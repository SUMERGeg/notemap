import type { StyleSpecification } from 'maplibre-gl';

export function mobileMapStyle(key:string,style:string,tileTemplate?:string):StyleSpecification{
  return {
    version:8,
    sources:{geoapify:{type:'raster',tiles:[tileTemplate??`https://maps.geoapify.com/v1/tile/${encodeURIComponent(style)}/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(key)}`],tileSize:256,maxzoom:18,
      attribution:'<a href="https://www.geoapify.com/">Geoapify</a> | <a href="https://openmaptiles.org/">© OpenMapTiles</a> | <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>'}},
    layers:[{id:'geoapify',type:'raster',source:'geoapify',paint:{'raster-fade-duration':0}}],
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
