const paths = {
  search:'M21 21l-4.5-4.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0',
  map:'M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3V3m6 3v15',
  list:'M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01',
  layers:'M12 3L2 8l10 5 10-5-10-5M2 12l10 5 10-5M2 16l10 5 10-5',
  user:'M20 21v-2a7 7 0 0 0-14 0v2M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  plus:'M12 5v14M5 12h14',close:'M6 6l12 12M18 6L6 18',
  arrow:'M5 12h14M13 6l6 6-6 6',chevron:'M9 5l7 7-7 7',
  sliders:'M4 7h7M15 7h5M4 17h3M11 17h9M11 4v6M7 14v6',
  location:'M21 3L3 10l7 4 4 7 7-18z',
  pin:'M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  food:'M5 3v6a3 3 0 0 0 6 0V3M8 3v18M19 3c-3 3-3 8 0 9V3v18',
  culture:'M3 21h18M5 18V9m5 9V9m4 9V9m5 9V9M3 7l9-4 9 4H3',
  nature:'M12 3l6 7h-3l5 7H4l5-7H6l6-7v18',
  heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8',
  lock:'M5 11h14v10H5V11m3 0V7a4 4 0 0 1 8 0v4M12 15v2',
  photo:'M3 3h18v18H3V3m0 13l5-5 8 10m-3-5l4-4 4 4M15 7h.01',
  edit:'M16 3l5 5-12 12-6 1 1-6L16 3M14 5l5 5',
  trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  star:'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3',
  check:'M5 12l4 4L19 6',
  bookmark:'M6 3h12v18l-6-4-6 4V3',
  calendar:'M4 5h16v16H4V5m0 5h16M8 3v4m8-4v4',
  share:'M12 15V3M8 7l4-4 4 4M7 10H4v11h16V10h-3',
  more:'M5 12h.01M12 12h.01M19 12h.01',
  info:'M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  coffee:'M4 7h13v10a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V7m13 1h2a3 3 0 1 1 0 6h-2M8 3v1m4-1v1',
  grid:'M3 3h6v6H3V3m12 0h6v6h-6V3M3 15h6v6H3v-6m12 0h6v6h-6v-6',
} as const;
export type IconName = keyof typeof paths;
export function Icon({name,className=''}:{name:IconName;className?:string}) {
  return <svg className={`icon ${className}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
export function markerIcon(category:string) {
  const name:IconName=category==='food'?'food':category==='culture'?'culture':category==='nature'?'nature':'heart';
  return `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
}
