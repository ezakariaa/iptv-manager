const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { spawn } = require('child_process');
const fs = require('fs');

app.disableHardwareAcceleration();

let mainWindow;
let db;

// ─── Settings ────────────────────────────────────────────────────────────────

let settingsPath;
function getSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch { return {}; }
}
function saveSettings(data) {
  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));
}

// ─── Media player detection ───────────────────────────────────────────────────

const PLAYER_PRESETS = [
  {
    name: 'VLC',
    paths: [
      'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
      'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe',
    ],
  },
  {
    name: 'MPC-HC',
    paths: [
      'C:\\Program Files\\MPC-HC\\mpc-hc64.exe',
      'C:\\Program Files (x86)\\MPC-HC\\mpc-hc.exe',
    ],
  },
  {
    name: 'MPC-BE',
    paths: [
      'C:\\Program Files\\MPC-BE x64\\mpc-be64.exe',
      'C:\\Program Files (x86)\\MPC-BE\\mpc-be.exe',
    ],
  },
  {
    name: 'PotPlayer',
    paths: [
      'C:\\Program Files\\DAUM\\PotPlayer\\PotPlayerMini64.exe',
      'C:\\Program Files (x86)\\DAUM\\PotPlayer\\PotPlayerMini.exe',
      'C:\\Program Files\\PotPlayer\\PotPlayerMini64.exe',
    ],
  },
  {
    name: 'Windows Media Player',
    paths: [
      'C:\\Program Files\\Windows Media Player\\wmplayer.exe',
      'C:\\Program Files (x86)\\Windows Media Player\\wmplayer.exe',
    ],
  },
];

function detectPlayers() {
  return PLAYER_PRESETS.map((preset) => {
    const found = preset.paths.find((p) => fs.existsSync(p));
    return found ? { name: preset.name, path: found } : null;
  }).filter(Boolean);
}

// Renvoie { mode } au renderer : 'internal' => la lecture se fait dans l'app.
function openStream(url, forceExternal = false) {
  const settings = getSettings();

  if (!forceExternal && settings.playerMode === 'internal') {
    return { mode: 'internal' };
  }

  const playerPath = settings.playerPath;

  if (playerPath && fs.existsSync(playerPath)) {
    spawn(playerPath, [url], { detached: true, stdio: 'ignore' }).unref();
    return { mode: 'external', player: playerPath };
  }

  // Auto-detect first available player
  const players = detectPlayers();
  if (players.length > 0) {
    spawn(players[0].path, [url], { detached: true, stdio: 'ignore' }).unref();
    return { mode: 'external', player: players[0].path };
  }

  // Fallback: open in default browser
  shell.openExternal(url);
  return { mode: 'browser' };
}

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    backgroundColor: '#0d0d1a',
    title: 'IPTV Manager',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── M3U fetch ────────────────────────────────────────────────────────────────

function fetchUrl(urlString, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error('Trop de redirections'));
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(urlString); } catch { return reject(new Error('URL invalide')); }

    const isHttps = parsed.protocol === 'https:';
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      timeout: 30000,
      headers: { 'User-Agent': 'IPTV-Manager/1.0' },
    };

    const req = (isHttps ? https : http).get(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return resolve(fetchUrl(res.headers.location, redirectCount + 1));
      if (res.statusCode !== 200)
        return reject(new Error(`Erreur HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Délai dépassé')); });
    req.on('error', reject);
  });
}

async function refreshPlaylist(id, url) {
  const { parseM3U } = require('./utils/m3uParser');
  const content = await fetchUrl(url);
  const channels = parseM3U(content);
  db.insertChannels(id, channels);
  db.updatePlaylist(id, channels.length);
  return channels.length;
}

// ─── App ready ────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  db = require('./db/database');
  await db.init();
  settingsPath = path.join(app.getPath('userData'), 'settings.json');

  createWindow();

  // Playlist handlers
  ipcMain.handle('get-playlists', () => db.getPlaylists());

  ipcMain.handle('add-playlist', async (_, { name, url }) => {
    const id = db.addPlaylist(name, url);
    if (!id) throw new Error('Cette URL de playlist existe déjà.');
    try {
      const count = await refreshPlaylist(id, url);
      return { id, channelCount: count };
    } catch (err) {
      db.deletePlaylist(id);
      throw err;
    }
  });

  ipcMain.handle('delete-playlist', (_, id) => { db.deletePlaylist(id); return true; });

  ipcMain.handle('rename-playlist', (_, { id, name }) => {
    const clean = db.renamePlaylist(id, name);
    if (!clean) throw new Error('Le nom ne peut pas être vide.');
    return clean;
  });
  ipcMain.handle('get-channels',    (_, filters) => db.getChannels(filters));
  ipcMain.handle('toggle-favorite', (_, id) => db.toggleFavorite(id));
  ipcMain.handle('get-groups',      (_, playlistId) => db.getGroups(playlistId));

  ipcMain.handle('refresh-playlist', async (_, { id, url }) => ({
    channelCount: await refreshPlaylist(id, url),
  }));

  // Stream opening
  ipcMain.handle('open-stream', (_, url) => openStream(url));
  ipcMain.handle('open-stream-external', (_, url) => openStream(url, true));

  // Settings handlers
  ipcMain.handle('get-settings', () => ({
    ...getSettings(),
    detectedPlayers: detectPlayers(),
  }));

  ipcMain.handle('set-player-path', (_, playerPath) => {
    const s = getSettings();
    s.playerPath = playerPath || null;
    s.playerMode = 'external';
    saveSettings(s);
    return true;
  });

  ipcMain.handle('set-player-mode', (_, mode) => {
    const s = getSettings();
    s.playerMode = mode === 'internal' ? 'internal' : 'external';
    saveSettings(s);
    return true;
  });

  ipcMain.handle('browse-player', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Sélectionner le lecteur vidéo',
      filters: [{ name: 'Exécutables', extensions: ['exe'] }],
      properties: ['openFile'],
    });
    if (!result.canceled && result.filePaths[0]) {
      const s = getSettings();
      s.playerPath = result.filePaths[0];
      s.playerMode = 'external';
      saveSettings(s);
      return result.filePaths[0];
    }
    return null;
  });

  // Auto-refresh toutes les 6 heures
  setInterval(async () => {
    for (const pl of db.getPlaylists()) {
      try {
        const count = await refreshPlaylist(pl.id, pl.url);
        mainWindow?.webContents.send('auto-refreshed', { id: pl.id, channelCount: count });
      } catch (err) {
        console.error(`Auto-refresh échoué pour "${pl.name}":`, err.message);
      }
    }
  }, 6 * 60 * 60 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
