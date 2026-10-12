import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMapStartup, mobileMapStyle } from './startup';

afterEach(()=>vi.useRealTimers());
describe('запуск карты на медленной сети',()=>{
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
