import { useEffect, useRef, useState } from 'react';
import { downloadArchive, parseArchive, prepareServerMigration, restoreArchive, serializeArchive, type DatabaseArchive } from '../../local/archive';

function size(value: number) { return `${(value / 1024 / 1024).toFixed(1)} МБ`; }
export function StoragePanel({onRestored}: {onRestored?: () => void}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [usage,setUsage] = useState<StorageEstimate | null>(null);
  const [persisted,setPersisted] = useState<boolean | null>(null);
  const [busy,setBusy] = useState(false);
  const [status,setStatus] = useState('');
  const [error,setError] = useState('');
  const [candidate,setCandidate] = useState<DatabaseArchive | null>(null);
  const [source,setSource] = useState('');
  const [confirmed,setConfirmed] = useState(false);
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  async function updateUsage() {
    if (!navigator.storage) return;
    setUsage(await navigator.storage.estimate());
    if (navigator.storage.persisted) setPersisted(await navigator.storage.persisted());
  }
  useEffect(() => { void updateUsage().catch(() => {}); },[]);
  async function action(work: () => Promise<void>) {
    setBusy(true); setError(''); setStatus('');
    try { await work(); await updateUsage(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Не удалось обработать данные. Локальная копия не заменена.'); }
    finally { setBusy(false); }
  }
  function prepare(contents: DatabaseArchive, label: string) { setCandidate(contents); setSource(label); setConfirmed(false); }
  const localServer = ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
  return <section className="storage-panel" aria-label="Локальное хранилище и резервные копии">
    <h3>Данные на этом устройстве</h3>
    <p>Заметки, фотографии, оценки и коллекции хранятся в этом браузере. Резервный файл переносит полную копию на другое устройство.</p>
    {usage && <p>Занято: {size(usage.usage ?? 0)}{usage.quota != null ? ` из ${size(usage.quota)}` : ''}.</p>}
    <p>{persisted === true ? 'Браузер предоставил постоянное хранение.' : 'Очистка данных браузера удаляет заметки. Регулярно сохраняй резервную копию.'}</p>
    {persisted !== true && navigator.storage?.persist && <button type="button" className="secondary" disabled={busy} onClick={() => void action(async () => {
      const result = await navigator.storage.persist(); setPersisted(result);
      setStatus(result ? 'Постоянное хранение включено.' : 'Браузер пока не разрешил постоянное хранение. Резервный файл остаётся способом защиты данных.');
    })}>Запросить постоянное хранение</button>}
    <div className="dialog-actions">
      <button type="button" disabled={busy} onClick={() => void action(async () => { setStatus('Подготавливаем файл с фотографиями…'); downloadArchive(await serializeArchive()); setStatus('Резервный файл подготовлен. Проверь его в загрузках.'); })}>Скачать полную резервную копию</button>
      <button type="button" className="secondary" disabled={busy} onClick={() => fileInput.current?.click()}>Восстановить из файла</button>
    </div>
    <p className="photo-caption">Файл содержит личные тексты и фото. Храни его в своём защищённом хранилище. Максимум 256 МБ на файл, 128 МБ фотографий.</p>
    <input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" aria-label="Полная резервная копия Notemap" disabled={busy} onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      setCandidate(null); setConfirmed(false);
      void action(async () => { setStatus('Проверяем данные и фотографии…'); prepare(await parseArchive(file),file.name); setStatus('Файл проверен. Подтверди восстановление.'); });
    }}/>
    <details>
      <summary>Перенести данные из прежнего серверного аккаунта</summary>
      <p>Открой эту версию Notemap на прежнем локальном адресе (обычно http://127.0.0.1:5173) с запущенным API. Введи данные существующего аккаунта. Во время переноса не редактируй серверные записи. Серверная копия сохранится; старые ссылки обмена не переносятся.</p>
      {!localServer && <p>На этом адресе перенос недоступен. Подготовь локальную копию на прежнем сервере, скачай резервный файл и восстанови его здесь.</p>}
      <form onSubmit={event => { event.preventDefault(); setCandidate(null); setConfirmed(false); void action(async () => {
        try { prepare(await prepareServerMigration(email,password,setStatus),'Серверный аккаунт'); }
        finally { setPassword(''); }
      }); }}>
        <label>Email существующего аккаунта<input type="email" value={email} autoComplete="off" required maxLength={320} disabled={busy || !localServer} onChange={event => setEmail(event.target.value)}/></label>
        <label>Пароль<input type="password" value={password} autoComplete="off" required minLength={10} maxLength={128} disabled={busy || !localServer} onChange={event => setPassword(event.target.value)}/></label>
        <button disabled={busy || !localServer}>Прочитать серверную копию</button>
      </form>
    </details>
    {candidate && <div className="notice">
      <p>{source}: {candidate.state.notes.length} заметок, {candidate.photos.length} фото, {candidate.state.collections.length} коллекций, {candidate.state.imports.length} импортированных коллекций.</p>
      <p>Восстановление заменит все данные в этом браузере. Сначала скачай текущую резервную копию, если она нужна.</p>
      <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)}/>Подтверждаю замену локальных данных этой проверенной копией</label>
      <div className="dialog-actions"><button type="button" disabled={busy || !confirmed} onClick={() => void action(async () => {
        await restoreArchive(candidate,confirmed); setCandidate(null); setConfirmed(false); setStatus('Копия восстановлена.'); onRestored?.();
      })}>Заменить локальную копию</button><button type="button" className="secondary" disabled={busy} onClick={() => { setCandidate(null); setConfirmed(false); setStatus(''); }}>Отмена</button></div>
    </div>}
    <div aria-live="polite">{status && <p role="status">{status}</p>}{error && <p className="notice error" role="alert">{error}</p>}</div>
  </section>;
}
