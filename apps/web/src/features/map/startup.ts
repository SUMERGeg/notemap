
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
