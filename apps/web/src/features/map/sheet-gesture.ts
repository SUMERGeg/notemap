export type SheetDrag={startY:number;startOffset:number;travel:number;offset:number;lastY:number;lastTime:number;velocity:number;distance:number};
export function startSheetDrag(y:number,offset:number,travel:number,time:number):SheetDrag{
  return {startY:y,startOffset:offset,travel,offset,lastY:y,lastTime:time,velocity:0,distance:0};
}
export function moveSheetDrag(drag:SheetDrag,y:number,time:number){
  const elapsed=time-drag.lastTime;
  if(elapsed>0)drag.velocity=(y-drag.lastY)/elapsed;
  drag.lastY=y;drag.lastTime=time;drag.distance=Math.max(drag.distance,Math.abs(y-drag.startY));
  drag.offset=Math.max(0,Math.min(drag.travel,drag.startOffset+y-drag.startY));return drag.offset;
}
export function finishSheetDrag(drag:SheetDrag,time:number):boolean|null{
  if(drag.distance<6)return null;
  const velocity=time-drag.lastTime<100?drag.velocity:0;
  return Math.abs(velocity)>.5?velocity>0:drag.offset>drag.travel/2;
}
