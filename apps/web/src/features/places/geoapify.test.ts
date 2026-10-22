import { describe, expect, it, vi } from 'vitest';
vi.mock('../../local/api',()=>({reserveGeoRequest:vi.fn().mockResolvedValue(undefined)}));
import { searchPlaces, normalizeResults } from './geoapify';
import { readViewport } from '../map/viewport';

describe('Geoapify search', () => {
  it('keeps named POI identity and excludes invalid coordinates', () => {
    expect(normalizeResults({ features: [
      { properties: { name: 'Кафе', formatted: 'Москва', lon: 37.6, lat: 55.7, place_id: 'poi-1' } },
      { properties: { name: 'Ошибка', lon: 200, lat: 55 } },
    ] })).toEqual([{ title: 'Кафе', address: 'Москва', longitude: 37.6, latitude: 55.7, providerId: 'poi-1' }]);
  });
  it('rejects malformed provider response instead of showing fake empty results', () => {
    expect(() => normalizeResults({ error: 'invalid key' })).toThrow();
  });
  it('does not contact a service without a key', async () => {
    const fetcher = vi.fn();
    await expect(searchPlaces('адрес', 'Москва', '', [37.6, 55.7], new AbortController().signal, fetcher)).rejects.toThrow('Ключ');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('reports quota exhaustion without exposing key', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    await expect(searchPlaces('адрес', 'Москва', 'private-test-key', [37.6, 55.7], new AbortController().signal, fetcher)).rejects.toThrow('Лимит');
  });
  it('uses category search for cafes and preserves cancellation signal', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [] }) });
    const signal = new AbortController().signal;
    await searchPlaces('организация', 'Кофейня', 'test-only', [37.6, 55.7], signal, fetcher);
    const [url, options] = fetcher.mock.calls[0];
    expect(new URL(url).pathname).toBe('/v2/places');
    expect(new URL(url).searchParams.get('categories')).toBe('catering.cafe');
    expect(new URL(url).searchParams.has('name')).toBe(false);
    expect(new URL(url).searchParams.get('filter')).toContain('circle:37.6,55.7,');
    expect(new URL(url).searchParams.get('bias')).toBe('proximity:37.6,55.7');
    expect(options.signal).toBe(signal);
  });
  it('uses a name filter and rejects address-only and unrelated name matches',async()=>{
    const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({features:[
      {properties:{name:'Шоколадница',place_id:'cafe-1',lon:37.6,lat:55.7,categories:['catering.cafe']}},
      {properties:{name:'Шоколадница',place_id:'cafe-1',lon:37.6,lat:55.7,categories:['catering.cafe']}},
      {properties:{formatted:'Шоколадница, Москва',result_type:'street',lon:37.6,lat:55.7}},
      {properties:{name:'Другое кафе',place_id:'other',lon:37.6,lat:55.7,categories:['catering.cafe']}}
    ]})});
    const found=await searchPlaces('организация','Шоколадница','named-test',[37.6,55.7],new AbortController().signal,fetcher);
    expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('name')).toBe('Шоколадница');
    expect(found.map(place=>place.providerId)).toEqual(['cafe-1']);
  });
  it('reuses identical recent searches without consuming another request',async()=>{
    const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({features:[]})});
    for(let i=0;i<2;i++)await searchPlaces('организация','Аптека','cache-test',[37,55],new AbortController().signal,fetcher);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('falls back to named amenities when Places misses a known organization, never streets',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({features:[]})}).mockResolvedValueOnce({ok:true,json:async()=>({features:[
      {properties:{name:'Шоколадница',place_id:'real-cafe',result_type:'amenity',lon:37,lat:55}},
      {properties:{name:'Шоколадница',place_id:'street',result_type:'street',lon:37,lat:55}},
      {properties:{name:'Шоколадница',place_id:'far-cafe',result_type:'amenity',lon:30,lat:60}}
    ]})});
    const found=await searchPlaces('организация','Шоколадница','fallback-test',[37,55],new AbortController().signal,fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);expect(found.map(place=>place.providerId)).toEqual(['real-cafe']);
    expect(new URL(fetcher.mock.calls[1][0]).searchParams.get('type')).toBe('amenity');
  });
  it('supports geocoder results lacking external identity', () => {
    expect(normalizeResults({ results: [{ formatted: 'Адрес', lon: 37.6, lat: 55.7 }] })[0].providerId).toBeUndefined();
  });
});

describe('viewport storage', () => {
  it('uses Moscow fallback for corrupt, nonfinite or out of range data', () => {
    for (const value of ['{', '{"longitude":200,"latitude":55,"zoom":12}', '{"longitude":37,"latitude":null,"zoom":12}']) {
      expect(readViewport(value)).toEqual({ longitude: 37.6173, latitude: 55.7558, zoom: 12 });
    }
  });
  it('restores voluntarily selected viewport', () => {
    expect(readViewport('{"longitude":30.3,"latitude":59.9,"zoom":14}')).toEqual({ longitude: 30.3, latitude: 59.9, zoom: 14 });
  });
});

