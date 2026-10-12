import { useId, useRef } from 'react';
import { Icon } from './Icon';
export function ConfirmAction({label,title,description,disabled,onConfirm,confirmLabel='Удалить'}:{label:string;title:string;description:string;disabled?:boolean;onConfirm:()=>void;confirmLabel?:string}) {
  const dialog=useRef<HTMLDialogElement>(null);const titleId=useId();const descriptionId=useId();
  return <><button type="button" className="danger-action" disabled={disabled} onClick={()=>dialog.current?.showModal()}><Icon name="trash"/>{label}</button>
    <dialog ref={dialog} className="confirm-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}><span className="dialog-icon"><Icon name="trash"/></span><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p><form method="dialog" className="dialog-actions"><button className="secondary" autoFocus>Отмена</button><button type="button" className="danger-button" onClick={()=>{dialog.current?.close();onConfirm();}}>{confirmLabel}</button></form></dialog></>;
}
