import { describe,expect,it } from 'vitest';
import { mapPixelRatio,preferRetinaTiles,rasterTileUrl } from './startup';

describe('Geoapify thumbnails',()=>{
 it('uses Retina only on a known fast connection',()=>{
  expect(preferRetinaTiles()).toBe(false);expect(preferRetinaTiles({effectiveType:'3g',downlink:8,rtt:100})).toBe(false);
  expect(preferRetinaTiles({type:'wifi',saveData:true})).toBe(false);expect(preferRetinaTiles({type:'wifi'})).toBe(true);
  expect(preferRetinaTiles({effectiveType:'4g',downlink:10,rtt:50})).toBe(true);
 });
 it('bounds display density and respects data-saving mode',()=>{
  expect(mapPixelRatio(4)).toBe(2);expect(mapPixelRatio(1.5)).toBe(1.5);expect(mapPixelRatio(3,true)).toBe(1);expect(mapPixelRatio(NaN)).toBe(1);
 });
 it('builds thumbnail URLs and preserves tile coverage at high resolution',()=>{
  expect(rasterTileUrl('test key','osm-bright-smooth','1/2/3',{pixelRatio:2,highResolution:true})).toBe('https://maps.geoapify.com/v1/tile/osm-bright-smooth/1/2/3@2x.png?apiKey=test%20key');
  expect(rasterTileUrl('key','osm-bright','1/2/3',{pixelRatio:2,saveData:true})).not.toContain('@2x');
  expect(rasterTileUrl('key','osm-bright','1/2/3',{pixelRatio:2,highResolution:false})).not.toContain('@2x');
 });
});
