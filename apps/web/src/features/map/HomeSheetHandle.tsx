import { useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';
import { startSheetDrag, moveSheetDrag, finishSheetDrag, type SheetDrag } from './sheet-gesture';

export function HomeSheetHandle({compact,travel,onCompact,onOffset}:{compact:boolean;travel:number;onCompact:(value:boolean)=>void;onOffset:(value:number|null)=>void}){
  const gesture=useRef<{pointerId:number;drag:SheetDrag}|null>(null);
  const suppressClickUntil=useRef(0);
  const offsetCallback=useRef(onOffset);offsetCallback.current=onOffset;
  useEffect(()=>()=>{if(gesture.current)offsetCallback.current(null);},[]);
  function start(event:PointerEvent<HTMLButtonElement>){
    if(!event.isPrimary||event.button!==0||!window.matchMedia('(max-width:700px)').matches)return;
    const sheet=event.currentTarget.closest('aside');
    const transform=sheet?getComputedStyle(sheet).transform:'none';
    const offset=transform==='none'?(compact?travel:0):new DOMMatrixReadOnly(transform).m42;
    gesture.current={pointerId:event.pointerId,drag:startSheetDrag(event.clientY,offset,travel,event.timeStamp)};
    event.currentTarget.setPointerCapture(event.pointerId);onOffset(offset);
  }
  function move(event:PointerEvent<HTMLButtonElement>){
    const active=gesture.current;if(!active||active.pointerId!==event.pointerId)return;
    onOffset(moveSheetDrag(active.drag,event.clientY,event.timeStamp));
  }
  function finish(event:PointerEvent<HTMLButtonElement>,cancelled=false){
    const active=gesture.current;if(!active||active.pointerId!==event.pointerId)return;
    gesture.current=null;
    if(cancelled||active.drag.distance>=6)suppressClickUntil.current=Date.now()+400;
    if(!cancelled){const target=finishSheetDrag(active.drag,event.timeStamp);if(target!==null)onCompact(target);}
    onOffset(null);
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return <button type="button" className="sheet-handle home-sheet-handle" aria-label={compact?'Развернуть панель':'Свернуть панель'} aria-expanded={!compact} aria-controls="map-panel-content"
    onPointerDown={start} onPointerMove={move} onPointerUp={event=>finish(event)} onPointerCancel={event=>finish(event,true)} onLostPointerCapture={event=>finish(event,true)}
    onKeyDown={event=>{if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();onCompact(event.key==='ArrowDown');}}}
    onClick={event=>{if(event.detail>0&&Date.now()<suppressClickUntil.current)return;onCompact(!compact);}}><span/></button>;
}
