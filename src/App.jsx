import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ChannelGrid from './components/ChannelGrid';
import AddPlaylistModal from './components/AddPlaylistModal';
import SettingsModal from './components/SettingsModal';
import PlayerOverlay from './components/PlayerOverlay';
import Toast from './components/Toast';
import { iptv, isMobile } from './platform';

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
  const [menuOpen, setMenuOpen]       = useState(false); // tiroir latéral (petits écrans)
  const searchTimer                 = useRef(null);

  const notify = (message, type = 'info') =>
    setToast({ message, type, id: Date.now() });

  const loadPlaylists = async () => {
    const data = await iptv.getPlaylists();
    setPlaylists(data);
  };

  const loadGroups = async (playlistId) => {
    const data = await iptv.getGroups(playlistId);
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
    iptv.getChannels(filters)
      .then((data) => { if (!cancelled) { setChannels(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters]);

  // Listen for auto-refresh events from main process
  useEffect(() => {
    const off = iptv.onAutoRefreshed(() => {
      loadPlaylists();
      setFilters((f) => ({ ...f })); // trigger channel reload
      notify('Playlist mise à jour automatiquement', 'info');
    });
    return off;
  }, []);

  // Le retour ferme la couche visible la plus haute ; s'il n'y en a aucune,
  // renvoyer false laisse Android quitter l'application.
  useEffect(() => iptv.onBackButton(() => {
    if (playing)      { setPlaying(null);     return true; }
    if (showModal)    { setShowModal(false);  return true; }
    if (showSettings) { setShowSettings(false); return true; }
    if (menuOpen)     { setMenuOpen(false);   return true; }
    return false;
  }), [playing, showModal, showSettings, menuOpen]);

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
      const result = await iptv.addPlaylist({ name, url });
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
    await iptv.deletePlaylist(id);
    await loadPlaylists();
    if (filters.playlistId === id) handleShowAll();
    notify('Playlist supprimée', 'info');
  };

  const handleRefreshPlaylist = async (playlist) => {
    setLoading(true);
    try {
      const result = await iptv.refreshPlaylist({ id: playlist.id, url: playlist.url });
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
      const result = await iptv.openStream(channel.url);
      if (result?.mode === 'internal') setPlaying(channel);
      else if (result?.mode === 'browser') notify('Aucun lecteur trouvé — ouverture dans le navigateur', 'info');
    } catch (err) {
      notify('Impossible de lancer la lecture : ' + (err.message || ''), 'error');
    }
  };

  // Depuis le lecteur interne : basculer vers le lecteur externe.
  const handlePlayExternal = async (channel) => {
    setPlaying(null);
    await iptv.openStreamExternal(channel.url);
  };

  const handleToggleFavorite = async (channelId) => {
    const newVal = await iptv.toggleFavorite(channelId);
    setChannels((prev) => {
      if (filters.favoritesOnly && newVal === 0) return prev.filter((c) => c.id !== channelId);
      return prev.map((c) => (c.id === channelId ? { ...c, is_favorite: newVal } : c));
    });
  };

  // Sur mobile la sidebar recouvre la grille : toute navigation la referme.
  const closeMenuAfter = (fn) => (...args) => { setMenuOpen(false); return fn(...args); };

  const title = getTitle(filters, playlists);

  return (
    <div className={`app${isMobile ? ' is-mobile' : ''}${menuOpen ? ' menu-open' : ''}`}>
      <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} />

      <Sidebar
        playlists={playlists}
        groups={groups}
        filters={filters}
        onSelectPlaylist={closeMenuAfter(handleSelectPlaylist)}
        onSelectGroup={closeMenuAfter(handleSelectGroup)}
        onShowAll={closeMenuAfter(handleShowAll)}
        onShowFavorites={closeMenuAfter(handleShowFavorites)}
        onAddPlaylist={closeMenuAfter(() => setShowModal(true))}
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
          onToggleMenu={() => setMenuOpen((o) => !o)}
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
