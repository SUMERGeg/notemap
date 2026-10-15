import { Icon, type IconName } from '../../components/Icon';
import { installClusteredMarkers } from './clustered-markers';
import { mapPickHint } from './map-pick';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DEFAULT_VIEWPORT, readViewport, VIEWPORT_KEY, type Viewport } from './viewport';
import { searchPlaces, type PlaceCandidate, type SearchMode } from '../places/geoapify';
import { NotesPanel, type PersonalNote } from '../notes/NotesPanel';
import { categoryData, MiniMap, placesCount } from '../../components/PlaceVisuals';
import type { ImportedLayer, ImportedSelection } from '../notes/import-api';
import { ImportedPlacePanel } from '../notes/ImportedCollectionsPanel';
import { createMapStartup, getMapRenderPreferences } from './startup';
import { yandexMapStyle } from './yandex-style';
import './yandex-main.css';
import { watchLocation, accuracyRadius, type LocationPoint } from './live-location';
import './live-location.css';
import { HomeSheetHandle } from './HomeSheetHandle';
import './home-sheet.css';

const key = import.meta.env.VITE_GEOAPIFY_API_KEY?.trim() ?? '';
const mapKey=import.meta.env.VITE_YANDEX_MAPS_API_KEY?.trim()??'';
// Vite prebundles the main module; bundle the module worker explicitly as well.
maplibregl.setWorkerUrl(workerUrl);
function initialViewport(): Viewport {
  try { return readViewport(localStorage.getItem(VIEWPORT_KEY)); } catch { return DEFAULT_VIEWPORT; }
}

export function MapScreen() {
  const container = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const popup = useRef<maplibregl.Popup|null>(null);
  const searchOverlay = useRef<HTMLDivElement>(null);
  const searchSettings = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const controller = useRef<AbortController | null>(null);
  const requestNumber = useRef(0);
  const alive = useRef(true);
  const [tracking,setTracking]=useState(false);
  const [gpsPrompt,setGpsPrompt]=useState(false);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [retry, setRetry] = useState(0);
  const [recovering, setRecovering] = useState(false);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('организация');
  const [results, setResults] = useState<PlaceCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [manual, setManual] = useState(false);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<PlaceCandidate | null>(null);
  const [gpsError, setGpsError] = useState('');
  const [gps, setGps] = useState<LocationPoint|null>(null);
  const [locating, setLocating] = useState(false);
  useEffect(()=>{
    if(!gpsError)return;
    const timeout=window.setTimeout(()=>setGpsError(''),4500);
    return()=>window.clearTimeout(timeout);
  },[gpsError]);
  useEffect(()=>{
    if(!tracking||!navigator.geolocation)return;
    return watchLocation(navigator.geolocation,{
      changed:point=>{setGps(point);setLocating(false);setGpsError('');},
      failed:(message,denied)=>{setLocating(false);setGpsError(message);if(denied){setTracking(false);setGps(null);setGpsPrompt(false);}},
    });
  },[tracking]);
  useEffect(()=>{
    const instance=map.current;if(!ready||!instance||!gps)return;
    const element=document.createElement('div');element.className='live-location';element.setAttribute('role','img');element.setAttribute('aria-label',`Текущая геопозиция, точность около ${Math.round(gps.accuracy)} м`);
    const halo=document.createElement('span');halo.className='live-location-halo';
    const dot=document.createElement('span');dot.className='live-location-dot';element.append(halo,dot);
    const gpsMarker=new maplibregl.Marker({element,anchor:'center'}).setLngLat([gps.longitude,gps.latitude]).addTo(instance);
    const resize=()=>{const diameter=accuracyRadius(gps.accuracy,gps.latitude,instance.getZoom())*2;halo.style.width=`${diameter}px`;halo.style.height=`${diameter}px`;};
    resize();instance.on('zoom',resize);
    return()=>{instance.off('zoom',resize);gpsMarker.remove();};
  },[ready,retry,gps]);
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [listMode, setListMode] = useState<'all' | 'ranked' | 'items'>('ranked');
  const [activeNote, setActiveNote] = useState<PersonalNote | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [sheetCompact, setSheetCompact] = useState(false);
  const [sheetDragOffset,setSheetDragOffset] = useState<number|null>(null);
  const initialImportId = /^#import=([0-9a-f-]{36})$/i.exec(window.location.hash)?.[1]??null;
  const [view, setView] = useState<'map' | 'list' | 'profile' | 'collections'>(initialImportId?'collections':'map');
  const [importedLayers,setImportedLayers] = useState<ImportedLayer[]>([]);
  const [importedSelection,setImportedSelection] = useState<ImportedSelection|null>(null);
  const [searchOptions, setSearchOptions] = useState(false);
  const [presetCategory, setPresetCategory] = useState<string | null>(null);
  const [bounds, setBounds] = useState<string | null>(null);
  const [previewPlace,setPreviewPlace] = useState<PlaceCandidate|null>(null);
  const [popupElement,setPopupElement] = useState<HTMLElement|null>(null);
  const [panelHeight,setPanelHeight] = useState(0);
  const homeSheet=view==='map'&&!selected&&!manual&&!importedSelection&&results.length===0;
  const sheetTravel=panelHeight;
  const sheetOffset=homeSheet?(sheetDragOffset??(sheetCompact?sheetTravel:0)):0;
  const visiblePanelHeight=homeSheet?Math.max(0,panelHeight-sheetOffset):panelHeight;
  useEffect(()=>{
    if(!panel.current)return;
    const observer=new ResizeObserver(entries=>setPanelHeight(entries[0].target.getBoundingClientRect().height));
    observer.observe(panel.current);
    return()=>observer.disconnect();
  },[]);
  function clearPreview(){setPreviewPlace(null);setPopupElement(null);popup.current?.remove();popup.current=null;}
  useEffect(()=>{
    if(!ready||!map.current||manual||selected||importedSelection||results.length||view!=='map'||sheetDragOffset!==null)return;
    const update=()=>{
      const mobile=window.matchMedia('(max-width:700px)').matches;
      const navigation=document.querySelector('.bottom-nav')?.getBoundingClientRect().height??78;
      map.current?.setPadding({top:mobile?94:0,bottom:mobile?(panelOpen?visiblePanelHeight:0)+navigation:0,left:0,right:0});
    };
    update(); window.addEventListener('resize',update);
    return()=>window.removeEventListener('resize',update);
  },[ready,manual,selected,importedSelection,results.length,view,panelOpen,visiblePanelHeight,sheetDragOffset]);
  useEffect(()=>{
    if(!searchOptions)return;
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!searchOverlay.current?.contains(event.target))setSearchOptions(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setSearchOptions(false);searchSettings.current?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[searchOptions]);
  function openNote(note: PersonalNote | null) {
    setImportedSelection(null);
    if (note) setPanelOpen(true);
    if (note) choose({ ...note.place, address: note.place.address ?? 'Личная точка' });
    else { setSelected(null); marker.current?.remove(); marker.current = null; }
    setActiveNote(note);
  }
  useEffect(() => {
    if (!ready || !map.current) return;
    return installClusteredMarkers(map.current,'personal-notes',notes.map(note=>({
      id:note.id,longitude:note.place.longitude,latitude:note.place.latitude,category:note.category,
      label:`Открыть заметку: ${note.place.title}`,open:()=>openNote(note),
    })));
  }, [notes, ready, retry]);

  function openImported(selection:ImportedSelection){invalidateSearch();
    openNote(null);clearPreview();setResults([]);setManual(false);setView('map');setImportedSelection(selection);setPanelOpen(true);setSheetCompact(false);
    const {longitude,latitude}=selection.note.place;
    map.current?.jumpTo({center:[longitude,latitude],zoom:Math.max(15,map.current.getZoom()),padding:{top:0,bottom:0,left:0,right:0}});
  }
  function showImportedMap(layer:ImportedLayer){
    showView('map');
    if(!map.current||!layer.items.length)return;
    const bounds=new maplibregl.LngLatBounds();layer.items.forEach(note=>bounds.extend([note.place.longitude,note.place.latitude]));
    const mobile=window.matchMedia('(max-width:700px)').matches;
    map.current.fitBounds(bounds,{maxZoom:15,duration:0,padding:{top:110,bottom:mobile?Math.min(panelHeight+95,map.current.getContainer().clientHeight*.6):80,left:mobile?45:400,right:45}});
  }
  useEffect(()=>{
    if(!ready||!map.current)return;
    return installClusteredMarkers(map.current,'imported-notes',importedLayers.filter(layer=>layer.visible).flatMap(layer=>layer.items.map(note=>({
      id:`${layer.id}:${note.origin_note_id}`,longitude:note.place.longitude,latitude:note.place.latitude,category:note.category,
      label:`Импорт: ${note.place.title} · ${layer.author_name}`,open:()=>openImported({layer,note}),
    }))),true);
  },[importedLayers,ready,retry]);
  useEffect(()=>{if(importedSelection&&!importedLayers.some(layer=>layer.id===importedSelection.layer.id))setImportedSelection(null);},[importedLayers,importedSelection]);
  useEffect(()=>{
    if(!importedSelection||!ready||!map.current)return;
    const mobile=window.matchMedia('(max-width:700px)').matches;
    const height=map.current.getContainer().clientHeight;
    const {longitude,latitude}=importedSelection.note.place;
    map.current.jumpTo({center:[longitude,latitude],padding:{top:mobile?94:40,bottom:mobile?Math.min(panelHeight+85,height*.65):40,left:mobile?0:440,right:0}});
  },[importedSelection,ready,panelHeight]);

  useEffect(() => {
    alive.current = true;
    if (!mapKey || !container.current) {setMapError('Не настроен ключ Яндекс Tiles API.');return;}
    setReady(false); setMapError('');setRecovering(false);
    const viewport = initialViewport();
    const rendering=getMapRenderPreferences();
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({ container: container.current,
        style: yandexMapStyle(mapKey,rendering),
        pixelRatio:rendering.pixelRatio,fadeDuration:rendering.reduceMotion?0:160,
        center: [viewport.longitude, viewport.latitude], zoom: viewport.zoom, maxZoom: 18, attributionControl: false });
    } catch { setMapError('Карта не запустилась. Проверь поддержку WebGL в браузере.'); return; }
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    instance.addControl(new maplibregl.AttributionControl({ compact: false }));
    function updateBounds() {
      const b = instance.getBounds();
      const width = b.getEast() - b.getWest();
      const wrap = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;
      setBounds([width >= 360 ? -180 : wrap(b.getWest()), Math.max(-90,b.getSouth()), width >= 360 ? 180 : wrap(b.getEast()), Math.min(90,b.getNorth())].join(','));
    }
    const startup=createMapStartup({
      ready:()=>{setReady(true);setMapError('');setRecovering(false);updateBounds();},
      recover:()=>{
        setRecovering(true);
        instance.setPixelRatio(1);
        const fallbackStyle=yandexMapStyle(mapKey,{pixelRatio:1,reduceMotion:true});
        const source=instance.getSource('yandex');
        if(source?.type==='raster'){
          const tiles=fallbackStyle.sources.yandex;
          if(tiles.type==='raster'&&tiles.tiles)(source as maplibregl.RasterTileSource).setTiles(tiles.tiles);
        }else instance.setStyle(fallbackStyle);
      },
      failed:()=>{setRecovering(false);setMapError('Карта не загрузилась. Проверь интернет и попробуй ещё раз.');},
    });
    instance.on('load',startup.loaded);
    instance.on('sourcedata',event=>{if(event.tile?.state==='loaded')startup.tileLoaded();});
    instance.on('render',startup.rendered);
    instance.on('error',startup.failed);
    instance.on('webglcontextlost',()=>{setReady(false);setMapError('Браузер потерял доступ к графике. Попробуй загрузить карту снова.');});
    instance.on('moveend', () => {
      updateBounds();
      const center = instance.getCenter();
      try { localStorage.setItem(VIEWPORT_KEY, JSON.stringify({ longitude: center.lng, latitude: center.lat, zoom: instance.getZoom() })); } catch { /* Optional storage. */ }
    });
    return () => { startup.dispose(); alive.current = false; controller.current?.abort(); marker.current?.remove(); marker.current = null; instance.remove(); map.current = null; };
  }, [retry]);

  useEffect(()=>{
    if(!mapError)return;
    const reconnect=()=>setRetry(value=>value+1);
    window.addEventListener('online',reconnect,{once:true});
    return()=>window.removeEventListener('online',reconnect);
  },[mapError]);

  function choose(candidate: PlaceCandidate) {
    invalidateSearch();
    setImportedSelection(null);
    setPanelOpen(true);
    setSheetCompact(false); setResults([]); clearPreview();
    setActiveNote(null);
    setSelected(candidate); setManual(false);
    const instance = map.current;
    if (!instance) return;
    marker.current?.remove();
    marker.current = new maplibregl.Marker({ color: '#1769e8' }).setLngLat([candidate.longitude, candidate.latitude]).addTo(instance);
    instance.jumpTo({ center: [candidate.longitude, candidate.latitude], zoom: Math.max(15, instance.getZoom()), padding:{top:0,bottom:0,left:0,right:0} });
  }
  function previewResult(place: PlaceCandidate) {
    setPreviewPlace(place); marker.current?.remove();
    if(!map.current)return;
    marker.current=new maplibregl.Marker({color:'#0068ff'}).setLngLat([place.longitude,place.latitude]).addTo(map.current);
    map.current.jumpTo({center:[place.longitude,place.latitude],zoom:Math.max(15,map.current.getZoom()),padding:{top:0,bottom:map.current.getContainer().clientHeight*.48,left:0,right:0}});
    popup.current?.remove();
    const host=document.createElement('div');
    popup.current=new maplibregl.Popup({closeButton:false,closeOnClick:false,anchor:'bottom',offset:[0,-48],maxWidth:'280px',className:'result-popup'}).setLngLat([place.longitude,place.latitude]).setDOMContent(host).addTo(map.current);
    setPopupElement(host);
  }
  function invalidateSearch() {
    controller.current?.abort(); requestNumber.current++; setLoading(false); setSearched(false);  setResults([]); setSearchError(''); clearPreview(); map.current?.setPadding({top:0,bottom:0,left:0,right:0});
  }
  function closeSearchPanel() {
    invalidateSearch(); setManual(false); setPanelOpen(true); setSheetCompact(true);
  }
  async function search(event: React.FormEvent) {
    
    setPanelOpen(true); setView('map');
    setSheetCompact(false); openNote(null); setManual(false);
    event.preventDefault(); controller.current?.abort();
    const id = ++requestNumber.current;
    const abort = new AbortController(); controller.current = abort;
    setLoading(true); setSearchError(''); setResults([]); setSearched(false);
    const center = map.current?.getCenter();
    const timeout = window.setTimeout(() => abort.abort(), 10000);
    try {
      const found = await searchPlaces(mode, query, key, center ? [center.lng, center.lat] : [37.6173, 55.7558], abort.signal);
      if (id === requestNumber.current && alive.current) { setResults(found); setSearched(true); }
    } catch (error) {
      if (id === requestNumber.current && alive.current) setSearchError(abort.signal.aborted ? 'Поиск занял слишком много времени. Попробуй ещё раз или выбери точку вручную.'
        : error instanceof Error && error.name !== 'TypeError' ? error.message : 'Нет связи с поиском. Можно выбрать точку вручную.');
    } finally { window.clearTimeout(timeout); if (id === requestNumber.current && alive.current) setLoading(false); }
  }
  function locate() {
    if(tracking){setTracking(false);setGps(null);setLocating(false);setGpsPrompt(false);setGpsError('');return;}
    setPanelOpen(true);setGpsError('');setGps(null);
    if (!navigator.geolocation) { setGpsError('Геопозиция недоступна. Используй поиск или ручную точку.'); return; }
    setLocating(true);setGpsPrompt(true);setTracking(true);
  }
  function showView(next: 'map' | 'list' | 'profile' | 'collections', category: string | null = null) {
    invalidateSearch();
    setView(next); setPresetCategory(category); setPanelOpen(true); setSheetCompact(false); setManual(false); setResults([]); clearPreview(); map.current?.setPadding({top:0,bottom:0,left:0,right:0}); openNote(null);
  }
  function addPoint() {
    invalidateSearch();
    setView('map');
    setPanelOpen(true); setSheetCompact(false); setResults([]); clearPreview(); map.current?.setPadding({top:0,bottom:0,left:0,right:0}); marker.current?.remove(); marker.current = null; setSelected(null); setActiveNote(null); setManual(true);
  }
  useEffect(()=>{
    const instance=map.current;
    if(!ready||!instance||manual||selected||importedSelection||view!=='map')return;
    let pickPopup:maplibregl.Popup|null=null;
    const pick=(event:maplibregl.MapMouseEvent)=>{
      const target=event.originalEvent.target;
      if(target instanceof Element&&target.closest('.maplibregl-marker,.maplibregl-popup,.maplibregl-control-container'))return;
      clearPreview();pickPopup?.remove();
      const longitude=((event.lngLat.lng+180)%360+360)%360-180;
      const features=instance.queryRenderedFeatures([[event.point.x-12,event.point.y-12],[event.point.x+12,event.point.y+12]]);
      const hint=mapPickHint(features,[longitude,event.lngLat.lat]);
      const content=document.createElement('div');content.className='map-pick';
      const title=document.createElement('strong');title.textContent=hint.title;content.append(title);
      const explanation=document.createElement('p');
      explanation.textContent='Добавь личную точку и сохрани впечатления об этом месте.';content.append(explanation);
      const custom=document.createElement('button');custom.type='button';custom.textContent='Добавить личную точку';
      custom.onclick=()=>{pickPopup?.remove();addPoint();setName(hint.named?hint.title:'');instance.jumpTo({center:hint.position,padding:{top:0,bottom:0,left:0,right:0}});};content.append(custom);
      pickPopup=new maplibregl.Popup({maxWidth:'280px',closeOnClick:false}).setLngLat(hint.position).setDOMContent(content).addTo(instance);
    };
    instance.on('click',pick);
    return()=>{instance.off('click',pick);pickPopup?.remove();};
  },[ready,retry,manual,selected,importedSelection,view,loading,results.length]);
  const detail = !!selected || manual || !!importedSelection;
  return <div style={{'--panel-height':`${visiblePanelHeight}px`,'--sheet-offset':`${sheetOffset}px`} as CSSProperties} className={`map-screen${homeSheet?' home-sheet':''}${homeSheet&&sheetDragOffset!==null?' sheet-dragging':''}${manual ? ' manual-mode' : ''}${selected ? ' selected-place' : ''}${view !== 'map' && !detail ? ' screen-page' : ''}${results.length ? ' results-sheet' : ''}${detail || view !== 'map' || results.length ? ' expanded-sheet' : ''}${sheetCompact ? ' compact-sheet' : ''}`}>
    <div className="search-overlay" ref={searchOverlay}>
      <form className="map-search" onSubmit={search}>
        <Icon name="search" className="search-icon"/>
        <label className="sr-only" htmlFor="place-query">Название или адрес</label>
        <input ref={searchInput} id="place-query" value={query} onChange={event => { invalidateSearch(); setQuery(event.target.value); }} maxLength={200} placeholder="Поиск мест" />
        {query&&<button type="button" className="search-clear" aria-label="Очистить поиск" onClick={()=>{invalidateSearch();setQuery('');searchInput.current?.focus();}}><Icon name="close"/></button>}
        <button type="submit" aria-label="Найти" disabled={!key || query.trim().length < 2 || loading}>{loading ? <span className="spinner"/> : <Icon name="arrow"/>}</button>
      </form>
      <button ref={searchSettings} className="round-button" aria-label="Настройки поиска" aria-expanded={searchOptions} aria-controls="search-options" onClick={() => setSearchOptions(value => !value)}><Icon name="sliders"/></button>
      {searchOptions && <div id="search-options" className="search-options"><label htmlFor="search-mode">Что ищем</label><select autoFocus id="search-mode" value={mode} onChange={event => { invalidateSearch(); setMode(event.target.value as SearchMode); }}><option value="организация">Организации</option><option value="адрес">Адрес или город в России</option></select></div>}
    </div>
    {homeSheet && <button className="panel-toggle" aria-controls="map-panel-content" aria-expanded={!sheetCompact} onClick={() => { setPanelOpen(true); setSheetCompact(value => !value); }}>Мои места <Icon name="chevron"/></button>}
    <aside ref={panel} id="map-panel" className="sidebar" hidden={!panelOpen} inert={homeSheet&&sheetCompact} aria-label="Поиск и личные места">
      {homeSheet?<HomeSheetHandle compact={sheetCompact} travel={sheetTravel} onCompact={setSheetCompact} onOffset={setSheetDragOffset}/>:!selected&&!importedSelection&&view==='map'&&!manual&&<button className="sheet-handle" aria-label={sheetCompact?'Развернуть панель':'Уменьшить панель'} aria-expanded={!sheetCompact} aria-controls="map-panel" onClick={()=>setSheetCompact(value=>!value)}><span/></button>}
      <div id="map-panel-content" className="sheet-content" inert={homeSheet&&sheetCompact}>
      {!selected&&view!=='map'&&!manual&&<div className="screen-toolbar"><button className="soft-circle" aria-label="Вернуться на карту" onClick={()=>showView('map')}><Icon name="chevron" className="back-icon"/></button><strong>Notemap</strong><button className="soft-circle" aria-label="Профиль и настройки" onClick={()=>showView('profile')}><Icon name="more"/></button></div>}
      {!selected&&!importedSelection&&<header className="sheet-header"><div><h1>{manual ? 'Добавить место' : results.length ? 'Результаты поиска' : view === 'list' ? (listMode === 'all' ? 'Все заметки' : listMode === 'items' ? 'Лучшие предметы' : 'Лучшие места') : view === 'profile' ? 'Профиль' : view === 'collections' ? 'Коллекции' : 'Notemap'}</h1>{!detail && !results.length && <p>{view === 'list' ? (listMode === 'all' ? 'Все твои сохранённые места' : listMode === 'items' ? 'Сравнивай предметы в разных местах' : 'На основе твоих оценок и заметок') : view === 'profile' ? 'Твои личные места и заметки' : view === 'collections' ? 'Подборки любимых мест' : 'Твоя карта любимых мест'}</p>}</div>{(manual||results.length>0)&&<button className="sheet-close" aria-label="Свернуть панель" onClick={closeSearchPanel}><Icon name="close"/></button>}</header>}
      {!detail && view === 'map' && !results.length && <div className="category-cards">{categoryData.map(({id,icon,title}) => <button key={id} className={`category-card ${id}`} onClick={() => showView('list',id)}><span className="category-icon"><Icon name={icon as IconName}/></span><strong>{title}</strong><small>{placesCount(notes.filter(note=>note.category===id).length)}</small></button>)}</div>}
      <div aria-live="polite">{loading&&<p role="status">Ищем место…</p>}{searchError && <p className="notice error" role="alert">{searchError}</p>}{searched && results.length === 0 && <p className="notice">Ничего не найдено. Попробуй другое название или добавь свою точку через «+».</p>}</div>
      {results.length > 0 && <><div className="nearby-caption"><Icon name="pin"/>Результаты поиска · {results.length}</div><ul className="nearby-places">{results.map((place, index) => { const savedNote = place.providerId ? notes.find(note => note.place.provider_id === place.providerId) : undefined; return <li className="nearby-entry" key={`${place.providerId ?? place.title}-${index}`}><button className="nearby-row" aria-pressed={previewPlace===place} onClick={() => previewResult(place)}><MiniMap longitude={place.longitude} latitude={place.latitude}/><span className="row-copy"><strong>{place.title}</strong><span>{place.address}</span><small>{savedNote && 'Уже сохранено · '}{place.distanceM!==undefined?`${place.distanceM} м по прямой`:mode==='организация'?'Организация':'Адрес на карте'}</small></span></button><button className={previewPlace===place?'nearby-save':'row-add'} aria-label={`${savedNote ? "Открыть" : "Добавить"} заметку: ${place.title}`} title={savedNote ? "Открыть сохранённую заметку" : "Добавить заметку"} onClick={()=>savedNote ? openNote(savedNote) : choose({...place,startEditing:true})}>{previewPlace===place?<><Icon name="bookmark"/>{savedNote ? "Открыть" : "Сохранить"}</>:<Icon name={savedNote ? "bookmark" : "plus"}/>}</button></li>;})}</ul><div className="nearby-credit"><a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a></div></>}
      {gps && gpsPrompt && <section className="notice"><p>Геопозиция показана синей точкой. Точность около {Math.round(gps.accuracy)} м. Переместить карту?</p><button disabled={!ready} onClick={() => { map.current?.jumpTo({ center: [gps.longitude, gps.latitude], zoom: 15 }); setGpsPrompt(false); }}>Показать на карте</button><button className="secondary" onClick={() => setGpsPrompt(false)}>Остаться здесь</button></section>}
      {manual && <section className="selection manual-selection"><p>Перемести карту так, чтобы пин оказался над нужным местом.</p><label htmlFor="custom-name">Название места</label><input autoFocus id="custom-name" value={name} onChange={event => setName(event.target.value)} maxLength={200} placeholder="Например, любимая кофейня"/><div className="manual-actions"><button disabled={!ready || !!mapError || !name.trim()} onClick={() => { const center = map.current?.getCenter(); if (center) choose({ title: name.trim(), address: 'Ручная точка', origin: 'custom', longitude: center.lng, latitude: center.lat }); }}>Выбрать точку</button><button className="secondary" onClick={() => setManual(false)}>Отмена</button></div></section>}
      {importedSelection&&<ImportedPlacePanel selection={importedSelection} onClose={()=>setImportedSelection(null)} onCreate={note=>choose({title:note.place.title,longitude:note.place.longitude,latitude:note.place.latitude,origin:'custom',address:'Моя точка'})}/>}
      <div hidden={!!importedSelection || manual || (!detail && view === 'map')}><NotesPanel selected={selected} active={activeNote} onNotes={setNotes} onOpen={openNote} bounds={bounds} view={view} presetCategory={presetCategory} onImports={setImportedLayers} onImportedOpen={openImported} onImportedMap={showImportedMap} initialImportId={initialImportId} onListModeChange={setListMode}/></div>
      {!key && <p className="notice">Для карты нужен ключ Geoapify. Добавь VITE_GEOAPIFY_API_KEY в apps/web/.env.local и перезапусти приложение.</p>}
      {view === 'profile' && <footer>Заметки, оценки и фотографии доступны только владельцу.</footer>}
      </div>
    </aside>
    <section className="map-area" aria-label="Карта мест"><div ref={container} className="map-canvas" />
      <div className="main-yandex-brand"><a href="https://yandex.ru/maps/" target="_blank" rel="noopener noreferrer"><img src={`${import.meta.env.BASE_URL}maps/yandex-logo-ru.svg`} alt="Яндекс Карты"/></a><a href="https://yandex.ru/maps/" target="_blank" rel="noopener noreferrer">Открыть в Картах</a></div>
      {previewPlace&&popupElement&&results.length>0&&createPortal(<button className="map-place-callout" onClick={()=>choose(previewPlace)}><MiniMap longitude={previewPlace.longitude} latitude={previewPlace.latitude}/><span><strong>{previewPlace.title}</strong><small>{previewPlace.address}</small></span><Icon name="chevron"/></button>,popupElement)}
      <div className="map-tools" aria-label="Действия на карте">
        <button className="round-button" aria-label={locating?'Определяем геопозицию':tracking?'Выключить геопозицию':'Где я?'} aria-pressed={tracking} aria-busy={locating} aria-describedby={gpsError?'location-error':undefined} onClick={locate}>{locating ? <span className="spinner" aria-hidden="true"/> : <Icon name="location"/>}</button>
        {gpsError&&<div id="location-error" className="location-toast" role="alert">{gpsError}</div>}
      </div>
      {manual && ready && !mapError && <div className="center-pin" aria-hidden="true"><Icon name="pin"/></div>}
      {!ready && !mapError && mapKey && <div className="map-message" role="status">{recovering?'Восстанавливаем карту…':'Загружаем карту…'}</div>}
      {mapError && <div className="map-message error" role="alert"><p>{mapError}</p><button onClick={() => { setSelected(null); setManual(false); setRetry(value => value + 1); }}>Повторить</button></div>}
      {!key && <div className="map-message"><h2>Карта готова к подключению</h2><p>Укажи бесплатный ключ Geoapify для загрузки настоящей карты.</p></div>}
    </section>
    <nav className="bottom-nav" aria-label="Основная навигация"><button aria-current={view === 'map' && !detail ? 'page' : undefined} onClick={() => showView('map')}><Icon name="pin"/>Карта</button><button aria-current={view === 'list' && !detail ? 'page' : undefined} onClick={() => showView('list')}><Icon name="list"/>Места</button><button className="add-button" aria-label="Добавить место" onClick={addPoint} disabled={!ready || !!mapError}><Icon name="plus"/></button><button aria-current={view === 'collections' && !detail ? 'page' : undefined} onClick={() => showView('collections')}><Icon name="bookmark"/>Коллекции</button><button aria-current={view === 'profile' && !detail ? 'page' : undefined} onClick={() => showView('profile')}><Icon name="user"/>Профиль</button></nav>
  </div>;
}
