import type { SharedNote } from './share-api';
import type { RefreshDiff } from './import-api';
import { categoryTitle } from '../../components/PlaceVisuals';
import { SharedPhotos } from './SharedPhotos';

function fields(note:SharedNote):Record<string,string> {
  return {
    'Название':note.place.title,
    'Адрес':note.place.address||'Не передан',
    'Расположение':`${note.place.latitude}, ${note.place.longitude}`,
    'Категория':categoryTitle(note.category),
    'Текст':note.text??'Не передан',
    'Оценка':note.rating==null?'Не передана':`${note.rating}/10`,
    'Дата посещения':note.visited_on?new Date(`${note.visited_on}T12:00:00`).toLocaleDateString('ru-RU'):'Не передана',
    'Оценки предметов':note.item_reviews?.map(item=>`${item.name}: ${item.rating}/10`).join(', ')||'Не переданы',
    'Источник':note.place.attribution??note.place.origin,
    'Лицензия':note.place.source_license??'Не передана',
  };
}

function NoteList({title,items}:{title:string;items:SharedNote[]}) {
  if(!items.length)return null;
  return <section className="refresh-group"><h4>{title} · {items.length}</h4><ul>{items.map(note=><li key={note.origin_note_id}><strong>{note.place.title}</strong><span>{note.place.address||categoryTitle(note.category)}</span></li>)}</ul></section>;
}

export function RefreshDiffPanel({diff,busy,onConfirm,onCancel,kind='collection'}:{diff:RefreshDiff;busy:boolean;onConfirm:()=>void;onCancel:()=>void;kind?:'collection'|'note'}) {
  const metadataLabels={name:kind==='note'?'Название места':'Название коллекции',author_name:'Имя автора',description:'Описание'};
  return <section className="refresh-preview" aria-labelledby="refresh-heading">
    <h3 id="refresh-heading" tabIndex={-1}>{kind==='note'?'Изменения заметки':'Изменения коллекции'}</h3>
    <p className="muted">Версия {diff.current_version} → {diff.target_version}</p>
    <div className="refresh-counts"><span className="added">+{diff.added.length} новых</span><span className="changed">{diff.changed.length} изменены</span><span className="removed">−{diff.removed.length} удалены</span></div>
    {(Object.keys(metadataLabels) as (keyof typeof metadataLabels)[]).filter(key=>diff.metadata_before[key]!==diff.metadata_after[key]).map(key=><div className="refresh-change" key={key}><strong>{metadataLabels[key]}</strong><div><p><small>Было</small>{diff.metadata_before[key]||'Без описания'}</p><p><small>Станет</small>{diff.metadata_after[key]||'Без описания'}</p></div></div>)}
    <NoteList title="Добавятся" items={diff.added}/>
    {!!diff.changed.length&&<section className="refresh-group"><h4>Изменятся · {diff.changed.length}</h4>{diff.changed.map(({before,after})=>{
      const oldFields=fields(before),newFields=fields(after);
      return <details key={after.origin_note_id}><summary>{after.place.title}</summary>{Object.keys(oldFields).filter(key=>oldFields[key]!==newFields[key]).map(key=><div className="refresh-change" key={key}><strong>{key}</strong><div><p><small>Было</small>{oldFields[key]}</p><p><small>Станет</small>{newFields[key]}</p></div></div>)}{JSON.stringify(before.photos??[])!==JSON.stringify(after.photos??[])&&<div className="refresh-change"><strong>Фотографии</strong><div><section><p>Было: {before.photos?.length??0}</p><SharedPhotos photos={before.photos}/></section><section><p>Станет: {after.photos?.length??0}</p><SharedPhotos photos={after.photos}/></section></div></div>}</details>;
    })}</section>}
    <NoteList title="Уберутся из копии" items={diff.removed}/>
    {!diff.added.length&&!diff.changed.length&&!diff.removed.length&&<p className="muted">Состав мест не изменился. Будет сохранена новая версия снимка.</p>}
    <p className="refresh-warning">{kind==='note'?'Обновится только эта импортированная копия заметки.':'Обновится только эта импортированная коллекция.'} Твои личные заметки, фото и оценки сохранятся. Автоматического обновления нет.</p>
    <div className="refresh-buttons"><button className="primary-link" disabled={busy} onClick={onConfirm}>{busy?'Обновляем…':`Подтвердить обновление до версии ${diff.target_version}`}</button><button className="outline-action" disabled={busy} onClick={onCancel}>Оставить текущую версию</button></div>
  </section>;
}
