import { createRoot } from 'react-dom/client';
import './style.css';
import './target-interface.css';
import { MapScreen } from './features/map/MapScreen';
import { useEffect, useState } from 'react';
import { SharePreviewPage } from './features/notes/SharePanel';
import { registerPwa } from './pwa';
registerPwa();

function App() {
  const [hash,setHash]=useState(window.location.hash);
  useEffect(()=>{const update=()=>setHash(window.location.hash);window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update);},[]);
  return hash.startsWith('#share=')?<SharePreviewPage token={hash.slice(7)}/>:<MapScreen/>;
}

createRoot(document.getElementById('root')!).render(
  <App />,
);
