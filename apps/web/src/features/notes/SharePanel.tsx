import { useEffect,useState } from 'react';
import { Icon } from '../../components/Icon';
import type { ShareOptions,SharePreview } from './share-api';
import { createFileSnapshot,downloadJson,encodeSnapshot } from '../../local/file-share';
import { readState } from '../../local/db';
export function ShareLinksPanel({collectionId,noteId,version=0}:{collectionId?:string;noteId?:string;version?:number;onRevoke?:(id:string)=>void}){
 const [files,setFiles]=useState<SharePreview[]>([]);const [error,setError]=useState('');
 useEffect(()=>{let alive=true;readState().then(s=>{if(alive)setFiles(s.snapshots.filter((p:any)=>!(collectionId||noteId)||p.origin_collection_id===(noteId??collectionId)).slice().reverse());}).catch(e=>setError(e.message));return()=>{alive=false;};},[collectionId,noteId,version]);
 return <section className="share-links"><h3>Созданные файлы</h3><p className="muted">Отправленный файл нельзя отозвать. Для обновления создай новую версию.</p>{files.map(p=><button key={p.snapshot_id} className="secondary" onClick={()=>downloadJson(encodeSnapshot(p),`notemap-${p.kind}-v${p.version}.json`)}><Icon name="share"/>{p.name} · версия {p.version}</button>)}{error&&<p role="alert">{error}</p>}</section>;
}
export function ShareCollectionPanel({collectionId,noteId,disabled=false}:{collectionId?:string;noteId?:string;disabled?:boolean;notes?:unknown[];noteCount?:number}){
 const [opened,setOpened]=useState(!!noteId);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [version,setVersion]=useState(0);const [message,setMessage]=useState('');
 const [options,setOptions]=useState<ShareOptions>({author_name:'Автор подборки',include_text:false,include_ratings:false,include_visited_on:false});
 async function create(){setBusy(true);setError('');try{
  const snapshot=await createFileSnapshot(noteId??collectionId!,noteId?'note':'collection',options);
  downloadJson(encodeSnapshot(snapshot),`notemap-${snapshot.kind}-v${snapshot.version}.json`);setVersion(n=>n+1);setMessage(`Версия ${snapshot.version} сохранена. Отправь файл получателю.`);
 }catch(e){setError(e instanceof Error?e.message:'Не удалось создать файл.');}finally{setBusy(false);}}
 return <section className="share-collection"><button className="secondary" disabled={disabled||busy} aria-expanded={opened} onClick={()=>setOpened(x=>!x)}><Icon name="share"/>{noteId?'Поделиться заметкой':'Поделиться коллекцией'}</button>{opened&&<><form onSubmit={e=>{e.preventDefault();void create();}}><h3>Что включить в файл</h3><label>Имя автора<input value={options.author_name} maxLength={80} required onChange={e=>setOptions({...options,author_name:e.target.value})}/></label>{([['include_text',noteId?'Текст заметки':'Тексты заметок и описание коллекции'],['include_ratings','Оценки мест и предметов'],['include_visited_on','Дата посещения']] as const).map(([id,title])=><label className="share-option" key={id}><input type="checkbox" checked={options[id]} onChange={e=>setOptions({...options,[id]:e.target.checked})}/>{title}</label>)}<p className="muted">По умолчанию передаются только места и категории. Фото не включаются. Доступ к файлу получит любой, кому ты его отправишь.</p><button disabled={busy||disabled}>{busy?'Создаём…':'Скачать файл подборки'}</button></form><ShareLinksPanel collectionId={collectionId} noteId={noteId} version={version}/></>}{error&&<p role="alert" className="notice error">{error}</p>}{message&&<p role="status">{message}</p>}</section>;
}
export function SharePreviewPage({token:_token}:{token:string}){
 return <main className="share-preview-page"><h1>Это ссылка серверной версии</h1><p>Локальная версия Notemap принимает файлы подборок. Попроси автора экспортировать и прислать файл.</p><a href={import.meta.env.BASE_URL}>Открыть карту</a></main>;
}
