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
  it('uses name search for organizations and preserves cancellation signal', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [] }) });
    const signal = new AbortController().signal;
    await searchPlaces('организация', 'Кофейня', 'test-only', [37.6, 55.7], signal, fetcher);
    const [url, options] = fetcher.mock.calls[0];
    expect(new URL(url).searchParams.get('text')).toBe('Кофейня');
    expect(new URL(url).searchParams.get('type')).toBe('amenity');
    expect(new URL(url).searchParams.has('categories')).toBe(false);
    expect(new URL(url).searchParams.get('bias')).toBe('proximity:37.6,55.7');
    expect(options.signal).toBe(signal);
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

