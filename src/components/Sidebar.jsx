import React, { useState } from 'react';

export default function Sidebar({
  playlists, groups, filters,
  onSelectPlaylist, onSelectGroup, onShowAll, onShowFavorites,
  onAddPlaylist, onDeletePlaylist, onRefreshPlaylist,
}) {
  const [confirmId, setConfirmId] = useState(null);

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (confirmId === id) {
      onDeletePlaylist(id);
      setConfirmId(null);
    } else {
      setConfirmId(id);
      setTimeout(() => setConfirmId(null), 2200);
    }
  };

  const handleRefresh = (e, playlist) => {
    e.stopPropagation();
    onRefreshPlaylist(playlist);
  };

  const isAllActive = !filters.favoritesOnly && !filters.groupTitle && filters.playlistId === null;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon">📺</span>
        <span className="brand-name">IPTV Manager</span>
      </div>

      <nav className="sidebar-nav">
        <button className={`nav-item ${isAllActive ? 'active' : ''}`} onClick={onShowAll}>
          <span className="nav-icon">🌐</span>
          Toutes les chaînes
        </button>
        <button className={`nav-item ${filters.favoritesOnly ? 'active' : ''}`} onClick={onShowFavorites}>
          <span className="nav-icon">⭐</span>
          Favoris
        </button>
      </nav>

      <div className="sidebar-section">
        <div className="section-header">
          <span>Playlists</span>
          <button className="btn-add" onClick={onAddPlaylist} title="Ajouter une playlist">+</button>
        </div>

        {playlists.length === 0 ? (
          <p className="sidebar-empty">Aucune playlist — cliquez sur +</p>
        ) : (
          <ul className="playlist-list">
            {playlists.map((pl) => (
              <li key={pl.id}>
                <div
                  className={`playlist-item ${filters.playlistId === pl.id ? 'active' : ''}`}
                  onClick={() => onSelectPlaylist(pl.id)}
                >
                  <span className="playlist-name" title={pl.name}>{pl.name}</span>
                  <span className="playlist-count">{pl.channel_count}</span>
                  <div className="playlist-actions">
                    <button
                      className="btn-icon"
                      title="Actualiser"
                      onClick={(e) => handleRefresh(e, pl)}
                    >↻</button>
                    <button
                      className={`btn-icon btn-delete ${confirmId === pl.id ? 'confirm' : ''}`}
                      title={confirmId === pl.id ? 'Confirmer ?' : 'Supprimer'}
                      onClick={(e) => handleDelete(e, pl.id)}
                    >×</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {groups.length > 0 && (
        <div className="sidebar-section">
          <div className="section-header">
            <span>Catégories</span>
          </div>
          <ul className="group-list">
            {groups.map((g) => (
              <li key={g}>
                <button
                  className={`group-item ${filters.groupTitle === g ? 'active' : ''}`}
                  onClick={() => onSelectGroup(g)}
                  title={g}
                >
                  {g}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
