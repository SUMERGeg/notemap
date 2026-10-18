import { describe,it,expect,vi } from 'vitest';
import { createShareHandler } from '../../../../supabase/functions/share-snapshot/handler';
const env={url:'https://test.supabase.co',serviceKey:'server-only',origins:['https://sumergeg.github.io']};
const request=(action:string,body:unknown={},authorization?:string)=>new Request('https://test.supabase.co/functions/v1/share-snapshot',{method:'POST',headers:{'x-share-action':action,'Content-Type':'application/json',...(authorization?{Authorization:authorization}:{})},body:JSON.stringify(body)});
describe('облачные снимки: доступ и очистка',()=>{
 it('не разрешает публикацию без сессии, очистку с браузерным ключом и чужой origin',async()=>{
   const fetcher=vi.fn(),handler=createShareHandler(env,fetcher);
   expect((await handler(request('publish'))).status).toBe(401);expect((await handler(request('cleanup',{},'Bearer public-key'))).status).toBe(401);
   expect((await handler(new Request('https://test.invalid',{method:'OPTIONS',headers:{Origin:'https://evil.invalid'}}))).status).toBe(403);expect(fetcher).not.toHaveBeenCalled();
 });
 it('отклоняет неизвестную или просроченную ссылку до чтения фото',async()=>{
   const fetcher=vi.fn(async(_url:string|URL|Request,_init?:RequestInit)=>new Response('[]'));const handler=createShareHandler(env,fetcher as typeof fetch);
   expect((await handler(request('read',{token:'a'.repeat(43)}))).status).toBe(410);expect(fetcher).toHaveBeenCalledOnce();
   expect(fetcher.mock.calls[0][0]).toContain('expires_at=gt.');expect(fetcher.mock.calls[0][0]).not.toContain('a'.repeat(43));
 });
 it('сначала удаляет байты через Storage API и только затем метаданные',async()=>{
   const id='11111111-1111-4111-8111-111111111111';const calls:string[]=[];
   const fetcher=vi.fn(async(url:string|URL|Request)=>{calls.push(String(url));return new Response(calls.length===1?JSON.stringify([{id}]):'{}');});
   const response=await createShareHandler(env,fetcher as typeof fetch)(request('cleanup',{},'Bearer server-only'));
   expect(response.status).toBe(200);expect(calls[1]).toContain('/storage/v1/object/notemap-shares');expect(calls[2]).toContain(`/rest/v1/notemap_shares?id=eq.${id}`);
 });
 it('не теряет запись об объекте, если Storage не смог его удалить',async()=>{
   const fetcher=vi.fn(async()=>new Response(fetcher.mock.calls.length===1?'[{"id":"11111111-1111-4111-8111-111111111111"}]':'{}',{status:fetcher.mock.calls.length===1?200:503}));
   await createShareHandler(env,fetcher as typeof fetch)(request('cleanup',{},'Bearer server-only'));expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('берёт владельца из проверенной сессии, выдаёт случайную ссылку и не перезаписывает архив',async()=>{
   const owner='11111111-1111-4111-8111-111111111111';const calls:{url:string;init?:RequestInit}[]=[];
   const fetcher=vi.fn(async(url:string|URL|Request,init?:RequestInit)=>{
     calls.push({url:String(url),init});
     if(String(url).endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:owner}));
     if(String(url).endsWith('/rpc/notemap_reserve_share'))return new Response('{"expires_at":"2099-10-25T00:00:00Z"}');
     return new Response('{}');
   });
   const response=await createShareHandler(env,fetcher as typeof fetch)(request('publish',{format:'notemap-snapshot',schema_version:1,payload:{kind:'collection',items:[]},owner_id:'attacker'},'Bearer verified-user'));
   expect(response.status).toBe(201);const result=await response.json();expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
   const reserve=JSON.parse(calls[1].init!.body as string);expect(reserve._owner_id).toBe(owner);expect(reserve._token_hash).not.toBe(result.token);expect(reserve._token_hash).toHaveLength(64);
   expect(calls[2].init!.headers).toMatchObject({'x-upsert':'false'});expect(calls[3].init!.method).toBe('PATCH');
 });
});
