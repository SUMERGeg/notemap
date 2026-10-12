import {describe,it,expect,vi,afterEach} from 'vitest';
const state=vi.hoisted(()=>({imports:[{id:'copy',origin_collection_id:'origin',visible:true,items:[]}],notes:[{id:'mine'}]}));
vi.mock('../../local/db',()=>({readState:async()=>structuredClone(state),mutateState:async(work:any)=>work(state)}));
import {importsApi,importCollection,findImportedCollection} from './import-api';
afterEach(()=>vi.unstubAllGlobals());
describe('local imported layers',()=>{
 it('loads and changes layer visibility without server or private note changes',async()=>{const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);expect(await findImportedCollection('origin')).toMatchObject({id:'copy'});await importsApi('/imports/copy','PATCH',{visible:false});expect(state.imports[0].visible).toBe(false);expect(state.notes).toEqual([{id:'mine'}]);expect(fetcher).not.toHaveBeenCalled();});
 it('rejects server bearer import and asks for a file',async()=>{await expect(importCollection('token','key')).rejects.toThrow('файл');});
});
