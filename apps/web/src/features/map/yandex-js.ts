type Entity = object;
export type NativeMap = {
  addChild(child: Entity): NativeMap;
  destroy(): void;
  update(props: { location?: { zoom: number }; camera?: { azimuth: number } }): void;
};
export type NativeLocation = { center: [number, number]; zoom: number };
type NativeState = { getLayerState(id: string, type: 'tile'): { tilesReady: number } | undefined };
export type YandexSdk = {
  ready: Promise<void>;
  YMap: new (host: HTMLElement, props: { location: NativeLocation; mode: 'vector'; camera: { azimuth: number; tilt: number }; behaviors: string[] }) => NativeMap;
  YMapDefaultSchemeLayer: { new (props: object): Entity; defaultProps: { source: string } };
  YMapDefaultFeaturesLayer: new (props: object) => Entity;
  YMapListener: new (props: { onUpdate: (event: { location: NativeLocation; camera: { azimuth: number } }) => void; onStateChanged: (state: NativeState) => void }) => Entity;
};

let pending: Promise<YandexSdk> | undefined;
export function loadYandexJs(key: string): Promise<YandexSdk> {
  if (!key.trim()) return Promise.reject(new Error('Не настроен ключ JavaScript API.'));
  if (pending) return pending;
  pending = new Promise<YandexSdk>((resolve, reject) => {
    const script = document.createElement('script');
    script.dataset.notemapOptional = 'true';
    let finished = false;
    const finish = (sdk?: YandexSdk) => {
      if (finished) return;
      finished = true; clearTimeout(timer); script.onload = null; script.onerror = null;
      if (sdk) resolve(sdk);
      else { script.remove(); pending = undefined; reject(new Error('Яндекс JS API не загрузился. Проверь ключ, активацию и разрешённый домен.')); }
    };
    const timer = window.setTimeout(() => finish(), 15000);
    const url = new URL('https://api-maps.yandex.ru/v3/');
    url.searchParams.set('apikey', key); url.searchParams.set('lang', 'ru_RU');
    script.src = url.toString(); script.async = true; script.referrerPolicy = 'strict-origin-when-cross-origin';
    script.onerror = () => finish();
    script.onload = () => {
      const sdk = (window as Window & { ymaps3?: YandexSdk }).ymaps3;
      if (!sdk) { finish(); return; }
      void sdk.ready.then(() => finish(sdk), () => finish());
    };
    document.head.append(script);
  });
  return pending;
}
