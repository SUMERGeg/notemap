import { reserveGeoRequest } from '../../local/api';
import { validCoordinates } from '../map/viewport';
import { nearbyTypes, distanceMeters, type NearbyOptions } from './nearby-options';
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

export async function searchNearby(center:[number,number],signal:AbortSignal,fetcher:typeof fetch=fetch,key=import.meta.env.VITE_GEOAPIFY_API_KEY??'',options:NearbyOptions={}):Promise<PlaceCandidate[]> {
  if(!validCoordinates(center[0],center[1]))throw new Error('Не удалось определить область поиска. Перемести карту и попробуй снова.');
  if(!key.trim())throw new Error('Ключ Geoapify не настроен.');
  signal.throwIfAborted();await reserveGeoRequest();signal.throwIfAborted();
  const url=new URL('https://api.geoapify.com/v2/places');
  const radius=[500,1500,3000].includes(options.radius??1500)?options.radius??1500:1500;
  const category=nearbyTypes.find(row=>row.id===(options.type??'all'))??nearbyTypes[0];
  url.searchParams.set('apiKey',key);url.searchParams.set('lang','ru');url.searchParams.set('limit','100');
  url.searchParams.set('categories',category.categories);url.searchParams.set('filter',`circle:${center[0]},${center[1]},${radius}`);url.searchParams.set('bias',`proximity:${center[0]},${center[1]}`);
  const response=await fetcher(url,{credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal});
  if(!response.ok)throw new Error(response.status===429?'Лимит поиска исчерпан. Попробуй позже или выбери точку вручную.':'Поиск рядом временно недоступен. Можно найти место по названию или выбрать точку вручную.');
  const body=await response.json();if(!Array.isArray(body.features))throw new Error('Некорректный ответ поиска рядом.');
  const found=normalizeResults({features:body.features.slice(0,100).filter((f:any)=>typeof f?.properties?.name==='string'&&f.properties.name.trim()&&typeof f.properties.country_code==='string'&&f.properties.country_code.toLowerCase()==='ru')});
  const seen=new Set<string>();
  const candidates=found.map(p=>({...p,title:p.title.trim(),distanceM:Math.round(distanceMeters(center,[p.longitude,p.latitude]))}))
    .filter(p=>{if(!p.providerId||!/^[a-f\d]{6,2048}$/i.test(p.providerId)||p.distanceM>radius||seen.has(p.providerId))return false;seen.add(p.providerId);return true;}).sort((a,b)=>a.distanceM-b.distanceM);
  const unique:PlaceCandidate[]=[];
  for(const point of candidates){
    const title=point.title.toLocaleLowerCase('ru').replace(/[«»"']/g,'').replace(/\s+/g,' ').trim();
    if(unique.some(previous=>previous.title.toLocaleLowerCase('ru').replace(/[«»"']/g,'').replace(/\s+/g,' ').trim()===title&&distanceMeters([point.longitude,point.latitude],[previous.longitude,previous.latitude])<25))continue;
    unique.push(point);if(unique.length===50)break;
  }
  return unique;
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

