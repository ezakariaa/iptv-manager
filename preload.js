const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('iptv', {
  getPlaylists:    () => ipcRenderer.invoke('get-playlists'),
  addPlaylist:     (data) => ipcRenderer.invoke('add-playlist', data),
  deletePlaylist:  (id) => ipcRenderer.invoke('delete-playlist', id),
  renamePlaylist:  (data) => ipcRenderer.invoke('rename-playlist', data),
  getChannels:     (filters) => ipcRenderer.invoke('get-channels', filters),
  toggleFavorite:  (id) => ipcRenderer.invoke('toggle-favorite', id),
  getGroups:       (playlistId) => ipcRenderer.invoke('get-groups', playlistId),
  refreshPlaylist: (data) => ipcRenderer.invoke('refresh-playlist', data),
  openStream:         (url) => ipcRenderer.invoke('open-stream', url),
  openStreamExternal: (url) => ipcRenderer.invoke('open-stream-external', url),

  // Settings
  getSettings:    () => ipcRenderer.invoke('get-settings'),
  setPlayerPath:  (p) => ipcRenderer.invoke('set-player-path', p),
  setPlayerMode:  (m) => ipcRenderer.invoke('set-player-mode', m),
  browsePlayer:   () => ipcRenderer.invoke('browse-player'),

  onAutoRefreshed: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('auto-refreshed', handler);
    return () => ipcRenderer.removeListener('auto-refreshed', handler);
  },
});
