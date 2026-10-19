import { buildSnapshot } from './file-share';
import type { LocalState } from './db';
import type { ShareOptions } from '../features/notes/share-api';
// Cloud transport accepts collections; a shared note is a collection of one place.
// Keep its origin so previously imported copies can still be refreshed manually.
export function buildCloudSnapshot(state:LocalState,origin:string,kind:'note'|'collection',options:ShareOptions){
 const snapshot=buildSnapshot(state,origin,kind,options);
 return {...snapshot,kind:'collection' as const};
}
