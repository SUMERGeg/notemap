import { expect, it } from 'vitest';
import { createState } from './db';
import { applyNoteDraft } from './note-draft';

const payload = { place: { title: 'Кофейня', longitude: 37, latitude: 55 }, rating: 7, text: 'Тихий двор' };
const photo = { id: 'draft-photo', blob: new Blob(['pixels'], { type: 'image/png' }) };
it('saves a note and its prepared photos together and retries without duplicates', () => {
  const contents = { state: createState(), photos: [] as any[] };
  const note = applyNoteDraft(contents, undefined, payload, [photo], 'retry');
  applyNoteDraft(contents, undefined, payload, [photo], 'retry');
  expect(contents.state.notes).toHaveLength(1);
  expect(contents.photos).toHaveLength(1);
  expect(contents.photos[0].note_id).toBe(note.id);
  expect(note.rating).toBe(7);
});
it('rejects an invalid photo before creating the note', () => {
  const contents = { state: createState(), photos: [] as any[] };
  expect(() => applyNoteDraft(contents, undefined, payload, [{ ...photo, blob: new Blob([]) }], 'retry')).toThrow();
  expect(contents.state.notes).toHaveLength(0);
});
it('cannot attach a photo belonging to another note', () => {
  const contents = { state: createState(), photos: [] as any[] };
  applyNoteDraft(contents, undefined, payload, [photo], 'first');
  expect(() => applyNoteDraft(contents, undefined, payload, [photo], 'second')).toThrow();
  expect(contents.state.notes).toHaveLength(1);
});
it('keeps the photo limit when a creation is retried after other photos were added', () => {
  const contents = { state: createState(), photos: [] as any[] };
  const note = applyNoteDraft(contents, undefined, payload, [], 'retry');
  contents.photos = Array.from({length:10},(_,i)=>({ ...photo, id:`existing-${i}`, note_id:note.id }));
  expect(() => applyNoteDraft(contents, undefined, payload, [photo], 'retry')).toThrow(/10/);
  expect(contents.photos).toHaveLength(10);
});
