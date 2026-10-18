import { useEffect,useState } from 'react';
import { Icon } from '../../components/Icon';
import type { ShareOptions,SharePreview } from './share-api';
import { createFileSnapshot,downloadJson,encodeSnapshot } from '../../local/file-share';
import { readState } from '../../local/db';
import { cloudSharingEnabled,publishCollection,readCloudSnapshot } from '../../local/cloud-share';
import { acceptSnapshot,previewFileImport,snapshotDiff } from '../../local/file-share';
import type { ImportedLayer,RefreshDiff } from './import-api';
import { RefreshDiffPanel } from './RefreshDiffPanel';
import { SharedPhotos } from './SharedPhotos';
import './cloud-share.css';
export function ShareLinksPanel({collectionId,noteId,version=0}:{collectionId?:string;noteId?:string;version?:number;onRevoke?:(id:string)=>void}){
 const [links,setLinks]=useState<{url:string;expires_at:string;name:string;origin_collection_id:string}[]>([]);
 const [files,setFiles]=useState<SharePreview[]>([]);const [error,setError]=useState('');
 useEffect(()=>{let alive=true;readState().then(s=>{if(alive){setFiles(s.snapshots.filter((p:any)=>!(collectionId||noteId)||p.origin_collection_id===(noteId??collectionId)).slice().reverse());setLinks(Object.entries(s.receipts).filter(([key,value])=>key.startsWith('cloud-share:')&&(!(collectionId||noteId)||value.origin_collection_id===(noteId??collectionId))).map(([,value])=>value).reverse());}}).catch(e=>setError(e.message));return()=>{alive=false;};},[collectionId,noteId,version]);
 return <section className="share-links">{!!links.length&&<><h3>Созданные ссылки</h3>{links.map(link=><label key={link.url}>{link.name} · {Date.parse(link.expires_at)>Date.now()?`до ${new Date(link.expires_at).toLocaleDateString('ru-RU')}`:'Срок истёк'}<input readOnly value={link.url} onFocus={e=>e.target.select()}/></label>)}</>}<h3>Созданные файлы</h3><p className="muted">Отправленный файл нельзя отозвать. Для обновления создай новую версию.</p>{files.map(p=><button key={p.snapshot_id} className="secondary" onClick={()=>downloadJson(encodeSnapshot(p),`notemap-${p.kind}-v${p.version}.json`)}><Icon name="share"/>{p.name} · версия {p.version}</button>)}{error&&<p role="alert">{error}</p>}</section>;
}
export function ShareCollectionPanel({collectionId,noteId,disabled=false}:{collectionId?:string;noteId?:string;disabled?:boolean;notes?:unknown[];noteCount?:number}){
 const [opened,setOpened]=useState(!!noteId);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [version,setVersion]=useState(0);const [message,setMessage]=useState('');
 const [includePhotos,setIncludePhotos]=useState(true);const [link,setLink]=useState<{url:string;expires_at:string}|null>(null);
 const [options,setOptions]=useState<ShareOptions>({author_name:'Автор подборки',include_text:false,include_ratings:false,include_visited_on:false});
 async function create(){setBusy(true);setError('');try{
  const snapshot=await createFileSnapshot(noteId??collectionId!,noteId?'note':'collection',options);
  downloadJson(encodeSnapshot(snapshot),`notemap-${snapshot.kind}-v${snapshot.version}.json`);setVersion(n=>n+1);setMessage(`Версия ${snapshot.version} сохранена. Отправь файл получателю.`);
 }catch(e){setError(e instanceof Error?e.message:'Не удалось создать файл.');}finally{setBusy(false);}}
 async function publish(){if(!collectionId)return;setBusy(true);setError('');setMessage('');try{setLink(await publishCollection(collectionId,options,includePhotos));setVersion(n=>n+1);}catch(e){setError(e instanceof Error?e.message:'Не удалось опубликовать коллекцию.');}finally{setBusy(false);}}
 async function copyLink(){if(!link)return;try{await navigator.clipboard.writeText(link.url);setMessage('Ссылка скопирована.');}catch{setMessage('Выдели и скопируй ссылку из поля.');}}
 return <section className="share-collection"><button className="secondary" disabled={disabled||busy} aria-expanded={opened} onClick={()=>setOpened(x=>!x)}><Icon name="share"/>{noteId?'Поделиться заметкой':'Поделиться коллекцией'}</button>{opened&&<><form onSubmit={e=>{e.preventDefault();void create();}}><h3>Что включить в подборку</h3><label>Имя автора<input value={options.author_name} maxLength={80} required onChange={e=>setOptions({...options,author_name:e.target.value})}/></label>{([['include_text',noteId?'Текст заметки':'Тексты заметок и описание коллекции'],['include_ratings','Оценки мест и предметов'],['include_visited_on','Дата посещения']] as const).map(([id,title])=><label className="share-option" key={id}><input type="checkbox" checked={options[id]} onChange={e=>setOptions({...options,[id]:e.target.checked})}/>{title}</label>)}
 {collectionId&&cloudSharingEnabled&&<><label className="share-option"><input type="checkbox" checked={includePhotos} onChange={e=>setIncludePhotos(e.target.checked)}/>Фотографии — при обмене ссылкой</label><p className="muted">Ссылка действует 7 дней. Снимок и выбранные фото загружаются в Supabase и доступны каждому, кому передана ссылка. Затем удаляются из облака; импортированные копии сохраняются. До 40 МБ на ссылку.</p><button type="button" disabled={busy||disabled||!options.author_name.trim()} onClick={()=>void publish()}>{busy?'Загружаем подборку…':'Создать ссылку на 7 дней'}</button></>}
 <p className="muted">Файл подборки передаёт выбранные сведения без фото. Отправленный файл нельзя отозвать.</p><button className="secondary" disabled={busy||disabled}>{busy?'Создаём…':'Скачать файл подборки'}</button></form>
 {link&&<div className="cloud-link-result"><label>Ссылка на коллекцию<input readOnly value={link.url} onFocus={e=>e.target.select()}/></label><p>Доступна до {new Date(link.expires_at).toLocaleString('ru-RU')}</p><button type="button" onClick={()=>void copyLink()}>Скопировать ссылку</button></div>}
 <ShareLinksPanel collectionId={collectionId} noteId={noteId} version={version}/></>}{error&&<p role="alert" className="notice error">{error}</p>}{message&&<p role="status">{message}</p>}</section>;
}
export function SharePreviewPage({token}:{token:string}){
 const [preview,setPreview]=useState<SharePreview|null>(null);const [current,setCurrent]=useState<ImportedLayer>();const [diff,setDiff]=useState<RefreshDiff|null>(null);const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [saved,setSaved]=useState<string|null>(null);const [retry,setRetry]=useState(0);
 useEffect(()=>{const abort=new AbortController();setPreview(null);setDiff(null);setError('');setLoading(true);setSaved(null);
  void readCloudSnapshot(token,abort.signal).then(async p=>{const existing=await previewFileImport(p);if(abort.signal.aborted)return;setCurrent(existing);if(existing?.snapshot_id===p.snapshot_id){setSaved(existing.id);return;}setDiff(existing?snapshotDiff(existing,p):null);setPreview(p);}).catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Не удалось открыть подборку.');}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
  return()=>abort.abort();
 },[token,retry]);
 async function accept(){if(!preview)return;setBusy(true);setError('');try{const result=await acceptSnapshot(preview,current?.snapshot_version);setSaved(result.id);setPreview(null);setDiff(null);}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить копию.');}finally{setBusy(false);}}
 return <main className="share-preview-page cloud-preview"><a href={import.meta.env.BASE_URL}>← На мою карту</a><h1>{preview?.name??'Коллекция Notemap'}</h1>{loading&&<p role="status">Загружаем коллекцию и фотографии…</p>}{error&&<><p className="notice error" role="alert">{error}</p><button disabled={loading||busy} onClick={()=>setRetry(n=>n+1)}>Повторить</button></>}
 {preview&&<><p>{preview.author_name} · {preview.items.length} мест · Версия {preview.version}</p><p className="muted">Имя автора не подтверждено. Ссылка доступна до {new Date(preview.expires_at).toLocaleString('ru-RU')}. Сохрани копию, чтобы места и фото остались на устройстве.</p>{preview.description&&<p>{preview.description}</p>}
 {diff?<RefreshDiffPanel diff={diff} busy={busy} onConfirm={()=>void accept()} onCancel={()=>{setDiff(null);setPreview(null);}}/>:<><ul className="results cloud-preview-items">{preview.items.map(note=><li key={note.origin_note_id}><h2>{note.place.title}</h2>{note.text&&<p>{note.text}</p>}{note.rating!=null&&<p>Оценка автора: {note.rating}/10</p>}<SharedPhotos photos={note.photos}/></li>)}</ul><button disabled={busy} onClick={()=>void accept()}>{busy?'Сохраняем…':'Сохранить коллекцию с фото'}</button></>}
 <p className="muted">Сохранится независимая копия. Личные заметки не изменятся. Для обновления потребуется новая ссылка и твоё подтверждение.</p></>}
 {saved&&<><p role="status">Копия с фотографиями сохранена на этом устройстве.</p><a className="primary-link" href={`${import.meta.env.BASE_URL}#import=${saved}`}>Открыть коллекцию на карте</a></>}
 </main>;
}
