import { expect,it } from 'vitest';
import { nextOption,matchOption } from './select-navigation';
const options=[{value:'a',label:'Еда'},{value:'b',label:'Культура',disabled:true},{value:'c',label:'Природа'}];
it('moves through enabled options, wrapping at both ends',()=>{
 expect(nextOption(options,0,1)).toBe(2);expect(nextOption(options,2,1)).toBe(0);expect(nextOption(options,0,-1)).toBe(2);
});
it('finds options by typed text, ignoring disabled choices',()=>{
 expect(matchOption(options,'при',0)).toBe(2);expect(matchOption(options,'кул',0)).toBe(0);
 expect(nextOption(options.map(option=>({...option,disabled:true})),0,1)).toBe(-1);
});
