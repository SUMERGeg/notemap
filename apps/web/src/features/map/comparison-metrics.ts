export type ComparisonMetrics={firstTileMs:number|null;tiles:number;errors:number};
export function createComparisonMetrics(changed:(value:ComparisonMetrics)=>void,now=()=>performance.now()){
  const started=now();let disposed=false;
  let value:ComparisonMetrics={firstTileMs:null,tiles:0,errors:0};
  const emit=()=>changed({...value});
  return {
    tileLoaded(){if(disposed)return;value.tiles++;emit();},
    tileFailed(){if(disposed)return;value.errors++;emit();},
    rendered(){if(disposed||!value.tiles||value.firstTileMs!==null)return;value.firstTileMs=Math.round(now()-started);emit();},
    dispose(){disposed=true;},
  };
}
