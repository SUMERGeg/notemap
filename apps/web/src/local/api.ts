import { deletePhoto, listPhotos, mutateState, readState, type LocalState } from './db';

const categories = ['food', 'culture', 'nature', 'other'];
const invalid = () => new Error('Проверь поля запроса.');
function object(value: unknown, keys: string[]): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw invalid();
  return value as Record<string, any>;
}
function text(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw invalid();
  return value;
}
function rating(value: unknown, nullable = false): number | null {
  if (value === null && nullable) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 10) throw invalid();
  return value;
}
function owned(rows: any[], id: string, label = 'Запись'): any {
  const row = rows.find(row => row.id === id);
  if (!row) throw new Error(`${label} не найдена.`);
  return row;
}
function coordinate(value: unknown, bound: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > bound) throw invalid();
  return value;
}
function fields(data: Record<string, any>, patch = false): Record<string, any> {
  const result: Record<string, any> = patch ? {} : { category: 'other', rating: null, text: '', visited_on: null };
  if ('category' in data) { if (!categories.includes(data.category)) throw invalid(); result.category = data.category; }
  if ('rating' in data) result.rating = rating(data.rating, true);
  if ('text' in data) result.text = text(data.text, 10000);
  if ('visited_on' in data) {
    const value = data.visited_on;
    const today = new Date(); const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (value !== null && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T12:00:00Z`)) || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value || value > localDate)) throw invalid();
    result.visited_on = value;
  }
  return result;
}
function normalizeName(name: string): string { return name.trim().normalize('NFC').toLocaleLowerCase('ru-RU').replace(/ß/g, 'ss').replace(/ς/g, 'σ'); }
function stable(value: any): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function created(state: LocalState, scope: string, data: unknown, key: string | undefined, work: () => any): any {
  if (key !== undefined && (!key || key.length > 100)) throw invalid();
  if (!key) return work();
  const receiptKey = `${scope}:${key}`; const payload = stable(data); const receipt = state.receipts[receiptKey];
  if (receipt) {
    if (receipt.payload !== payload) throw new Error('Ключ повторного запроса уже использован с другими данными.');
    return structuredClone(receipt.result);
  }
  const result = work(); state.receipts[receiptKey] = { payload, result: structuredClone(result) }; return result;
}
function collectionDTO(row: any) { const { note_ids, ...dto } = row; return { ...dto, note_count: note_ids.length }; }
function reviewsFor(state: LocalState, noteId: string) {
  return state.reviews.filter(row => row.note_id === noteId).map(row => ({ item_type_id: row.item_type_id, name: owned(state.itemTypes, row.item_type_id).name, rating: row.rating })).sort((a, b) => normalizeName(a.name).localeCompare(normalizeName(b.name)) || a.item_type_id.localeCompare(b.item_type_id));
}
function page(rows: any[], query: URLSearchParams, id: (row: any) => string = row => row.id) {
  const limit = query.has('limit') ? Number(query.get('limit')) : 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw invalid();
  const cursor = query.get('cursor');
  if (cursor) { const index = rows.findIndex(row => id(row) === cursor); if (index === -1) throw new Error('Список изменился. Обнови его.'); rows = rows.slice(index + 1); }
  return { items: rows.slice(0, limit), next_cursor: rows.length > limit ? id(rows[limit - 1]) : null };
}
function filtered(rows: any[], query: URLSearchParams, itemRatings = false): any[] {
  const selected = query.getAll('category'); if (selected.some(category => !categories.includes(category))) throw invalid();
  const min = query.has('min_rating') ? Number(query.get('min_rating')) : null; if (min !== null) rating(min);
  let bbox: number[] | undefined;
  if (query.has('bbox')) {
    const input = query.get('bbox')!; bbox = input.split(',').map(Number);
    if (input.split(',').some(value => !value.trim()) || bbox.length !== 4 || bbox.some(value => !Number.isFinite(value)) || Math.abs(bbox[0]) > 180 || Math.abs(bbox[2]) > 180 || Math.abs(bbox[1]) > 90 || Math.abs(bbox[3]) > 90 || bbox[1] > bbox[3]) throw invalid();
  }
  return rows.filter(row => {
    const note = itemRatings ? row.note : row;
    if (selected.length && !selected.includes(note.category)) return false;
    if (min !== null && (row.rating === null || row.rating < min)) return false;
    if (bbox) {
      const [west, south, east, north] = bbox; const { longitude, latitude } = note.place;
      if (latitude < south || latitude > north || (west <= east ? longitude < west || longitude > east : longitude < west && longitude > east)) return false;
    }
    return true;
  });
}
const byId = (a: any, b: any) => a.id.localeCompare(b.id);
const byRating = (a: any, b: any) => b.rating - a.rating || b.updated_at.localeCompare(a.updated_at) || (a.id ?? a.note.id).localeCompare(b.id ?? b.note.id);

// Tests inject state here; runtime persists every mutation in one IDB transaction.
export function dispatchLocal(state: LocalState, path: string, method = 'GET', input?: unknown, key?: string): any {
  const url = new URL(path, 'https://notemap.local'); const route = url.pathname; const query = url.searchParams;
  const parts = route.split('/').filter(Boolean); const now = new Date().toISOString();
  if (route === '/auth/me' && method === 'GET') return state.profile;
  if (route === '/auth/logout' && method === 'POST') return null;
  if (route === '/categories' && method === 'GET') return categories.map((id, index) => ({ id, title: ['Еда и напитки', 'Культура', 'Природа', 'Другое'][index] }));
  if ((route === '/notes' || route === '/rankings/places') && method === 'GET') {
    let rows = filtered([...state.notes], query);
    if (route === '/rankings/places') rows = rows.filter(row => row.rating !== null).sort(byRating); else rows.sort(byId);
    return page(rows, query);
  }
  if (route === '/notes' && method === 'POST') {
    const data = object(input, ['place', 'place_id', 'category', 'rating', 'text', 'visited_on']); const validated = fields(data);
    if ((data.place == null) === (data.place_id == null)) throw invalid();
    const manual = data.place == null ? null : object(data.place, ['title', 'longitude', 'latitude']);
    const prepared = manual ? { title: text(manual.title, 200, true).trim(), longitude: coordinate(manual.longitude, 180), latitude: coordinate(manual.latitude, 90), origin: 'custom', address: null, attribution: null, source_license: null } : null;
    if (!manual && typeof data.place_id !== 'string') throw invalid();
    return created(state, 'notes', data, key, () => {
      const place = prepared ? { id: crypto.randomUUID(), ...prepared } : owned(state.places, data.place_id, 'Точка');
      if (state.notes.some(row => row.place_id === place.id)) throw new Error('У этого места уже есть заметка. Открой её для редактирования.');
      if (prepared) state.places.push(place);
      const note = { id: crypto.randomUUID(), place_id: place.id, place: { ...place }, ...validated, created_at: now, updated_at: now };
      state.notes.push(note); return note;
    });
  }
  if (parts[0] === 'notes' && parts.length >= 2) {
    const note = owned(state.notes, parts[1], 'Заметка');
    if (parts.length === 2) {
      if (method === 'GET') return note;
      if (method === 'PATCH') { Object.assign(note, fields(object(input, ['category', 'rating', 'text', 'visited_on']), true), { updated_at: now }); return note; }
      if (method === 'DELETE') {
        state.notes = state.notes.filter(row => row.id !== note.id); state.reviews = state.reviews.filter(row => row.note_id !== note.id);
        for (const collection of state.collections) collection.note_ids = collection.note_ids.filter((id: string) => id !== note.id);
        return null;
      }
    }
    if (parts[2] === 'collections' && parts.length === 3 && method === 'GET') return page(state.collections.filter(row => row.note_ids.includes(note.id)).sort(byId).map(collectionDTO), query);
    if (parts[2] === 'item-reviews') {
      if (parts.length === 3 && method === 'GET') return reviewsFor(state, note.id);
      if (parts.length === 4) {
        const item = owned(state.itemTypes, parts[3], 'Оценка предмета');
        if (method === 'PUT') {
          const value = rating(object(input, ['rating']).rating);
          const review = state.reviews.find(row => row.note_id === note.id && row.item_type_id === item.id);
          if (review) Object.assign(review, { rating: value, updated_at: now }); else state.reviews.push({ note_id: note.id, item_type_id: item.id, rating: value, updated_at: now });
          return { item_type_id: item.id, name: item.name, rating: value };
        }
        if (method === 'DELETE') { state.reviews = state.reviews.filter(row => row.note_id !== note.id || row.item_type_id !== item.id); return null; }
      }
    }
  }
  if (route === '/item-types') {
    if (method === 'GET') {
      const q = normalizeName(text(query.get('q') ?? '', 100));
      return page(state.itemTypes.filter(row => row.normalized_name.includes(q)).sort(byId).map(({ id, name }) => ({ id, name })), query);
    }
    if (method === 'POST') {
      const name = text(object(input, ['name']).name, 100, true).trim().normalize('NFC');
      if (/[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]/u.test(name)) throw invalid();
      const normalized_name = normalizeName(name); let item = state.itemTypes.find(row => row.normalized_name === normalized_name);
      if (!item) { item = { id: crypto.randomUUID(), name, normalized_name }; state.itemTypes.push(item); }
      return { id: item.id, name: item.name };
    }
  }
  if (route === '/rankings/items' && method === 'GET') {
    const item = owned(state.itemTypes, query.get('item_type_id') ?? '', 'Оценка предмета');
    const rows = state.reviews.filter(row => row.item_type_id === item.id).map(row => ({ ...row, name: item.name, note: owned(state.notes, row.note_id, 'Заметка') }));
    return page(filtered(rows, query, true).sort(byRating).map(({ item_type_id, name, rating, note }) => ({ item_type_id, name, rating, note })), query, row => row.note.id);
  }
  if (route === '/collections') {
    if (method === 'GET') return page([...state.collections].sort(byId).map(collectionDTO), query);
    if (method === 'POST') {
      const data = object(input, ['name', 'description']); const name = text(data.name, 120, true).trim(); const description = text(data.description ?? '', 1000);
      return created(state, 'collections', { name, description }, key, () => {
        const row = { id: crypto.randomUUID(), name, description, note_ids: [], created_at: now, updated_at: now }; state.collections.push(row); return collectionDTO(row);
      });
    }
  }
  if (parts[0] === 'collections' && parts.length >= 2) {
    const collection = owned(state.collections, parts[1], 'Коллекция');
    if (parts.length === 2) {
      if (method === 'GET') return collectionDTO(collection);
      if (method === 'PATCH') {
        const data = object(input, ['name', 'description']); const name = 'name' in data ? text(data.name, 120, true).trim() : collection.name;
        const description = 'description' in data ? text(data.description, 1000) : collection.description;
        Object.assign(collection, { name, description, updated_at: now }); return collectionDTO(collection);
      }
      if (method === 'DELETE') { state.collections = state.collections.filter(row => row.id !== collection.id); return null; }
    }
    if (parts[2] === 'notes') {
      if (parts.length === 3 && method === 'GET') return page(filtered(state.notes.filter(row => collection.note_ids.includes(row.id)), query).sort(byId), query);
      if (parts.length === 4) {
        const note = owned(state.notes, parts[3], 'Заметка');
        if (method === 'PUT') { if (!collection.note_ids.includes(note.id)) collection.note_ids.push(note.id); collection.updated_at = now; return null; }
        if (method === 'DELETE') { collection.note_ids = collection.note_ids.filter((id: string) => id !== note.id); collection.updated_at = now; return null; }
      }
    }
  }
  throw new Error('Этот запрос недоступен в локальном режиме.');
}

export async function reserveGeoRequest(): Promise<void> {
  return mutateState(state => {
    const now = Date.now(); const day = new Date(now).toISOString().slice(0, 10); const previous = state.receipts._geo_budget;
    const budget = previous?.day === day ? previous : { day, used: 0, last_at: 0 };
    if (budget.used >= 50 || now - budget.last_at < 250) throw new Error('Лимит поиска исчерпан. Попробуй позже или выбери точку вручную.');
    state.receipts._geo_budget = { day, used: budget.used + 1, last_at: now };
  });
}
export function normalizeVerifiedPlace(payload: unknown): Record<string, any> {
  const features = (payload as any)?.features; const p = Array.isArray(features) ? features.find(item => item?.properties?.feature_type === 'details')?.properties : null;
  const source = p?.datasource; const raw = source?.raw;
  if (source?.sourcename !== 'openstreetmap' || !['n', 'w', 'r'].includes(raw?.osm_type) || typeof raw?.osm_id === 'boolean' || !/^\d+$/.test(String(raw?.osm_id)) || Number(raw.osm_id) <= 0 || p?.country_code?.toLowerCase() !== 'ru') throw new Error('Организацию не удалось подтвердить как разрешённые данные OSM в России. Выбери ручную точку.');
  const title = text(p.name || p.address_line1 || p.formatted, 10000, true).trim().slice(0, 200);
  return { title, address: String(p.formatted ?? '').slice(0, 500), longitude: coordinate(p.lon, 180), latitude: coordinate(p.lat, 90), origin: 'external', source_key: `osm:${raw.osm_type}:${raw.osm_id}`, source_license: 'ODbL-1.0', attribution: '© OpenStreetMap contributors · Geoapify' };
}
function resolvedDTO(state: LocalState, place: any) { return { ...place, note_id: state.notes.find(note => note.place_id === place.id)?.id ?? null }; }
async function resolvePlace(input: unknown) {
  const providerId = object(input, ['provider_id']).provider_id;
  if (typeof providerId !== 'string' || providerId.length < 6 || providerId.length > 2048 || !/^[a-f\d]+$/i.test(providerId)) throw invalid();
  const state = await readState(); const existing = state.places.find(row => row.provider_id === providerId);
  if (existing) return resolvedDTO(state, existing);
  const key = import.meta.env.VITE_GEOAPIFY_API_KEY?.trim(); if (!key) throw new Error('Ключ Geoapify не настроен. Выбери ручную точку.');
  await reserveGeoRequest();
  const url = new URL('https://api.geoapify.com/v2/place-details'); url.searchParams.set('id', providerId); url.searchParams.set('lang', 'ru'); url.searchParams.set('apiKey', key);
  let properties: Record<string, any>;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000), referrerPolicy: 'no-referrer', cache: 'no-store' });
    if (!response.ok) throw new Error('Организацию не удалось проверить. Попробуй позже или выбери ручную точку.');
    const body = await response.text(); if (body.length > 1024 * 1024) throw invalid(); properties = normalizeVerifiedPlace(JSON.parse(body));
  } catch (error) {
    if (error instanceof TypeError || error instanceof DOMException || error instanceof SyntaxError) throw new Error('Нет связи с поиском организаций. Выбери ручную точку.');
    throw error;
  }
  return mutateState(state => {
    let place = state.places.find(row => row.provider_id === providerId || row.source_key === properties.source_key);
    if (!place) { place = { id: crypto.randomUUID(), provider_id: providerId, ...properties }; state.places.push(place); }
    return resolvedDTO(state, place);
  });
}
export async function localApi(path: string, method = 'GET', data?: unknown, key?: string): Promise<any> {
  if (path === '/places/resolve' && method === 'POST') return resolvePlace(data);
  const photoListing = /^\/notes\/([^/]+)\/photos$/.exec(path);
  if (photoListing && method === 'GET') {
    const state = await readState(); owned(state.notes, photoListing[1], 'Заметка');
    return (await listPhotos(photoListing[1])).map(({ blob: _blob, ...row }) => ({ ...row, status: 'ready' }));
  }
  const photoDelete = /^\/photos\/([^/]+)$/.exec(path); if (photoDelete && method === 'DELETE') { await deletePhoto(photoDelete[1]); return null; }
  if (method === 'GET') return dispatchLocal(await readState(), path, method, data, key);
  return mutateState(state => dispatchLocal(state, path, method, data, key));
}
