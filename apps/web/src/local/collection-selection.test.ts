import { expect, it } from 'vitest';
import { createState } from './db';
import { addCollectionPlaces } from './collection-selection';
it('adds multiple own places once and preserves existing members',()=>{
  const state=createState();state.notes=[{id:'a'},{id:'b'},{id:'c'}];state.collections=[{id:'collection',note_ids:['a']}];
  addCollectionPlaces(state,'collection',['a','b','b','c']);
  expect(state.collections[0].note_ids).toEqual(['a','b','c']);
});
it('leaves membership unchanged when any selected place is no longer available',()=>{
  const state=createState();state.notes=[{id:'a'}];state.collections=[{id:'collection',note_ids:[]}];
  expect(()=>addCollectionPlaces(state,'collection',['a','missing'])).toThrow();
  expect(state.collections[0].note_ids).toEqual([]);
});
