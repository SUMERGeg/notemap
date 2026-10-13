// The dev server stays untouched; an installed app always uses the built version.
export function registerPwa() {
  if(!import.meta.env.PROD || !window.isSecureContext || !('serviceWorker' in navigator))return;
  window.addEventListener('load',()=>{
    const base=import.meta.env.BASE_URL;
    void navigator.serviceWorker.register(`${base}sw.js`,{scope:base,updateViaCache:'none'}).then(registration=>{
      const announce=()=>{if(registration.waiting)window.dispatchEvent(new Event('notemap-update-ready'));};
      announce();registration.addEventListener('updatefound',()=>{
        registration.installing?.addEventListener('statechange',announce);
      });
    }).catch(()=>{
      // Installation helpers may be unavailable; the online app still works.
    });
  },{once:true});
}

export async function checkPwaUpdate(){
  if(!import.meta.env.PROD||!('serviceWorker' in navigator))throw new Error('Проверка обновлений доступна на опубликованном сайте.');
  const registration=await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  if(!registration)throw new Error('Обновление ещё не готово. Открой приложение с интернетом и повтори проверку.');
  await registration.update();
  if(registration.waiting)return 'ready';
  return registration.installing?'downloading':'current';
}
export async function applyPwaUpdate(){
  const registration=await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  if(!registration?.waiting)throw new Error('Новая версия ещё не загружена. Повтори проверку.');
  return new Promise<void>((resolve,reject)=>{
    const changed=()=>{clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',changed);resolve();location.reload();};
    const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',changed);reject(new Error('Обновление заняло слишком много времени. Закрой приложение и открой снова.'));},15000);
    navigator.serviceWorker.addEventListener('controllerchange',changed);
    registration.waiting!.postMessage({type:'NOTEMAP_ACTIVATE_UPDATE'});
  });
}
