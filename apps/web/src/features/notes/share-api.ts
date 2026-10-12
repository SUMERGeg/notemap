export type ShareOptions = {author_name:string;include_text:boolean;include_ratings:boolean;include_visited_on:boolean};
export type ShareLink = {id:string;snapshot_id:string;origin_collection_id:string;version:number;created_at:string;expires_at:string;revoked_at:string|null;token:string|null;name:string|null};
export type SharedNote = {origin_note_id:string;category:string;place:{title:string;latitude:number;longitude:number;origin:string;address?:string;source_license?:string;attribution?:string};text?:string;rating?:number|null;visited_on?:string|null;item_reviews?:{name:string;rating:number}[]};
export type SharePreview = {kind?:'collection'|'note';snapshot_id:string;origin_collection_id:string;version:number;created_at:string;expires_at:string;name:string;author_name:string;description?:string;options:ShareOptions;items:SharedNote[]};

export async function shareApi(_path:string,_method='GET',_body?:unknown,_key?:string,_signal?:AbortSignal):Promise<any>{throw new Error('В локальной версии обмен выполняется файлами подборок.');}
export async function loadSharePreview(_token:string,_signal:AbortSignal):Promise<SharePreview>{throw new Error('Это ссылка серверной версии. Попроси автора прислать файл подборки.');}
