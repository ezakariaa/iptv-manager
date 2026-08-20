/**
 * Implémentation Android de l'API `iptv`.
 *
 * Le contrat est exactement celui exposé par `preload.js` côté Electron, si
 * bien que les composants React ne font aucune distinction entre les deux
 * plateformes. Ce qui change ici :
 *   - le téléchargement M3U passe par CapacitorHttp (requête native, donc pas
 *     de blocage CORS depuis l'origine https://localhost de la WebView) ;
 *   - la base vit dans la WebView (sql.js + IndexedDB) ;
 *   - « lecteur externe » signifie déléguer l'URL à une autre application
 *     Android (VLC, MX Player…) par un intent.
 */

import { CapacitorHttp } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { parseM3U } from '../../utils/m3uParser';
import * as db from './mobileDb';

const SETTINGS_KEY  = 'iptv-settings';
const REFRESH_EVERY = 6 * 60 * 60 * 1000; // 6 h, comme la version desktop

// ─── Réglages ────────────────────────────────────────────────────────────────

function getStoredSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) ?? {}; } catch { return {}; }
}

function saveSettings(data) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
}

// ─── Téléchargement ──────────────────────────────────────────────────────────

async function fetchUrl(url) {
  let res;
  try {
    res = await CapacitorHttp.get({
      url,
      responseType: 'text',
      connectTimeout: 30000,
      readTimeout: 60000,
      headers: { 'User-Agent': 'IPTV-Manager/1.0' },
    });
  } catch (err) {
    throw new Error('Téléchargement impossible : ' + (err?.message || 'réseau injoignable'));
  }
  if (res.status < 200 || res.status >= 300) throw new Error(`Erreur HTTP ${res.status}`);
  if (typeof res.data !== 'string') throw new Error('Réponse illisible');
  return res.data;
}

async function refreshPlaylist(id, url) {
  const channels = parseM3U(await fetchUrl(url));
  db.insertChannels(id, channels);
  db.updatePlaylist(id, channels.length, Date.now());
  return channels.length;
}

// ─── Rafraîchissement automatique ────────────────────────────────────────────

const refreshListeners = new Set();

function startAutoRefresh() {
  setInterval(async () => {
    for (const pl of db.getPlaylists()) {
      try {
        const count = await refreshPlaylist(pl.id, pl.url);
        refreshListeners.forEach((cb) => cb({ id: pl.id, channelCount: count }));
      } catch (err) {
        console.error(`Auto-refresh échoué pour "${pl.name}" :`, err.message);
      }
    }
  }, REFRESH_EVERY);
}

// ─── Lecture ─────────────────────────────────────────────────────────────────

async function openExternal(url) {
  try {
    await AppLauncher.openUrl({ url });
    return { mode: 'external' };
  } catch {
    window.open(url, '_system');
    return { mode: 'browser' };
  }
}

function openStream(url, forceExternal = false) {
  const settings = getStoredSettings();
  if (!forceExternal && settings.playerMode !== 'external') return Promise.resolve({ mode: 'internal' });
  return openExternal(url);
}

// ─── API exposée ─────────────────────────────────────────────────────────────

export async function createMobileApi() {
  await db.init();
  startAutoRefresh();

  return {
    getPlaylists:   async () => db.getPlaylists(),
    getChannels:    async (filters) => db.getChannels(filters),
    getGroups:      async (playlistId) => db.getGroups(playlistId),
    toggleFavorite: async (id) => db.toggleFavorite(id),
    deletePlaylist: async (id) => { db.deletePlaylist(id); return true; },

    addPlaylist: async ({ name, url }) => {
      const id = db.addPlaylist(name, url);
      if (!id) throw new Error('Cette URL de playlist existe déjà.');
      try {
        return { id, channelCount: await refreshPlaylist(id, url) };
      } catch (err) {
        db.deletePlaylist(id); // ne pas garder une playlist vide si l'import échoue
        throw err;
      }
    },

    refreshPlaylist: async ({ id, url }) => ({ channelCount: await refreshPlaylist(id, url) }),

    openStream:         (url) => openStream(url),
    openStreamExternal: (url) => openStream(url, true),

    getSettings: async () => ({
      playerMode: 'internal',
      ...getStoredSettings(),
      detectedPlayers: [],   // pas de détection de binaire possible sur Android
    }),

    setPlayerMode: async (mode) => {
      saveSettings({ ...getStoredSettings(), playerMode: mode === 'external' ? 'external' : 'internal' });
      return true;
    },

    // Sans équivalent sur Android : c'est le sélecteur d'applications du
    // système qui choisit le lecteur au moment de l'ouverture du flux.
    setPlayerPath: async () => true,
    browsePlayer:  async () => null,

    onAutoRefreshed: (cb) => {
      refreshListeners.add(cb);
      return () => refreshListeners.delete(cb);
    },
  };
}
