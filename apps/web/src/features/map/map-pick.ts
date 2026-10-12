import { validCoordinates } from './viewport';
type TileHint={layer?:{type?:string;'source-layer'?:string};geometry?:{type?:string;coordinates?:unknown};properties?:Record<string,unknown>|null};
export function mapPickHint(features:TileHint[],position:[number,number]){
 for(const feature of features){
  if(feature.layer?.type!=='symbol'||feature.layer['source-layer']!=='poi'||feature.geometry?.type!=='Point')continue;
  const coords=feature.geometry.coordinates;
  const properties=feature.properties;
  const name=properties?.['name:ru']??properties?.name_ru??properties?.name;
  if(!Array.isArray(coords)||!validCoordinates(coords[0],coords[1])||typeof name!=='string'||!name.trim())continue;
  return {title:name.trim().slice(0,200),position:[coords[0],coords[1]] as [number,number],named:true};
 }
 return {title:'Точка на карте',position,named:false};
}
