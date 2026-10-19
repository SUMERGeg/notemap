export function shareTokenFromLink(value:string,base:string):string {
  try {
    const url=new URL(value.trim());
    const allowed=[new URL(base),new URL('https://sumergeg.github.io/notemap/')];
    if(!['https:','http:'].includes(url.protocol)||!allowed.some(app=>url.origin===app.origin&&url.pathname.replace(/\/$/,'')===app.pathname.replace(/\/$/,'')))throw new Error();
    const match=/^#share=([A-Za-z0-9_-]{43})$/.exec(url.hash);
    if(!match)throw new Error();
    return match[1];
  }catch{throw new Error('Вставь ссылку на коллекцию Notemap.');}
}
