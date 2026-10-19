import type { IconName } from './Icon';
import { Icon } from './Icon';
export function ToggleRow({title,icon,checked,disabled=false,onChange}:{title:string;icon:IconName;checked:boolean;disabled?:boolean;onChange:(value:boolean)=>void}){
 return <label className="native-toggle-row"><span className="toggle-row-icon"><Icon name={icon}/></span><span className="toggle-row-title">{title}</span><input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={event=>onChange(event.target.checked)}/><span className="toggle-track" aria-hidden="true"/></label>;
}
