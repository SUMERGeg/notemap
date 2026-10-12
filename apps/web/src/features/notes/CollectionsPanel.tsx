import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { PersonalNote } from './NotesPanel';
import { Icon } from '../../components/Icon';
import { EmptyState } from '../../components/EmptyState';
import { ConfirmAction } from '../../components/ConfirmAction';
import { ShareCollectionPanel } from './SharePanel';
type Collection = { id:string; name:string; description:string; note_count:number };
async function pages(path:string):Promise<Collection[]> {
  const all:Collection[]=[]; let cursor:string|null=null;
  do {const page=await api(`${path}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);all.push(...page.items);cursor=page.next_cursor;} while(cursor);
  return all;
}
export function CollectionsPanel({noteId,selectedId,onSelect,notes=[],onOpen,onChange,noteBusy=false,notesLoading=false}:{
  noteId?:string;selectedId?:string|null;onSelect?:(id:string|null)=>void;notes?:PersonalNote[];onOpen?:(note:PersonalNote)=>void;onChange:()=>void;noteBusy?:boolean;notesLoading?:boolean;
}) {
  const [collections,setCollections]=useState<Collection[]>([]);const [memberships,setMemberships]=useState<string[]>([]);
  const [choice,setChoice]=useState('');const [name,setName]=useState('');const [description,setDescription]=useState('');
  const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
  const [editing,setEditing]=useState(false);
  const pending=useRef<{payload:string;key:string}|null>(null);
  const selected=collections.find(row=>row.id===selectedId);
  async function reload() {const rows=await pages('/collections');setCollections(rows);if(noteId)setMemberships((await pages(`/notes/${noteId}/collections`)).map(row=>row.id));}
  useEffect(()=>{let alive=true;Promise.all([pages('/collections'),noteId?pages(`/notes/${noteId}/collections`):Promise.resolve([])]).then(([rows,member])=>{if(alive){setCollections(rows);setMemberships(member.map(row=>row.id));}}).catch(err=>{if(alive)setError(err.message);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[noteId]);
  useEffect(()=>{setName(selected?.name??'');setDescription(selected?.description??'');setEditing(false);pending.current=null;},[selected?.id,selected?.name,selected?.description]);
  async function action(work:()=>Promise<void>){setBusy(true);setError('');setMessage('');try{await work();await reload();onChange();}catch(err){setError(err instanceof Error?err.message:'Не удалось сохранить коллекцию.');}finally{setBusy(false);}}
  const disabled=busy||loading||noteBusy;
  const inCollection=memberships.includes(choice);
  return <section className="collections-panel" aria-label={noteId?'Коллекции заметки':'Личные коллекции'}>
    {noteId ? <><h3>Добавить в коллекцию</h3><label htmlFor="note-collection">Подборка</label><select id="note-collection" value={choice} onChange={e=>setChoice(e.target.value)} disabled={disabled}><option value="">Выбери коллекцию</option>{collections.map(row=><option key={row.id} value={row.id}>{row.name}{memberships.includes(row.id)?' · добавлено':''}</option>)}</select>
      <button className="secondary" disabled={disabled||!choice} onClick={()=>void action(async()=>{await api(`/collections/${choice}/notes/${noteId}`,inCollection?'DELETE':'PUT');setMessage(inCollection?'Заметка исключена из коллекции':'Заметка добавлена в коллекцию');})}>{inCollection?'Убрать из коллекции':'Добавить в коллекцию'}</button>
      {!loading&&!collections.length&&<p className="muted">Создай подборку во вкладке «Коллекции».</p>}</> : <>
      <p className="muted">Личные подборки твоих заметок. Видны только тебе.</p>
      {selectedId&&<button className="secondary" disabled={disabled} onClick={()=>onSelect?.(null)}><Icon name="arrow" className="back-icon"/>Все коллекции</button>}
      {!editing&&<button className={selected?'secondary':'primary-action'} disabled={disabled} onClick={()=>{setName(selected?.name??'');setDescription(selected?.description??'');setEditing(true);setMessage('');}}><Icon name={selected?'edit':'plus'}/>{selected?'Изменить коллекцию':'Новая коллекция'}</button>}
      {editing&&<form onSubmit={e=>{e.preventDefault();void action(async()=>{const payload={name:name.trim(),description};let saved:Collection;if(selected)saved=await api(`/collections/${selected.id}`,'PATCH',payload);else{const serialized=JSON.stringify(payload);if(!pending.current||pending.current.payload!==serialized)pending.current={payload:serialized,key:crypto.randomUUID()};saved=await api('/collections','POST',payload,pending.current.key);}await reload();onSelect?.(saved.id);setEditing(false);setMessage('Коллекция сохранена');});}}>
        <h3>{selected?'Редактировать подборку':'Новая коллекция'}</h3><label htmlFor="collection-name">Название коллекции</label><input autoFocus id="collection-name" value={name} onChange={e=>setName(e.target.value)} placeholder="Например, любимые кофейни" required maxLength={120} disabled={disabled}/><label htmlFor="collection-description">Описание коллекции</label><textarea id="collection-description" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Что объединяет эти места?" maxLength={1000} disabled={disabled}/><button disabled={disabled||!name.trim()}>{busy?'Сохраняем…':selected?'Сохранить коллекцию':'Создать коллекцию'}</button>
        <button type="button" className="secondary" disabled={disabled} onClick={()=>setEditing(false)}>Отмена</button>
      </form>}
      {selected&&<><div className="collection-title"><h3>{selected.name}</h3><span>{selected.note_count} мест</span></div>{selected.description&&<p className="muted">{selected.description}</p>}{notesLoading?<p role="status">Загружаем места…</p>:<ul className="results">{notes.map(note=><li className="collection-note" key={note.id}><button className="result" disabled={disabled} onClick={()=>onOpen?.(note)}><strong>{note.place.title}</strong><span>{note.rating==null?'Без оценки':`${note.rating}/10`}</span></button><button className="secondary" disabled={disabled} aria-label={`Убрать из коллекции: ${note.place.title}`} onClick={()=>void action(async()=>{await api(`/collections/${selected.id}/notes/${note.id}`,'DELETE');setMessage('Заметка исключена из коллекции');})}><Icon name="close"/></button></li>)}</ul>}
        {!notesLoading&&!notes.length&&<EmptyState icon="pin" title="Места ещё впереди" description="Открой сохранённую заметку и добавь её в эту коллекцию."/>}
        <ShareCollectionPanel key={selected.id} collectionId={selected.id} notes={notes} noteCount={selected.note_count} disabled={disabled||notesLoading}/>
        <ConfirmAction label="Удалить коллекцию" title="Удалить коллекцию?" description="Подборка будет удалена. Твои заметки и фотографии сохранятся." disabled={disabled} onConfirm={()=>void action(async()=>{await api(`/collections/${selected.id}`,'DELETE');onSelect?.(null);setMessage('Коллекция удалена, заметки сохранены');})}/></>}
      {!selectedId&&!editing&&<><ul className="results">{collections.map(row=><li key={row.id}><button className="result collection-card" disabled={disabled} onClick={()=>onSelect?.(row.id)}><span className="collection-card-icon"><Icon name="layers"/></span><div><strong>{row.name}</strong><span>{row.note_count} мест · Личная коллекция</span>{row.description&&<span>{row.description}</span>}</div><Icon name="chevron"/></button></li>)}</ul>
      {!loading&&!collections.length&&<EmptyState title="Собери своё любимое" description="Кофейни, прогулки или места для выходных — объедини заметки в личные подборки."/>}</>}
    </>}
    {loading&&<p role="status">Загружаем коллекции…</p>}<div aria-live="polite">{message&&<p>{message}</p>}{error&&<p role="alert" className="notice error">{error}</p>}</div>
  </section>;
}
