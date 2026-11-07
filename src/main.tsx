import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register service worker for Progressive Web App capability with automated stale cache purging
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if ('caches' in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => {
        if (key !== 'tareza-erp-pwa-v6') {
          console.log('[PWA] Purging outdated cache:', key);
          caches.delete(key);
        }
      });
    });
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        reg.update();
        console.log('Tareza ERP PWA ServiceWorker successfully registered with scope: ', reg.scope);
      })
      .catch((err) => {
        console.error('Tareza ERP PWA ServiceWorker registration failed: ', err);
      });
  });
}
