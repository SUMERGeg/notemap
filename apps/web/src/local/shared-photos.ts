import { inspectImage,MAX_PHOTO_BYTES } from './photos';
export type SharedPhoto={mime_type:string;data:string};
export const CLOUD_SHARE_LIMIT=40*1024*1024;
export function toBase64(bytes:Uint8Array){let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);}
export function photoBytes(photo:SharedPhoto){
 if(!photo||!['image/jpeg','image/png','image/webp'].includes(photo.mime_type)||typeof photo.data!=='string'||photo.data.length>Math.ceil(MAX_PHOTO_BYTES/3)*4||!photo.data.length||photo.data.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(photo.data))throw new Error('Некорректное фото в подборке.');
 const bytes=Uint8Array.from(atob(photo.data),c=>c.charCodeAt(0));
 if(inspectImage(bytes).mime!==photo.mime_type)throw new Error('Тип фотографии не совпадает с содержимым.');return bytes;
}
export function validateSharedPhotos(value:unknown):SharedPhoto[]{
 if(!Array.isArray(value)||value.length>10)throw new Error('В одном месте может быть до 10 фото.');
 return value.map(photo=>{photoBytes(photo);return {mime_type:photo.mime_type,data:photo.data};});
}
export function photoSource(photo:SharedPhoto){photoBytes(photo);return `data:${photo.mime_type};base64,${photo.data}`;}
