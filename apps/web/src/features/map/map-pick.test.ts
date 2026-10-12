import { describe,expect,it } from 'vitest';
import { mapPickHint } from './map-pick';
const poi={layer:{type:'symbol','source-layer':'poi'},geometry:{type:'Point',coordinates:[37.6,55.7]},properties:{name:'Кофейня',place_id:'untrusted',id:123}};
describe('background map selection',()=>{
 it('uses a named POI as hint without trusting tile/provider identifiers',()=>{
  expect(mapPickHint([poi],[37,55])).toEqual({title:'Кофейня',position:[37.6,55.7],named:true});
 });
 it('offers the clicked position on raster or unnamed map background',()=>{
  expect(mapPickHint([],[37,55])).toEqual({title:'Точка на карте',position:[37,55],named:false});
 });
 it('does not turn a street, polygon or personal marker into an organization',()=>{
  const road={...poi,layer:{type:'symbol','source-layer':'transportation_name'}};
  const polygon={...poi,geometry:{type:'Polygon',coordinates:[]}};
  expect(mapPickHint([road,polygon],[37,55]).named).toBe(false);
 });
 it('rejects invalid coordinates and preserves literal safe text',()=>{
  expect(mapPickHint([{...poi,geometry:{type:'Point',coordinates:[NaN,55]}}],[37,55]).named).toBe(false);
  expect(mapPickHint([{...poi,properties:{'name:ru':'<script>test</script>'}}],[37,55]).title).toBe('<script>test</script>');
 });
});
