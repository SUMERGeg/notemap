import { describe, expect, it } from 'vitest';
import { yandexMapStyle } from './yandex-style';

describe('тайлы Яндекса в MapLibre',()=>{
  it('запрашивает русские подписи и сферическую проекцию без смещения личных точек',()=>{
    const style=yandexMapStyle('test key&value');const source=style.sources.yandex;
    if(source.type!=='raster')throw new Error('Expected raster');
    expect(source.tileSize).toBe(256);
    const url=new URL(source.tiles![0]);
    expect(url.origin).toBe('https://tiles.api-maps.yandex.ru');
    expect(url.searchParams.get('apikey')).toBe('test key&value');
    expect(url.searchParams.get('projection')).toBe('web_mercator');
    expect(url.searchParams.get('lang')).toBe('ru_RU');
    expect(url.searchParams.get('l')).toBe('map');
    expect(url.searchParams.get('scale')).toBe('1');
    expect(source.attribution).toContain('https://yandex.ru/legal/maps_api/');
  });
});
