import { useEffect, useRef } from 'react';
import { loadYandexJs, type NativeMap } from './yandex-js';
import type { Viewport } from './viewport';

export type VectorStatus = { ready: boolean; tiles: number; error: string };
export function YandexVectorMap({ run, position, onMove, onStatus }: {
  run: number; position: Viewport; onMove: (position: Viewport) => void; onStatus: (status: VectorStatus) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onMove, onStatus }); callbacks.current = { onMove, onStatus };
  const initial = useRef(position); initial.current = position;
  const controls = useRef<(action: 'in' | 'out' | 'rotate' | 'north') => void>(() => {});
  useEffect(() => {
    let alive = true, map: NativeMap | undefined, ready = false;
    callbacks.current.onStatus({ ready: false, tiles: 0, error: '' });
    const timer = window.setTimeout(() => {
      if (alive && !ready) callbacks.current.onStatus({ ready: false, tiles: 0, error: 'Векторные тайлы не появились за 20 секунд. Проверь подключение или повтори.' });
    }, 20000);
    void loadYandexJs(import.meta.env.VITE_YANDEX_JS_API_KEY?.trim() ?? '').then(sdk => {
      if (!alive || !host.current) return;
      let zoom = initial.current.zoom, azimuth = 0;
      map = new sdk.YMap(host.current, {
        location: { center: [initial.current.longitude, initial.current.latitude], zoom },
        mode: 'vector', camera: { azimuth: 0, tilt: 0 }, behaviors: ['drag', 'scrollZoom', 'pinchZoom', 'dblClick', 'pinchRotate'],
      });
      map.addChild(new sdk.YMapDefaultSchemeLayer({}));
      map.addChild(new sdk.YMapDefaultFeaturesLayer({}));
      map.addChild(new sdk.YMapListener({
        onUpdate: event => {
          if (!alive) return;
          zoom = event.location.zoom; azimuth = event.camera.azimuth;
          callbacks.current.onMove({ longitude: event.location.center[0], latitude: event.location.center[1], zoom });
        },
        onStateChanged: state => {
          if (!alive) return;
          const ground = state.getLayerState(`${sdk.YMapDefaultSchemeLayer.defaultProps.source}:ground`, 'tile');
          if (ground?.tilesReady) {
            ready = true; clearTimeout(timer);
            callbacks.current.onStatus({ ready: true, tiles: ground.tilesReady, error: '' });
          }
        },
      }));
      controls.current = action => {
        if (action === 'in' || action === 'out') map?.update({ location: { zoom: Math.max(2, Math.min(20, zoom + (action === 'in' ? 1 : -1))) } });
        else map?.update({ camera: { azimuth: action === 'north' ? 0 : azimuth + Math.PI / 4 } });
      };
    }).catch(() => {
      if (alive) { clearTimeout(timer); callbacks.current.onStatus({ ready: false, tiles: 0, error: 'Не удалось открыть Яндекс JS API. Проверь ключ JavaScript API, активацию и HTTP Referer.' }); }
    });
    return () => { alive = false; clearTimeout(timer); controls.current = () => {}; map?.destroy(); };
  }, [run]);
  return <div className="comparison-map-wrap">
    <div ref={host} className="comparison-map" aria-label="Векторная карта Яндекса" />
    <div className="vector-map-controls" aria-label="Управление векторной картой">
      <button aria-label="Увеличить масштаб" onClick={() => controls.current('in')}>+</button>
      <button aria-label="Уменьшить масштаб" onClick={() => controls.current('out')}>−</button>
      <button onClick={() => controls.current('rotate')}>Повернуть 45°</button>
      <button onClick={() => controls.current('north')}>Север ↑</button>
    </div>
  </div>;
}
