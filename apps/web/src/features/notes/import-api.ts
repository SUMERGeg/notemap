import type { SharedNote } from './share-api';
import { readState,mutateState } from '../../local/db';
export type ImportedCollection = {id:string;origin_collection_id:string;snapshot_id:string;snapshot_version:number;snapshot_created_at:string;name:string;author_name:string;description:string|null;note_count:number;visible:boolean;imported_at:string};
export type ImportedLayer = ImportedCollection & {items:SharedNote[]};
export type ImportedSelection = {layer:ImportedCollection;note:SharedNote};
export type RefreshDiff = {current_version:number;target_version:number;metadata_before:{name:string;author_name:string;description:string|null};metadata_after:{name:string;author_name:string;description:string|null};added:SharedNote[];removed:SharedNote[];changed:{before:SharedNote;after:SharedNote}[];diff_token:string;expires_at:string};
export class ImportError extends Error {constructor(public status:number,message:string){super(message);}}
export async function importsApi(path:string,method='GET',body?:any,_key?:string,signal?:AbortSignal,_token?:string){
 signal?.throwIfAborted();const url=new URL(path,'https://local.invalid');const parts=url.pathname.split('/').filter(Boolean);
 if(method==='GET'){const s=await readState();signal?.throwIfAborted();if(parts.length===1)return {items:s.imports.map(({items,...meta}:ImportedLayer)=>meta),next_cursor:null};const row=s.imports.find((l:ImportedLayer)=>l.id===parts[1]);if(!row)throw new ImportError(404,'Копия не найдена.');return parts[2]==='items'?{items:row.items,next_cursor:null}:row;}
 if(parts.length===2&&(method==='PATCH'||method==='DELETE'))return mutateState(s=>{const row=s.imports.find((l:ImportedLayer)=>l.id===parts[1]);if(!row)throw new ImportError(404,'Копия не найдена.');if(method==='DELETE'){s.imports=s.imports.filter((l:ImportedLayer)=>l.id!==row.id);return null;}if(typeof body?.visible!=='boolean')throw new Error('Неверная настройка слоя.');row.visible=body.visible;return row;});
 throw new ImportError(422,'Открой новый файл подборки для импорта или обновления.');
}
export async function loadImportedLayers(signal?:AbortSignal):Promise<ImportedLayer[]>{signal?.throwIfAborted();const s=await readState();signal?.throwIfAborted();return s.imports;}
export async function findImportedCollection(origin:string,signal?:AbortSignal):Promise<ImportedCollection|null>{return (await loadImportedLayers(signal)).find(l=>l.origin_collection_id===origin)??null;}
export async function loadImportedItems(id:string,signal?:AbortSignal):Promise<SharedNote[]>{return (await loadImportedLayers(signal)).find(l=>l.id===id)?.items??[];}
export async function importCollection(_token:string,_key:string):Promise<{status:'imported'|'already_imported';collection:ImportedCollection}>{throw new ImportError(422,'Импортируй файл подборки.');}
export async function previewRefresh(_id:string,_token:string):Promise<RefreshDiff>{throw new ImportError(422,'Открой новый файл подборки.');}
export async function refreshCollection(_id:string,_token:string,_proof:string,_key:string):Promise<{status:'refreshed'|'already_refreshed';collection:ImportedCollection}>{throw new ImportError(422,'Подтверди изменения из нового файла подборки.');}
