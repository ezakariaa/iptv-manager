import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ChannelGrid from './components/ChannelGrid';
import AddPlaylistModal from './components/AddPlaylistModal';
import SettingsModal from './components/SettingsModal';
import PlayerOverlay from './components/PlayerOverlay';
import Toast from './components/Toast';

export default function App() {
  const [playlists, setPlaylists]   = useState([]);
  const [channels, setChannels]     = useState([]);
  const [groups, setGroups]         = useState([]);
  const [filters, setFilters]       = useState({ search: '', groupTitle: '', playlistId: null, favoritesOnly: false });
  const [loading, setLoading]         = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast]             = useState(null);
  const [playing, setPlaying]         = useState(null); // chaîne lue par le lecteur interne
  const searchTimer                 = useRef(null);

  const notify = (message, type = 'info') =>
    setToast({ message, type, id: Date.now() });

  const loadPlaylists = async () => {
    const data = await window.iptv.getPlaylists();
    setPlaylists(data);
  };

  const loadGroups = async (playlistId) => {
    const data = await window.iptv.getGroups(playlistId);
    setGroups(data);
  };

  // Initial load
  useEffect(() => { loadPlaylists(); }, []);

  // Reload groups when playlist changes
  useEffect(() => { loadGroups(filters.playlistId); }, [filters.playlistId]);

  // Reload channels whenever filters change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    window.iptv.getChannels(filters)
      .then((data) => { if (!cancelled) { setChannels(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters]);

  // Listen for auto-refresh events from main process
  useEffect(() => {
    const off = window.iptv.onAutoRefreshed(() => {
      loadPlaylists();
      setFilters((f) => ({ ...f })); // trigger channel reload
      notify('Playlist mise à jour automatiquement', 'info');
    });
    return off;
  }, []);

  const handleSearch = (query) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(
      () => setFilters((f) => ({ ...f, search: query })),
      220
    );
  };

  const handleSelectPlaylist = (id) =>
    setFilters({ search: '', groupTitle: '', playlistId: id, favoritesOnly: false });

  const handleSelectGroup = (group) =>
    setFilters((f) => ({ ...f, groupTitle: group, favoritesOnly: false, search: '' }));

  const handleShowAll = () =>
    setFilters({ search: '', groupTitle: '', playlistId: null, favoritesOnly: false });

  const handleShowFavorites = () =>
    setFilters((f) => ({ ...f, favoritesOnly: true, groupTitle: '', search: '' }));

  const handleAddPlaylist = async ({ name, url }) => {
    setLoading(true);
    try {
      const result = await window.iptv.addPlaylist({ name, url });
      await loadPlaylists();
      setFilters({ search: '', groupTitle: '', playlistId: result.id, favoritesOnly: false });
      setShowModal(false);
      notify(`${result.channelCount} chaînes importées avec succès`, 'success');
    } catch (err) {
      notify(err.message || 'Erreur lors de l\'ajout', 'error');
      setLoading(false);
    }
  };

  const handleDeletePlaylist = async (id) => {
    await window.iptv.deletePlaylist(id);
    await loadPlaylists();
    if (filters.playlistId === id) handleShowAll();
    notify('Playlist supprimée', 'info');
  };

  const handleRefreshPlaylist = async (playlist) => {
    setLoading(true);
    try {
      const result = await window.iptv.refreshPlaylist({ id: playlist.id, url: playlist.url });
      await loadPlaylists();
      setFilters((f) => ({ ...f }));
      notify(`Playlist mise à jour : ${result.channelCount} chaînes`, 'success');
    } catch (err) {
      notify('Erreur de mise à jour : ' + (err.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Le process principal décide : lecteur interne (overlay) ou lecteur externe.
  const handleOpenStream = async (channel) => {
    try {
      const result = await window.iptv.openStream(channel.url);
      if (result?.mode === 'internal') setPlaying(channel);
      else if (result?.mode === 'browser') notify('Aucun lecteur trouvé — ouverture dans le navigateur', 'info');
    } catch (err) {
      notify('Impossible de lancer la lecture : ' + (err.message || ''), 'error');
    }
  };

  // Depuis le lecteur interne : basculer vers le lecteur externe.
  const handlePlayExternal = async (channel) => {
    setPlaying(null);
    await window.iptv.openStreamExternal(channel.url);
  };

  const handleToggleFavorite = async (channelId) => {
    const newVal = await window.iptv.toggleFavorite(channelId);
    setChannels((prev) => {
      if (filters.favoritesOnly && newVal === 0) return prev.filter((c) => c.id !== channelId);
      return prev.map((c) => (c.id === channelId ? { ...c, is_favorite: newVal } : c));
    });
  };

  const title = getTitle(filters, playlists);

  return (
    <div className="app">
      <Sidebar
        playlists={playlists}
        groups={groups}
        filters={filters}
        onSelectPlaylist={handleSelectPlaylist}
        onSelectGroup={handleSelectGroup}
        onShowAll={handleShowAll}
        onShowFavorites={handleShowFavorites}
        onAddPlaylist={() => setShowModal(true)}
        onDeletePlaylist={handleDeletePlaylist}
        onRefreshPlaylist={handleRefreshPlaylist}
      />

      <div className="main">
        <Header
          title={title}
          channelCount={channels.length}
          loading={loading}
          onSearch={handleSearch}
          onOpenSettings={() => setShowSettings(true)}
        />
        <ChannelGrid
          channels={channels}
          loading={loading}
          onToggleFavorite={handleToggleFavorite}
          onOpenStream={handleOpenStream}
        />
      </div>

      {playing && (
        <PlayerOverlay
          channel={playing}
          onClose={() => setPlaying(null)}
          onPlayExternal={handlePlayExternal}
        />
      )}

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      {showModal && (
        <AddPlaylistModal
          loading={loading}
          onAdd={handleAddPlaylist}
          onClose={() => setShowModal(false)}
        />
      )}

      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  );
}

function getTitle(filters, playlists) {
  if (filters.favoritesOnly) return 'Favoris';
  if (filters.groupTitle) return filters.groupTitle;
  if (filters.playlistId !== null) {
    const pl = playlists.find((p) => p.id === filters.playlistId);
    return pl?.name ?? 'Chaînes';
  }
  return 'Toutes les chaînes';
}
