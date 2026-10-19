import type { LocalState } from './db';
export function addCollectionPlaces(state: LocalState, collectionId: string, ids: string[]) {
  const collection=state.collections.find(row=>row.id===collectionId);
  if(!collection)throw new Error('Коллекция не найдена.');
  const available=new Set(state.notes.map(row=>row.id));
  if(ids.some(id=>!available.has(id)))throw new Error('Список мест изменился. Открой выбор заново.');
  collection.note_ids=[...new Set([...collection.note_ids,...ids])];
  collection.updated_at=new Date().toISOString();
}
