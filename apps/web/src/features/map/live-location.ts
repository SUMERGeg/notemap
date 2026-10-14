export type LocationPoint={longitude:number;latitude:number;accuracy:number};
export function locationPoint(coords:GeolocationCoordinates):LocationPoint|null{
  const {longitude,latitude,accuracy}=coords;
  return Number.isFinite(longitude)&&Math.abs(longitude)<=180&&Number.isFinite(latitude)&&Math.abs(latitude)<=90&&Number.isFinite(accuracy)&&accuracy>=0?{longitude,latitude,accuracy}:null;
}
export function accuracyRadius(accuracy:number,latitude:number,zoom:number){
  const metersPerPixel=40075016.686*Math.max(.01,Math.cos(latitude*Math.PI/180))/(512*2**zoom);
  return Math.max(12,Math.min(150,accuracy/metersPerPixel));
}
export function watchLocation(geo:Geolocation,{changed,failed}:{changed:(point:LocationPoint)=>void;failed:(message:string,denied:boolean)=>void},visibility:Pick<Document,'hidden'|'addEventListener'|'removeEventListener'>=document){
  let disposed=false,id:number|undefined,generation=0;
  const stop=()=>{generation++;if(id!==undefined){geo.clearWatch(id);id=undefined;}};
  const start=()=>{
    if(disposed||visibility.hidden||id!==undefined)return;
    const current=++generation;
    try{id=geo.watchPosition(position=>{
      if(disposed||current!==generation)return;
      const point=locationPoint(position.coords);
      if(point)changed(point);else failed('GPS вернул некорректную точку. Поиск и ручное добавление доступны.',false);
    },error=>{
      if(disposed||current!==generation)return;
      const denied=error.code===1;if(denied)stop();
      failed(denied?'Доступ к геопозиции запрещён. Разреши его в настройках браузера или используй поиск.':'Не удалось обновить геопозицию. Ожидаем сигнал; поиск и ручная точка доступны.',denied);
    },{enableHighAccuracy:true,maximumAge:5000,timeout:15000});}
    catch{failed('Геопозиция недоступна. Используй поиск или ручную точку.',true);}
  };
  const visible=()=>{if(visibility.hidden)stop();else start();};
  visibility.addEventListener('visibilitychange',visible);start();
  return()=>{disposed=true;stop();visibility.removeEventListener('visibilitychange',visible);};
}
