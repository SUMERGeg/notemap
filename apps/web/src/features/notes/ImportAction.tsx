import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { Icon } from '../../components/Icon';
import { importCollection, ImportError, findImportedCollection, previewRefresh, refreshCollection, type ImportedCollection, type RefreshDiff } from './import-api';
import { RefreshDiffPanel } from './RefreshDiffPanel';

export function ImportAction({token,origin,version,kind='collection'}:{token:string;origin:string;version:number;kind?:'collection'|'note'}) {
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [login,setLogin]=useState(false);const [register,setRegister]=useState(false);
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [message,setMessage]=useState('');const [saved,setSaved]=useState<ImportedCollection|null>(null);
  const key=useRef(crypto.randomUUID());
  const [existing,setExisting]=useState<ImportedCollection|null>(null);
  const [diff,setDiff]=useState<RefreshDiff|null>(null);
  const refreshKey=useRef(crypto.randomUUID());
  const [checking,setChecking]=useState(true);
  function recognize(row:ImportedCollection|null){
    setExisting(row);
    if(row&&row.snapshot_version>=version){setSaved(row);setMessage(row.snapshot_version===version?'Эта версия уже сохранена. Повторная копия не создана.':'У тебя сохранена более новая версия. Она не будет заменена старой.');}
  }
  useEffect(()=>{
    const abort=new AbortController();
    findImportedCollection(origin,abort.signal).then(row=>{if(!abort.signal.aborted)recognize(row);}).catch(err=>{if(!abort.signal.aborted&&!(err instanceof ImportError&&err.status===401))setError(err.message);}).finally(()=>{if(!abort.signal.aborted)setChecking(false);});
    return()=>abort.abort();
  },[origin,version]);
  async function save(){
    setBusy(true);setError('');setMessage('');
    try{
      const row=await findImportedCollection(origin);recognize(row);
      if(row){
        if(row.snapshot_version<version){const preview=await previewRefresh(row.id,token);refreshKey.current=crypto.randomUUID();setDiff(preview);requestAnimationFrame(()=>document.getElementById('refresh-heading')?.focus());}
      }else{const result=await importCollection(token,key.current);setSaved(result.collection);setMessage(result.status==='already_imported'?'Эта версия уже сохранена. Повторная копия не создана.':kind==='note'?'Копия заметки сохранена отдельным слоем. Твои заметки и оценки не изменены.':'Коллекция сохранена. Твои заметки и оценки не изменены.');}
    }
    catch(err){if(err instanceof ImportError&&err.status===401)setLogin(true);else setError(err instanceof Error?err.message:'Не удалось сохранить копию.');}
    finally{setBusy(false);}
  }
  async function confirmRefresh(){
    if(!diff||!existing)return;
    setBusy(true);setError('');setMessage('');
    try{const result=await refreshCollection(existing.id,token,diff.diff_token,refreshKey.current);setSaved(result.collection);setDiff(null);setMessage('Сохранённая копия обновлена. Твои заметки, фото и оценки не изменены.');}
    catch(err){
      if(err instanceof ImportError&&[401,404,409,410,422].includes(err.status)){setDiff(null);if(err.status===401)setLogin(true);}
      setError(err instanceof Error?err.message:'Не удалось обновить копию.');
    }finally{setBusy(false);}
  }
  return <div className="import-save">
    {saved?<a className="primary-link" href={`/#import=${saved.id}`}><Icon name="map"/>Открыть сохранённую копию на карте</a>:diff?<RefreshDiffPanel diff={diff} busy={busy} kind={kind} onConfirm={()=>void confirmRefresh()} onCancel={()=>{setDiff(null);setError('');setMessage('Сохранённая версия оставлена без изменений.');}}/>:!login?<button className="primary-link" disabled={busy||checking} onClick={()=>void save()}>{checking?'Проверяем сохранённые коллекции…':busy?'Подготавливаем…':existing?'Посмотреть изменения':'Добавить на мою карту'}</button>:<form className="import-login" onSubmit={event=>{event.preventDefault();setBusy(true);setError('');void api(`/auth/${register?'register':'login'}`,'POST',{email,password}).then(async()=>{setPassword('');setLogin(false);setMessage('Вход выполнен. Сохранение или обновление потребует твоего подтверждения.');recognize(await findImportedCollection(origin));}).catch(err=>setError(err.message)).finally(()=>setBusy(false));}}>
      <h3>{register?'Создать аккаунт':'Войти для сохранения'}</h3><p>После входа ты сможешь подтвердить сохранение независимой копии.</p>
      <label htmlFor="import-email">Email</label><input id="import-email" type="email" autoComplete="username" required maxLength={320} value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/>
      <label htmlFor="import-password">Пароль</label><input id="import-password" type="password" autoComplete={register?'new-password':'current-password'} required minLength={10} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/>
      <button disabled={busy}>{busy?'Подожди…':register?'Создать аккаунт':'Войти'}</button><button type="button" className="secondary" disabled={busy} onClick={()=>{setRegister(value=>!value);setError('');}}>{register?'Уже есть аккаунт':'Создать аккаунт'}</button>
    </form>}
    <div aria-live="polite">{message&&<p className="notice">{message}</p>}{error&&<p role="alert" className="notice error">{error}</p>}</div>
  </div>;
}
