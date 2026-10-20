import React, { useState, useRef, useEffect } from 'react';

export default function Sidebar({
  playlists, groups, filters,
  onSelectPlaylist, onSelectGroup, onShowAll, onShowFavorites,
  onAddPlaylist, onDeletePlaylist, onRefreshPlaylist, onRenamePlaylist,
}) {
  const [confirmId, setConfirmId] = useState(null);
  const [editId, setEditId]       = useState(null);
  const [draft, setDraft]         = useState('');
  const inputRef                  = useRef(null);

  useEffect(() => {
    if (editId !== null) inputRef.current?.select();
  }, [editId]);

  const startRename = (e, playlist) => {
    e.stopPropagation();
    setConfirmId(null);
    setEditId(playlist.id);
    setDraft(playlist.name);
  };

  const cancelRename = () => { setEditId(null); setDraft(''); };

  const commitRename = (playlist) => {
    const name = draft.trim();
    if (name && name !== playlist.name) onRenamePlaylist(playlist.id, name);
    cancelRename();
  };

  const handleRenameKey = (e, playlist) => {
    if (e.key === 'Enter')       { e.preventDefault(); commitRename(playlist); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
  };

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
                  className={`playlist-item ${filters.playlistId === pl.id ? 'active' : ''} ${editId === pl.id ? 'editing' : ''}`}
                  onClick={() => editId !== pl.id && onSelectPlaylist(pl.id)}
                  onDoubleClick={(e) => startRename(e, pl)}
                >
                  {editId === pl.id ? (
                    <input
                      ref={inputRef}
                      className="playlist-rename-input"
                      value={draft}
                      maxLength={80}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => handleRenameKey(e, pl)}
                      onBlur={() => commitRename(pl)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <>
                      <span className="playlist-name" title={`${pl.name} — double-clic pour renommer`}>
                        {pl.name}
                      </span>
                      <span className="playlist-count">{pl.channel_count}</span>
                      <div className="playlist-actions">
                        <button
                          className="btn-icon"
                          title="Renommer"
                          onClick={(e) => startRename(e, pl)}
                        >✎</button>
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
                    </>
                  )}
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
