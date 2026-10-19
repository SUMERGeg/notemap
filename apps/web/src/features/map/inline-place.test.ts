import { expect,it } from 'vitest';
import { inlinePlacePayload } from './inline-place';
import { createState } from '../../local/db';
import { dispatchLocal } from '../../local/api';
it('saves a wrapped title at the clicked coordinate and safely retries creation',()=>{
 const payload=inlinePlacePayload('  Любимая\n кофейня  ',[37.61,55.75]);
 const state=createState();const first=dispatchLocal(state,'/notes','POST',payload,'inline-retry');
 dispatchLocal(state,'/notes','POST',payload,'inline-retry');
 expect(state.notes).toHaveLength(1);expect(first.place.title).toBe('Любимая кофейня');
 expect(first.place.longitude).toBe(37.61);expect(first.place.latitude).toBe(55.75);
});
it('rejects empty or oversized names and invalid coordinates before saving',()=>{
 for(const title of ['  ','а'.repeat(201)])expect(()=>inlinePlacePayload(title,[37,55])).toThrow();
 expect(()=>inlinePlacePayload('Место',[181,55])).toThrow();
});
