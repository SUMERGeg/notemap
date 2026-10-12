import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMapStartup, mobileMapStyle, mapPixelRatio } from './startup';

afterEach(()=>vi.useRealTimers());
describe('запуск карты на медленной сети',()=>{
  it('ограничивает нагрузку холста на экранах 3x/4x, учитывая экономию трафика',()=>{
    expect(mapPixelRatio(3)).toBe(2);expect(mapPixelRatio(4)).toBe(2);
    expect(mapPixelRatio(1.5)).toBe(1.5);expect(mapPixelRatio(3,true)).toBe(1);
    expect(mapPixelRatio(NaN)).toBe(1);expect(mapPixelRatio(0)).toBe(1);
  });
  it('прерывает бесконечную заглушку и позволяет поздней загрузке восстановить карту',()=>{
    vi.useFakeTimers();const ready=vi.fn(),failed=vi.fn();const startup=createMapStartup({ready,failed});
    vi.advanceTimersByTime(12000);expect(failed).toHaveBeenCalledOnce();expect(ready).not.toHaveBeenCalled();
    startup.loaded();expect(ready).toHaveBeenCalledOnce();startup.dispose();
  });
  it('снимает заглушку после первого нарисованного тайла, не после пустого render',()=>{
    vi.useFakeTimers();const ready=vi.fn(),failed=vi.fn();const startup=createMapStartup({ready,failed});
    startup.rendered();expect(ready).not.toHaveBeenCalled();
    startup.tileLoaded();expect(ready).not.toHaveBeenCalled();startup.rendered();expect(ready).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(20000);expect(failed).not.toHaveBeenCalled();startup.dispose();
  });
  it('отменяет таймер при уходе и не перекрывает работающую карту ошибкой одного тайла',()=>{
    vi.useFakeTimers();const ready=vi.fn(),failed=vi.fn();const startup=createMapStartup({ready,failed});
    startup.loaded();startup.failed();expect(failed).not.toHaveBeenCalled();startup.dispose();
    const abandoned=createMapStartup({ready,failed});abandoned.dispose();vi.advanceTimersByTime(20000);abandoned.loaded();expect(ready).toHaveBeenCalledOnce();expect(failed).not.toHaveBeenCalled();
  });
  it('Retina-подложка сохраняет охват тайла и получает 512 физических пикселей',()=>{
    const style=mobileMapStyle('test key','osm-bright-smooth',undefined,{pixelRatio:3});
    const source=style.sources.geoapify;
    if(source.type!=='raster')throw new Error('Expected raster');
    expect(source.tileSize).toBe(256);
    expect(source.tiles?.[0]).toContain('/osm-bright-smooth/{z}/{x}/{y}@2x.png?');
  });
  it('экономия трафика использует обычные тайлы, а LAN-шаблон сохраняется дословно',()=>{
    const ordinary=mobileMapStyle('key','osm-bright',undefined,{pixelRatio:3,saveData:true});
    expect(JSON.stringify(ordinary)).not.toContain('@2x');
    const lan=mobileMapStyle('key','osm-bright','/map-tiles/osm-bright/{z}/{x}/{y}.png',{pixelRatio:3});
    const source=lan.sources.geoapify;if(source.type!=='raster')throw new Error('Expected raster');
    expect(source.tiles).toEqual(['/map-tiles/osm-bright/{z}/{x}/{y}.png']);
  });
  it('смена тайлов плавная, а reduced motion отключает переход',()=>{
    expect(mobileMapStyle('key','osm-bright').layers[0]).toMatchObject({paint:{'raster-fade-duration':160}});
    expect(mobileMapStyle('key','osm-bright',undefined,{reduceMotion:true}).layers[0]).toMatchObject({paint:{'raster-fade-duration':0}});
  });
  it('мобильная подложка не требует отдельных шрифтов, значков или vector tilejson',()=>{
    const style=mobileMapStyle('test key','osm-bright');expect(style.glyphs).toBeUndefined();expect(style.sprite).toBeUndefined();
    const source=style.sources['geoapify'];expect(source.type).toBe('raster');
    if(source.type==='raster'){expect(source.tileSize).toBe(256);expect(source.tiles?.[0]).toContain('/osm-bright/{z}/{x}/{y}.png?apiKey=test%20key');expect(source.attribution).toContain('OpenMapTiles');}
  });
  it('LAN карта получает тайлы с локального HTTPS-сервера без прямого запроса с телефона',()=>{
    const style=mobileMapStyle('test key','osm-bright','/map-tiles/osm-bright/{z}/{x}/{y}.png');
    const source=style.sources['geoapify'];if(source.type!=='raster')throw new Error('Expected raster');
    expect(source.tiles).toEqual(['/map-tiles/osm-bright/{z}/{x}/{y}.png']);expect(JSON.stringify(style)).not.toContain('test key');
  });
});
