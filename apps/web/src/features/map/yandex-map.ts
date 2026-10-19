import { markerIcon } from '../../components/Icon';
import type { Entity, NativeMap, NativeLocationRequest, YandexSdk } from './yandex-js';
import type { Viewport } from './viewport';

type Position = [number,number];
type Padding = {top:number;right:number;bottom:number;left:number};
export type MapClick = {lngLat:{lng:number;lat:number}};
type EventName = 'move'|'moveend'|'zoom'|'click';
type Handler = (event:MapClick)=>void;
const clampZoom=(zoom:number)=>Math.max(2,Math.min(19,zoom));

/** Small camera/overlay bridge: all map rendering and labels belong to Yandex JS API. */
export class NativeMapController {
  readonly native:NativeMap;
  private events=new Map<EventName,Set<Handler>>();
  private disposed=false;
  private timer:ReturnType<typeof setTimeout>;
  private lastZoom:number;
  constructor(readonly sdk:YandexSdk,private host:HTMLElement,viewport:Viewport,callbacks:{ready:()=>void;failed:()=>void;preview?:boolean}){
    this.lastZoom=viewport.zoom;
    this.native=new sdk.YMap(host,{
      location:{center:[viewport.longitude,viewport.latitude],zoom:clampZoom(viewport.zoom)},
      mode:'vector',theme:'light',camera:{azimuth:0,tilt:0},zoomRange:{min:2,max:19},
      behaviors:callbacks.preview?[]:['drag','scrollZoom','pinchZoom','dblClick','pinchRotate','mouseRotate'],
      copyrightsPosition:callbacks.preview?'bottom left':'top left',distributionPosition:callbacks.preview?'bottom right':'top left',
    });
    this.timer=setTimeout(()=>{if(!this.disposed)callbacks.failed();},20000);
    let loaded=false;
    try{
      this.native.addChild(new sdk.YMapDefaultSchemeLayer({}));
      this.native.addChild(new sdk.YMapDefaultFeaturesLayer({}));
      this.native.addChild(new sdk.YMapListener({
        onUpdate:event=>{
          if(this.disposed)return;
          this.emit('move');
          if(event.location.zoom!==this.lastZoom){this.lastZoom=event.location.zoom;this.emit('zoom');}
          if(!event.mapInAction)this.emit('moveend');
        },
        onClick:(object,event)=>{
          if(this.disposed||object?.type==='marker')return;
          this.emit('click',{lngLat:{lng:event.coordinates[0],lat:event.coordinates[1]}});
        },
        onStateChanged:state=>{
          if(this.disposed||loaded)return;
          const layer=state.getLayerState(`${sdk.YMapDefaultSchemeLayer.defaultProps.source}:ground`,'tile');
          if(layer?.tilesReady){loaded=true;clearTimeout(this.timer);callbacks.ready();}
        },
      }));
    }catch(error){clearTimeout(this.timer);this.native.destroy();throw error;}
  }
  on(event:EventName,handler:Handler){let handlers=this.events.get(event);if(!handlers){handlers=new Set();this.events.set(event,handlers);}handlers.add(handler);}
  off(event:EventName,handler:Handler){this.events.get(event)?.delete(handler);}
  private emit(event:EventName,value:MapClick={lngLat:this.getCenter()}){for(const handler of this.events.get(event)??[])handler(value);}
  getCenter(){return {lng:this.native.center[0],lat:this.native.center[1]};}
  getZoom(){return this.native.zoom;}
  getContainer(){return this.host;}
  getBounds(){const [a,b]=this.native.bounds;return {getWest:()=>a[0],getEast:()=>b[0],getSouth:()=>Math.min(a[1],b[1]),getNorth:()=>Math.max(a[1],b[1])};}
  setPadding(padding:Padding){if(!this.disposed)this.native.update({margin:[padding.top,padding.right,padding.bottom,padding.left]});}
  jumpTo(props:{center?:Position;zoom?:number;padding?:Padding;duration?:number}){
    if(this.disposed)return;
    if(props.padding)this.setPadding(props.padding);
    const location:NativeLocationRequest={duration:props.duration??0};
    if(props.center)location.center=props.center;
    if(props.zoom!==undefined)location.zoom=clampZoom(props.zoom);
    this.native.update({location});
  }
  fitBounds(bounds:Position[],options:{maxZoom:number;duration:number;padding:Padding}){
    if(!bounds.length)return;
    const xs=bounds.map(p=>p[0]),ys=bounds.map(p=>p[1]);
    if(Math.max(...xs)-Math.min(...xs)<.00001&&Math.max(...ys)-Math.min(...ys)<.00001){this.jumpTo({center:bounds[0],zoom:options.maxZoom,padding:options.padding});return;}
    this.setPadding(options.padding);
    const mercator=(latitude:number)=>(1-Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,latitude))*Math.PI/360))/Math.PI)/2;
    const top=mercator(Math.max(...ys)),bottom=mercator(Math.min(...ys));
    const width=Math.max(1,this.host.clientWidth-options.padding.left-options.padding.right);
    const height=Math.max(1,this.host.clientHeight-options.padding.top-options.padding.bottom);
    const zoom=Math.min(options.maxZoom,Math.log2(width/(256*Math.max(.0000001,(Math.max(...xs)-Math.min(...xs))/360))),Math.log2(height/(256*Math.max(.0000001,bottom-top))));
    const center:Position=[(Math.min(...xs)+Math.max(...xs))/2,Math.atan(Math.sinh(Math.PI*(1-top-bottom)))*180/Math.PI];
    this.native.update({camera:{azimuth:0},location:{center,zoom:clampZoom(zoom),duration:options.duration}});
  }
  remove(){if(this.disposed)return;this.disposed=true;clearTimeout(this.timer);this.events.clear();this.native.destroy();}
  attach(entity:Entity){if(!this.disposed)this.native.addChild(entity);}
  detach(entity:Entity){if(!this.disposed)this.native.removeChild(entity);}
}

export class NativeMarker {
  private position:Position=[0,0];private entity?:Entity;private map?:NativeMapController;
  private element:HTMLElement;
  constructor({element,anchor='bottom'}:{element:HTMLElement;anchor?:'bottom'|'center'}){
    this.element=document.createElement('div');this.element.className=`native-marker native-marker-${anchor}`;
    this.element.append(element);
    this.element.addEventListener('click',event=>event.stopPropagation());
  }
  setLngLat(position:Position){this.position=position;this.entity?.update?.({coordinates:position});return this;}
  addTo(map:NativeMapController){this.remove();this.map=map;this.entity=new map.sdk.YMapMarker({coordinates:this.position,zIndex:10,blockBehaviors:true},this.element);map.attach(this.entity);return this;}
  remove(){if(this.entity)this.map?.detach(this.entity);this.entity=undefined;this.map=undefined;return this;}
}
export function selectionMarker(){const element=document.createElement('span');element.className='native-selection-dot';return new NativeMarker({element,anchor:'center'});}

export class NativePopup {
  private marker?:NativeMarker;private position:Position=[0,0];private content?:HTMLElement;
  constructor(private options:{closeButton?:boolean;className?:string;maxWidth?:string;offset?:number[];closeOnClick?:boolean;anchor?:string}={}){}
  setLngLat(position:Position){this.position=position;return this;}
  setDOMContent(content:HTMLElement){this.content=content;return this;}
  addTo(map:NativeMapController){
    this.remove();const shell=document.createElement('div');shell.className=`native-popup ${this.options.className??''}`;shell.style.width=this.options.maxWidth??'280px';
    if(this.options.offset)shell.style.marginBottom=`${-this.options.offset[1]}px`;
    if(this.options.closeButton!==false){const close=document.createElement('button');close.className='native-popup-close';close.type='button';close.setAttribute('aria-label','Закрыть');close.textContent='×';close.onclick=()=>this.remove();shell.append(close);}
    if(this.content)shell.append(this.content);
    this.marker=new NativeMarker({element:shell}).setLngLat(this.position).addTo(map);return this;
  }
  remove(){this.marker?.remove();this.marker=undefined;return this;}
}

type Point={id:string;longitude:number;latitude:number};
export function groupPoints<T extends Point>(points:T[],zoom:number){
  const scale=256*2**Math.floor(zoom),groups=new Map<string,{position:Position;points:T[]}>();
  for(const point of points){
    const lat=Math.max(-85,Math.min(85,point.latitude))*Math.PI/180;
    const x=(point.longitude+180)/360*scale,y=(1-Math.log(Math.tan(lat)+1/Math.cos(lat))/Math.PI)/2*scale;
    const key=`${Math.floor(x/64)}:${Math.floor(y/64)}`;
    let group=groups.get(key);if(!group){group={position:[point.longitude,point.latitude],points:[]};groups.set(key,group);}group.points.push(point);
  }
  return [...groups.values()].map(group=>({...group,position:[group.points.reduce((n,p)=>n+p.longitude,0)/group.points.length,group.points.reduce((n,p)=>n+p.latitude,0)/group.points.length] as Position}));
}
type MarkerPoint=Point&{category:string;label:string;open:()=>void};
export function installNativeMarkers(map:NativeMapController,_id:string,points:MarkerPoint[],imported=false){
  let markers:NativeMarker[]=[],popup:NativePopup|undefined,frame=0,disposed=false;
  const update=()=>{
    frame=0;if(disposed)return;
    markers.forEach(marker=>marker.remove());markers=[];
    const b=map.getBounds(),west=b.getWest(),east=b.getEast(),south=b.getSouth(),north=b.getNorth();
    const visible=points.filter(p=>(west<=east?p.longitude>=west-.02&&p.longitude<=east+.02:p.longitude>=west-.02||p.longitude<=east+.02)&&p.latitude>=south-.02&&p.latitude<=north+.02);
    for(const group of groupPoints(visible,map.getZoom())){
      const button=document.createElement('button');button.type='button';
      if(group.points.length===1){const point=group.points[0];button.className=`personal-marker${imported?' imported-marker':''}`;button.dataset.category=point.category;button.innerHTML=markerIcon(point.category);button.setAttribute('aria-label',point.label);button.onclick=point.open;}
      else{
        button.className=`cluster-marker${imported?' imported-cluster':''}`;button.textContent=String(group.points.length);button.setAttribute('aria-label',`${imported?'Импортированные места':'Личные заметки'}: ${group.points.length}. Раскрыть группу`);
        button.onclick=()=>{
          if(map.getZoom()<19){map.jumpTo({center:group.position,zoom:Math.min(19,map.getZoom()+2),duration:window.matchMedia('(prefers-reduced-motion:reduce)').matches?0:300});return;}
          const content=document.createElement('div');content.className='cluster-places';
          const show=(offset:number)=>{
            content.replaceChildren();
            for(const point of group.points.slice(offset,offset+20)){const item=document.createElement('button');item.type='button';item.textContent=point.label;item.onclick=()=>{popup?.remove();point.open();};content.append(item);}
            for(const [label,next] of [['Назад',offset-20],['Далее',offset+20]] as const){if(next<0||next>=group.points.length)continue;const item=document.createElement('button');item.type='button';item.textContent=label;item.onclick=()=>show(next);content.append(item);}
          };
          show(0);popup?.remove();popup=new NativePopup().setLngLat(group.position).setDOMContent(content).addTo(map);
        };
      }
      markers.push(new NativeMarker({element:button,anchor:group.points.length>1?'center':'bottom'}).setLngLat(group.position).addTo(map));
    }
  };
  const schedule=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(update);};
  map.on('moveend',schedule);schedule();
  return()=>{disposed=true;cancelAnimationFrame(frame);map.off('moveend',schedule);popup?.remove();markers.forEach(marker=>marker.remove());};
}
