import { useEffect, useState } from 'react';
import { api } from './api';
import { Icon } from '../../components/Icon';
import { EmptyState } from '../../components/EmptyState';
export type ItemType = { id: string; name: string };
type Review = { item_type_id: string; name: string; rating: number };
export async function loadItemTypes(): Promise<ItemType[]> {
  const items: ItemType[] = []; let cursor: string | null = null;
  do { const page = await api(`/item-types${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`); items.push(...page.items); cursor = page.next_cursor; } while (cursor);
  return items;
}
export function ItemReviews({ noteId, noteBusy, onChange }: { noteId: string; noteBusy: boolean; onChange: () => void }) {
  const [types,setTypes] = useState<ItemType[]>([]);
  const [reviews,setReviews] = useState<Review[]>([]);
  const [name,setName] = useState(''); const [rating,setRating] = useState('');
  const [busy,setBusy] = useState(false); const [loading,setLoading] = useState(true); const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const [opened,setOpened] = useState(false);
  async function reload() { const [dictionary,rows] = await Promise.all([loadItemTypes(),api(`/notes/${noteId}/item-reviews`)]); setTypes(dictionary); setReviews(rows); }
  useEffect(() => { let alive = true; Promise.all([loadItemTypes(),api(`/notes/${noteId}/item-reviews`)]).then(([dictionary,rows]) => { if (alive) { setTypes(dictionary); setReviews(rows); } }).catch(err => { if (alive) setError(err.message); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, [noteId]);
  async function action(work: () => Promise<void>) { setBusy(true); setError(''); setMessage(''); try { await work(); await reload(); onChange(); } catch(err) { setError(err instanceof Error ? err.message : 'Не удалось сохранить оценку.'); } finally { setBusy(false); } }
  const disabled = busy || noteBusy || loading;
  return <section className="item-reviews" aria-label="Оценки предметов"><h3>Оценки предметов</h3>
    {loading && <p role="status">Загружаем оценки…</p>}
    <ul className="item-review-list">{reviews.map(review => <li key={review.item_type_id}><span className="item-thumbnail"><Icon name="food"/></span><strong>{review.name}</strong><span className="rating-badge"><Icon name="star"/> {review.rating}</span><button type="button" className="secondary" disabled={disabled} aria-label={`Изменить оценку: ${review.name}`} onClick={() => { setName(review.name); setRating(String(review.rating)); setOpened(true); }}> <Icon name="edit"/></button><button type="button" className="secondary" disabled={disabled} aria-label={`Удалить оценку: ${review.name}`} onClick={() => void action(async () => { await api(`/notes/${noteId}/item-reviews/${review.item_type_id}`,'DELETE'); setMessage('Оценка предмета удалена'); })}><Icon name="close"/></button></li>)}</ul>
    {!opened&&<button className="add-item-button" type="button" disabled={disabled} onClick={()=>setOpened(true)}><Icon name="plus"/>Добавить предмет</button>}
    <form hidden={!opened} onSubmit={e => { e.preventDefault(); void action(async () => { const item: ItemType = await api('/item-types','POST',{name:name.trim()}); await api(`/notes/${noteId}/item-reviews/${item.id}`,'PUT',{rating:Number(rating)}); setName(''); setRating(''); setOpened(false); setMessage('Оценка предмета сохранена'); }); }}>
      <label htmlFor="item-name">Название предмета</label><input id="item-name" list="item-suggestions" value={name} onChange={e => setName(e.target.value)} placeholder="Например, Борщ" maxLength={100} required disabled={disabled} /><datalist id="item-suggestions">{types.map(item => <option key={item.id} value={item.name} />)}</datalist>
      <label htmlFor="item-rating">Оценка предмета 1–10</label><input id="item-rating" type="number" min={1} max={10} step={1} required value={rating} onChange={e => setRating(e.target.value)} disabled={disabled} />
      <button disabled={disabled || !name.trim()}>{busy ? 'Сохраняем…' : 'Сохранить оценку предмета'}</button>
      <button type="button" className="text-action" disabled={busy} onClick={()=>setOpened(false)}>Отмена</button>
    </form><div aria-live="polite">{message && <p>{message}</p>}{error && <p className="notice error" role="alert">{error}</p>}</div>
  </section>;
}

export function ItemRatingsSummary({noteId,version,onEdit}:{noteId:string;version:number;onEdit:()=>void}) {
  const [reviews,setReviews]=useState<Review[]>([]);
  useEffect(()=>{let alive=true;api(`/notes/${noteId}/item-reviews`).then(rows=>{if(alive)setReviews(rows);}).catch(()=>{});return()=>{alive=false;};},[noteId,version]);
  return <section className="item-summary"><div className="section-heading"><h3>Мои оценки предметов</h3><button className="text-action" onClick={onEdit}>{reviews.length?'Изменить':'Добавить'}</button></div><div className="item-summary-cards">{reviews.map(review=><button key={review.item_type_id} onClick={onEdit}><span className="item-thumbnail"><Icon name="food"/></span><span>{review.name}<strong><Icon name="star"/>{review.rating}</strong></span></button>)}</div>{!reviews.length&&<p className="muted">Запомни лучшее блюдо, напиток или другую деталь.</p>}</section>;
}
