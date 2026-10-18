import { describe,it,expect,vi } from 'vitest';
vi.mock('./db',()=>({readState:vi.fn(),mutateState:vi.fn(),listPhotos:vi.fn()}));
import { validateSharedPhotos,photoSource } from './shared-photos';
import { buildSnapshot,encodeSnapshot,validateSnapshot,applySnapshot,snapshotDiff } from './file-share';
const id='11111111-1111-4111-8111-111111111111';
const photo={mime_type:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='};
const state=()=>({profile:{id,email:''},places:[],notes:[{id,category:'food',place:{title:'Кафе',origin:'custom',longitude:37,latitude:55},text:'Личное'}],collections:[{id,name:'Места',note_ids:[id]}],reviews:[],itemTypes:[],imports:[],snapshots:[],receipts:{}} as any);
describe('снимок коллекции с фото',()=>{
 it('принимает растровое фото, отклоняет SVG, внешние URL и подмену MIME',()=>{
   expect(validateSharedPhotos([photo])).toEqual([photo]);expect(photoSource(photo)).toMatch(/^data:image\/png;base64,/);
   for(const p of [{...photo,mime_type:'image/svg+xml'},{...photo,data:'https://example.com/a.jpg'},{...photo,mime_type:'image/jpeg'}])expect(()=>validateSharedPhotos([p])).toThrow();
 });
 it('сохраняет все фото в независимой копии и показывает их изменение в diff',()=>{
   const s=state();const p=buildSnapshot(s,id,'collection',{author_name:'Автор',include_text:false,include_ratings:false,include_visited_on:false});p.items[0].photos=[photo];
   const validated=validateSnapshot(JSON.parse(encodeSnapshot(p)));expect(validated.items[0].photos).toEqual([photo]);
   const copy=applySnapshot(s,validated);expect(copy.items[0].photos).toEqual([photo]);expect(s.notes[0].text).toBe('Личное');
   const next={...validated,snapshot_id:crypto.randomUUID(),version:2,items:[{...validated.items[0],photos:[]}]};
   expect(snapshotDiff(copy,next).changed).toHaveLength(1);expect(()=>applySnapshot(s,next)).toThrow();applySnapshot(s,next,1);expect(s.imports[0].items[0].photos).toEqual([]);
 });
 it('не допускает больше 10 фото у места',()=>{expect(()=>validateSharedPhotos(Array(11).fill(photo))).toThrow();});
});
