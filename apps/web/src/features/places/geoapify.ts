import { reserveGeoRequest } from '../../local/api';
import { validCoordinates } from '../map/viewport';
export type SearchMode = 'организация' | 'адрес';
export type PlaceCandidate = { title: string; address: string; longitude: number; latitude: number; providerId?: string; origin?: 'custom' | 'external'; startEditing?: boolean; distanceM?:number };

export function normalizeResults(payload: unknown): PlaceCandidate[] {
  if (!payload || typeof payload !== 'object') throw new Error('Некорректный ответ поиска.');
  const value = payload as { features?: { properties?: Record<string, unknown> }[]; results?: Record<string, unknown>[] };
  const entries = Array.isArray(value.features) ? value.features.map(feature => feature.properties ?? {}) : value.results;
  if (!Array.isArray(entries)) throw new Error('Некорректный ответ поиска.');
  return entries.filter(p => validCoordinates(p.lon, p.lat)).map(p => ({
    title: String(p.name ?? p.address_line1 ?? p.formatted ?? 'Место'), address: String(p.formatted ?? p.address_line2 ?? ''),
    longitude: p.lon as number, latitude: p.lat as number, providerId: typeof p.place_id === 'string' ? p.place_id : undefined,
  }));
}

export async function searchPlaces(mode: SearchMode, query: string, key: string, center: [number, number], signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<PlaceCandidate[]> {
  if (!key.trim()) throw new Error('Ключ Geoapify не настроен.');
  if (query.trim().length < 2) throw new Error('Введите минимум два символа.');
  const url = new URL('https://api.geoapify.com/v1/geocode/search');
  url.searchParams.set('apiKey', key); url.searchParams.set('lang', 'ru'); url.searchParams.set('limit', '10');
  url.searchParams.set('bias', `proximity:${center[0]},${center[1]}`);
  url.searchParams.set('text', query.trim()); url.searchParams.set('format', 'json'); url.searchParams.set('filter', 'countrycode:ru');
  if (mode === 'организация') url.searchParams.set('type', 'amenity');
  signal.throwIfAborted(); await reserveGeoRequest(); signal.throwIfAborted();
  const response = await fetcher(url.toString(), { signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
  if (!response.ok) {
    if (response.status === 429) throw new Error('Лимит Geoapify исчерпан. Попробуй позже или выбери точку вручную.');
    if (response.status === 401 || response.status === 403) throw new Error('Geoapify отклонил ключ или доступ. Проверь настройки проекта.');
    throw new Error('Поиск временно недоступен. Можно выбрать точку вручную.');
  }
  return normalizeResults(await response.json());
}

