import { defineConfig, loadEnv, type Plugin, type ResolvedConfig } from 'vite';

function offlineShell():Plugin {
  let config:ResolvedConfig;
  return {
    name:'notemap-offline-shell',apply:'build',
    configResolved(resolved){config=resolved;},
    async writeBundle(output){
      // Node built-ins are loaded at build time; the browser project needs no
      // Node typings or additional runtime dependency for this plugin.
      const fsModule='node:fs/promises',pathModule='node:path',cryptoModule='node:crypto';
      const {readFile,readdir,writeFile}=await import(fsModule);
      const {resolve}=await import(pathModule);
      const {createHash}=await import(cryptoModule);
      const dir=resolve(config.root,output.dir??config.build.outDir);
      const files=['index.html'];
      for(const folder of ['assets','icons']){
        for(const entry of await readdir(resolve(dir,folder),{withFileTypes:true})){
          if(entry.isFile() && (folder==='icons'?/\.(png|svg|ico)$/:/\.(js|css)$/).test(entry.name))files.push(`${folder}/${entry.name}`);
        }
      }
      files.sort();
      const digest=createHash('sha256');
      for(const file of files){digest.update(file);digest.update(await readFile(resolve(dir,file)));}
      // Cache the entry HTML at its app URL (also served by the LAN gateway).
      const precache=[config.base,...files.filter(file=>file!=='index.html').map(file=>`${config.base}${file}`)];
      const source=await readFile(resolve(config.root,'public/sw.js'),'utf8');
      await writeFile(resolve(dir,'sw.js'),source
        .replace("/*__NOTEMAP_BASE__*/ '/'",JSON.stringify(config.base))
        .replace('/*__NOTEMAP_PRECACHE__*/ []',JSON.stringify(precache))
        .replace("/*__NOTEMAP_CACHE__*/ 'notemap-shell-unbuilt'",JSON.stringify(`notemap-shell-${config.base}-${digest.digest('hex').slice(0,16)}`)));
    },
  };
}

export default defineConfig(({mode})=>{
  const env=loadEnv(mode,'.','NOTEMAP_');
  const path=env.NOTEMAP_BASE_PATH??'/';
  if(!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(path))throw new Error('NOTEMAP_BASE_PATH must be / or a path such as /notemap/.');
  return {
    base:path,
    plugins:[offlineShell()],
    worker: { format: 'es' },
    server: { proxy: { '/api': env.NOTEMAP_API_PROXY ?? 'http://127.0.0.1:8000' } },
  };
});
