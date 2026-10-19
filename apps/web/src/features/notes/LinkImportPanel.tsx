import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { shareTokenFromLink } from '../../local/share-link';

export function LinkImportPanel(){
 const [opened,setOpened]=useState(false);const [value,setValue]=useState('');const [error,setError]=useState('');
 return <div className="link-import">{!opened?<button className="link-import-trigger" onClick={()=>setOpened(true)}><Icon name="plus"/>Открыть ссылку</button>:<form onSubmit={event=>{event.preventDefault();try{const base=new URL(import.meta.env.BASE_URL,window.location.origin).toString();window.location.hash=`share=${shareTokenFromLink(value,base)}`;}catch(failure){setError((failure as Error).message);}}}><label htmlFor="collection-link">Ссылка на коллекцию</label><input autoFocus id="collection-link" type="url" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="https://…#share=…" value={value} onChange={event=>{setValue(event.target.value);setError('');}} required/><div className="link-import-actions"><button type="button" className="secondary" onClick={()=>{setOpened(false);setValue('');setError('');}}>Отмена</button><button disabled={!value.trim()}>Открыть</button></div>{error&&<p role="alert" className="notice error">{error}</p>}</form>}</div>;
}
