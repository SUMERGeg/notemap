import { useMemo, useState } from 'react';
import { PhotoViewer } from '../../components/PhotoViewer';
import { photoSource,type SharedPhoto } from '../../local/shared-photos';
export function SharedPhotos({photos}:{photos?:SharedPhoto[]}){
 const [viewing,setViewing]=useState<number|null>(null);
 const sources=useMemo(()=>{try{return (photos??[]).slice(0,10).map(photoSource);}catch{return [];}},[photos]);
 if(!sources.length)return null;
 return <><div className="shared-photos" aria-label="Фотографии из коллекции">{sources.map((source,index)=><button type="button" key={index} aria-label={`Открыть фото ${index+1}`} onClick={()=>setViewing(index)}><img src={source} loading="lazy" alt={`Фото места ${index+1}`}/></button>)}</div>{viewing!==null&&<PhotoViewer sources={sources} index={viewing} onIndex={setViewing} onClose={()=>setViewing(null)}/>}</>;
}
