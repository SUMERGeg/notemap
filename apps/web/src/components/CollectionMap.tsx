import { useEffect,useRef,useState } from 'react';
import { loadYandexJs } from '../features/map/yandex-js';
import { groupPoints,NativeMapController,NativeMarker } from '../features/map/yandex-map';
import { markerIcon } from './Icon';
import '../features/map/yandex-native.css';

type Point={category:string;place:{longitude:number;latitude:number;title:string}};
export function CollectionMap({points}:{points:Point[]}){
 const container=useRef<HTMLDivElement>(null);const [error,setError]=useState(false);const [ready,setReady]=useState(false);const [retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!points.length||!container.current)return;
  let alive=true;let map:NativeMapController|undefined;let observer:ResizeObserver|undefined;const markers:NativeMarker[]=[];
  setError(false);setReady(false);
  const key=import.meta.env.VITE_YANDEX_JS_API_KEY?.trim()??'';
  void loadYandexJs(key).then(sdk=>{
   if(!alive||!container.current)return;
   const first=points[0].place;
   map=new NativeMapController(sdk,container.current,{longitude:first.longitude,latitude:first.latitude,zoom:13},{preview:true,ready:()=>{if(alive){setReady(true);setError(false);}},failed:()=>{if(alive)setError(true);}});
   const reference=first.longitude;
   const positions=points.map((point,index)=>({id:String(index),longitude:reference+((point.place.longitude-reference+540)%360)-180,latitude:point.place.latitude,category:point.category}));
   const frame=()=>{if(map)map.fitBounds(positions.map(point=>[point.longitude,point.latitude]),{maxZoom:15,duration:0,padding:{top:44,right:44,bottom:84,left:44}});};
   frame();
   for(const group of groupPoints(positions,map.getZoom())){
    const element=document.createElement('span');
    if(group.points.length>1){element.className='cluster-marker';element.textContent=String(group.points.length);}
    else{element.className='personal-marker';element.dataset.category=group.points[0].category;element.innerHTML=markerIcon(group.points[0].category);}
    markers.push(new NativeMarker({element}).setLngLat(group.position).addTo(map));
   }
   observer=new ResizeObserver(frame);observer.observe(container.current);
  }).catch(()=>{if(alive)setError(true);});
  return()=>{alive=false;observer?.disconnect();markers.forEach(marker=>marker.remove());map?.remove();};
 },[points,retry]);
 if(!points.length)return null;
 return <div className="collection-map collection-yandex-map" role="region" aria-label={`Карта подборки: ${points.length} мест`}><div ref={container} className="collection-map-canvas"/>{!ready&&!error&&<span className="collection-map-loading" role="status"><span className="spinner"/>Загружаем карту</span>}{error&&<div className="collection-map-failure"><span>Карта временно недоступна</span><button type="button" onClick={()=>setRetry(value=>value+1)}>Повторить</button></div>}</div>;
}
