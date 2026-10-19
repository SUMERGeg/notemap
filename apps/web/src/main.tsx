import { createRoot } from 'react-dom/client';
import './style.css';
import './target-interface.css';
import './experience.css';
import './spacing.css';
import './features/notes/sharing-native.css';
import './components/select.css';
import { MapScreen } from './features/map/MapScreen';
import { lazy, Suspense, useEffect, useState } from 'react';
import { SharePreviewPage } from './features/notes/SharePanel';
import { registerPwa } from './pwa';
registerPwa();
const MapComparison=lazy(()=>import('./features/map/MapComparison'));

function App() {
  useEffect(()=>{window.dispatchEvent(new Event('notemap-mounted'));},[]);
  const [hash,setHash]=useState(window.location.hash);
  useEffect(()=>{const update=()=>setHash(window.location.hash);window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update);},[]);
  if(hash==='#map-compare')return <Suspense fallback={<p role="status">Открываем сравнение карт…</p>}><MapComparison/></Suspense>;
  return hash.startsWith('#share=')?<SharePreviewPage token={hash.slice(7)}/>:<MapScreen/>;
}

createRoot(document.getElementById('root')!,{onUncaughtError:()=>window.dispatchEvent(new Event('notemap-startup-error'))}).render(
  <App />,
);
