/**
 * Base de données côté mobile.
 *
 * Reprend le schéma et les requêtes de `db/database.js` (version Electron),
 * mais tourne dans la WebView : sql.js compile SQLite en WebAssembly, et
 * l'image binaire de la base est persistée dans IndexedDB après chaque écriture.
 */

import initSqlJs from 'sql.js';
// Le binaire est intégré au bundle sous forme de data URI (voir la règle
// `asset/inline` de webpack.mobile.config.js) : sql.js va sinon le chercher
// par fetch(), requête que la WebView refuse de servir depuis https://localhost.
import wasmDataUri from 'sql.js/dist/sql-wasm.wasm';
import { idbGet, idbSet } from './idb';

const DB_KEY = 'sqlite-image';

/** Convertit le data URI du module WebAssembly en octets. */
function decodeWasm(dataUri) {
  const binary = atob(dataUri.slice(dataUri.indexOf(',') + 1));
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

let db = null;
let saveTimer = null;

export async function init() {
  if (db) return;

  const SQL = await initSqlJs({ wasmBinary: decodeWasm(wasmDataUri) });

  const stored = await idbGet(DB_KEY);
  db = stored ? new SQL.Database(new Uint8Array(stored)) : new SQL.Database();

  db.run(`PRAGMA foreign_keys = ON`);

  db.run(`
    CREATE TABLE IF NOT EXISTS playlists (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      url           TEXT NOT NULL UNIQUE,
      channel_count INTEGER DEFAULT 0,
      last_updated  INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS channels (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      name        TEXT NOT NULL,
      url         TEXT NOT NULL,
      logo        TEXT,
      group_title TEXT DEFAULT 'Général',
      tvg_id      TEXT,
      is_favorite INTEGER DEFAULT 0,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_ch_playlist ON channels(playlist_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ch_name     ON channels(name)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ch_group    ON channels(group_title)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ch_fav      ON channels(is_favorite)`);

  await save();
}

/**
 * Écrit l'image de la base dans IndexedDB. Regroupée sur 300 ms : basculer
 * plusieurs favoris d'affilée ne déclenche qu'un seul export.
 */
function save() {
  clearTimeout(saveTimer);
  return new Promise((resolve) => {
    saveTimer = setTimeout(async () => {
      try { await idbSet(DB_KEY, db.export()); } catch (err) { console.error('Sauvegarde échouée', err); }
      resolve();
    }, 300);
  });
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  return all(sql, params)[0] ?? null;
}

function run(sql, params = []) {
  db.run(sql, params);
}

// ─── API publique (identique à celle du processus principal Electron) ────────

export function getPlaylists() {
  return all('SELECT * FROM playlists ORDER BY name');
}

export function addPlaylist(name, url) {
  if (get('SELECT id FROM playlists WHERE url = ?', [url])) return null;
  run('INSERT INTO playlists (name, url) VALUES (?, ?)', [name, url]);
  const row = get('SELECT last_insert_rowid() AS id');
  save();
  return row?.id ?? null;
}

export function updatePlaylist(id, channelCount, now) {
  run('UPDATE playlists SET channel_count = ?, last_updated = ? WHERE id = ?', [channelCount, now, id]);
  save();
}

export function deletePlaylist(id) {
  run('DELETE FROM channels WHERE playlist_id = ?', [id]);
  run('DELETE FROM playlists WHERE id = ?', [id]);
  save();
}

/**
 * Insertion en masse : une seule transaction et une seule requête préparée,
 * sans quoi l'import d'une playlist de 10 000 chaînes fige la WebView.
 */
export function insertChannels(playlistId, channels) {
  run('DELETE FROM channels WHERE playlist_id = ?', [playlistId]);
  db.run('BEGIN TRANSACTION');
  const stmt = db.prepare(
    'INSERT INTO channels (playlist_id, name, url, logo, group_title, tvg_id) VALUES (?, ?, ?, ?, ?, ?)'
  );
  try {
    for (const ch of channels) {
      stmt.run([playlistId, ch.name, ch.url, ch.logo || null, ch.group || 'Général', ch.tvgId || null]);
    }
    db.run('COMMIT');
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  } finally {
    stmt.free();
  }
  save();
}

export function getChannels({ search = '', groupTitle = '', playlistId = null, favoritesOnly = false } = {}) {
  const conditions = [];
  const params = [];

  if (search.trim()) {
    conditions.push('LOWER(name) LIKE LOWER(?)');
    params.push(`%${search.trim()}%`);
  }
  if (groupTitle) {
    conditions.push('group_title = ?');
    params.push(groupTitle);
  }
  if (playlistId !== null) {
    conditions.push('playlist_id = ?');
    params.push(playlistId);
  }
  if (favoritesOnly) {
    conditions.push('is_favorite = 1');
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  return all(
    `SELECT * FROM channels ${where} ORDER BY is_favorite DESC, LOWER(name) LIMIT 2000`,
    params
  );
}

export function toggleFavorite(id) {
  run('UPDATE channels SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END WHERE id = ?', [id]);
  save();
  return get('SELECT is_favorite FROM channels WHERE id = ?', [id])?.is_favorite ?? 0;
}

export function getGroups(playlistId = null) {
  const rows = playlistId !== null
    ? all('SELECT DISTINCT group_title FROM channels WHERE playlist_id = ? AND group_title IS NOT NULL ORDER BY group_title', [playlistId])
    : all('SELECT DISTINCT group_title FROM channels WHERE group_title IS NOT NULL ORDER BY group_title');
  return rows.map((r) => r.group_title);
}
