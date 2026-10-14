import { useEffect, useState } from 'react';
import { applyPwaUpdate, checkPwaUpdate } from '../../pwa';
import { Icon } from '../../components/Icon';

export function PwaUpdatePanel(){
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
  useEffect(()=>{const announce=()=>{setReady(true);setStatus('Новая версия готова.');};window.addEventListener('notemap-update-ready',announce);return()=>window.removeEventListener('notemap-update-ready',announce);},[]);
  async function check(){setBusy(true);setError('');try{const result=await checkPwaUpdate();setReady(result==='ready');setStatus(result==='ready'?'Новая версия готова.':result==='downloading'?'Загружается новая версия…':'Установлена актуальная версия.');}catch(failure){setError(failure instanceof Error?failure.message:'Нет связи с обновлениями. Попробуй позже.');}finally{setBusy(false);}}
  async function apply(){setBusy(true);setError('');try{await applyPwaUpdate();}catch(failure){setError(failure instanceof Error?failure.message:'Не удалось обновить приложение.');setBusy(false);}}
  return <section className="profile-card profile-update" aria-label="Обновление приложения">
    <button className="profile-row" disabled={busy} onClick={()=>void check()}><span className="profile-action-icon"><Icon name="arrow"/></span><span>Обновление приложения<small>{busy?'Проверяем…':'Проверить новую версию'}</small></span><Icon name="chevron"/></button>
    {ready&&<div className="profile-update-ready"><p>Перед обновлением сохрани незавершённые изменения.</p><button disabled={busy} onClick={()=>void apply()}>Обновить приложение</button></div>}
    <div aria-live="polite">{status&&<p className="profile-status" role="status">{status}</p>}{error&&<p className="profile-status error" role="alert">{error}</p>}</div>
  </section>;
}
