import * as maplibregl from 'maplibre-gl';
import { markerIcon } from '../../components/Icon';
export type MarkerPoint={id:string;longitude:number;latitude:number;category:string;label:string;open:()=>void};
type PointFeature={geometry:{type:string;coordinates:readonly number[]};properties:Record<string,unknown>|null};
export function markerData(points:MarkerPoint[]){
 return {type:'FeatureCollection' as const,features:points.map(p=>({type:'Feature' as const,geometry:{type:'Point' as const,coordinates:[p.longitude,p.latitude]},properties:{id:p.id}}))};
}
export function visibleFeatures<T extends PointFeature>(features:T[],contains:(position:[number,number])=>boolean):T[]{
 const seen=new Set<string>();
 return features.filter(f=>{
  if(f.geometry.type!=='Point')return false;
  const key=f.properties?.cluster?`c:${f.properties.cluster_id}`:`p:${f.properties?.id}`;
  const position:[number,number]=[f.geometry.coordinates[0],f.geometry.coordinates[1]];
  if(seen.has(key)||!contains(position))return false;
  seen.add(key);return true;
 });
}
// The worker clusters GeoJSON; DOM buttons exist only for visible groups/leaves.
export function installClusteredMarkers(map:maplibregl.Map,id:string,points:MarkerPoint[],imported=false){
 const lookup=new Map(points.map(p=>[p.id,p]));
 const markers=new Map<string,maplibregl.Marker>();
 let disposed=false,frame=0,detail:maplibregl.Popup|null=null;
 map.addSource(id,{type:'geojson',data:markerData(points),cluster:true,clusterRadius:60,clusterMaxZoom:18,maxzoom:19});
 // A transparent GPU layer ensures the source's visible tiles are loaded.
 map.addLayer({id,type:'circle',source:id,paint:{'circle-radius':1,'circle-opacity':0}});
 const source=map.getSource(id) as maplibregl.GeoJSONSource;
 async function showLeaves(clusterId:number,position:[number,number],count:number,offset=0){
  try{
   const leaves=await source.getClusterLeaves(clusterId,20,offset);
   if(disposed)return;
   detail?.remove();
   const content=document.createElement('div');content.className='cluster-places';
   const title=document.createElement('strong');title.textContent=`${imported?'Импортированные места':'Личные заметки'} · ${count}`;content.append(title);
   for(const leaf of leaves){
    const p=lookup.get(String(leaf.properties?.id));if(!p)continue;
    const button=document.createElement('button');button.type='button';button.textContent=p.label;
    button.onclick=()=>{detail?.remove();p.open();};content.append(button);
   }
   for(const [label,next] of [['Назад',offset-20],['Далее',offset+20]] as const){
    if(next<0||next>=count)continue;
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.onclick=()=>{void showLeaves(clusterId,position,count,next);};content.append(button);
   }
   detail=new maplibregl.Popup({maxWidth:'300px'}).setLngLat(position).setDOMContent(content).addTo(map);
  }catch{/* A changed/removed cluster can be selected again. */}
 }
 function update(){
  frame=0;if(disposed||!map.isSourceLoaded(id))return;
  const canvas=map.getCanvas();
  const features=visibleFeatures(map.querySourceFeatures(id).filter(f=>f.geometry.type==='Point') as unknown as PointFeature[],position=>{
   // Wrap the position to the currently displayed copy of the world.
   const longitude=position[0]+360*Math.round((map.getCenter().lng-position[0])/360);
   const screen=map.project([longitude,position[1]]);
   return screen.x>=-50&&screen.y>=-50&&screen.x<=canvas.clientWidth+50&&screen.y<=canvas.clientHeight+50;
  });
  const retained=new Set<string>();
  for(const feature of features){
   const props=feature.properties!;const cluster=Boolean(props.cluster);
   const key=cluster?`c:${props.cluster_id}`:`p:${props.id}`;retained.add(key);
   const position:[number,number]=[feature.geometry.coordinates[0],feature.geometry.coordinates[1]];
   position[0]+=360*Math.round((map.getCenter().lng-position[0])/360);
   const existing=markers.get(key);if(existing){existing.setLngLat(position);continue;}
   const button=document.createElement('button');button.type='button';
   if(cluster){
    const count=Number(props.point_count);const clusterId=Number(props.cluster_id);
    button.className=`cluster-marker${imported?' imported-cluster':''}`;button.textContent=String(count);
    button.setAttribute('aria-label',`${imported?'Импортированные места':'Личные заметки'}: ${count}. Раскрыть группу`);
    button.onclick=async()=>{
     try{const zoom=await source.getClusterExpansionZoom(clusterId);if(disposed)return;
      if(zoom>map.getMaxZoom())await showLeaves(clusterId,position,count);
      else map.easeTo({center:position,zoom,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:350});
     }catch{/* Source changed while expansion was pending. */}
    };
   }else{
    const point=lookup.get(String(props.id));if(!point)continue;
    button.className=`personal-marker${imported?' imported-marker':''}`;button.dataset.category=point.category;
    button.innerHTML=markerIcon(point.category);button.setAttribute('aria-label',point.label);button.onclick=point.open;
   }
   markers.set(key,new maplibregl.Marker({element:button,anchor:cluster?'center':'bottom'}).setLngLat(position).addTo(map));
  }
  for(const [key,marker] of markers)if(!retained.has(key)){marker.remove();markers.delete(key);}
 }
 const schedule=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(update);};
 const data=(event:maplibregl.MapSourceDataEvent)=>{if(event.sourceId===id)schedule();};
 map.on('move',schedule);map.on('sourcedata',data);schedule();
 return()=>{
  disposed=true;cancelAnimationFrame(frame);map.off('move',schedule);map.off('sourcedata',data);
  detail?.remove();markers.forEach(marker=>marker.remove());markers.clear();
  if(map.getLayer(id))map.removeLayer(id);if(map.getSource(id))map.removeSource(id);
 };
}
