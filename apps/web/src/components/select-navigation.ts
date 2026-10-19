export type SelectOption={value:string;label:string;disabled?:boolean};
export function nextOption(options:SelectOption[],current:number,direction:1|-1){
 for(let step=1;step<=options.length;step++){const index=((current+direction*step)%options.length+options.length)%options.length;if(!options[index].disabled)return index;}
 return -1;
}
export function matchOption(options:SelectOption[],query:string,current:number){
 for(let step=1;step<=options.length;step++){const index=(Math.max(current,-1)+step)%options.length;if(!options[index].disabled&&options[index].label.toLocaleLowerCase('ru').startsWith(query.toLocaleLowerCase('ru')))return index;}
 return current;
}
