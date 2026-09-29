import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if ('caches' in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          if (key !== 'pulse-epg-shell-v5') {
            void caches.delete(key);
          }
        }
      });
    }
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        void registration.update();
      })
      .catch((err) => {
        console.warn('Échec de l’enregistrement du Service Worker PulseEPG:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
