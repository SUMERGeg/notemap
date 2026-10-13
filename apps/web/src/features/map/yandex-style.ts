import type { StyleSpecification } from 'maplibre-gl';

export function yandexMapStyle(key:string,preferences:{pixelRatio?:number;saveData?:boolean;reduceMotion?:boolean}={}):StyleSpecification{
  const scale=!preferences.saveData&&(preferences.pixelRatio??1)>1?2:1;
  return {
    version:8,
    sources:{yandex:{type:'raster',tileSize:256,maxzoom:20,
      tiles:[`https://tiles.api-maps.yandex.ru/v1/tiles/?x={x}&y={y}&z={z}&lang=ru_RU&l=map&projection=web_mercator&scale=${scale}&apikey=${encodeURIComponent(key)}`],
      attribution:'© Яндекс | <a href="https://yandex.ru/legal/maps_api/" target="_blank" rel="noopener noreferrer">Условия использования</a>',
    }},
    layers:[{id:'yandex-map',type:'raster',source:'yandex',paint:{'raster-fade-duration':preferences.reduceMotion?0:160}}],
  };
}
