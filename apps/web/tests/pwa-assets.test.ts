import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { resolveConfig } from 'vite';

const shell=['/notemap/','/notemap/index.html','/notemap/assets/app-abc.js','/notemap/assets/map-worker-abc.js','/notemap/assets/app-abc.css','/notemap/icons/icon-192.png'];
function worker(){
  const source=readFileSync('public/sw.js','utf8')
    .replace("/*__NOTEMAP_BASE__*/ '/'",JSON.stringify('/notemap/'))
    .replace('/*__NOTEMAP_PRECACHE__*/ []',JSON.stringify(shell));
  const handlers:Record<string,(event:any)=>void>={};
  const entries=new Map<string,string>();
  const cache={addAll:async(paths:string[])=>{for(const path of paths)entries.set(path,`cached:${path}`);},match:async(path:string)=>entries.get(path)};
  const caches={open:async()=>cache,keys:async()=>['notemap-shell-/notemap/-oldest','notemap-shell-/notemap/-previous','notemap-shell-/-other'],delete:vi.fn().mockResolvedValue(true)};
  const network=vi.fn().mockRejectedValue(new Error('offline'));
  const clients={claim:vi.fn().mockResolvedValue(undefined)};
  runInNewContext(source,{URL,AbortController,setTimeout,clearTimeout,self:{location:{origin:'https://notemap.test'},clients,addEventListener:(type:string,fn:(event:any)=>void)=>handlers[type]=fn},fetch:network,caches});
  return {handlers,entries,caches,network,clients};
}
describe('installable offline app shell',()=>{
  it('uses relative manifest paths at root or a repository subpath',()=>{
    const manifest=JSON.parse(readFileSync('public/manifest.webmanifest','utf8'));
    expect(manifest.start_url).toBe('./');expect(manifest.scope).toBe('./');expect(manifest.display).toBe('standalone');
    for(const size of ['192x192','512x512'])expect(manifest.icons.some((icon:{sizes:string})=>icon.sizes===size)).toBe(true);
    for(const icon of manifest.icons){const bytes=readFileSync(`public/${icon.src}`);expect(bytes.subarray(1,4).toString()).toBe('PNG');}
    const html=readFileSync('index.html','utf8');expect(html).toContain('%BASE_URL%manifest.webmanifest');expect(html).toContain('viewport-fit=cover');
  });
  it('preloads shell, scripts, CSS and map worker, then opens the real app offline',async()=>{
    const {handlers,entries,network}=worker();let installed:Promise<unknown>|undefined;
    handlers.install({waitUntil:(promise:Promise<unknown>)=>installed=promise});await installed;
    expect([...entries.keys()]).toEqual(shell);
    for(const [path,mode] of [['/notemap/#share=example','navigate'],['/notemap/assets/map-worker-abc.js','cors'],['/notemap/assets/app-abc.css','cors']]){
      let result:Promise<string>|undefined;
      handlers.fetch({request:{url:`https://notemap.test${path}`,method:'GET',mode},respondWith:(promise:Promise<string>)=>result=promise});
      await expect(result).resolves.toBe(`cached:${mode==='navigate'?'/notemap/':path}`);
    }
    expect(network).toHaveBeenCalledOnce();
  });
  it('leaves provider data, private paths and token queries outside the shell cache',()=>{
    const {handlers}=worker();
    for(const path of ['/api/v1/shares/preview','/notemap/api/v1/notes','/storage/notemap-photos/photos/a','/notemap/photos/a','/notemap/map-tiles/a','/notemap/shared-file.json','/notemap/assets/app-abc.js?token=private']){
      const respondWith=vi.fn();handlers.fetch({request:{url:`https://notemap.test${path}`,method:'GET',mode:'navigate'},respondWith});expect(respondWith).not.toHaveBeenCalled();
    }
    const respondWith=vi.fn();handlers.fetch({request:{url:'https://maps.geoapify.com/tile',method:'GET',mode:'cors'},respondWith});expect(respondWith).not.toHaveBeenCalled();
  });
  it('upgrades only caches for this base and never deletes browser data',async()=>{
    const {handlers,caches,clients}=worker();let activated:Promise<unknown>|undefined;
    handlers.activate({waitUntil:(promise:Promise<unknown>)=>activated=promise});await activated;
    expect(caches.delete).toHaveBeenCalledExactlyOnceWith('notemap-shell-/notemap/-oldest');expect(clients.claim).toHaveBeenCalledOnce();
  });
  it('generates the shell allowlist from built files at either base and versions content updates',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'notemap-shell-'));
    try{
      await mkdir(join(dir,'assets'));await mkdir(join(dir,'icons')); // No optional maps directory after removing comparison assets.
      await writeFile(join(dir,'index.html'),'<div id="root"></div>');
      for(const file of ['app-abc.js','map-worker-abc.js','app-abc.css','private.json'])await writeFile(join(dir,'assets',file),'original');
      await writeFile(join(dir,'icons','icon-192.png'),'icon');
      for(const base of ['/','/notemap/']){
        const config=await resolveConfig({base},'build','test');
        const plugin=config.plugins.find(plugin=>plugin.name==='notemap-offline-shell')!;
        const hook=typeof plugin.writeBundle==='function'?plugin.writeBundle:plugin.writeBundle!.handler;
        await hook.call({} as never,{dir} as never,{});
        const source=readFileSync(join(dir,'sw.js'),'utf8');
        const built=runInNewContext(source+';({BASE,PRECACHE,CACHE})',{self:{addEventListener(){}}});
        expect(built.BASE).toBe(base);
        expect(built.PRECACHE).toEqual([base,`${base}assets/app-abc.css`,`${base}assets/app-abc.js`,`${base}assets/map-worker-abc.js`,`${base}icons/icon-192.png`]);
        await writeFile(join(dir,'assets','app-abc.js'),`updated-${base}`);
        await hook.call({} as never,{dir} as never,{});
        expect(readFileSync(join(dir,'sw.js'),'utf8')).not.toContain(built.CACHE);
      }
    }finally{
      expect(dirname(resolve(dir))).toBe(resolve(tmpdir()));expect(basename(dir)).toMatch(/^notemap-shell-/);
      await rm(dir,{recursive:true,force:true});
    }
  });
});
