import type { SharePreview } from './share-api';
import { placesCount } from '../../components/PlaceVisuals';
import { Icon } from '../../components/Icon';
import { SharedPhotos } from './SharedPhotos';
import { photoSource } from '../../local/shared-photos';
import { lazy, Suspense } from 'react';
const CollectionMap = lazy(()=>import('../../components/CollectionMap').then(module=>({default:module.CollectionMap})));

export function CollectionPreview({preview}:{preview:SharePreview}) {
  const firstPhoto=preview.items.find(item=>item.photos?.length)?.photos?.[0];
  const cover=firstPhoto?photoSource(firstPhoto):null;
  return <><div className="collection-preview-heading">{cover?<img className="collection-preview-cover" src={cover} alt="Обложка подборки"/>:<span className="collection-preview-placeholder"><Icon name="bookmark"/></span>}<div><span className="eyebrow">Подборка мест</span><h2>{preview.name}</h2><p>{preview.author_name} · {placesCount(preview.items.length)}</p></div></div>{preview.description&&<p className="collection-description">{preview.description}</p>}<Suspense fallback={<p role="status">Открываем карту подборки…</p>}><CollectionMap points={preview.items}/></Suspense><div className="import-notice"><Icon name="layers"/><div><h3>Сохранится твоя копия</h3><p>Личные заметки останутся без изменений. Обновление — только по новой ссылке с твоим подтверждением.</p></div></div><details className="preview-places"><summary>Посмотреть места ({preview.items.length})</summary><ul className="results cloud-preview-items">{preview.items.map(note=><li key={note.origin_note_id}><h3>{note.place.title}</h3>{note.text&&<p>{note.text}</p>}{note.rating!=null&&<p className="muted">Оценка автора: {note.rating}/10</p>}<SharedPhotos photos={note.photos}/></li>)}</ul></details></>;
}
