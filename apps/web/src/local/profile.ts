import { mutateState, type LocalState } from './db';

export const profileColors = ['blue','purple','green','rose','amber','graphite'] as const;
export type ProfileColor = typeof profileColors[number];
export function nickname(value:string):string {
  const name=value.normalize('NFC').trim().replace(/ +/g,' ');
  if(!name||name.length>40||/[\u0000-\u001f\u007f-\u009f]/u.test(name))throw new Error('Укажи никнейм от 1 до 40 символов.');
  return name;
}
export function initials(name:string):string {
  return name.trim().split(/\s+/u).filter(Boolean).slice(0,2).map(part=>Array.from(part)[0]).join('').toLocaleUpperCase('ru-RU')||'N';
}
export async function saveProfile(name:string,color:ProfileColor):Promise<LocalState['profile']>{
  const clean=nickname(name);
  if(!profileColors.includes(color))throw new Error('Выбери цвет аватара.');
  return mutateState(state=>{state.profile={...state.profile,nickname:clean,avatar_color:color};return {...state.profile};});
}
