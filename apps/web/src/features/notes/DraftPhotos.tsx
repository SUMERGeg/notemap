import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import type { DraftPhoto } from '../../local/note-draft';
import { listPhotos } from '../../local/db';
import { getDirectPhoto } from '../../local/photos';
import { MAX_PHOTO_BYTES } from '../../local/photos';

export function DraftPhotos({photos,onChange,disabled,noteId}:{noteId?:string;photos:DraftPhoto[];onChange:(photos:DraftPhoto[])=>void;disabled:boolean}) {
  const [existing,setExisting]=useState<string[]>([]);
  useEffect(()=>{let alive=true;const releases:Array<()=>void>=[];setExisting([]);if(noteId)void listPhotos(noteId).then(async rows=>{const urls:string[]=[];for(const row of rows){const photo=await getDirectPhoto(row.id);if(!alive){photo.release();continue;}releases.push(photo.release);urls.push(photo.url);}if(alive)setExisting(urls);}).catch(()=>{if(alive)setError('Не удалось открыть сохранённые фото.');});return()=>{alive=false;releases.forEach(release=>release());};},[noteId]);
  const [sources,setSources]=useState<string[]>([]); const [error,setError]=useState('');
  useEffect(()=>{const urls=photos.map(photo=>URL.createObjectURL(photo.blob));setSources(urls);return()=>urls.forEach(url=>URL.revokeObjectURL(url));},[photos]);
  return <section className="draft-photos"><h3>Фотографии</h3><div className="draft-photo-grid">{existing.map((url,i)=><div key={url}><img src={url} alt={`Сохранённое фото ${i+1}`}/><span className="saved-photo-label">Сохранено</span></div>)}{photos.map((photo,i)=><div key={photo.id}><img src={sources[i]} alt={`Выбранное фото ${i+1}`}/><button type="button" aria-label={`Убрать выбранное фото ${i+1}`} disabled={disabled} onClick={()=>onChange(photos.filter(row=>row.id!==photo.id))}><Icon name="close"/></button></div>)}<label className="draft-photo-add"><Icon name="plus"/><span>Добавить фото</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled||photos.length+existing.length>=10} onChange={event=>{const files=Array.from(event.target.files??[]);event.target.value='';if(files.length+photos.length+existing.length>10||files.some(file=>!file.size||file.size>MAX_PHOTO_BYTES)){setError('До 10 фотографий, каждая — до 10 МБ.');return;}setError('');onChange([...photos,...files.map(blob=>({id:crypto.randomUUID(),blob}))]);}}/></label></div><p className="field-hint">Сохранятся вместе с заметкой · до 10 фото</p>{error&&<p role="alert">{error}</p>}</section>;
}
