import { useEffect, useState } from 'react';
import { applyPwaUpdate, checkPwaUpdate } from '../../pwa';

export function PwaUpdatePanel(){
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
  useEffect(()=>{const announce=()=>{setReady(true);setStatus('Новая версия готова.');};window.addEventListener('notemap-update-ready',announce);return()=>window.removeEventListener('notemap-update-ready',announce);},[]);
  async function check(){setBusy(true);setError('');try{const result=await checkPwaUpdate();setReady(result==='ready');setStatus(result==='ready'?'Новая версия готова.':result==='downloading'?'Загружается новая версия…':'Установлена актуальная версия.');}catch(failure){setError(failure instanceof Error?failure.message:'Нет связи с обновлениями. Попробуй позже.');}finally{setBusy(false);}}
  async function apply(){setBusy(true);setError('');try{await applyPwaUpdate();}catch(failure){setError(failure instanceof Error?failure.message:'Не удалось обновить приложение.');setBusy(false);}}
  return <section className="storage-panel" aria-label="Обновление приложения"><h3>Обновление Notemap</h3><p>Переустановка не нужна. Перед обновлением сохрани незавершённые изменения. Сохранённые заметки и фото остаются на устройстве.</p><button className="secondary" disabled={busy} onClick={()=>void check()}>{busy?'Подождите…':'Проверить обновления'}</button>{ready&&<button disabled={busy} onClick={()=>void apply()}>Обновить приложение</button>}<div aria-live="polite">{status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}</div></section>;
}
