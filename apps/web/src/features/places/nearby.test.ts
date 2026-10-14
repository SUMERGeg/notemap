import {describe,it,expect,vi} from 'vitest';
vi.mock('../../local/api',()=>({reserveGeoRequest:vi.fn().mockResolvedValue(undefined)}));
import {searchNearby} from './geoapify';
describe('explicit local-mode nearby search',()=>{
 it('filters unnamed points and duplicate locations while keeping separate branches',async()=>{
  const feature=(id:string,name:string,lon:number)=>({properties:{name,lon,lat:55,place_id:id,country_code:'ru',formatted:'Москва'}});
  const features=[feature('abc001','Кофе',37.001),feature('abc002','Кофе',37.00101),feature('abc003','Кофе',37.005),feature('abc004','',37),feature('abc005','Далеко',37.05),feature('abc001','Кофе',37.001)];
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({features})});
  const found=await searchNearby([37,55],new AbortController().signal,fetcher,'test-only',{type:'cafe',radius:500});
  expect(found.map(place=>place.providerId)).toEqual(['abc001','abc003']);
  const url=new URL(fetcher.mock.calls[0][0]);expect(url.searchParams.get('categories')).toBe('catering.cafe');expect(url.searchParams.get('filter')).toBe('circle:37,55,500');expect(url.searchParams.get('limit')).toBe('100');
 });
 it('uses Geoapify directly without a private backend and preserves cancellation',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({features:[{properties:{name:'Кафе',formatted:'Москва',lon:37,lat:55,place_id:'abc123',country_code:'ru'}}]})});
  const signal=new AbortController().signal;const found=await searchNearby([37,55],signal,fetcher,'test-only');
  const [url,options]=fetcher.mock.calls[0];expect(new URL(url).hostname).toBe('api.geoapify.com');expect(new URL(url).searchParams.get('filter')).toBe('circle:37,55,1500');expect(options.signal).toBe(signal);expect(options.credentials).toBe('omit');expect(found[0]).toMatchObject({providerId:'abc123',distanceM:0});
 });
 it('does not request geolocation or contact the provider for invalid coordinates',async()=>{const fetcher=vi.fn();await expect(searchNearby([200,55],new AbortController().signal,fetcher,'test-only')).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();});
 it('allows empty results and reports quota exhaustion with manual fallback',async()=>{expect(await searchNearby([37,55],new AbortController().signal,vi.fn().mockResolvedValue({ok:true,json:async()=>({features:[]})}),'test-only')).toEqual([]);await expect(searchNearby([37,55],new AbortController().signal,vi.fn().mockResolvedValue({ok:false,status:429}),'test-only')).rejects.toThrow('вручную');});
});
