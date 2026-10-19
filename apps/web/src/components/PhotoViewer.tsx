import { useEffect, useRef } from 'react';
import { Icon } from './Icon';

export function PhotoViewer({sources,index,onIndex,onClose}:{sources:string[];index:number;onIndex:(index:number)=>void;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
  return <dialog ref={dialog} className="photo-viewer" aria-label="Просмотр фотографий" onCancel={event=>{event.preventDefault();onClose();}} onKeyDown={event=>{if(event.key==='ArrowRight')onIndex((index+1)%sources.length);if(event.key==='ArrowLeft')onIndex((index+sources.length-1)%sources.length);}}><header><span>{index+1} / {sources.length}</span><button autoFocus type="button" aria-label="Закрыть фотографии" onClick={onClose}><Icon name="close"/></button></header><img src={sources[index]} alt={`Фото ${index+1}`}/>{sources.length>1&&<footer><button type="button" onClick={()=>onIndex((index+sources.length-1)%sources.length)}>Назад</button><button type="button" onClick={()=>onIndex((index+1)%sources.length)}>Далее</button></footer>}</dialog>;
}
