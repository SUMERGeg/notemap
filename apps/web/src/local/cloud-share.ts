import type { ShareOptions,SharePreview } from '../features/notes/share-api';
import { exportDatabase,mutateState } from './db';
import { buildSnapshot,encodeSnapshot,validateSnapshot } from './file-share';
import { CLOUD_SHARE_LIMIT,photoBytes,toBase64 } from './shared-photos';
import { sanitizePhoto } from './photos';

const project=(import.meta.env.VITE_SUPABASE_URL??'').trim().replace(/\/$/,'');
const publicKey=(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY??'').trim();
export const cloudSharingEnabled=!!project&&!!publicKey&&/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(project);
const endpoint=`${project}/functions/v1/share-snapshot`;
const authKey='notemap.cloud.session.v1';
type Session={access_token:string;refresh_token:string;expires_at:number};
let sessionPromise:Promise<string>|undefined;
async function sessionToken(){
 if(sessionPromise)return sessionPromise;
 sessionPromise=(async()=>{
   let previous:Session|undefined;try{previous=JSON.parse(localStorage.getItem(authKey)??'null')??undefined;}catch{/* Optional storage. */}
   if(previous&&previous.expires_at>Date.now()/1000+60)return previous.access_token;
   let response:Response|undefined;
   if(previous?.refresh_token)response=await fetch(`${project}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:publicKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:previous.refresh_token}),referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});
   if(!response?.ok)response=await fetch(`${project}/auth/v1/signup`,{method:'POST',headers:{apikey:publicKey,'Content-Type':'application/json'},body:'{}',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new Error('Публикация недоступна. Проверь включение Anonymous sign-ins в Supabase.');
   const result=await response.json();if(typeof result.access_token!=='string'||typeof result.refresh_token!=='string')throw new Error('Не удалось создать сессию публикации.');
   const saved:Session={access_token:result.access_token,refresh_token:result.refresh_token,expires_at:result.expires_at??Date.now()/1000+result.expires_in};
   try{localStorage.setItem(authKey,JSON.stringify(saved));}catch{/* Publishing still works for this request. */}
   return saved.access_token;
 })();try{return await sessionPromise;}finally{sessionPromise=undefined;}
}
async function responseError(response:Response){
 let message='Хранилище временно недоступно.';try{const data=await response.json();if(typeof data.error==='string')message=data.error;}catch{/* Do not expose raw gateway pages. */}return new Error(message);
}
async function boundedJson(response:Response){
 if(Number(response.headers.get('content-length'))>CLOUD_SHARE_LIMIT)throw new Error('Подборка больше 40 МБ.');
 const reader=response.body?.getReader();if(!reader)throw new Error('Подборка пуста.');const chunks:Uint8Array[]=[];let total=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>CLOUD_SHARE_LIMIT){await reader.cancel();throw new Error('Подборка больше 40 МБ.');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
export async function publishCollection(origin:string,options:ShareOptions,includePhotos:boolean){
 if(!cloudSharingEnabled)throw new Error('Облачный обмен ещё не подключён. Можно передать файл подборки.');
 const contents=await exportDatabase();const snapshot=buildSnapshot(contents.state,origin,'collection',options);
 if(includePhotos){
   const photos=contents.photos.filter(photo=>snapshot.items.some(note=>note.origin_note_id===photo.note_id));
   if(photos.reduce((sum,photo)=>sum+Math.ceil(photo.blob.size/3)*4,0)>CLOUD_SHARE_LIMIT)throw new Error('Коллекция с фото превышает 40 МБ. Раздели её на несколько подборок.');
   for(const note of snapshot.items){note.photos=[];for(const photo of photos.filter(p=>p.note_id===note.origin_note_id)){
     // Strip metadata again before explicitly publishing photographs to the cloud.
     const clean=await sanitizePhoto(photo.blob);note.photos.push({mime_type:clean.type,data:toBase64(new Uint8Array(await clean.arrayBuffer()))});
   }}
 }
 await mutateState(state=>{snapshot.version=1+state.snapshots.filter(s=>s.origin_collection_id===origin).reduce((max,s)=>Math.max(max,s.version),0);state.snapshots.push({...snapshot,items:snapshot.items.map(({photos:_photos,...item})=>item)});});
 const encoded=encodeSnapshot(snapshot);if(new TextEncoder().encode(encoded).length>CLOUD_SHARE_LIMIT)throw new Error('Коллекция с фото превышает 40 МБ. Раздели её на несколько подборок.');
 const access=await sessionToken();
 const response=await fetch(endpoint,{method:'POST',headers:{apikey:publicKey,Authorization:`Bearer ${access}`,'Content-Type':'application/json','x-share-action':'publish'},body:encoded,referrerPolicy:'no-referrer',signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw await responseError(response);
 const result=await response.json();if(!/^[A-Za-z0-9_-]{43}$/.test(result.token)||!Number.isFinite(Date.parse(result.expires_at)))throw new Error('Хранилище вернуло некорректную ссылку.');
 const url=new URL(import.meta.env.BASE_URL,window.location.origin);url.hash=`share=${result.token}`;
 const link={url:url.toString(),expires_at:result.expires_at,name:snapshot.name,origin_collection_id:origin};
 try{await mutateState(state=>{state.receipts[`cloud-share:${snapshot.snapshot_id}`]=link;});}catch{/* A full local store must not hide an already published link. */}return link;
}
export async function readCloudSnapshot(token:string,signal:AbortSignal):Promise<SharePreview>{
 if(!cloudSharingEnabled)throw new Error('Облачный обмен ещё не подключён.');
 if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new Error('Эта ссылка не поддерживается. Попроси автора создать новую.');
 const response=await fetch(endpoint,{method:'POST',headers:{apikey:publicKey,'Content-Type':'application/json','x-share-action':'read'},body:JSON.stringify({token}),signal:AbortSignal.any([signal,AbortSignal.timeout(90000)]),referrerPolicy:'no-referrer',cache:'no-store'});
 if(!response.ok)throw await responseError(response);
 const expires=response.headers.get('X-Share-Expires');if(!expires||Date.parse(expires)<=Date.now()||!Number.isFinite(Date.parse(expires)))throw new Error('Срок действия ссылки истёк.');
 const snapshot=validateSnapshot(await boundedJson(response));
 for(const note of snapshot.items)for(const photo of note.photos??[]){
   signal.throwIfAborted();const clean=await sanitizePhoto(new Blob([photoBytes(photo)],{type:photo.mime_type}));photo.mime_type=clean.type;photo.data=toBase64(new Uint8Array(await clean.arrayBuffer()));
 }
 signal.throwIfAborted();return {...snapshot,expires_at:expires};
}
