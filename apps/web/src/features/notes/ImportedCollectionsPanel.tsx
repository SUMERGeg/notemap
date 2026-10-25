import { AuthorBadge } from './ProfileIdentity';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { EmptyState } from '../../components/EmptyState';
import { ConfirmAction } from '../../components/ConfirmAction';
import { categoryTitle, MiniMap, MapCredit } from '../../components/PlaceVisuals';
import { importsApi, loadImportedLayers, type ImportedLayer, type ImportedSelection } from './import-api';
import type { SharedNote } from './share-api';
import { LinkImportPanel } from './LinkImportPanel';
import { ToggleRow } from '../../components/ToggleRow';
import { SharedPhotos } from './SharedPhotos';
import './cloud-share.css';

export function ImportedCollectionsPanel({hidden,onLayers,onOpen,onMap,initialId}:{hidden:boolean;onLayers:(layers:ImportedLayer[])=>void;onOpen:(selection:ImportedSelection)=>void;onMap:(layer:ImportedLayer)=>void;initialId?:string|null}){
  const [layers,setLayers]=useState<ImportedLayer[]>([]);const [selected,setSelected]=useState<string|null>(initialId??null);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const controller=useRef<AbortController|null>(null);
  async function reload(){
    controller.current?.abort();const abort=new AbortController();controller.current=abort;
    try{const rows=await loadImportedLayers(abort.signal);if(abort.signal.aborted)return;setLayers(rows);onLayers(rows);}
    catch(err){if(!abort.signal.aborted)throw err;}
  }
  useEffect(()=>{void reload().catch(err=>setError(err.message)).finally(()=>setLoading(false));return()=>{controller.current?.abort();onLayers([]);};},[]);
  async function action(work:()=>Promise<void>){setBusy(true);setError('');try{await work();}catch(err){setError(err instanceof Error?err.message:'Не удалось обработать импорт.');}finally{setBusy(false);}}
  const current=layers.find(layer=>layer.id===selected);
  function open(layer:ImportedLayer){setSelected(layer.id);}
  return <section className="imported-collections" hidden={hidden} aria-label="Импортированные коллекции">
    <div className="imported-section-heading"><h2>Полученные</h2><span className="collection-count">{layers.length||''}</span></div>{!current&&<LinkImportPanel/>}
    {loading&&<p role="status">Загружаем импортированные коллекции…</p>}
    {error&&<><p className="notice error" role="alert">{error}</p><button className="secondary" disabled={busy} onClick={()=>void action(reload)}>Повторить загрузку</button></>}
    {selected&&!current&&!loading&&!error&&<p className="notice">Коллекция недоступна на этом устройстве.</p>}
    {selected&&<button className="secondary" disabled={busy} onClick={()=>setSelected(null)}><Icon name="chevron" className="back-icon"/>Все полученные</button>}
    {current?<><h3>{current.name}</h3><AuthorBadge name={current.author_name}/><p className="muted">{current.note_count} мест · Версия {current.snapshot_version}</p>{current.description&&<p>{current.description}</p>}<p className="muted">Личная копия · обновление по новой ссылке</p>
      <div className="toggle-group"><ToggleRow title="Показывать на карте" icon="map" checked={current.visible} disabled={busy} onChange={visible=>void action(async()=>{await importsApi(`/imports/${current.id}`,'PATCH',{visible});await reload();})}/></div>
      <button className="secondary" disabled={busy||!current.visible||!current.items.length} onClick={()=>onMap(current)}><Icon name="map"/>Посмотреть на карте</button>
      <ul className="results">{current.items.map(note=><li key={note.origin_note_id}><button className="result imported-place-row" disabled={busy} onClick={()=>onOpen({layer:current,note})}><MiniMap longitude={note.place.longitude} latitude={note.place.latitude}/><span><strong>{note.place.title}</strong><small>{categoryTitle(note.category)}{note.rating!=null?` · Оценка автора ${note.rating}/10`:''}</small></span><Icon name="chevron"/></button></li>)}</ul>
      {!current.note_count&&<EmptyState icon="pin" title="Пустая коллекция" description="В сохранённой версии ещё нет мест."/>}
      <ConfirmAction label="Удалить импорт" title="Удалить импортированную коллекцию?" description="Удалится только эта копия. Твои заметки, фотографии и оценки сохранятся." disabled={busy} onConfirm={()=>void action(async()=>{await importsApi(`/imports/${current.id}`,'DELETE');setSelected(null);await reload();})}/>
    </>:!selected&&<><ul className="results">{layers.map(layer=><li key={layer.id} className="import-layer-card"><button className="result collection-card" disabled={busy} onClick={()=>void open(layer)}><span className="collection-card-icon imported-layer-icon"><Icon name="layers"/></span><span><strong>{layer.name}</strong><small>{layer.author_name} · {layer.note_count} мест</small><small>{layer.visible?'На карте':'Скрыта с карты'}</small></span><Icon name="chevron"/></button></li>)}</ul>{!loading&&!error&&!layers.length&&<EmptyState icon="layers" title="Места, которыми поделились" description="Сохрани коллекцию по ссылке."/>}</>}
  </section>;
}

export function ImportedPlacePanel({selection,onClose,onCreate}:{selection:ImportedSelection;onClose:()=>void;onCreate:(note:SharedNote)=>void}){
  const {layer,note}=selection;
  return <section className="selection imported-place-detail"><button className="text-action" onClick={onClose}><Icon name="chevron" className="back-icon"/>На карту</button><span className="privacy-label imported-label"><Icon name="layers"/>Импортированная копия</span><h2>{note.place.title}</h2><p className="muted">{note.place.address||categoryTitle(note.category)}</p><AuthorBadge name={layer.author_name}/><p className="muted">{layer.name}</p>
    <MiniMap longitude={note.place.longitude} latitude={note.place.latitude}/>
    <p className="rating-badge">{note.rating==null?'Автор не передал оценку':`Оценка автора: ${note.rating}/10`}</p>
    {note.text&&<p className="preview-text">{note.text}</p>}<SharedPhotos photos={note.photos}/>{note.visited_on&&<p>Посещение: {new Date(`${note.visited_on}T12:00:00`).toLocaleDateString('ru-RU')}</p>}
    {!!note.item_reviews?.length&&<ul className="preview-item-ratings">{note.item_reviews.map((item,index)=><li key={index}>{item.name}<strong>{item.rating}/10</strong></li>)}</ul>}
    <p className="muted">Копия доступна только для чтения. Изменения автора не обновляют её автоматически.</p><button onClick={()=>onCreate(note)}><Icon name="plus"/>Создать свою заметку</button>{note.place.attribution&&<p className="source-credit">{note.place.attribution} · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">ODbL 1.0</a></p>}<MapCredit/>
  </section>;
}

