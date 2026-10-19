import { expect,it } from 'vitest';
import { createState } from './db';
import { buildCloudSnapshot } from './cloud-snapshot';
it('publishes a single note as a one-place collection without adding a personal collection',()=>{
 const state=createState();const id=crypto.randomUUID();state.notes=[{id,category:'food',place:{title:'Кафе',origin:'custom',longitude:37,latitude:55},text:'Личное',rating:9}];
 const snapshot=buildCloudSnapshot(state,id,'note',{author_name:'Автор',include_text:false,include_ratings:false,include_visited_on:false});
 expect(snapshot.kind).toBe('collection');expect(snapshot.items).toHaveLength(1);expect(snapshot.items[0].text).toBeUndefined();expect(snapshot.name).toBe('Кафе');expect(state.collections).toHaveLength(0);
});
