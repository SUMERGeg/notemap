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

const normalizeName=(value:string)=>value.toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const categoriesByQuery:Record<string,string>={
 'кафе':'catering.cafe','кофейня':'catering.cafe','кофейни':'catering.cafe','кофе':'catering.cafe',
 'ресторан':'catering.restaurant','рестораны':'catering.restaurant','бар':'catering.bar','бары':'catering.bar',
 'аптека':'healthcare.pharmacy','аптеки':'healthcare.pharmacy','магазин':'commercial','магазины':'commercial',
 'супермаркет':'commercial.supermarket','продукты':'commercial.supermarket','музей':'entertainment.museum','музеи':'entertainment.museum',
 'парк':'leisure.park','парки':'leisure.park','отель':'accommodation.hotel','гостиница':'accommodation.hotel'
};
const organizationCategories='commercial,catering,service,healthcare,education,entertainment,leisure,tourism,accommodation,office';
const recent=new Map<string,{until:number;items:PlaceCandidate[]}>();
export function distanceFrom(a:[number,number],b:[number,number]){
 const r=Math.PI/180;const deltaLat=(b[1]-a[1])*r,deltaLon=(b[0]-a[0])*r;
 const h=Math.sin(deltaLat/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(deltaLon/2)**2;
 return 6371000*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
function organizationResults(payload:unknown,query:string,center:[number,number],radius:number,category?:string){
 if(!payload||typeof payload!=='object'||!Array.isArray((payload as any).features))throw new Error('Некорректный ответ поиска.');
 const raw=(payload as {features:{properties?:Record<string,unknown>}[]}).features.map(row=>row.properties??{});
 const tokens=normalizeName(query).split(' ').filter(token=>token.length>1);
 const filtered=raw.filter(row=>typeof row.name==='string'&&row.name.trim()&&typeof row.place_id==='string'&&validCoordinates(row.lon,row.lat)&&!['street','city','country','postcode','county','state','suburb'].includes(String(row.result_type))&&(category||tokens.every(token=>normalizeName(row.name as string).includes(token))));
 const items=normalizeResults({features:filtered.map(properties=>({properties}))}).map((item,index)=>{
  const row=filtered[index];const street=[row.street,row.housenumber].filter(value=>typeof value==='string'&&value).join(', ');
  return {...item,address:street?[street,row.city].filter(Boolean).join(' · '):item.address,distanceM:Math.round(distanceFrom(center,[item.longitude,item.latitude]))};
 }).filter(item=>item.distanceM<=radius);
 items.sort((a,b)=>{
  const rank=(item:PlaceCandidate)=>category?0:normalizeName(item.title)===normalizeName(query)?0:normalizeName(item.title).startsWith(normalizeName(query))?1:2;
  return rank(a)-rank(b)||a.distanceM-b.distanceM;
 });
 const unique:PlaceCandidate[]=[];
 for(const item of items){if(unique.some(old=>old.providerId===item.providerId||(normalizeName(old.title)===normalizeName(item.title)&&distanceFrom([old.longitude,old.latitude],[item.longitude,item.latitude])<30)))continue;unique.push(item);}
 return unique;
}

export async function searchPlaces(mode:SearchMode,query:string,key:string,center:[number,number],signal:AbortSignal,fetcher:typeof fetch=fetch,radius=10000):Promise<PlaceCandidate[]>{
 if(!key.trim())throw new Error('Ключ Geoapify не настроен.');
 if(query.trim().length<2)throw new Error('Введите минимум два символа.');
 if(!validCoordinates(center[0],center[1]))throw new Error('Перемести карту и повтори поиск.');
 radius=Number.isFinite(radius)?Math.max(1000,Math.min(50000,Math.round(radius))):10000;
 signal.throwIfAborted();
 const cacheKey=JSON.stringify([key,mode,normalizeName(query),center,radius]);const cached=recent.get(cacheKey);
 if(cached&&cached.until>Date.now())return structuredClone(cached.items);
 const category=categoriesByQuery[normalizeName(query)];
 const url=new URL(mode==='организация'?'https://api.geoapify.com/v2/places':'https://api.geoapify.com/v1/geocode/search');
 url.searchParams.set('apiKey',key);url.searchParams.set('lang','ru');url.searchParams.set('limit','20');url.searchParams.set('bias',`proximity:${center[0]},${center[1]}`);
 if(mode==='организация'){
  url.searchParams.set('categories',category??organizationCategories);url.searchParams.set('filter',`circle:${center[0]},${center[1]},${radius}`);
  if(!category)url.searchParams.set('name',query.trim());
 }else{url.searchParams.set('text',query.trim());url.searchParams.set('format','json');url.searchParams.set('filter','countrycode:ru');}
 async function request(target:URL){
  signal.throwIfAborted();await reserveGeoRequest();signal.throwIfAborted();
  const response=await fetcher(target.toString(),{signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});
  if(!response.ok){
   if(response.status===429)throw new Error('Лимит Geoapify исчерпан. Попробуй позже или выбери точку вручную.');
   if(response.status===401||response.status===403)throw new Error('Geoapify отклонил ключ или доступ. Проверь настройки проекта.');
   throw new Error('Поиск временно недоступен. Можно выбрать точку вручную.');
  }
  const payload=await response.json();signal.throwIfAborted();return payload;
 }
 const payload=await request(url);
 let items=mode==='организация'?organizationResults(payload,query,center,radius,category):normalizeResults(payload);
 if(mode==='организация'&&!category&&!items.length){
  // Some name aliases exist only in geocoding. Never substitute an address for a business.
  await new Promise<void>((resolve,reject)=>{const cancel=()=>{clearTimeout(timer);reject(signal.reason??new DOMException('Aborted','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},260);signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();});
  const fallback=new URL('https://api.geoapify.com/v1/geocode/search');
  for(const [name,value] of Object.entries({apiKey:key,lang:'ru',text:query.trim(),type:'amenity',limit:'20',filter:'countrycode:ru',bias:`proximity:${center[0]},${center[1]}`}))fallback.searchParams.set(name,value);
  items=organizationResults(await request(fallback),query,center,radius);
 }
 if(recent.size>=30)recent.delete(recent.keys().next().value!);
 recent.set(cacheKey,{until:Date.now()+5*60*1000,items:structuredClone(items)});return items;
}
