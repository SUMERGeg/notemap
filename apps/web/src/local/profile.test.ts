import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./db',()=>({mutateState:vi.fn()}));
import { mutateState, type LocalState } from './db';
import { initials,nickname,saveProfile } from './profile';

describe('локальный профиль',()=>{
  beforeEach(()=>vi.clearAllMocks());
  it('нормализует никнейм и отклоняет пустые, длинные и управляющие символы',()=>{
    expect(nickname('  Егор   Данилов ')).toBe('Егор Данилов');
    for(const value of ['', '   ', 'a'.repeat(41), 'Егор\nАдмин'])expect(()=>nickname(value)).toThrow();
    expect(initials('Егор Данилов')).toBe('ЕД');expect(initials('alice')).toBe('A');expect(initials('')).toBe('N');
  });
  it('сохраняет имя и цвет без изменения идентичности, записей и старого авторства',async()=>{
    const state={profile:{id:'same-id',email:'local'},notes:[{text:'личное'}],imports:[{author_name:'Друг'}],snapshots:[{author_name:'Старое имя'}]} as unknown as LocalState;
    vi.mocked(mutateState).mockImplementation(async work=>work(state));
    expect(await saveProfile('  Новый ник  ','purple')).toEqual({id:'same-id',email:'local',nickname:'Новый ник',avatar_color:'purple'});
    expect(state.notes).toEqual([{text:'личное'}]);expect(state.imports[0].author_name).toBe('Друг');expect(state.snapshots[0].author_name).toBe('Старое имя');
  });
  it('не записывает некорректные данные',async()=>{
    await expect(saveProfile('','blue')).rejects.toThrow();await expect(saveProfile('Имя','unknown' as any)).rejects.toThrow();expect(mutateState).not.toHaveBeenCalled();
  });
});
