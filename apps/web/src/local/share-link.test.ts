import { expect,it } from 'vitest';
import { shareTokenFromLink } from './share-link';
const base='https://sumergeg.github.io/notemap/';
const token='a'.repeat(43);
it('accepts a Notemap link including its cache-busting query',()=>{
  expect(shareTokenFromLink(`${base}?recover=test#share=${token}`,base)).toBe(token);
});
it('rejects external sites, wrong app paths and malformed tokens',()=>{
  for(const value of [`https://other.example/#share=${token}`,`https://sumergeg.github.io/other/#share=${token}`,'javascript:alert(1)',`${base}#share=short`])expect(()=>shareTokenFromLink(value,base)).toThrow();
});
