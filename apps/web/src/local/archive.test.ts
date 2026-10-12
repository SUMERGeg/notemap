import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateState, parseArchive, restoreArchive, prepareServerMigration, serializeArchive, ARCHIVE_FORMAT } from './archive';
import { createState } from './db';
import { buildSnapshot, applySnapshot, encodeSnapshot, validateSnapshot } from './file-share';

const id = '00000000-0000-4000-8000-000000000001';
const placeId = '00000000-0000-4000-8000-000000000002';
afterEach(() => vi.unstubAllGlobals());
function populated() {
  const state = createState();
  const place = {id:placeId,title:'Кафе',longitude:37,latitude:55,origin:'custom'};
  state.places = [place];
  state.notes = [{id,place_id:placeId,place,category:'food',rating:8,text:'Личная запись',visited_on:null,created_at:'2026-10-12T00:00:00Z',updated_at:'2026-10-12T00:00:00Z'}];
  return state;
}
describe('full local backup validation', () => {
  it('round-trips exported and imported snapshots with the full allowed title and description', async () => {
    const state = populated();
    state.places[0].title = 'М'.repeat(200); state.notes[0].place.title = state.places[0].title;
    const snapshot = buildSnapshot(state,id,'note',{author_name:'Автор',include_text:false,include_ratings:false,include_visited_on:false});
    state.snapshots.push(snapshot);
    const imported = validateSnapshot(JSON.parse(encodeSnapshot({...snapshot,description:'Д'.repeat(2000)})));
    applySnapshot(state,imported);
    const restored = await parseArchive(await serializeArchive({state,photos:[]}));
    expect(restored.state.snapshots[0].name).toHaveLength(200);
    expect(restored.state.imports[0].description).toHaveLength(2000);
    expect(restored.state.notes[0].text).toBe('Личная запись');
  });
  it('accepts a valid local state and rejects dangling note/collection/review references', () => {
    expect(validateState(populated()).notes).toHaveLength(1);
    const state = populated(); state.places = [];
    expect(() => validateState(state)).toThrow();
    const collection = populated(); collection.collections = [{id:placeId,name:'Список',description:'',note_ids:[placeId],created_at:'2026-10-12T00:00:00Z',updated_at:'2026-10-12T00:00:00Z'}];
    expect(() => validateState(collection)).toThrow();
    const review = populated(); review.reviews = [{note_id:id,item_type_id:placeId,rating:8,updated_at:'2026-10-12T00:00:00Z'}];
    expect(() => validateState(review)).toThrow();
  });
  it('rejects duplicate identities, invalid coordinates and dangerous JSON keys', () => {
    const duplicate = populated(); duplicate.notes.push({...duplicate.notes[0]});
    expect(() => validateState(duplicate)).toThrow();
    const bad = populated(); bad.places[0].latitude = 100;
    expect(() => validateState(bad)).toThrow();
    const polluted = JSON.parse(JSON.stringify(createState()).replace('"receipts":{}','"receipts":{"__proto__":{}}'));
    expect(() => validateState(polluted)).toThrow();
  });
  it('requires a full versioned archive and never accepts an orphaned photograph', async () => {
    await expect(parseArchive(new Blob([JSON.stringify({format:ARCHIVE_FORMAT,version:2,state:createState(),photos:[]})]))).rejects.toThrow();
    await expect(parseArchive(new Blob([JSON.stringify({format:ARCHIVE_FORMAT,version:1,state:createState(),photos:[{id,note_id:id,created_at:'2026-10-12T00:00:00Z',mime_type:'image/png',size_bytes:1,data:'AA=='}]})]))).rejects.toThrow();
    const result = await parseArchive(new Blob([JSON.stringify({format:ARCHIVE_FORMAT,version:1,state:populated(),photos:[]})]));
    expect(result.state.notes[0].text).toBe('Личная запись');
    expect(result.photos).toEqual([]);
  });
  it('refuses replacement without explicit confirmation before opening storage', async () => {
    await expect(restoreArchive({state:populated(),photos:[]},false)).rejects.toThrow('Подтверди');
  });
  it('reads an authenticated server account into an independent staged state without rewriting the server', async () => {
    vi.stubGlobal('location',{hostname:'127.0.0.1',origin:'http://127.0.0.1:5173'});
    const state = populated();
    const fetcher = vi.fn(async (url: string, options: RequestInit) => {
      let data: any;
      if (url === '/api/v1/auth/login') data = state.profile;
      else if (url === '/api/v1/notes?limit=100') data = {items:state.notes,next_cursor:null};
      else if (url === `/api/v1/notes/${id}/item-reviews` || url === `/api/v1/notes/${id}/photos`) data = [];
      else data = {items:[],next_cursor:null};
      return {ok:true,status:200,json:async () => structuredClone(data)};
    });
    vi.stubGlobal('fetch',fetcher);
    const migrated = await prepareServerMigration('old@example.com','secret-password',() => {});
    expect(migrated.state.notes[0].text).toBe('Личная запись');
    expect(migrated.state.places[0].id).toBe(placeId);
    expect(JSON.stringify(migrated)).not.toContain('secret-password');
    expect(fetcher.mock.calls.filter(([,options]) => options.method !== 'GET').map(([url]) => url)).toEqual(['/api/v1/auth/login']);
    expect(fetcher.mock.calls[0][1].credentials).toBe('same-origin');
    expect(fetcher.mock.calls[0][1].headers).toMatchObject({'X-Notemap-CSRF':'1'});
  });
});
