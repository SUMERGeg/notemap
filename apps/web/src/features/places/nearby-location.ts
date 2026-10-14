import { locationPoint, type LocationPoint } from '../map/live-location';
export function locateNearby(geo:Geolocation|undefined,signal:AbortSignal):Promise<LocationPoint>{
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(signal.reason);return;}
    if(!geo){reject(new Error('GPS недоступен. Выбери «Вокруг карты» или найди место по названию.'));return;}
    let finished=false;
    const done=(point:LocationPoint|null,error?:unknown)=>{if(finished)return;finished=true;clearTimeout(timer);signal.removeEventListener('abort',abort);if(point)resolve(point);else reject(error);};
    const abort=()=>done(null,signal.reason);
    const timer=setTimeout(()=>done(null,new Error('GPS не ответил. Используй поиск вокруг карты.')),12000);
    signal.addEventListener('abort',abort,{once:true});
    try{geo.getCurrentPosition(position=>{
      const point=locationPoint(position.coords);
      if(!point||point.accuracy>500||!Number.isFinite(position.timestamp)||Math.abs(Date.now()-position.timestamp)>30000){done(null,new Error('Геопозиция слишком неточная или устарела. Выбери область на карте.'));return;}
      done(point);
    },()=>done(null,new Error('Не удалось определить геопозицию. Разреши GPS или выбери «Вокруг карты».')),{enableHighAccuracy:true,maximumAge:5000,timeout:10000});}
    catch{done(null,new Error('Геопозиция недоступна. Используй поиск вокруг карты.'));}
  });
}
