import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { markerIcon } from './Icon';

type Point = { category: string; place: { longitude: number; latitude: number; title: string } };
export function CollectionMap({ points }: { points: Point[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const key = import.meta.env.VITE_GEOAPIFY_API_KEY?.trim();
    if (!container.current || !key) { setError(true); return; }
    setError(false);
    const instance = new maplibregl.Map({ container: container.current, style: `https://maps.geoapify.com/v1/styles/osm-bright/style.json?apiKey=${encodeURIComponent(key)}`, center: points.length ? [points[0].place.longitude, points[0].place.latitude] : [37.6173,55.7558], zoom: 13, interactive: false, attributionControl: false });
    instance.addControl(new maplibregl.AttributionControl({ compact: false }));
    instance.on('error',()=>setError(true));
    instance.on('load',()=>{
      if (points.length) {
        const bounds = new maplibregl.LngLatBounds();
        const reference = points[0].place.longitude;
        points.forEach(point => {
          const lon = reference + ((point.place.longitude - reference + 540) % 360) - 180;
          bounds.extend([lon,point.place.latitude]);
          const element = document.createElement('span'); element.className = 'personal-marker'; element.dataset.category = point.category; element.innerHTML = markerIcon(point.category);
          new maplibregl.Marker({element,anchor:'bottom'}).setLngLat([lon,point.place.latitude]).addTo(instance);
        });
        instance.fitBounds(bounds,{padding:46,maxZoom:15,duration:0});
      }
    });
    const observer = new ResizeObserver(()=>instance.resize()); observer.observe(container.current);
    return()=>{observer.disconnect();instance.remove();};
  },[points]);
  return <div className="collection-map" role="img" aria-label={`Карта коллекции: ${points.length} мест`}><div ref={container}/>{error&&<p className="collection-map-error">Не удалось загрузить карту. Список мест доступен ниже.</p>}</div>;
}
