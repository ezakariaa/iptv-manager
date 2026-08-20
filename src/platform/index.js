/**
 * Point d'entrée plateforme.
 *
 * Sur Electron, `preload.js` a déjà posé `window.iptv` : on l'utilise tel quel.
 * Sinon (WebView Android, ou navigateur en développement), on construit
 * l'implémentation mobile, qui expose le même contrat.
 */

export const isMobile = typeof window !== 'undefined' && !window.iptv;

let ready = null;

export function initPlatform() {
  if (ready) return ready;
  ready = window.iptv
    ? Promise.resolve(window.iptv)
    : import('./mobileApi').then((m) => m.createMobileApi());
  return ready;
}

/**
 * Accès synchrone à l'API, une fois `initPlatform()` résolu — ce que garantit
 * `src/index.jsx`, qui n'effectue le rendu de l'application qu'après.
 */
export let iptv = null;

export function setApi(api) {
  iptv = api;
}
