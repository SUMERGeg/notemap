import { nickname, profileColors } from './profile';
import { validateSharedPhotos } from './shared-photos';
import { createState, exportDatabase, replaceDatabase, type LocalPhoto, type LocalState } from './db';
import { MAX_PHOTO_BYTES, sanitizePhoto } from './photos';

export const ARCHIVE_FORMAT = 'notemap-backup';
export const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const MAX_TOTAL_PHOTOS = 128 * 1024 * 1024;
const MAX_ROWS = 20000;
export type DatabaseArchive = {state: LocalState; photos: LocalPhoto[]};
const invalid = () => new Error('Резервная копия повреждена, несовместима или превышает допустимый размер.');
function requireValue(condition: unknown): asserts condition { if (!condition) throw invalid(); }
const object = (value: any) => value && typeof value === 'object' && !Array.isArray(value);
const text = (value: any, max: number, min = 0) => typeof value === 'string' && value.length >= min && value.length <= max;
const uuid = (value: any) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const date = (value: any) => text(value,50,1) && Number.isFinite(Date.parse(value));
const rating = (value: any) => Number.isInteger(value) && value >= 1 && value <= 10;
const categories = ['food','culture','nature','other'];
function unique(rows: any[], key: string): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) { requireValue(object(row) && uuid(row[key]) && !ids.has(row[key])); ids.add(row[key]); }
  return ids;
}
function checkJson(value: any) {
  let nodes = 0;
  function visit(row: any, depth: number) {
    requireValue(++nodes <= 2_000_000 && depth <= 20);
    if (typeof row === 'number') requireValue(Number.isFinite(row));
    if (row && typeof row === 'object') for (const [key,child] of Object.entries(row)) {
      requireValue(!['__proto__','prototype','constructor'].includes(key)); visit(child,depth + 1);
    }
  }
  visit(value,0);
}
function place(row: any) {
  requireValue(object(row) && text(row.title,200,1) && ['custom','external'].includes(row.origin));
  requireValue(Number.isFinite(row.longitude) && row.longitude >= -180 && row.longitude <= 180 && Number.isFinite(row.latitude) && row.latitude >= -90 && row.latitude <= 90);
  for (const field of ['address','source_key','provider_id','source_license','attribution']) requireValue(row[field] == null || text(row[field],2000));
}
function sharedNote(row: any) {
  if (row?.photos !== undefined) validateSharedPhotos(row.photos);
  requireValue(object(row) && uuid(row.origin_note_id) && categories.includes(row.category)); place(row.place);
  requireValue(row.text == null || text(row.text,10000)); requireValue(row.rating == null || rating(row.rating));
  requireValue(row.visited_on == null || date(row.visited_on));
  if (row.item_reviews != null) {
    requireValue(Array.isArray(row.item_reviews) && row.item_reviews.length <= 1000);
    for (const review of row.item_reviews) requireValue(object(review) && text(review.name,100,1) && rating(review.rating));
  }
}
function sharedItems(items: any) {
  requireValue(Array.isArray(items) && items.length <= 1000); unique(items,'origin_note_id'); items.forEach(sharedNote);
}

export function validateState(value: unknown): LocalState {
  const state = value as LocalState;
  requireValue(object(state)); checkJson(state);
  requireValue(object(state.profile) && uuid(state.profile.id) && text(state.profile.email,320,1));
  if(state.profile.nickname!==undefined){requireValue(typeof state.profile.nickname==='string');requireValue(nickname(state.profile.nickname)===state.profile.nickname);}
  if(state.profile.avatar_color!==undefined)requireValue(profileColors.some(color=>color===state.profile.avatar_color));
  for (const field of ['places','notes','itemTypes','reviews','collections','imports','snapshots'] as const) requireValue(Array.isArray(state[field]) && state[field].length <= MAX_ROWS);
  requireValue(object(state.receipts) && Object.keys(state.receipts).length <= MAX_ROWS);
  const placeIds = unique(state.places,'id'), noteIds = unique(state.notes,'id'), typeIds = unique(state.itemTypes,'id');
  state.places.forEach(place);
  for (const row of state.notes) {
    requireValue(placeIds.has(row.place_id) && categories.includes(row.category) && text(row.text,10000) && (row.rating == null || rating(row.rating)) && (row.visited_on == null || date(row.visited_on)) && date(row.created_at) && date(row.updated_at));
    place(row.place);
    const original = state.places.find(p => p.id === row.place_id);
    requireValue(row.place.title === original.title && row.place.longitude === original.longitude && row.place.latitude === original.latitude);
  }
  const reviewKeys = new Set<string>();
  for (const row of state.itemTypes) requireValue(text(row.name,100,1) && text(row.normalized_name,200,1));
  for (const row of state.reviews) {
    const key = `${row.note_id}:${row.item_type_id}`;
    requireValue(noteIds.has(row.note_id) && typeIds.has(row.item_type_id) && rating(row.rating) && date(row.updated_at) && !reviewKeys.has(key)); reviewKeys.add(key);
  }
  unique(state.collections,'id');
  for (const row of state.collections) {
    requireValue(text(row.name,120,1) && text(row.description,1000) && date(row.created_at) && date(row.updated_at) && Array.isArray(row.note_ids) && row.note_ids.length <= MAX_ROWS && new Set(row.note_ids).size === row.note_ids.length);
    for (const id of row.note_ids) requireValue(noteIds.has(id));
  }
  unique(state.imports,'id');
  const importOrigins = new Set<string>();
  for (const row of state.imports) {
    requireValue(uuid(row.origin_collection_id) && !importOrigins.has(row.origin_collection_id) && uuid(row.snapshot_id) && Number.isInteger(row.snapshot_version) && row.snapshot_version >= 1 && date(row.snapshot_created_at) && date(row.imported_at));
    requireValue(text(row.name,200,1) && text(row.author_name,120,1) && (row.description == null || text(row.description,2000)) && typeof row.visible === 'boolean');
    sharedItems(row.items); requireValue(row.note_count === row.items.length); importOrigins.add(row.origin_collection_id);
  }
  unique(state.snapshots,'snapshot_id');
  for (const row of state.snapshots) {
    requireValue(uuid(row.origin_collection_id) && Number.isInteger(row.version) && row.version >= 1 && date(row.created_at) && text(row.name,200,1) && text(row.author_name,120,1) && (row.description == null || text(row.description,2000)) && (row.kind == null || ['note','collection'].includes(row.kind)));
    requireValue(object(row.options) && text(row.options.author_name,80,1));
    for (const flag of ['include_text','include_ratings','include_visited_on']) requireValue(typeof row.options[flag] === 'boolean');
    sharedItems(row.items);
  }
  return state;
}

function encode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i,i + 8192));
  return btoa(binary);
}
function decode(value: any): Uint8Array {
  requireValue(text(value,4 * Math.ceil(MAX_PHOTO_BYTES / 3),4) && value.length % 4 === 0 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value));
  try { return Uint8Array.from(atob(value),char => char.charCodeAt(0)); } catch { throw invalid(); }
}

export async function serializeArchive(database?: DatabaseArchive): Promise<Blob> {
  const contents = database ?? await exportDatabase();
  validateState(contents.state);
  requireValue(contents.photos.reduce((sum,row) => sum + row.blob.size,0) <= MAX_TOTAL_PHOTOS);
  const photos = [];
  for (const row of contents.photos) photos.push({id:row.id,note_id:row.note_id,created_at:row.created_at,mime_type:row.mime_type,size_bytes:row.size_bytes,data:encode(new Uint8Array(await row.blob.arrayBuffer()))});
  const blob = new Blob([JSON.stringify({format:ARCHIVE_FORMAT,version:1,created_at:new Date().toISOString(),state:contents.state,photos})],{type:'application/json'});
  requireValue(blob.size <= MAX_ARCHIVE_BYTES); return blob;
}

export async function parseArchive(file: Blob): Promise<DatabaseArchive> {
  requireValue(file.size > 0 && file.size <= MAX_ARCHIVE_BYTES);
  let raw: any;
  try { raw = JSON.parse(await file.text()); } catch { throw invalid(); }
  requireValue(object(raw) && raw.format === ARCHIVE_FORMAT && raw.version === 1);
  const state = validateState(raw.state);
  requireValue(Array.isArray(raw.photos) && raw.photos.length <= 5000);
  unique(raw.photos,'id');
  const notes = new Set(state.notes.map(note => note.id));
  const counts = new Map<string,number>(); let total = 0;
  const photos: LocalPhoto[] = [];
  for (const row of raw.photos) {
    requireValue(notes.has(row.note_id) && date(row.created_at) && ['image/jpeg','image/png','image/webp'].includes(row.mime_type) && Number.isInteger(row.size_bytes) && row.size_bytes > 0 && row.size_bytes <= MAX_PHOTO_BYTES);
    const count = (counts.get(row.note_id) ?? 0) + 1; counts.set(row.note_id,count); requireValue(count <= 10);
    const bytes = decode(row.data); requireValue(bytes.length === row.size_bytes); total += bytes.length; requireValue(total <= MAX_TOTAL_PHOTOS);
    const blob = await sanitizePhoto(new Blob([new Uint8Array(bytes)],{type:row.mime_type}));
    photos.push({id:row.id,note_id:row.note_id,created_at:row.created_at,mime_type:blob.type,size_bytes:blob.size,blob});
  }
  return {state,photos};
}

export async function restoreArchive(contents: DatabaseArchive, confirmed: boolean): Promise<void> {
  if (confirmed !== true) throw new Error('Подтверди замену данных на этом устройстве.');
  validateState(contents.state);
  await replaceDatabase(contents.state,contents.photos);
}

function isLoopback(host: string) { return ['localhost','127.0.0.1','[::1]'].includes(host); }
async function boundedBlob(response: Response): Promise<Blob> {
  if (!response.ok || Number(response.headers.get('Content-Length')) > MAX_PHOTO_BYTES || !response.body) throw new Error('Не удалось получить серверную фотографию.');
  const reader = response.body.getReader(); const chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0;
  try {
    while (true) {
      const result = await reader.read(); if (result.done) break;
      size += result.value.length; if (size > MAX_PHOTO_BYTES) throw invalid();
      chunks.push(new Uint8Array(result.value));
    }
  } catch (failure) { await reader.cancel(); throw failure; }
  return new Blob(chunks,{type:response.headers.get('Content-Type') ?? ''});
}

// Existing server auth uses a same-origin HttpOnly cookie and Origin CSRF checks.
// Run the new frontend on its existing local server, then transfer a backup file.
export async function prepareServerMigration(email: string, password: string, progress: (value: string) => void): Promise<DatabaseArchive> {
  if (!isLoopback(location.hostname)) throw new Error('Для переноса открой Notemap на прежнем локальном сервере (http://127.0.0.1:5173), затем перенеси резервный файл на новое устройство.');
  async function request(path: string, body?: any): Promise<any> {
    const response = await fetch(`/api/v1${path}`,{method:body ? 'POST' : 'GET',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json','X-Notemap-CSRF':'1'},body:body ? JSON.stringify(body) : undefined}).catch(() => { throw new Error('Локальный сервер недоступен. Запусти прежний сервер и повтори перенос.'); });
    if (!response.ok) throw new Error(response.status === 401 ? 'Проверь email и пароль существующего аккаунта.' : response.status === 403 ? 'Открой прежний адрес сервера: его настройки доступа не разрешили перенос.' : 'Не удалось прочитать серверные данные. Перенос не выполнен.');
    return response.status === 204 ? null : response.json();
  }
  async function pages(path: string): Promise<any[]> {
    const rows: any[] = []; let cursor: string | null = null; const seen = new Set<string>();
    do {
      const page = await request(`${path}?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      requireValue(Array.isArray(page.items)); rows.push(...page.items); requireValue(rows.length <= MAX_ROWS);
      cursor = page.next_cursor; if (cursor) { requireValue(uuid(cursor) && !seen.has(cursor)); seen.add(cursor); }
    } while (cursor);
    return rows;
  }
  progress('Входим в существующий серверный аккаунт…');
  const profile = await request('/auth/login',{email,password});
  const state = createState(); state.profile = profile;
  progress('Читаем заметки и оценки…'); state.notes = await pages('/notes');
  state.places = [...new Map(state.notes.map(note => [note.place_id,{...note.place,id:note.place_id}])).values()];
  state.itemTypes = (await pages('/item-types')).map(row => ({...row,normalized_name:row.name.trim().normalize('NFC').toLocaleLowerCase('ru-RU').replace(/ß/g,'ss').replace(/ς/g,'σ')}));
  state.collections = await pages('/collections');
  for (const row of state.collections) row.note_ids = (await pages(`/collections/${row.id}/notes`)).map(note => note.id);
  for (const note of state.notes) for (const row of await request(`/notes/${note.id}/item-reviews`)) state.reviews.push({note_id:note.id,item_type_id:row.item_type_id,rating:row.rating,updated_at:note.updated_at});
  progress('Читаем независимые импортированные коллекции…'); state.imports = await pages('/imports');
  for (const row of state.imports) row.items = await pages(`/imports/${row.id}/items`);
  validateState(state);
  const photos: LocalPhoto[] = []; let total = 0;
  for (const note of state.notes) {
    progress(`Переносим фотографии: ${photos.length}…`);
    const rows = await request(`/notes/${note.id}/photos`);
    requireValue(Array.isArray(rows) && rows.length <= 10);
    for (const row of rows) {
      const grant = await request(`/photos/${row.id}/url`);
      const url = new URL(grant.url,location.origin);
      requireValue(['http:','https:'].includes(url.protocol) && !url.username && !url.password && (url.origin === location.origin || isLoopback(url.hostname)));
      const response = await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(60000),cache:'no-store'});
      const blob = await sanitizePhoto(await boundedBlob(response)); total += blob.size; requireValue(total <= MAX_TOTAL_PHOTOS && photos.length < 5000);
      requireValue(uuid(row.id));
      photos.push({id:row.id,note_id:note.id,created_at:note.created_at,mime_type:blob.type,size_bytes:blob.size,blob});
    }
  }
  progress('Данные проверены. Подтверди сохранение локальной копии.');
  return {state,photos};
}

export function downloadArchive(blob: Blob) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `notemap-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url),10000);
}
