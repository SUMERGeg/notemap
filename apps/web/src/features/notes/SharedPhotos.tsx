import { useMemo } from 'react';
import { photoSource,type SharedPhoto } from '../../local/shared-photos';
export function SharedPhotos({photos}:{photos?:SharedPhoto[]}){
 const sources=useMemo(()=>{try{return (photos??[]).slice(0,10).map(photoSource);}catch{return [];}},[photos]);
 if(!sources.length)return null;
 return <div className="shared-photos" aria-label="Фотографии из коллекции">{sources.map((source,index)=><img key={index} src={source} loading="lazy" alt={`Фото места ${index+1}`}/>)}</div>;
}
