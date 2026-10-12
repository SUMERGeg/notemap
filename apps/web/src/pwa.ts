// The dev server stays untouched; an installed app always uses the built version.
export function registerPwa() {
  if(!import.meta.env.PROD || !window.isSecureContext || !('serviceWorker' in navigator))return;
  window.addEventListener('load',()=>{
    const base=import.meta.env.BASE_URL;
    void navigator.serviceWorker.register(`${base}sw.js`,{scope:base,updateViaCache:'none'}).catch(()=>{
      // Installation helpers may be unavailable; the online app still works.
    });
  },{once:true});
}
