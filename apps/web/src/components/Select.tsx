import { useEffect,useId,useRef,useState,type CSSProperties,type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { matchOption,nextOption,type SelectOption } from './select-navigation';

export function Select({id,value,options,onChange,disabled=false,autoFocus=false,label}:{id:string;value:string;options:SelectOption[];onChange:(value:string)=>void;disabled?:boolean;autoFocus?:boolean;label:string}){
 const uid=useId();const menuId=`select-${uid}`;const trigger=useRef<HTMLButtonElement>(null);const menu=useRef<HTMLDivElement>(null);
 const [opened,setOpened]=useState(false);const [active,setActive]=useState(0);const [position,setPosition]=useState<CSSProperties>();const typed=useRef({value:'',at:0});
 const selected=options.findIndex(option=>option.value===value);
 function close(restore=false){setOpened(false);if(restore)trigger.current?.focus();}
 function open(){if(disabled||trigger.current?.matches(':disabled'))return;setActive(selected>=0&&!options[selected].disabled?selected:nextOption(options,-1,1));setPosition(undefined);setOpened(true);typed.current={value:'',at:0};}
 function choose(index:number){if(index>=0&&options[index]&&!options[index].disabled){onChange(options[index].value);close(true);}}
 useEffect(()=>{if(autoFocus)trigger.current?.focus();},[autoFocus]);
 useEffect(()=>{if(disabled)close();},[disabled]);
 useEffect(()=>{
  if(!opened)return;
  function place(){const rect=trigger.current?.getBoundingClientRect();if(!rect)return;const viewport=window.visualViewport;const top=viewport?.offsetTop??0;const left=viewport?.offsetLeft??0;const width=viewport?.width??window.innerWidth;const height=viewport?.height??window.innerHeight;
   if(rect.bottom<top||rect.top>top+height){close();return;}
   const below=top+height-rect.bottom-16;const above=rect.top-top-16;const up=below<200&&above>below;const maxHeight=Math.max(48,Math.min(320,up?above:below));
   const menuWidth=Math.min(rect.width,width-24);setPosition({position:'fixed',left:Math.max(left+12,Math.min(rect.left,left+width-menuWidth-12)),width:menuWidth,maxHeight,...(up?{bottom:window.innerHeight-rect.top+8}:{top:rect.bottom+8})});
  }
  function outside(event:PointerEvent){if(!trigger.current?.contains(event.target as Node)&&!menu.current?.contains(event.target as Node))close();}
  function focusOutside(event:FocusEvent){if(!trigger.current?.contains(event.target as Node)&&!menu.current?.contains(event.target as Node))close();}
  place();menu.current?.focus({preventScroll:true});
  window.addEventListener('resize',place);document.addEventListener('scroll',place,true);document.addEventListener('pointerdown',outside,true);document.addEventListener('focusin',focusOutside);
  window.visualViewport?.addEventListener('resize',place);window.visualViewport?.addEventListener('scroll',place);
  return()=>{window.removeEventListener('resize',place);document.removeEventListener('scroll',place,true);document.removeEventListener('pointerdown',outside,true);document.removeEventListener('focusin',focusOutside);window.visualViewport?.removeEventListener('resize',place);window.visualViewport?.removeEventListener('scroll',place);};
 },[opened]);
 useEffect(()=>{if(opened&&position)menu.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({block:'nearest'});},[opened,active,!!position]);
 function keys(event:KeyboardEvent){
  if(event.key==='Tab'){if(opened){trigger.current?.focus();close();}return;}
  if(event.key==='Escape'){event.preventDefault();close(true);return;}
  if(['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(event.key)){event.preventDefault();if(!opened){open();return;}
   if(event.key==='Enter'||event.key===' '){choose(active);return;}
   setActive(event.key==='Home'?nextOption(options,-1,1):event.key==='End'?nextOption(options,0,-1):nextOption(options,active,event.key==='ArrowDown'?1:-1));return;
  }
  if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();if(!opened)open();const now=Date.now();typed.current={value:now-typed.current.at>600?event.key:typed.current.value+event.key,at:now};setActive(current=>matchOption(options,typed.current.value,current));}
 }
 return <><button ref={trigger} id={id} type="button" className="custom-select" role="combobox" aria-label={label} aria-expanded={opened} aria-controls={opened?menuId:undefined} aria-haspopup="listbox" disabled={disabled} onClick={()=>opened?close():open()} onKeyDown={keys}><span>{options[selected]?.label??'Выбрать'}</span><Icon name="chevron"/></button>{opened&&createPortal(<div ref={menu} id={menuId} role="listbox" aria-label={label} aria-activedescendant={active>=0?`${menuId}-${active}`:undefined} tabIndex={-1} className="custom-select-menu" style={position??{position:'fixed',visibility:'hidden'}} onKeyDown={keys}>{options.map((option,index)=><div key={option.value} id={`${menuId}-${index}`} data-index={index} role="option" aria-selected={option.value===value} aria-disabled={option.disabled||undefined} className={`custom-select-option${active===index?' is-active':''}`} onPointerMove={event=>{if(event.pointerType==='mouse'&&!option.disabled)setActive(index);}} onClick={()=>choose(index)}><span>{option.label}</span>{option.value===value&&<Icon name="check"/>}</div>)}{!options.length&&<p className="custom-select-empty">Нет вариантов</p>}</div>,document.body)}</>;
}
