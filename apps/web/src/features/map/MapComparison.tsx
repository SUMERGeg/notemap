import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import './comparison.css';
import { mobileMapStyle } from './startup';
import { yandexMapStyle } from './yandex-style';
import { DEFAULT_VIEWPORT, readViewport, VIEWPORT_KEY, type Viewport } from './viewport';
import { createComparisonMetrics, type ComparisonMetrics } from './comparison-metrics';
import { YandexVectorMap, type VectorStatus } from './YandexVectorMap';

type Engine='vector'|'yandex'|'geoapify';
const providers=['vector','yandex','geoapify'] as const;
const providerName=(value:Engine)=>value==='vector'?'Яндекс вектор':value==='yandex'?'Яндекс тайлы':'Geoapify';
const empty:ComparisonMetrics={firstTileMs:null,tiles:0,errors:0};
const comparisonStyle='osm-bright';
export default function MapComparison(){
  const host=useRef<HTMLDivElement>(null);
  const position=useRef<Viewport>({...DEFAULT_VIEWPORT});
  const [engine,setEngine]=useState<Engine>('vector');
  const [run,setRun]=useState(0);
  const [metrics,setMetrics]=useState<ComparisonMetrics>(empty);
  const [history,setHistory]=useState<Partial<Record<Engine,ComparisonMetrics>>>({});
  const [error,setError]=useState('');
  const [vectorStatus,setVectorStatus]=useState<VectorStatus>({ready:false,tiles:0,error:''});
  useEffect(()=>{try{position.current=readViewport(localStorage.getItem(VIEWPORT_KEY));}catch{/* Default remains usable. */}},[]);
  useEffect(()=>{
    if(engine==='vector'||!host.current)return;
    setMetrics(empty);setError('');
    const key=(engine==='yandex'?import.meta.env.VITE_YANDEX_MAPS_API_KEY:import.meta.env.VITE_GEOAPIFY_API_KEY)?.trim();
    if(!key){setError(`Не настроен ключ ${providerName(engine)}.`);return;}
    let drawn=false;
    const measurement=createComparisonMetrics(value=>{
      setMetrics(value);
      if(value.firstTileMs!==null){drawn=true;setError('');setHistory(previous=>({...previous,[engine]:value}));}
    });
    const timer=window.setTimeout(()=>{if(!drawn)setError('Тайлы не появились за 15 секунд. Можно повторить или сменить подложку.');},15000);
    const {longitude,latitude,zoom}=position.current;
    let remove:()=>void=()=>{};
    let resize:()=>void=()=>{};
    try{
        const sourceId=engine==='yandex'?'yandex':'geoapify';
        const map=new maplibregl.Map({container:host.current,style:engine==='yandex'?yandexMapStyle(key):mobileMapStyle(key,comparisonStyle,undefined,{pixelRatio:1,highResolution:false}),pixelRatio:1,center:[longitude,latitude],zoom,maxZoom:18,attributionControl:false});
        remove=()=>map.remove();resize=()=>map.resize();
        map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-left');
        map.addControl(new maplibregl.AttributionControl({compact:false}));
        const loaded=new Set<string>();
        map.on('sourcedata',event=>{
          if(event.sourceId!==sourceId||event.tile?.state!=='loaded')return;
          const id=String(event.tile.tileID.key);
          if(!loaded.has(id)){loaded.add(id);measurement.tileLoaded();}
        });
        map.on('render',measurement.rendered);map.on('error',()=>{
          measurement.tileFailed();
          if(!drawn)setError(engine==='yandex'?'Яндекс не отдаёт тайлы. Проверь ключ Tiles API, активацию и разрешённый домен.':'Geoapify не отдаёт тайлы. Можно повторить или сменить подложку.');
        });
        map.on('moveend',()=>{const center=map.getCenter();position.current={longitude:center.lng,latitude:center.lat,zoom:map.getZoom()};});
    }catch{setError('Этот движок не запустился в браузере. Попробуй второй вариант.');}
    const observer=new ResizeObserver(()=>resize());observer.observe(host.current);
    return()=>{measurement.dispose();clearTimeout(timer);observer.disconnect();remove();};
  },[engine,run]);
  return <main className="map-comparison">
    <header><a href="#">← На мою карту</a><h1>Сравнение подложек</h1><p>Векторный Яндекс JS API и растровые подложки в MapLibre. Личные слои не загружаются.</p></header>
    <div className="comparison-switch" aria-label="Подложка карты">{providers.map(value=><button key={value} aria-pressed={engine===value} onClick={()=>setEngine(value)}>{providerName(value)}</button>)}</div>
    <section className="comparison-stats" aria-live="polite">{engine==='vector'?<><strong>{vectorStatus.ready?'Векторная карта готова':vectorStatus.error?'Карта недоступна':'Загружаем векторную карту…'}</strong><span>Готовые тайлы: {vectorStatus.tiles}</span></>:<><strong>{metrics.firstTileMs===null?'Загружаем…':`Первый участок: ${(metrics.firstTileMs/1000).toFixed(2)} с`}</strong><span>Тайлы: {metrics.tiles} · Ошибки: {metrics.errors}</span></>}</section>
    {engine==='vector'?<YandexVectorMap run={run} position={position.current} onMove={next=>{position.current=next;}} onStatus={setVectorStatus}/>:<div className="comparison-map-wrap"><div className="comparison-map" ref={host} aria-label={`Карта ${providerName(engine)}`}/>{engine==='yandex'&&<><a className="yandex-logo" href="https://yandex.ru/maps/" target="_blank" rel="noopener noreferrer"><img src={`${import.meta.env.BASE_URL}maps/yandex-logo-ru.svg`} alt="Яндекс Карты"/></a><a className="yandex-open" href="https://yandex.ru/maps/" target="_blank" rel="noopener noreferrer">Открыть в Картах</a></>}</div>}
    {(engine==='vector'?vectorStatus.error:error)&&<p className="comparison-error" role="alert">{engine==='vector'?vectorStatus.error:error}</p>}
    <div className="comparison-actions"><button onClick={()=>setRun(value=>value+1)}>{engine==='vector'?'Повторить загрузку':'Повторить замер'}</button><button onClick={()=>{position.current={...DEFAULT_VIEWPORT};setRun(value=>value+1);}}>Центр Москвы</button></div>
    <section className="comparison-results"><h2>Последние результаты</h2>{providers.filter(value=>value!=='vector').map(value=><p key={value}><strong>{providerName(value)}</strong><span>{history[value]?.firstTileMs!=null?`${(history[value]!.firstTileMs!/1000).toFixed(2)} с`:'Ещё не измерено'}</span></p>)}</section>
    <p className="comparison-help">Переключай варианты после перемещения и увеличения карты. Область передаётся между ними только на этом экране. В векторном варианте нажми «Повернуть 45°» или поверни карту двумя пальцами: сравни поведение подписей организаций и улиц. Улицы могут подписываться вдоль дороги. Векторные данные загружаются отдельно от приложения и требуют сети.</p>
    <p className="comparison-help">Замеры времени ниже относятся только к растровым подложкам MapLibre 256 × 256 без Retina: от запуска до первого отображённого тайла. Векторный SDK показывает готовность тайлов, без сравнения этих разных показателей. Кеш браузера влияет на повторные загрузки.</p>
  </main>;
}
