import { describe, expect, it, vi } from 'vitest';
import source from '../public/sw.js?raw';

function worker(fetcher:()=>Promise<Response>){
  const handlers:Record<string,(event:any)=>void>={};
  const cached=new Response('<html>offline shell</html>',{headers:{'Content-Type':'text/html'}});
  const cache={match:vi.fn(async()=>cached),addAll:vi.fn()};
  const caches={open:vi.fn(async()=>cache),keys:vi.fn(async()=>['notemap-shell-/-old','notemap-shell-unbuilt']),delete:vi.fn()};
  const self={location:{origin:'https://example.test'},clients:{claim:vi.fn()},skipWaiting:vi.fn(),addEventListener:(type:string,fn:(event:any)=>void)=>{handlers[type]=fn;}};
  new Function('self','caches','fetch','URL',source)(self,caches,fetcher,URL);
  return {handlers,self,caches,cache};
}
describe('обновление оболочки PWA',()=>{
  it('получает свежий HTML онлайн, сохраняя офлайн запуск при ошибке сети',async()=>{
    const online=worker(async()=>new Response('<html>new shell</html>',{headers:{'Content-Type':'text/html'}}));
    let response:Promise<Response>|undefined;
    const event={request:{method:'GET',url:'https://example.test/',mode:'navigate'},respondWith:(value:Promise<Response>)=>{response=value;}};
    online.handlers.fetch(event);expect(await (await response!).text()).toContain('new shell');
    const offline=worker(async()=>{throw new Error('offline');});
    offline.handlers.fetch(event);expect(await (await response!).text()).toContain('offline shell');
  });
  it('не активирует обновление без явной команды и не перехватывает внешние данные',()=>{
    const state=worker(async()=>new Response());
    state.handlers.message({data:{type:'unrelated'}});expect(state.self.skipWaiting).not.toHaveBeenCalled();
    state.handlers.message({data:{type:'NOTEMAP_ACTIVATE_UPDATE'},waitUntil:vi.fn()});expect(state.self.skipWaiting).toHaveBeenCalledOnce();
    const respondWith=vi.fn();state.handlers.fetch({request:{method:'GET',url:'https://other.test/private',mode:'cors'},respondWith});expect(respondWith).not.toHaveBeenCalled();
  });
});
