import { validateSharedPhotos } from './shared-photos';
import type { ShareOptions,SharePreview,SharedNote } from '../features/notes/share-api';
import type { ImportedLayer,RefreshDiff } from '../features/notes/import-api';
import { readState,mutateState,type LocalState } from './db';
export const SHARE_LIMIT=2*1024*1024;
const uuid=(x:unknown)=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const str=(x:unknown,max:number)=>typeof x==='string'&&x.length<=max;
const score=(x:unknown)=>x===null||typeof x==='number'&&Number.isInteger(x)&&x>=1&&x<=10;
function invalid():never{throw new Error('Файл подборки повреждён или имеет неподдерживаемый формат.');}
export function validateSnapshot(input:unknown):SharePreview{
 const value=input as any;
 if(!value||value.format!=='notemap-snapshot'||value.schema_version!==1)invalid();
 const p=value.payload;
 if(!p||!uuid(p.snapshot_id)||!uuid(p.origin_collection_id)||!Number.isSafeInteger(p.version)||p.version<1||!str(p.name,200)||!p.name.trim()||!str(p.author_name,80)||!p.author_name.trim()||!str(p.created_at,40)||!Number.isFinite(Date.parse(p.created_at))||!['note','collection'].includes(p.kind)||!Array.isArray(p.items)||p.items.length>1000||p.kind==='note'&&p.items.length!==1||p.description!==undefined&&!str(p.description,2000))invalid();
 const options=p.options;
 if(!options||!str(options.author_name,80)||['include_text','include_ratings','include_visited_on'].some(k=>typeof options[k]!=='boolean'))invalid();
 const seen=new Set();
 const items:SharedNote[]=p.items.map((n:any)=>{
  const place=n?.place;
  if(!n||!uuid(n.origin_note_id)||seen.has(n.origin_note_id)||!['food','culture','nature','other'].includes(n.category)||!place||!str(place.title,200)||!place.title.trim()||typeof place.longitude!=='number'||!Number.isFinite(place.longitude)||Math.abs(place.longitude)>180||typeof place.latitude!=='number'||!Number.isFinite(place.latitude)||Math.abs(place.latitude)>90||!['custom','external'].includes(place.origin)||place.address!==undefined&&!str(place.address,500)||place.source_license!==undefined&&!str(place.source_license,100)||place.attribution!==undefined&&!str(place.attribution,500)||n.text!==undefined&&!str(n.text,10000)||n.rating!==undefined&&!score(n.rating)||n.visited_on!==undefined&&n.visited_on!==null&&(!str(n.visited_on,10)||!/^\d{4}-\d{2}-\d{2}$/.test(n.visited_on)||!Number.isFinite(Date.parse(n.visited_on))))invalid();
  if(n.item_reviews!==undefined&&(!Array.isArray(n.item_reviews)||n.item_reviews.length>1000||n.item_reviews.some((r:any)=>!str(r.name,100)||!r.name.trim()||!score(r.rating)||r.rating===null)))invalid();
  seen.add(n.origin_note_id);
  return {origin_note_id:n.origin_note_id,category:n.category,place:{title:place.title,longitude:place.longitude,latitude:place.latitude,origin:place.origin,...(place.address!==undefined?{address:place.address}:{}),...(place.source_license!==undefined?{source_license:place.source_license}:{}),...(place.attribution!==undefined?{attribution:place.attribution}:{})},...(n.photos!==undefined?{photos:validateSharedPhotos(n.photos)}:{}),...(n.text!==undefined?{text:n.text}:{}),...(n.rating!==undefined?{rating:n.rating}:{}),...(n.visited_on!==undefined?{visited_on:n.visited_on}:{}),...(n.item_reviews?{item_reviews:n.item_reviews.map((r:any)=>({name:r.name,rating:r.rating}))}:{})};
 });
 return {kind:p.kind,snapshot_id:p.snapshot_id,origin_collection_id:p.origin_collection_id,version:p.version,created_at:p.created_at,expires_at:'',name:p.name,author_name:p.author_name,...(p.description!==undefined?{description:p.description}:{}),options:{author_name:options.author_name,include_text:options.include_text,include_ratings:options.include_ratings,include_visited_on:options.include_visited_on},items};
}
export function encodeSnapshot(preview:SharePreview){return JSON.stringify({format:'notemap-snapshot',schema_version:1,payload:preview});}
export async function readSnapshotFile(file:File){
 if(file.size>SHARE_LIMIT)throw new Error('Файл подборки больше 2 МБ.');
 try{return validateSnapshot(JSON.parse(await file.text()));}catch(error){if(error instanceof SyntaxError)invalid();throw error;}
}
export function downloadJson(value:string,name:string){
 const url=URL.createObjectURL(new Blob([value],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export function buildSnapshot(state:LocalState,origin:string,kind:'note'|'collection',options:ShareOptions):SharePreview{
 if(!options.author_name.trim()||options.author_name.length>80)throw new Error('Укажи имя автора до 80 символов.');
 const collection=kind==='collection'?state.collections.find((c:any)=>c.id===origin):null;
 if(kind==='collection'&&!collection)throw new Error('Коллекция не найдена.');
 const notes=kind==='note'?state.notes.filter((n:any)=>n.id===origin):state.notes.filter((n:any)=>collection.note_ids.includes(n.id));
 if(kind==='note'&&notes.length!==1)throw new Error('Заметка не найдена.');
 const items:SharedNote[]=notes.map((note:any)=>{
  const place=note.place??state.places.find((p:any)=>p.id===note.place_id);
  if(!place)throw new Error('Место заметки не найдено.');
  if(place.origin==='external'&&place.source_license!=='ODbL-1.0')throw new Error('Источник места не подтверждён для передачи.');
  const cleanPlace={title:place.title,longitude:place.longitude,latitude:place.latitude,origin:place.origin,...(place.address?{address:place.address}:{}),...(place.source_license?{source_license:place.source_license}:{}),...(place.attribution?{attribution:place.attribution}:{})};
  return {origin_note_id:note.id,category:note.category,place:cleanPlace,...(options.include_text?{text:note.text}:{}),...(options.include_ratings?{rating:note.rating,item_reviews:state.reviews.filter((r:any)=>r.note_id===note.id).map((r:any)=>({name:state.itemTypes.find((t:any)=>t.id===r.item_type_id)?.name??r.name,rating:r.rating}))}:{}),...(options.include_visited_on?{visited_on:note.visited_on}:{})};
 });
 const version=1+state.snapshots.filter((s:any)=>s.origin_collection_id===origin).reduce((m:number,s:any)=>Math.max(m,s.version),0);
 const preview:SharePreview={kind,origin_collection_id:origin,snapshot_id:crypto.randomUUID(),version,created_at:new Date().toISOString(),expires_at:'',name:kind==='note'?items[0].place.title:collection.name,author_name:options.author_name.trim(),...(options.include_text&&collection?.description?{description:collection.description}:{}),options:{...options,author_name:options.author_name.trim()},items};
 const encoded=encodeSnapshot(preview);if(new TextEncoder().encode(encoded).length>SHARE_LIMIT)throw new Error('Снимок больше 2 МБ. Уменьши состав или исключи текст.');
 return validateSnapshot(JSON.parse(encoded));
}
export async function createFileSnapshot(origin:string,kind:'note'|'collection',options:ShareOptions){return mutateState(state=>{const snapshot=buildSnapshot(state,origin,kind,options);state.snapshots.push(snapshot);return snapshot;});}
export function snapshotDiff(layer:ImportedLayer,target:SharePreview):RefreshDiff{
 if(layer.origin_collection_id!==target.origin_collection_id||target.version<=layer.snapshot_version)throw new Error('Для обновления нужен более свежий файл этой же подборки.');
 const old=new Map(layer.items.map(n=>[n.origin_note_id,n]));const fresh=new Map(target.items.map(n=>[n.origin_note_id,n]));
 return {current_version:layer.snapshot_version,target_version:target.version,metadata_before:{name:layer.name,author_name:layer.author_name,description:layer.description},metadata_after:{name:target.name,author_name:target.author_name,description:target.description??null},added:target.items.filter(n=>!old.has(n.origin_note_id)),removed:layer.items.filter(n=>!fresh.has(n.origin_note_id)),changed:target.items.filter(n=>old.has(n.origin_note_id)&&JSON.stringify(old.get(n.origin_note_id))!==JSON.stringify(n)).map(n=>({before:old.get(n.origin_note_id)!,after:n})),diff_token:'local-file-confirmation',expires_at:''};
}
export function applySnapshot(state:LocalState,target:SharePreview,expectedVersion?:number){
 const existing=state.imports.find((l:any)=>l.origin_collection_id===target.origin_collection_id) as ImportedLayer|undefined;
 if(existing){
  if(existing.snapshot_id===target.snapshot_id&&existing.snapshot_version===target.version)return existing;
  if(expectedVersion===undefined||existing.snapshot_version!==expectedVersion)throw new Error('Копия изменилась. Просмотри изменения заново.');
  snapshotDiff(existing,target);
 }else if(expectedVersion!==undefined)throw new Error('Импортированная копия была удалена. Выбери файл заново.');
 const layer:ImportedLayer={id:existing?.id??crypto.randomUUID(),origin_collection_id:target.origin_collection_id,snapshot_id:target.snapshot_id,snapshot_version:target.version,snapshot_created_at:target.created_at,name:target.name,author_name:target.author_name,description:target.description??null,note_count:target.items.length,visible:existing?.visible??true,imported_at:existing?.imported_at??new Date().toISOString(),items:structuredClone(target.items)};
 state.imports=state.imports.filter((l:any)=>l.origin_collection_id!==target.origin_collection_id);state.imports.push(layer);return layer;
}
export async function acceptSnapshot(target:SharePreview,expectedVersion?:number){return mutateState(state=>applySnapshot(state,validateSnapshot(JSON.parse(encodeSnapshot(target))),expectedVersion));}
export async function previewFileImport(target:SharePreview){const state=await readState();return state.imports.find((l:any)=>l.origin_collection_id===target.origin_collection_id) as ImportedLayer|undefined;}
