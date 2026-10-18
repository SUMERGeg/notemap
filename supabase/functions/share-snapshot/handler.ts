export type ShareEnv={url:string;serviceKey:string;origins:string[]};
const LIMIT=40*1024*1024;
const tokenPattern=/^[A-Za-z0-9_-]{43}$/;
const json=(body:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
export async function readLimited(request:Request,limit=LIMIT){
 if(Number(request.headers.get('content-length'))>limit)throw new Error('too_large');
 const reader=request.body?.getReader();if(!reader)throw new Error('empty');let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new Error('too_large');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}
export async function tokenHash(token:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function createShareHandler(env:ShareEnv,fetcher:typeof fetch=fetch){
 const serverHeaders={apikey:env.serviceKey,Authorization:`Bearer ${env.serviceKey}`,'Content-Type':'application/json'};
 const api=(path:string,init:RequestInit={})=>fetcher(`${env.url}${path}`,{...init,headers:{...serverHeaders,...init.headers},signal:AbortSignal.timeout(25000)});
 return async(request:Request):Promise<Response>=>{
   const origin=request.headers.get('origin');
   if(origin&&!env.origins.includes(origin))return json({error:'Источник запроса не разрешён.'},403);
   const cors:Record<string,string>=origin?{'Access-Control-Allow-Origin':origin,Vary:'Origin'}:{};
   const respond=(body:unknown,status=200)=>json(body,status,cors);
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-share-action','Access-Control-Max-Age':'600'}});
   if(request.method!=='POST')return respond({error:'Метод не поддерживается.'},405);
   const action=request.headers.get('x-share-action');
   try{
     if(action==='cleanup'){
       if(request.headers.get('authorization')!==`Bearer ${env.serviceKey}`){
         const token=request.headers.get('x-notemap-cleanup');
         if(!token||!/^[0-9a-f]{64}$/.test(token))return respond({error:'Нет доступа.'},401);
         const permission=await api('/rest/v1/rpc/notemap_cleanup_authorized',{method:'POST',body:JSON.stringify({_token:token})});
         if(!permission.ok||await permission.json()!==true)return respond({error:'Нет доступа.'},401);
       }
       const now=new Date().toISOString(),stale=new Date(Date.now()-3600000).toISOString();
       const response=await api(`/rest/v1/notemap_shares?select=id&or=(expires_at.lte.${now},and(ready.eq.false,created_at.lte.${stale}))&limit=100`);
       if(!response.ok)throw new Error('cleanup');
       const rows=await response.json() as {id:string}[];let removed=0;
       for(const row of rows){
         if(!/^[0-9a-f-]{36}$/.test(row.id))throw new Error('record');
         // Storage API must delete the actual bytes before metadata is removed.
         const deletion=await api('/storage/v1/object/notemap-shares',{method:'DELETE',body:JSON.stringify({prefixes:[`${row.id}.json`]})});
         if(!deletion.ok)continue;
         const record=await api(`/rest/v1/notemap_shares?id=eq.${row.id}`,{method:'DELETE'});if(record.ok)removed++;
       }
       return respond({removed,checked:rows.length});
     }
     if(action==='read'){
       const raw=await readLimited(request,1024);
       const {token}=JSON.parse(new TextDecoder().decode(raw));if(typeof token!=='string'||!tokenPattern.test(token))return respond({error:'Неверная ссылка.'},400);
       const hash=await tokenHash(token),now=new Date().toISOString();
       const metadata=await api(`/rest/v1/notemap_shares?select=id,expires_at&token_hash=eq.${hash}&ready=eq.true&expires_at=gt.${now}&limit=1`);
       if(!metadata.ok)throw new Error('read');const rows=await metadata.json() as {id:string;expires_at:string}[];
       if(!rows.length)return respond({error:'Ссылка недоступна или срок 7 дней истёк.'},410);
       const object=await api(`/storage/v1/object/authenticated/notemap-shares/${rows[0].id}.json`);
       if(!object.ok)throw new Error('object');
       return new Response(object.body,{headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Share-Expires':rows[0].expires_at,'Access-Control-Expose-Headers':'X-Share-Expires'}});
     }
     if(action!=='publish')return respond({error:'Неизвестное действие.'},400);
     const authorization=request.headers.get('authorization');if(!authorization?.startsWith('Bearer '))return respond({error:'Нужно разрешить публикацию.'},401);
     const userResponse=await api('/auth/v1/user',{headers:{Authorization:authorization}});
     if(!userResponse.ok)return respond({error:'Сессия публикации истекла. Повтори попытку.'},401);
     const user=await userResponse.json() as {id:string};if(!/^[0-9a-f-]{36}$/.test(user.id))return respond({error:'Нет доступа.'},401);
     const bytes=await readLimited(request);let archive;
     try{archive=JSON.parse(new TextDecoder().decode(bytes));}catch{return respond({error:'Неверный архив.'},400);}
     if(archive?.format!=='notemap-snapshot'||archive.schema_version!==1||archive.payload?.kind!=='collection'||!Array.isArray(archive.payload?.items)||archive.payload.items.length>1000)return respond({error:'Неверный архив коллекции.'},400);
     const id=crypto.randomUUID(),token=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
     const reserve=await api('/rest/v1/rpc/notemap_reserve_share',{method:'POST',body:JSON.stringify({_id:id,_owner_id:user.id,_token_hash:await tokenHash(token),_size_bytes:bytes.byteLength})});
     if(!reserve.ok)return respond({error:'Достигнут лимит публикаций или место в бесплатном хранилище закончилось. Попробуй позже.'},429);
     const record=await reserve.json() as {expires_at:string};
     const upload=await api(`/storage/v1/object/notemap-shares/${id}.json`,{method:'POST',headers:{'Content-Type':'application/json','Cache-Control':'no-store','x-upsert':'false'},body:bytes});
     if(!upload.ok)throw new Error('upload');
     const complete=await api(`/rest/v1/notemap_shares?id=eq.${id}&ready=eq.false`,{method:'PATCH',body:JSON.stringify({ready:true})});if(!complete.ok)throw new Error('complete');
     return respond({token,expires_at:record.expires_at},201);
   }catch(error){
     if(error instanceof Error&&error.message==='too_large')return respond({error:'Слишком большой запрос. Коллекцию с фото до 40 МБ можно опубликовать целиком; более крупную раздели на несколько подборок.'},413);
     // Never log request bodies, tokens, notes, images or provider responses.
     return respond({error:'Хранилище временно недоступно. Попробуй позже.'},503);
   }
 };
}
