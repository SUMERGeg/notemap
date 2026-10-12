import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { mapTilePosition, starsForRating } from './map-preview';
import { listPhotos } from '../local/db';
import { getDirectPhoto } from '../local/photos';
import { getMapRenderPreferences, rasterTileUrl, MAP_STYLE } from '../features/map/startup';

export const categoryData = [
  { id: 'food', title: 'Еда', fullTitle: 'Еда и напитки', icon: 'food' },
  { id: 'culture', title: 'Культура', fullTitle: 'Культура', icon: 'culture' },
  { id: 'nature', title: 'Природа', fullTitle: 'Природа', icon: 'nature' },
  { id: 'other', title: 'Другое', fullTitle: 'Другое', icon: 'heart' },
] as const;
export function categoryIcon(category: string): IconName { return categoryData.find(row => row.id === category)?.icon ?? 'pin'; }
export function categoryTitle(category: string) { return categoryData.find(row => row.id === category)?.fullTitle ?? 'Место'; }
const placePlurals = new Intl.PluralRules('ru');
export function placesCount(count: number) {
  const forms: Record<string,string> = {one:'место',few:'места',many:'мест',other:'мест'};
  return `${count} ${forms[placePlurals.select(count)] ?? 'мест'}`;
}

export function Stars({ rating, onChange }: { rating: number | null; onChange?: (value: number) => void }) {
  return <div className={`stars${onChange ? ' editable-stars' : ''}`} role={onChange ? 'group' : 'img'} aria-label={onChange ? 'Выбрать оценку' : rating == null ? 'Без оценки' : `Оценка ${rating} из 10`}>
    {starsForRating(rating).map((fill, index) => {
      const content = <span className="star-shape"><Icon name="star"/><span className="star-fill" style={{ width: `${fill * 100}%` }}><Icon name="star"/></span></span>;
      return onChange ? <button key={index} type="button" aria-label={`Оценка ${(index + 1) * 2} из 10`} onClick={() => onChange((index + 1) * 2)}>{content}</button> : <span key={index}>{content}</span>;
    })}
  </div>;
}

// Thumbnails request only public raster tiles. Coordinates are positioned in the browser.
export function MiniMap({ longitude, latitude, category = 'other', className = '' }: { longitude: number; latitude: number; category?: string; className?: string }) {
  const key = import.meta.env.VITE_GEOAPIFY_API_KEY?.trim();
  const [failed, setFailed] = useState(false);
  const tile = mapTilePosition(longitude, latitude);
  const count = 2 ** tile.zoom;
  const rendering=getMapRenderPreferences();
  return <span className={`mini-map ${className}`} aria-hidden="true">
    {key && !failed && [-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => {
      const y = tile.y + dy;
      if (y < 0 || y >= count || dx * 256 - tile.offsetX > 64 || dx * 256 - tile.offsetX + 256 < -64 || dy * 256 - tile.offsetY > 64 || dy * 256 - tile.offsetY + 256 < -64) return null;
      return <img key={`${dx}:${dy}`} src={rasterTileUrl(key,MAP_STYLE,`${tile.zoom}/${(tile.x + dx + count) % count}/${y}`,rendering)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} style={{ left: `calc(50% + ${dx * 256 - tile.offsetX}px)`, top: `calc(50% + ${dy * 256 - tile.offsetY}px)` }}/>
    }))}
    <span className={`mini-map-pin ${category}`}><Icon name="pin"/></span>
  </span>;
}

export function MapCredit() {
  return <small className="map-credit"><a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a></small>;
}

export function PlaceCover({ noteId, category = 'other', className = '', refresh = 0, imageUrl }: { noteId?: string; category?: string; className?: string; refresh?: number; imageUrl?: string }) {
  const element = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState('');
  useEffect(() => {
    const observer = new IntersectionObserver(entries => { if (entries.some(row => row.isIntersecting)) { setVisible(true); observer.disconnect(); } });
    if (element.current) observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setUrl('');
    if (!noteId || !visible || imageUrl) return;
    let alive = true;
    let release: (() => void) | undefined;
    listPhotos(noteId).then(async rows => {
      if (!alive || !rows.length) return;
      const photo = await getDirectPhoto(rows[0].id);
      if (alive) { release = photo.release; setUrl(photo.url); }
      else photo.release();
    }).catch(() => {});
    return () => { alive = false; release?.(); };
  }, [noteId, visible, refresh, imageUrl]);
  return <span ref={element} className={`place-cover ${category} ${className}`}>
    {imageUrl || url ? <img src={imageUrl || url} alt="" referrerPolicy="no-referrer" onError={() => setUrl('')}/> : <><span className="cover-orbit"/><Icon name={categoryIcon(category)}/></>}
  </span>;
}

export function CategoryChips({ selected, onChange }: { selected: string[]; onChange: (id: string | null) => void }) {
  return <div className="category-chips" role="group" aria-label="Категории мест">
    <button type="button" aria-pressed={!selected.length} onClick={() => onChange(null)}>Все</button>
    {categoryData.map(row => <button type="button" key={row.id} aria-pressed={selected.includes(row.id)} onClick={() => onChange(row.id)}><Icon name={row.icon}/>{row.title}</button>)}
  </div>;
}
