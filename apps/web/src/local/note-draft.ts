import { mutateDatabase, type DatabaseContents } from './db';
import { dispatchLocal } from './api';
import { MAX_PHOTO_BYTES, sanitizePhoto } from './photos';

export type DraftPhoto = { id: string; blob: Blob };
// Prepared pixels and domain changes are committed by one IndexedDB transaction.
export function applyNoteDraft(contents: DatabaseContents, noteId: string | undefined, payload: unknown, photos: DraftPhoto[], key?: string) {
  const targetId = noteId ?? (key ? contents.state.receipts[`notes:${key}`]?.result.id : undefined);
  const ids = new Set<string>();
  for (const photo of photos) {
    const existing = contents.photos.find(row => row.id === photo.id);
    if (!photo.id || ids.has(photo.id) || !photo.blob.size || photo.blob.size > MAX_PHOTO_BYTES || !['image/jpeg','image/png','image/webp'].includes(photo.blob.type)) throw new Error('Проверь выбранные фотографии.');
    if (existing && existing.note_id !== noteId) {
      const receipt = key && contents.state.receipts[`notes:${key}`];
      if (!receipt || existing.note_id !== receipt.result.id) throw new Error('Фотография принадлежит другой заметке.');
    }
    ids.add(photo.id);
  }
  const existingCount = targetId ? contents.photos.filter(row => row.note_id === targetId && !ids.has(row.id)).length : 0;
  if (existingCount + photos.length > 10) throw new Error('В заметке может быть максимум 10 фотографий.');
  const note = dispatchLocal(contents.state, noteId ? `/notes/${noteId}` : '/notes', noteId ? 'PATCH' : 'POST', payload, key);
  const created_at = new Date().toISOString();
  contents.photos = [...contents.photos.filter(row => !ids.has(row.id)), ...photos.map(photo => ({ ...photo, note_id: note.id, created_at, mime_type: photo.blob.type, size_bytes: photo.blob.size }))];
  return note;
}
export async function saveNoteDraft(noteId: string | undefined, payload: unknown, photos: DraftPhoto[], key?: string) {
  const prepared: DraftPhoto[] = [];
  // Decode one photo at a time to bound peak memory on phones.
  for (const photo of photos) prepared.push({ id: photo.id, blob: await sanitizePhoto(photo.blob) });
  return mutateDatabase(contents => applyNoteDraft(contents, noteId, payload, prepared, key));
}
