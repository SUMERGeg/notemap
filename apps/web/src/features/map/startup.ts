import type { StyleSpecification } from 'maplibre-gl';

export const MAP_STYLE=import.meta.env.VITE_GEOAPIFY_STYLE?.trim()||'osm-bright-smooth';
type RenderPreferences={pixelRatio?:number;saveData?:boolean;reduceMotion?:boolean;highResolution?:boolean};
type Connection={saveData?:boolean;type?:string;effectiveType?:string;downlink?:number;rtt?:number};
export function preferRetinaTiles(connection?:Connection){
  if(!connection||connection.saveData)return false;
  return connection.type==='wifi'||connection.type==='ethernet'||
    (connection.effectiveType==='4g'&&(connection.downlink??0)>=5&&(connection.rtt??Infinity)<=150);
}
export function mapPixelRatio(value:number,saveData=false){
  return saveData||!Number.isFinite(value)?1:Math.max(1,Math.min(2,value));
}
export function getMapRenderPreferences():RenderPreferences{
  const connection=(navigator as Navigator&{connection?:Connection}).connection;
  const saveData=!!connection?.saveData;
  return {pixelRatio:mapPixelRatio(window.devicePixelRatio,saveData),saveData,highResolution:preferRetinaTiles(connection),reduceMotion:window.matchMedia('(prefers-reduced-motion:reduce)').matches};
}
export function rasterTileUrl(key:string,style:string,path:string,preferences:RenderPreferences={}){
  const scale=preferences.highResolution!==false&&!preferences.saveData&&(preferences.pixelRatio??1)>1?'@2x':'';
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
export function createMapStartup({ready,failed,recover}:{ready:()=>void;failed:()=>void;recover?:()=>void}){
  let disposed=false,complete=false,hasTile=false,recovered=false,reported=false;
  function report(){if(disposed||complete||reported)return;reported=true;failed();}
  function fallback(){
    if(disposed||complete||recovered||!recover)return;
    recovered=true;hasTile=false;clearTimeout(timeout);
    timeout=setTimeout(report,12000);
    recover();
  }
  let timeout=setTimeout(()=>{if(recover&&!recovered)fallback();else report();},recover?8000:12000);
  function loaded(){if(disposed||complete)return;complete=true;clearTimeout(timeout);ready();}
  return {
    loaded,
    tileLoaded(){hasTile=true;},
    rendered(){if(hasTile)loaded();},
    failed(){if(disposed||complete)return;if(recover){fallback();}else{clearTimeout(timeout);report();}},
    dispose(){disposed=true;clearTimeout(timeout);},
  };
}
