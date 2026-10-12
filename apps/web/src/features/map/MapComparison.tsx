import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import * as maplibregl from 'maplibre-gl';
import 'leaflet/dist/leaflet.css';
import './comparison.css';
import { mobileMapStyle, rasterTileUrl } from './startup';
import { DEFAULT_VIEWPORT, readViewport, VIEWPORT_KEY, type Viewport } from './viewport';
import { createComparisonMetrics, type ComparisonMetrics } from './comparison-metrics';

type Engine='leaflet'|'maplibre';
const empty:ComparisonMetrics={firstTileMs:null,tiles:0,errors:0};
const comparisonStyle='osm-bright';
export default function MapComparison(){
  const host=useRef<HTMLDivElement>(null);
  const position=useRef<Viewport>({...DEFAULT_VIEWPORT});
  const [engine,setEngine]=useState<Engine>('leaflet');
  const [run,setRun]=useState(0);
  const [metrics,setMetrics]=useState<ComparisonMetrics>(empty);
  const [history,setHistory]=useState<Partial<Record<Engine,ComparisonMetrics>>>({});
  const [error,setError]=useState('');
  useEffect(()=>{try{position.current=readViewport(localStorage.getItem(VIEWPORT_KEY));}catch{/* Default remains usable. */}},[]);
  useEffect(()=>{
    if(!host.current)return;
    setMetrics(empty);setError('');
    const key=import.meta.env.VITE_GEOAPIFY_API_KEY?.trim();
    if(!key){setError('Не настроен ключ Geoapify.');return;}
    let drawn=false,frame=0;
    const measurement=createComparisonMetrics(value=>{
      setMetrics(value);
      if(value.firstTileMs!==null){drawn=true;setError('');setHistory(previous=>({...previous,[engine]:value}));}
    });
    const timer=window.setTimeout(()=>{if(!drawn)setError('Тайлы не появились за 15 секунд. Можно повторить или сменить движок.');},15000);
    const {longitude,latitude,zoom}=position.current;
    let remove:()=>void=()=>{};
    let resize:()=>void=()=>{};
    try{
      if(engine==='leaflet'){
        const map=L.map(host.current,{attributionControl:true,zoomControl:true,zoomSnap:0,maxZoom:18}).setView([latitude,longitude],zoom);
        remove=()=>map.remove();resize=()=>map.invalidateSize();
        const tiles=L.tileLayer(rasterTileUrl(key,comparisonStyle,'{z}/{x}/{y}',{highResolution:false}),{
          maxZoom:18,tileSize:256,detectRetina:false,updateWhenIdle:true,keepBuffer:1,
          attribution:'<a href="https://www.geoapify.com/">Geoapify</a> | <a href="https://openmaptiles.org/">© OpenMapTiles</a> | <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
        });
        tiles.on('tileload',()=>{measurement.tileLoaded();if(!frame)frame=requestAnimationFrame(()=>{frame=0;measurement.rendered();});});
        tiles.on('tileerror',measurement.tileFailed);tiles.addTo(map);
        map.on('moveend',()=>{const center=map.getCenter();position.current={longitude:center.lng,latitude:center.lat,zoom:map.getZoom()};});
      }else{
        const map=new maplibregl.Map({container:host.current,style:mobileMapStyle(key,comparisonStyle,undefined,{pixelRatio:1,highResolution:false}),pixelRatio:1,center:[longitude,latitude],zoom,maxZoom:18,attributionControl:false});
        remove=()=>map.remove();resize=()=>map.resize();
        map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-left');
        map.addControl(new maplibregl.AttributionControl({compact:false}));
        const loaded=new Set<string>();
        map.on('sourcedata',event=>{
          if(event.sourceId!=='geoapify'||event.tile?.state!=='loaded')return;
          const id=String(event.tile.tileID.key);
          if(!loaded.has(id)){loaded.add(id);measurement.tileLoaded();}
        });
        map.on('render',measurement.rendered);map.on('error',measurement.tileFailed);
        map.on('moveend',()=>{const center=map.getCenter();position.current={longitude:center.lng,latitude:center.lat,zoom:map.getZoom()};});
      }
    }catch{setError('Этот движок не запустился в браузере. Попробуй второй вариант.');}
    const observer=new ResizeObserver(()=>resize());observer.observe(host.current);
    return()=>{measurement.dispose();clearTimeout(timer);cancelAnimationFrame(frame);observer.disconnect();remove();};
  },[engine,run]);
  return <main className="map-comparison">
    <header><a href="#">← На мою карту</a><h1>Сравнение карт</h1><p>Светлая контрастная подложка, два движка. Личные данные не используются.</p></header>
    <div className="comparison-switch" aria-label="Движок карты">{(['leaflet','maplibre'] as const).map(value=><button key={value} aria-pressed={engine===value} onClick={()=>setEngine(value)}>{value==='leaflet'?'Leaflet':'MapLibre'}</button>)}</div>
    <section className="comparison-stats" aria-live="polite"><strong>{metrics.firstTileMs===null?'Загружаем…':`Первый участок: ${(metrics.firstTileMs/1000).toFixed(2)} с`}</strong><span>Тайлы: {metrics.tiles} · Ошибки: {metrics.errors}</span></section>
    <div className="comparison-map" ref={host} aria-label={`Карта ${engine==='leaflet'?'Leaflet':'MapLibre'}`}/>
    {error&&<p className="comparison-error" role="alert">{error}</p>}
    <div className="comparison-actions"><button onClick={()=>setRun(value=>value+1)}>Повторить замер</button><button onClick={()=>{position.current={...DEFAULT_VIEWPORT};setRun(value=>value+1);}}>Центр Москвы</button></div>
    <section className="comparison-results"><h2>Последние результаты</h2>{(['leaflet','maplibre'] as const).map(value=><p key={value}><strong>{value==='leaflet'?'Leaflet':'MapLibre'}</strong><span>{history[value]?.firstTileMs!=null?`${(history[value]!.firstTileMs!/1000).toFixed(2)} с`:'Ещё не измерено'}</span></p>)}</section>
    <p className="comparison-help">Подвигай карту и увеличь масштаб, затем переключи движок. Положение сохраняется только на этом экране. Обе карты используют тайлы 256 × 256 без Retina. Время отсчитывается от запуска карты до первого отображённого тайла; кеш браузера влияет на повторные замеры. Это тест подложки без личных маркеров, а не полный тест приложения.</p>
  </main>;
}
