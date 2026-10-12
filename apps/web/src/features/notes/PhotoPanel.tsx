import { useEffect, useRef, useState } from 'react';
import { ConfirmAction } from '../../components/ConfirmAction';
import { Icon } from '../../components/Icon';
import { deletePhoto, listPhotos, type LocalPhoto } from '../../local/db';
import { getDirectPhoto, MAX_PHOTO_BYTES, savePhoto } from '../../local/photos';

type Pending = {file: File; id: string};
export function PhotoPanel({ noteId, noteBusy, onChange }: {noteId: string; noteBusy: boolean; onChange?: () => void}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [photos,setPhotos] = useState<LocalPhoto[]>([]);
  const [urls,setUrls] = useState<Record<string,string>>({});
  const [pending,setPending] = useState<Pending[]>([]);
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [status,setStatus] = useState('');
  const generation = useRef(0);
  const releases = useRef<Array<() => void>>([]);
  function releaseUrls() { releases.current.forEach(release => release()); releases.current = []; }
  async function load(token = generation.current) {
    if (token !== generation.current) return;
    const list = await listPhotos(noteId);
    const loaded: Array<{id:string;url:string;release:()=>void}> = [];
    try { for (const photo of list) loaded.push({id:photo.id,...await getDirectPhoto(photo.id)}); }
    catch (failure) { loaded.forEach(photo => photo.release()); throw failure; }
    if (token !== generation.current) { loaded.forEach(photo => photo.release()); return; }
    releaseUrls(); releases.current = loaded.map(photo => photo.release);
    setPhotos(list); setUrls(Object.fromEntries(loaded.map(photo => [photo.id,photo.url])));
  }
  useEffect(() => {
    const token = ++generation.current;
    setLoading(true); setBusy(false); setPending([]); setPhotos([]); setUrls({}); setError('');
    void load(token).catch(failure => { if (token === generation.current) setError(failure instanceof Error ? failure.message : 'Не удалось открыть фото.'); }).finally(() => { if (token === generation.current) setLoading(false); });
    return () => { generation.current++; releaseUrls(); };
  },[noteId]);
  async function action(work: (token: number) => Promise<void>) {
    const token = generation.current;
    setBusy(true); setError('');
    try { await work(token); }
    catch (failure) { if (token === generation.current) setError(failure instanceof Error ? failure.message : 'Не удалось сохранить фото. Проверь свободное место.'); }
    finally { if (token === generation.current) { setBusy(false); setStatus(''); } }
  }
  async function upload(token: number) {
    for (const item of pending) {
      if (token !== generation.current) return;
      setStatus(`Сохраняем ${item.file.name}…`);
      await savePhoto(noteId,item.file,item.id);
      if (token !== generation.current) return;
      setPending(old => old.filter(row => row.id !== item.id));
      await load(token); if (token === generation.current) onChange?.();
    }
  }
  return <section className="photos" aria-label="Фотографии заметки">
    <div className="section-heading"><h3>Фотографии</h3><button className="text-action" disabled={busy || noteBusy} onClick={() => void action(token => load(token))}>Обновить</button></div>
    <label className="sr-only" htmlFor={`photos-${noteId}`}>Добавить фотографии</label>
    <input ref={fileInput} className="sr-only" tabIndex={-1} id={`photos-${noteId}`} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || noteBusy || loading || pending.length > 0 || photos.length >= 10} onChange={event => {
      const files = Array.from(event.target.files ?? []); event.target.value = ''; setError('');
      if (files.some(file => file.size <= 0 || file.size > MAX_PHOTO_BYTES)) { setError('Выбери JPEG, PNG или WebP размером до 10 МБ.'); return; }
      if (files.length + photos.length > 10) { setError('В заметке может быть максимум 10 фотографий.'); return; }
      setPending(files.map(file => ({file,id:crypto.randomUUID()})));
    }}/>
    {!!pending.length && <><p>Выбрано: {pending.map(item => item.file.name).join(', ')}</p><button disabled={busy || noteBusy} onClick={() => void action(upload)}>Сохранить фото</button><button className="secondary" disabled={busy || noteBusy} onClick={() => setPending([])}>Отменить выбор</button></>}
    {loading && <p role="status">Открываем фотографии…</p>}
    <div className="photo-grid">{photos.map((photo,index) => <figure key={photo.id}>
      <a href={urls[photo.id]} target="_blank" rel="noopener noreferrer"><img src={urls[photo.id]} alt={`Фото ${index + 1} к заметке`} onError={() => setError('Фото не открылось. Обнови галерею.')}/></a>
      <ConfirmAction label={`Удалить фото ${index + 1}`} title="Удалить фотографию?" description="Фотография исчезнет из заметки. Это действие нельзя отменить." disabled={busy || noteBusy} onConfirm={() => void action(async token => { await deletePhoto(photo.id); await load(token); if (token === generation.current) onChange?.(); })}/>
    </figure>)}<button type="button" className="photo-add-tile" aria-label="Выбрать фотографии" disabled={busy || noteBusy || loading || pending.length > 0 || photos.length >= 10} onClick={() => fileInput.current?.click()}><Icon name="plus"/></button></div>
    <p className="photo-caption">{photos.length}/10 · JPEG, PNG, WebP · до 10 МБ · хранятся на этом устройстве</p>
    <div aria-live="polite">{busy && <p role="status">{status || 'Обрабатываем…'}</p>}{error && <p className="notice error" role="alert">{error}</p>}</div>
  </section>;
}
