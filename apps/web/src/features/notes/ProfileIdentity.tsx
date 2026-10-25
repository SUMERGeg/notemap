import { useEffect, useState } from 'react';
import { readState, type LocalState } from '../../local/db';
import { initials, profileColors, saveProfile, type ProfileColor } from '../../local/profile';
import { Icon } from '../../components/Icon';

const colorNames=['Синий','Фиолетовый','Зелёный','Розовый','Янтарный','Графитовый'];
export function AuthorBadge({name}:{name:string}){
  return <div className="author-badge"><span aria-hidden="true">{initials(name)}</span><div><small>Поделился</small><strong>{name}</strong></div></div>;
}
export function ProfileIdentity(){
  const [profile,setProfile]=useState<LocalState['profile']>();
  const [counts,setCounts]=useState([0,0,0]);const [editing,setEditing]=useState(false);
  const [name,setName]=useState('');const [color,setColor]=useState<ProfileColor>('blue');
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [saved,setSaved]=useState(false);
  useEffect(()=>{let alive=true;void readState().then(state=>{if(!alive)return;setProfile(state.profile);setName(state.profile.nickname??'');setColor(profileColors.find(c=>c===state.profile.avatar_color)??'blue');setCounts([state.notes.length,state.collections.length,state.imports.length]);}).catch(()=>{if(alive)setError('Не удалось открыть профиль. Вернись сюда ещё раз.');});return()=>{alive=false;};},[]);
  async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);setError('');try{const result=await saveProfile(name,color);setProfile(result);setName(result.nickname??'');setEditing(false);setSaved(true);}catch(failure){setError(failure instanceof Error?failure.message:'Не удалось сохранить профиль.');}finally{setBusy(false);}}
  function cancel(){setName(profile?.nickname??'');setColor(profileColors.find(c=>c===profile?.avatar_color)??'blue');setEditing(false);setError('');}
  return <div className="profile-overview"><div className="profile-identity">
    <span className="profile-avatar" data-color={editing?color:profile?.avatar_color??'blue'} aria-hidden="true">{initials(editing?name:profile?.nickname??'')}</span>
    <h2>{profile?.nickname??'Твой профиль'}</h2><p>Твоя карта. Твои открытия.</p>
    {!editing&&<button className="profile-edit-button" disabled={!profile} onClick={()=>{setSaved(false);setEditing(true);}}><Icon name="edit"/>{profile?.nickname?'Редактировать':'Добавить никнейм'}</button>}
  </div>
  {editing&&<form className="profile-editor" onSubmit={event=>void submit(event)}>
    <label htmlFor="profile-nickname">Никнейм</label><input id="profile-nickname" autoFocus autoComplete="nickname" value={name} maxLength={40} required disabled={busy} placeholder="Как тебя называть?" onChange={event=>setName(event.target.value)}/>
    <p>Так тебя увидят в подборках по ссылке.</p>
    <fieldset disabled={busy}><legend>Цвет аватара</legend><div className="profile-colors">{profileColors.map((value,index)=><button key={value} type="button" data-color={value} aria-label={colorNames[index]} aria-pressed={color===value} onClick={()=>setColor(value)}>{color===value&&<Icon name="check"/>}</button>)}</div></fieldset>
    <div className="profile-editor-actions"><button type="button" className="secondary" disabled={busy} onClick={cancel}>Отмена</button><button disabled={busy||!name.trim()}>{busy?'Сохраняем…':'Сохранить'}</button></div>
  </form>}
  {error&&<p className="notice error" role="alert">{error}</p>}{saved&&<p className="profile-saved" role="status">Профиль сохранён</p>}
  <div className="profile-counts" aria-label="Моя карта">{['Мест','Коллекций','Получено'].map((label,index)=><div key={label}><strong>{counts[index]}</strong><span>{label}</span></div>)}</div>
  <p className="profile-local-caption"><Icon name="lock"/>Профиль хранится на этом устройстве</p>
  </div>;
}
