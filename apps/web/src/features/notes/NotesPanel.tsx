import { Select } from '../../components/Select';
import { api } from './api';
import { StoragePanel } from './StoragePanel';
import { PwaUpdatePanel } from './PwaUpdatePanel';
import './profile.css';
import { CollectionsPanel } from './CollectionsPanel';
import { ItemReviews, loadItemTypes, type ItemType } from './ItemReviews';
import { useEffect, useRef, useState } from 'react';
import type { PlaceCandidate } from '../places/geoapify';
import { DraftPhotos } from './DraftPhotos';
import { saveNoteDraft, type DraftPhoto } from '../../local/note-draft';
import { PhotoPanel } from './PhotoPanel';
import { Icon } from '../../components/Icon';
import { EmptyState } from '../../components/EmptyState';
import { ConfirmAction } from '../../components/ConfirmAction';
import { ShareLinksPanel, ShareCollectionPanel } from './SharePanel';
import { CategoryChips, categoryIcon, categoryTitle, MapCredit, MiniMap, PlaceCover, Stars } from '../../components/PlaceVisuals';
import { ItemRatingsSummary } from './ItemReviews';
import { ImportedCollectionsPanel } from './ImportedCollectionsPanel';
import type { ImportedLayer, ImportedSelection } from './import-api';

export type PersonalNote = {
  id: string; place: { title: string; latitude: number; longitude: number; origin: 'custom' | 'external'; provider_id?: string; address?: string | null; attribution?: string | null };
  category: string; rating: number | null; text: string; visited_on: string | null;
  item_rating?: number;
};
type User = { id: string; email: string };
type Resolved = { id: string; title: string; address: string | null; attribution: string | null; note_id: string | null };
const categories = [['food', 'Еда и напитки'], ['culture', 'Культура'], ['nature', 'Природа'], ['other', 'Другое']];


export function NotesPanel({ selected, active, onNotes, onOpen, bounds, view, presetCategory, onImports, onImportedOpen, onImportedMap, initialImportId, onListModeChange }: {
  selected: PlaceCandidate | null; active: PersonalNote | null;
  onNotes: (notes: PersonalNote[]) => void; onOpen: (note: PersonalNote | null) => void;
  bounds: string | null;
  view: 'map' | 'list' | 'profile' | 'collections'; presetCategory: string | null;
  onListModeChange: (mode: 'all' | 'ranked' | 'items') => void;
  onImports:(layers:ImportedLayer[])=>void; onImportedOpen:(selection:ImportedSelection)=>void; onImportedMap:(layer:ImportedLayer)=>void; initialImportId?:string|null;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [category, setCategory] = useState('other');
  const [rating, setRating] = useState('');
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [minRating, setMinRating] = useState('');
  const [inView, setInView] = useState(false);
  const [ranked, setRanked] = useState(false);
  const [listing, setListing] = useState(false);
  const [itemMode, setItemMode] = useState(false);
  useEffect(() => { onListModeChange(itemMode ? 'items' : ranked ? 'ranked' : 'all'); }, [itemMode, ranked, onListModeChange]);
  const [itemType, setItemType] = useState('');
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [typesVersion, setTypesVersion] = useState(0);
  const [collectionTab,setCollectionTab]=useState<'own'|'received'>(initialImportId?'received':'own');
  const [collectionId,setCollectionId] = useState<string|null>(null);
  const [collectionVersion,setCollectionVersion] = useState(0);
  const [detailTab,setDetailTab] = useState<'overview'|'note'|'photos'|'items'|'collections'|'share'>('overview');
  const [editing,setEditing] = useState(false);
  const [photoVersion,setPhotoVersion] = useState(0);
  const [draftPhotos,setDraftPhotos] = useState<DraftPhoto[]>([]);
  const [menuOpen,setMenuOpen] = useState(false);
  const params = new URLSearchParams();
  filterCategories.forEach(value => params.append('category', value));
  if (minRating) params.set('min_rating', minRating);
  if (inView && bounds) params.set('bbox', bounds);
  if (itemType) params.set('item_type_id',itemType);
  const listingPath = view === 'map' ? '/notes?' : view === 'collections' && collectionId ? `/collections/${collectionId}/notes?` : itemMode ? (itemType ? `/rankings/items?${params}` : '') : `${ranked ? '/rankings/places' : '/notes'}?${params}`;
  const listingRef = useRef(listingPath);
  listingRef.current = listingPath;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const pending = useRef<{ payload: string; key: string } | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    if (view === 'list') { setRanked(true); setFilterCategories(presetCategory ? [presetCategory] : []); }
  }, [view, presetCategory]);
  useEffect(() => {
    if (!user) { setItemTypes([]); setItemType(''); setItemMode(false); return; }
    let alive = true;
    loadItemTypes().then(items => { if (alive) setItemTypes(items); }).catch(err => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [user?.id,typesVersion]);
  async function refresh() {
    const version = ++generation.current;
    const path = listingRef.current;
    if (!path) { setNotes([]); onNotes([]); return; }
    let cursor: string | null = null;
    const all: PersonalNote[] = [];
    do {
      const page = await api(`${path}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      all.push(...(path.startsWith('/rankings/items') ? page.items.map((row: {note: PersonalNote; rating: number}) => ({...row.note,item_rating:row.rating})) : page.items)); cursor = page.next_cursor;
    } while (cursor);
    if (version === generation.current) { setNotes(all); onNotes(all); }
  }
  useEffect(() => {
    let alive = true;
    api('/auth/me').then(async current => { if (alive) { setUser(current); await refresh(); } }).catch(err => {if(alive)setError(err.message);}).finally(() => { if (alive) setInitializing(false); });
    return () => { alive = false; generation.current++; };
  }, []);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    setListing(true); setError(''); setNotes([]); onNotes([]);
    refresh().catch(err => { if (alive) setError(err.message); }).finally(() => { if (alive) setListing(false); });
    return () => { alive = false; generation.current++; };
  }, [user?.id, listingPath, typesVersion, collectionVersion]);
  useEffect(() => {
    setDraftPhotos([]); setMenuOpen(false); setDetailTab('overview'); setEditing(!!selected && selected.origin === 'custom' && !active);
    setCategory(active?.category ?? 'other'); setRating(active?.rating?.toString() ?? '');
    setText(active?.text ?? ''); setDate(active?.visited_on ?? ''); setError(''); setMessage(''); setResolved(null); pending.current = null;
  }, [active?.id, selected]);
  useEffect(()=>{if(selected)document.getElementById('map-panel')?.scrollTo({top:0});},[selected,editing]);
  useEffect(()=>{
    if(!selected?.startEditing||selected.origin==='custom'||active||!user)return;
    const candidate=selected;
    void action(async()=>{
      if(!candidate.providerId)return;
      const place:Resolved=await api('/places/resolve','POST',{provider_id:candidate.providerId});
      if(selectedRef.current!==candidate)return;
      if(place.note_id)onOpen(await api(`/notes/${place.note_id}`));
      else{setResolved(place);setEditing(true);}
    });
  },[selected,active?.id,user?.id]);
  async function action(work:()=>Promise<void>){
    setBusy(true);setError('');setMessage('');
    try{await work();}catch(err){setError(err instanceof Error?err.message:'Не удалось сохранить локальные данные.');}finally{setBusy(false);}
  }
  if(initializing)return <p role="status">Открываем локальные записи…</p>;
  if(!user)return <section className="selection"><h2>Локальное хранилище недоступно</h2><p role="alert">{error || 'Проверь настройки браузера и доступ к IndexedDB.'}</p><button onClick={()=>window.location.reload()}>Повторить</button></section>;
  const manual = selected?.origin === 'custom';
  const canEdit = !!active || manual || !!resolved;
  const editor = !!selected && editing && canEdit;
  function cancelEdit() {
    setDraftPhotos([]);
    if (!active) { onOpen(null); return; }
    setCategory(active.category); setRating(active.rating?.toString() ?? ''); setText(active.text); setDate(active.visited_on ?? ''); setEditing(false); setError('');
  }
  return <section className="selection note-workspace">{view === 'profile' && <div className="profile-identity"><span className="profile-avatar"><Icon name="user"/></span><h2>Личное пространство</h2><p><Icon name="lock"/>Данные на этом устройстве</p></div>}
    {view === 'profile' && <div className="profile-settings">
    <PwaUpdatePanel/>
    <StoragePanel onRestored={()=>window.location.reload()}/>
    <details className="profile-card profile-extra"><summary><Icon name="sliders"/>Дополнительно<Icon name="chevron"/></summary><div><ShareLinksPanel/></div></details>
    </div>}
    {editor&&<div className="editor-toolbar"><button type="button" className="text-action" disabled={busy} onClick={cancelEdit}>Отмена</button><h1>{active?'Редактировать':'Добавить заметку'}</h1><button type="submit" form="note-editor" className="text-action save-action" disabled={busy}>{busy?'Сохраняем…':'Сохранить'}</button></div>}
    {editor&&error&&<p className="notice error editor-error" role="alert">{error}</p>}
    {selected&&<div className={`place-presentation${editor?' is-editing':''}`}>
      <div className="place-hero"><PlaceCover noteId={active?.id} category={active?.category??category} refresh={photoVersion} className="hero-cover"/>
        {!editor&&<div className="hero-toolbar"><button className="soft-circle" aria-label="Назад к местам" disabled={busy} onClick={()=>onOpen(null)}><Icon name="chevron" className="back-icon"/></button><button className="soft-circle" aria-label="Действия с местом" aria-expanded={menuOpen} disabled={busy||!canEdit} onClick={()=>setMenuOpen(value=>!value)}><Icon name="more"/></button></div>}
      </div>
      {menuOpen&&<div className="place-menu"><button onClick={()=>{setEditing(true);setMenuOpen(false);}}><Icon name="edit"/>Редактировать</button><button onClick={()=>{setDetailTab('collections');setMenuOpen(false);}}><Icon name="bookmark"/>В коллекцию</button><button onClick={()=>{setDetailTab('share');setMenuOpen(false);}}><Icon name="share"/>Поделиться</button><button className="secondary" onClick={()=>setMenuOpen(false)}>Закрыть меню</button></div>}
      <div className={`place-heading${editor?' editor-place-heading':''}`}>
        {editor&&<PlaceCover noteId={active?.id} category={category} refresh={photoVersion} className="editor-thumbnail"/>}
        <div><h1>{selected.title}</h1><p className="place-meta"><Icon name={categoryIcon(active?.category??category)}/>{active?categoryTitle(active.category):manual?'Личная точка':'Организация'}</p><p className="place-meta"><Icon name="pin"/>{selected.address}</p>{active?.rating!=null&&<p className="place-rating"><Icon name="star"/><strong>{active.rating}</strong><span>/ 10 · Моя оценка</span></p>}</div>
        {!editor&&active&&<span className="saved-badge" aria-label="Место сохранено"><Icon name="bookmark"/></span>}
      </div>
    </div>}
    {selected && !manual && !active && !resolved && <button className="primary-action" disabled={busy || !selected.providerId} onClick={() => void action(async () => {
      const candidate = selected;
      const place: Resolved = await api('/places/resolve','POST',{provider_id:candidate.providerId});
      if (selectedRef.current !== candidate) return;
      if (place.note_id) onOpen(await api(`/notes/${place.note_id}`));
      else { setResolved(place); setEditing(true); }
    })}>{busy ? 'Проверяем организацию…' : 'Добавить заметку'}</button>}
    {active&&!editor&&<><div className="place-actions"><button onClick={()=>onOpen(null)}><Icon name="location"/>На карте</button><button onClick={()=>setEditing(true)}><Icon name="edit"/>Изменить</button><button onClick={()=>setDetailTab('share')}><Icon name="share"/>Поделиться</button></div>
    {(detailTab==='share'||detailTab==='collections')?<div className="detail-flow-toolbar"><button className="text-action" onClick={()=>setDetailTab('overview')}><Icon name="chevron" className="back-icon"/>К заметке</button><strong>{detailTab==='share'?'Обмен заметкой':'Добавить в коллекцию'}</strong></div>:<div className="detail-tabs" role="group" aria-label="Разделы заметки">{([['overview','Обзор'],['note','Заметка'],['items','Предметы'],['photos','Фото']] as const).map(([id,title])=><button key={id} type="button" aria-pressed={detailTab===id} onClick={()=>setDetailTab(id)}>{title}</button>)}</div>}</>}
    {active&&!editor&&detailTab==='overview'&&<div className="place-overview"><div className="overview-metrics"><div className="metric-card"><strong>Моя оценка</strong><div><Icon name="star"/><b>{active.rating??'—'}<small>/10</small></b></div></div><div className="metric-card visited-card"><Icon name="calendar"/><div><span>Посещение</span><strong>{active.visited_on?new Date(`${active.visited_on}T12:00:00`).toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'}):'Не указано'}</strong></div></div></div>
      <div className="note-preview">{active.text?<><p>{active.text}</p><button className="text-action" onClick={()=>setDetailTab('note')}>Читать всё</button></>:<button className="text-action" onClick={()=>setEditing(true)}><Icon name="plus"/>Добавить впечатления</button>}</div>
      <ItemRatingsSummary noteId={active.id} version={typesVersion} onEdit={()=>setDetailTab('items')}/>

    </div>}
    {active&&!editor&&detailTab==='note'&&<div className="full-note"><h3>Твоя заметка</h3><p>{active.text||'Здесь пока нет впечатлений об этом месте.'}</p><button className="secondary" onClick={()=>setEditing(true)}><Icon name="edit"/>Редактировать заметку</button></div>}
    {canEdit && <form id="note-editor" className="note-editor" hidden={!editor} onSubmit={event => { event.preventDefault(); void action(async () => {
      const fields = { category, rating: rating ? Number(rating) : null, text, visited_on: date || null };
      let saved: PersonalNote;
      if (active) saved = await saveNoteDraft(active.id, fields, draftPhotos);
      else {
        const payload = resolved ? { ...fields, place_id: resolved.id } : { ...fields, place: { title: selected!.title, longitude: selected!.longitude, latitude: selected!.latitude } };
        const serialized = JSON.stringify({payload, photos:draftPhotos.map(photo=>photo.id)});
        if (!pending.current || pending.current.payload !== serialized) pending.current = { payload: serialized, key: crypto.randomUUID() };
        saved = await saveNoteDraft(undefined, payload, draftPhotos, pending.current.key);
      }
      setDraftPhotos([]); setPhotoVersion(value=>value+1); onOpen(saved); await refresh(); setMessage('Заметка и фотографии сохранены');
    }); }}>
      <fieldset className="editor-fields" disabled={busy}><legend className="sr-only">Поля заметки</legend><div className="editor-rating-section"><span className="field-label">Моя оценка</span><div className="rating-picker" role="group" aria-label="Оценка от 1 до 10">{Array.from({length:10},(_,i)=><button key={i+1} type="button" aria-pressed={rating===String(i+1)} onClick={()=>setRating(String(i+1))}>{i+1}</button>)}</div><button type="button" className="text-action" onClick={()=>setRating('')}>{rating?`Моя оценка: ${rating}/10 · Убрать`:'Без оценки'}</button></div>
      <div className="editor-category"><label htmlFor="note-category">Категория</label><Select id="note-category" label="Категория" value={category} onChange={setCategory} disabled={busy} options={categories.map(([value,label])=>({value,label}))}/><span className={`category-tag ${category}`}><Icon name={categoryIcon(category)}/>{categoryTitle(category)}</span></div>
      <label htmlFor="note-text">Твоя заметка</label><textarea id="note-text" maxLength={10000} placeholder="Что понравилось? Что стоит запомнить?" value={text} onChange={e => setText(e.target.value)} />
      <details className="editor-extras"><summary><Icon name="calendar"/>Дата посещения<span>{date?new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU'):'Добавить'}</span></summary><label htmlFor="note-date">Дата посещения</label><input id="note-date" type="date" value={date} onChange={e => setDate(e.target.value)} /><p className="field-hint">Оценку и дату можно добавить позже.</p></details></fieldset>
      <DraftPhotos noteId={active?.id} photos={draftPhotos} onChange={setDraftPhotos} disabled={busy}/>
    </form>}
    {active && <div className="detail-section" hidden={editor||detailTab!=='photos'}><PhotoPanel key={active.id} noteId={active.id} noteBusy={busy} onChange={()=>setPhotoVersion(value=>value+1)} /></div>}
    {active && <div className="detail-section" hidden={!editor&&detailTab!=='items'}><ItemReviews key={`items-${active.id}`} noteId={active.id} noteBusy={busy} onChange={() => setTypesVersion(value => value + 1)} /></div>}
    {active&&!editor&&detailTab==='share'&&<ShareCollectionPanel key={`share-${active.id}`} noteId={active.id} notes={[active]} noteCount={1} disabled={busy}/>}
    {active && <div className="detail-section" hidden={editor||detailTab!=='collections'}><CollectionsPanel key={`collections-${active.id}`} noteId={active.id} noteBusy={busy} onChange={()=>setCollectionVersion(value=>value+1)}/></div>}
    {view==='collections'&&!selected&&!active&&!collectionId&&<div className="collection-tabs" role="group" aria-label="Коллекции"><button aria-pressed={collectionTab==='own'} onClick={()=>setCollectionTab('own')}>Мои</button><button aria-pressed={collectionTab==='received'} onClick={()=>setCollectionTab('received')}>Полученные</button></div>}
    {view==='collections'&&!selected&&!active&&collectionTab==='own'&&<CollectionsPanel selectedId={collectionId} onSelect={setCollectionId} notes={collectionId?notes:[]} notesLoading={listing} onOpen={onOpen} onChange={()=>setCollectionVersion(value=>value+1)}/>}
    <ImportedCollectionsPanel key={user.id} hidden={view!=='collections'||collectionTab!=='received'||!!selected||!!active||!!collectionId} onLayers={onImports} onOpen={onImportedOpen} onMap={onImportedMap} initialId={initialImportId}/>
    
    {active && <div hidden={!editor}><ConfirmAction label="Удалить заметку" title="Удалить заметку?" description="Вместе с заметкой удалятся её фотографии и оценки предметов. Это действие нельзя отменить." disabled={busy} onConfirm={()=>void action(async () => { await api(`/notes/${active.id}`, 'DELETE'); onOpen(null); await refresh(); setMessage('Заметка удалена'); })}/></div>}
    {(active?.place.attribution || resolved?.attribution) && <p className="muted">{active?.place.attribution ?? resolved?.attribution} · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">ODbL</a></p>}
    {selected && !manual && !selected.providerId && !active && <p>У результата нет проверяемого ID. Поставь свою точку вручную.</p>}
    <div hidden={!!selected || !!active || view === 'profile' || view === 'collections'}><section aria-label="Рейтинги и фильтры">
      <CategoryChips selected={filterCategories} onChange={id=>setFilterCategories(values=>id?(values.includes(id)?values.filter(value=>value!==id):[...values,id]):[])}/>
      <div className="mode-switch" role="group" aria-label="Показать места">{([['all','Все'],['ranked','Лучшие'],['items','По предмету']] as const).map(([id,title])=><button key={id} aria-pressed={(itemMode?'items':ranked?'ranked':'all')===id} onClick={()=>{setItemMode(id==='items');setRanked(id==='ranked');}}>{title}</button>)}</div><div className="list-options">
      {itemMode && <div className="ranking-field"><label htmlFor="ranking-item">Предмет для сравнения</label><Select id="ranking-item" label="Предмет для сравнения" value={itemType} onChange={setItemType} options={[{value:"",label:"Выбери предмет"},...itemTypes.map(item=>({value:item.id,label:item.name}))]}/>{!itemTypes.length && <p className="muted">Добавь оценку предмета в одну из своих заметок.</p>}</div>}
      <details className="filter-details"><summary><Icon name="sliders"/>Фильтры{(filterCategories.length>0||!!minRating||inView)&&<span className="filter-count">{filterCategories.length+Number(!!minRating)+Number(inView)}</span>}<Icon name="chevron"/></summary>

      <label htmlFor="filter-rating">Минимальная оценка</label><Select id="filter-rating" label="Минимальная оценка" value={minRating} onChange={setMinRating} options={[{value:"",label:"Любая"},...Array.from({length:10},(_,i)=>({value:String(i+1),label:String(i+1)}))]}/>
      <label className="filter-option"><input type="checkbox" checked={inView} disabled={!bounds} onChange={e => setInView(e.target.checked)} />В видимой области карты</label>
      <button className="secondary" onClick={() => { setFilterCategories([]); setMinRating(''); setInView(false); }}>Сбросить фильтры</button>
      </details>
      </div>
      {itemMode && <p className="muted">Сортировка и минимальная оценка относятся к предмету.</p>}
    </section>
    {listing ? <p role="status">Загружаем места…</p> : <span className="sr-only" aria-live="polite">Найдено: {notes.length}</span>}
    {!listing && !notes.length && <EmptyState icon={itemMode?'star':'pin'} title={itemMode?'Найди свой фаворит':ranked?'Здесь будут твои лучшие места':'Каждое место — своя история'} description={itemMode ? (itemType ? 'Нет оценок этого предмета по выбранным фильтрам.' : 'Выбери предмет, чтобы сравнить места.') : ranked ? 'Поставь месту оценку или измени фильтры, чтобы увидеть его в списке.' : 'Добавь место на карте или измени фильтры, чтобы увидеть свои заметки.'}/>}
    <ol className="ranked-places">{notes.map((note,index) => <li key={note.id}><button className="ranked-row" disabled={busy} onClick={() => onOpen(note)}>{(ranked||itemMode)&&<span className={`rank-number${index<3?' podium':''}`}>{index+1}</span>}<PlaceCover noteId={note.id} category={note.category}/><span className="row-copy"><strong>{note.place.title}</strong><span>{categoryTitle(note.category)}</span><small className="row-rating"><Icon name="star"/>{itemMode ? `${note.item_rating}/10 · ${itemTypes.find(item => item.id === itemType)?.name}` : note.rating!=null ? <>Моя оценка <b>{note.rating}/10</b></> : 'Без оценки'}</small></span><MiniMap longitude={note.place.longitude} latitude={note.place.latitude} category={note.category}/><Icon name="chevron" className="row-chevron"/></button></li>)}</ol>
    {!!notes.length&&<MapCredit/>}
    </div>
    <div aria-live="polite">{message && <p>{message}</p>}{error && !editor && <p role="alert" className="notice error">{error}</p>}</div>
  </section>;
}

