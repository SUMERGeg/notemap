import type { SharePreview } from './share-api';
import { placesCount } from '../../components/PlaceVisuals';
import { Icon } from '../../components/Icon';
import { SharedPhotos } from './SharedPhotos';
import { photoSource } from '../../local/shared-photos';
import { lazy,Suspense } from 'react';
const CollectionMap=lazy(()=>import('../../components/CollectionMap').then(module=>({default:module.CollectionMap})));

export function CollectionPreview({preview}:{preview:SharePreview}){
 const firstPhoto=preview.items.find(item=>item.photos?.length)?.photos?.[0];const cover=firstPhoto?photoSource(firstPhoto):null;
 return <section className="collection-invite"><div className="invite-heading">{cover?<img className="invite-cover" src={cover} alt="Обложка подборки"/>:<span className="invite-cover invite-cover-placeholder"><Icon name="bookmark"/></span>}<span className="invite-kicker">Коллекция Notemap</span><h1>{preview.name}</h1><p>{preview.author_name} · {placesCount(preview.items.length)}</p></div>{preview.description&&<p className="invite-description">{preview.description}</p>}
 {preview.items.length?<><Suspense fallback={<div className="invite-map-placeholder" role="status"><span className="spinner"/>Загружаем карту</div>}><CollectionMap points={preview.items}/></Suspense><details className="invite-places"><summary><span>Места в подборке</span><span>{preview.items.length}<Icon name="chevron"/></span></summary><ul className="invite-place-list">{preview.items.map(note=><li key={note.origin_note_id}><div className="invite-place-title"><h2>{note.place.title}</h2>{note.rating!=null&&<span><Icon name="star"/>{note.rating}/10</span>}</div>{note.text&&<p>{note.text}</p>}<SharedPhotos photos={note.photos}/></li>)}</ul></details></>:<div className="invite-empty"><Icon name="pin"/><h2>Пока нет мест</h2><p>Попроси автора прислать заполненную подборку.</p></div>}
 <p className="invite-privacy"><Icon name="lock"/>Сохранится отдельная копия. Личные места не изменятся.</p></section>;
}
