import { useState } from 'react';
import type { SharePreview } from './share-api';
import type { ImportedLayer,RefreshDiff } from './import-api';
import { readSnapshotFile,previewFileImport,snapshotDiff,acceptSnapshot } from '../../local/file-share';
import { RefreshDiffPanel } from './RefreshDiffPanel';
import { CollectionMap } from '../../components/CollectionMap';
export function FileImportPanel({onChange}:{onChange:()=>Promise<void>}){
 const [preview,setPreview]=useState<SharePreview|null>(null);const [current,setCurrent]=useState<ImportedLayer>();const [diff,setDiff]=useState<RefreshDiff|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function choose(file:File){setBusy(true);setError('');setMessage('');setPreview(null);setDiff(null);try{
  const p=await readSnapshotFile(file);const existing=await previewFileImport(p);
  if(existing?.snapshot_id===p.snapshot_id){setMessage('Этот файл уже сохранён на твоей карте.');return;}
  const d=existing?snapshotDiff(existing,p):null;setCurrent(existing);setPreview(p);setDiff(d);
 }catch(e){setError(e instanceof Error?e.message:'Не удалось открыть файл.');}finally{setBusy(false);}}
 async function accept(){if(!preview)return;setBusy(true);setError('');try{await acceptSnapshot(preview,current?.snapshot_version);await onChange();setPreview(null);setDiff(null);setMessage('Копия сохранена. Личные заметки не изменились.');}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить файл.');}finally{setBusy(false);}}
 return <section className="file-import"><label>Открыть файл подборки<input type="file" accept="application/json,.json" disabled={busy} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void choose(f);}}/></label>{preview&&<><h3>{preview.name}</h3><p>{preview.author_name} · Версия {preview.version} · {preview.items.length} мест</p><p className="muted">Файл получен извне. Имя автора и сведения о местах не подтверждают его личность. Никаких автоматических обновлений.</p><CollectionMap points={preview.items}/>{diff?<RefreshDiffPanel diff={diff} busy={busy} kind={preview.kind} onConfirm={()=>void accept()} onCancel={()=>{setPreview(null);setDiff(null);}}/>:<><ul className="results">{preview.items.map(n=><li key={n.origin_note_id}><strong>{n.place.title}</strong>{n.text&&<p>{n.text}</p>}{n.rating!=null&&<p>Оценка автора: {n.rating}/10</p>}</li>)}</ul><button disabled={busy} onClick={()=>void accept()}>Добавить независимую копию</button><button className="secondary" onClick={()=>setPreview(null)}>Отмена</button></>}</>}{error&&<p className="notice error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}</section>;
}
