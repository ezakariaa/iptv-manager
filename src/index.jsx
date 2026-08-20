import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initPlatform, setApi } from './platform';
import './styles/index.css';

const root = createRoot(document.getElementById('root'));

// L'implémentation mobile doit ouvrir sa base avant le premier rendu ; sur
// Electron, `initPlatform()` renvoie immédiatement l'API du preload.
initPlatform()
  .then((api) => {
    setApi(api);
    root.render(<App />);
  })
  .catch((err) => {
    console.error(err);
    root.render(
      <div className="fatal-error">
        <h1>Démarrage impossible</h1>
        <p>{err?.message || 'Erreur inconnue'}</p>
      </div>
    );
  });
