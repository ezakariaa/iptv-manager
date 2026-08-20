const fs   = require('fs');
const path = require('path');
const { app } = require('electron');

let db;
let dbPath;

async function init() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
  });

  dbPath = path.join(app.getPath('userData'), 'iptv-manager.db');

  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }

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

  save();
}

function save() {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  return all(sql, params)[0] ?? null;
}

function run(sql, params = []) {
  db.run(sql, params);
}

// ─── Public API ───────────────────────────────────────────────────────────────

function getPlaylists() {
  return all('SELECT * FROM playlists ORDER BY name');
}

function addPlaylist(name, url) {
  if (get('SELECT id FROM playlists WHERE url = ?', [url])) return null;
  run('INSERT INTO playlists (name, url) VALUES (?, ?)', [name, url]);
  const row = get('SELECT last_insert_rowid() AS id');
  save();
  return row?.id ?? null;
}

function updatePlaylist(id, channelCount) {
  run('UPDATE playlists SET channel_count = ?, last_updated = ? WHERE id = ?', [channelCount, Date.now(), id]);
  save();
}

function deletePlaylist(id) {
  run('DELETE FROM channels WHERE playlist_id = ?', [id]);
  run('DELETE FROM playlists WHERE id = ?', [id]);
  save();
}

function insertChannels(playlistId, channels) {
  run('DELETE FROM channels WHERE playlist_id = ?', [playlistId]);
  for (const ch of channels) {
    run(
      'INSERT INTO channels (playlist_id, name, url, logo, group_title, tvg_id) VALUES (?, ?, ?, ?, ?, ?)',
      [playlistId, ch.name, ch.url, ch.logo || null, ch.group || 'Général', ch.tvgId || null]
    );
  }
  save();
}

function getChannels({ search = '', groupTitle = '', playlistId = null, favoritesOnly = false } = {}) {
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

function toggleFavorite(id) {
  run('UPDATE channels SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END WHERE id = ?', [id]);
  save();
  return get('SELECT is_favorite FROM channels WHERE id = ?', [id])?.is_favorite ?? 0;
}

function getGroups(playlistId = null) {
  const rows = playlistId !== null
    ? all('SELECT DISTINCT group_title FROM channels WHERE playlist_id = ? AND group_title IS NOT NULL ORDER BY group_title', [playlistId])
    : all('SELECT DISTINCT group_title FROM channels WHERE group_title IS NOT NULL ORDER BY group_title');
  return rows.map((r) => r.group_title);
}

module.exports = { init, getPlaylists, addPlaylist, updatePlaylist, deletePlaylist, insertChannels, getChannels, toggleFavorite, getGroups };
