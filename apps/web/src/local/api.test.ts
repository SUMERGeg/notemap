import { describe, expect, it } from 'vitest';
import { dispatchLocal, normalizeVerifiedPlace } from './api';
import { cascadeNotes, createState } from './db';

function note(state: ReturnType<typeof createState>, longitude = 37, latitude = 55, extra = {}) {
  return dispatchLocal(state, '/notes', 'POST', { place: { title: 'Место', longitude, latitude }, ...extra });
}

describe('local personal domain', () => {
  it('starts with local profile and replays creation without duplicates', () => {
    const state = createState(); expect(dispatchLocal(state, '/auth/me').id).toBe(state.profile.id);
    const payload = { place: { title: 'Кафе', longitude: 37, latitude: 55 }, text: 'Личное', rating: 7 };
    const first = dispatchLocal(state, '/notes', 'POST', payload, 'retry');
    expect(dispatchLocal(state, '/notes', 'POST', payload, 'retry')).toEqual(first);
    expect(state.notes).toHaveLength(1); expect(state.places).toHaveLength(1);
    expect(() => dispatchLocal(state, '/notes', 'POST', { ...payload, rating: 8 }, 'retry')).toThrow(/другими данными/);
    expect(state.notes[0].rating).toBe(7);
  });

  it('rejects invalid fields and absent referenced place without adding data', () => {
    const state = createState();
    for (const data of [{ rating: 0 }, { rating: '7' }, { latitude: 100 }, { visited_on: '2024-02-30' }, { visited_on: '2099-01-01' }, { category: 'secret' }]) {
      const payload = { place: { title: 'Точка', longitude: 1, latitude: data.latitude ?? 1 }, ...data };
      if ('latitude' in payload) delete (payload as any).latitude;
      expect(() => dispatchLocal(state, '/notes', 'POST', payload)).toThrow();
    }
    expect(() => dispatchLocal(state, '/notes', 'POST', { place_id: 'missing' })).toThrow();
    expect(state.notes).toHaveLength(0); expect(state.places).toHaveLength(0);
  });

  it('applies category/rating/date-line bbox filters with stable ranked pagination', () => {
    const state = createState();
    const east = note(state, 179, 30, { category: 'food', rating: 8 });
    const west = note(state, -179, 30, { category: 'food', rating: 9 });
    note(state, 0, 30, { category: 'food', rating: 10 }); note(state, 178, 30, { category: 'nature', rating: 9 });
    const path = '/rankings/places?category=food&min_rating=8&bbox=170,20,-170,40&limit=1';
    const first = dispatchLocal(state, path); expect(first.items.map((row: any) => row.id)).toEqual([west.id]); expect(first.next_cursor).toBe(west.id);
    const second = dispatchLocal(state, `${path}&cursor=${first.next_cursor}`); expect(second.items.map((row: any) => row.id)).toEqual([east.id]); expect(second.next_cursor).toBeNull();
    expect(() => dispatchLocal(state, '/notes?bbox=,0,1,2')).toThrow();
  });

  it('normalizes item types, upserts reviews and ranks by item rating', () => {
    const state = createState(); const a = note(state, 1, 1, { rating: 10 }); const b = note(state, 2, 2, { rating: 1 });
    const item = dispatchLocal(state, '/item-types', 'POST', { name: ' Борщ ' });
    expect(dispatchLocal(state, '/item-types', 'POST', { name: 'борщ' }).id).toBe(item.id);
    dispatchLocal(state, `/notes/${a.id}/item-reviews/${item.id}`, 'PUT', { rating: 4 });
    dispatchLocal(state, `/notes/${a.id}/item-reviews/${item.id}`, 'PUT', { rating: 5 });
    dispatchLocal(state, `/notes/${b.id}/item-reviews/${item.id}`, 'PUT', { rating: 9 });
    expect(state.reviews).toHaveLength(2);
    const rows = dispatchLocal(state, `/rankings/items?item_type_id=${item.id}&min_rating=6`).items;
    expect(rows.map((row: any) => row.note.id)).toEqual([b.id]); expect(rows[0].rating).toBe(9);
    dispatchLocal(state, `/notes/${a.id}/item-reviews/${item.id}`, 'DELETE'); expect(state.reviews).toHaveLength(1);
    expect(() => dispatchLocal(state, `/notes/${b.id}/item-reviews/unknown`, 'PUT', { rating: 7 })).toThrow();
  });

  it('maintains collection memberships and cascades only personal dependent rows', () => {
    const state = createState(); const a = note(state); const b = note(state);
    const collection = dispatchLocal(state, '/collections', 'POST', { name: 'Любимое' }, 'create');
    dispatchLocal(state, `/collections/${collection.id}/notes/${a.id}`, 'PUT'); dispatchLocal(state, `/collections/${collection.id}/notes/${a.id}`, 'PUT');
    dispatchLocal(state, `/collections/${collection.id}/notes/${b.id}`, 'PUT');
    expect(dispatchLocal(state, `/collections/${collection.id}`).note_count).toBe(2);
    state.imports.push({ id: 'import', items: [{ origin_note_id: a.id, text: 'Копия' }] }); state.snapshots.push({ id: 'snapshot', notes: [{ id: a.id }] });
    const item = dispatchLocal(state, '/item-types', 'POST', { name: 'Чай' }); dispatchLocal(state, `/notes/${a.id}/item-reviews/${item.id}`, 'PUT', { rating: 8 });
    dispatchLocal(state, `/notes/${a.id}`, 'DELETE'); cascadeNotes(state);
    expect(state.collections[0].note_ids).toEqual([b.id]); expect(state.reviews).toHaveLength(0);
    expect(state.imports[0].items[0].text).toBe('Копия'); expect(state.snapshots).toHaveLength(1);
    dispatchLocal(state, `/collections/${collection.id}`, 'DELETE'); expect(state.notes.map(row => row.id)).toEqual([b.id]);
  });
});

describe('browser provider verification', () => {
  const details = () => ({ features: [{ properties: { feature_type: 'details', name: 'Кафе', formatted: 'Адрес', lon: 37, lat: 55, country_code: 'ru', datasource: { sourcename: 'openstreetmap', raw: { osm_type: 'n', osm_id: 123 } } } }] });
  it('keeps permitted provenance and rejects other sources/countries/coordinates', () => {
    expect(normalizeVerifiedPlace(details())).toMatchObject({ source_key: 'osm:n:123', source_license: 'ODbL-1.0', origin: 'external' });
    const foreign = details(); foreign.features[0].properties.country_code = 'us'; expect(() => normalizeVerifiedPlace(foreign)).toThrow();
    const source = details(); source.features[0].properties.datasource.sourcename = 'unknown'; expect(() => normalizeVerifiedPlace(source)).toThrow();
    const coords = details(); coords.features[0].properties.lon = Infinity; expect(() => normalizeVerifiedPlace(coords)).toThrow();
  });
});
