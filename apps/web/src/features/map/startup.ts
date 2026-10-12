import type { StyleSpecification } from 'maplibre-gl';

export const MAP_STYLE=import.meta.env.VITE_GEOAPIFY_STYLE?.trim()||'osm-bright-smooth';
type RenderPreferences={pixelRatio?:number;saveData?:boolean;reduceMotion?:boolean};
export function mapPixelRatio(value:number,saveData=false){
  return saveData||!Number.isFinite(value)?1:Math.max(1,Math.min(2,value));
}
export function getMapRenderPreferences():RenderPreferences{
  const saveData=!!(navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData;
  return {pixelRatio:mapPixelRatio(window.devicePixelRatio,saveData),saveData,reduceMotion:window.matchMedia('(prefers-reduced-motion:reduce)').matches};
}
export function rasterTileUrl(key:string,style:string,path:string,preferences:RenderPreferences={}){
  const scale=!preferences.saveData&&(preferences.pixelRatio??1)>1?'@2x':'';
  return `https://maps.geoapify.com/v1/tile/${encodeURIComponent(style)}/${path}${scale}.png?apiKey=${encodeURIComponent(key)}`;
}
export function mobileMapStyle(key:string,style:string,tileTemplate?:string,preferences:RenderPreferences={}):StyleSpecification{
  return {
    version:8,
    sources:{geoapify:{type:'raster',tiles:[tileTemplate??rasterTileUrl(key,style,'{z}/{x}/{y}',preferences)],tileSize:256,maxzoom:18,
      attribution:'<a href="https://www.geoapify.com/">Geoapify</a> | <a href="https://openmaptiles.org/">© OpenMapTiles</a> | <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>'}},
    layers:[{id:'geoapify',type:'raster',source:'geoapify',paint:{'raster-fade-duration':preferences.reduceMotion?0:160}}],
  };
}

// A pending network/worker request may emit neither load nor error.
export function createMapStartup({ready,failed}:{ready:()=>void;failed:()=>void}){
  let disposed=false,complete=false,hasTile=false;
  const timeout=setTimeout(()=>{if(!disposed&&!complete)failed();},12000);
  function loaded(){if(disposed||complete)return;complete=true;clearTimeout(timeout);ready();}
  return {
    loaded,
    tileLoaded(){hasTile=true;},
    rendered(){if(hasTile)loaded();},
    failed(){if(!disposed&&!complete){clearTimeout(timeout);failed();}},
    dispose(){disposed=true;clearTimeout(timeout);},
  };
}
