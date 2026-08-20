import React, { useState } from 'react';

export default function Header({ title, channelCount, loading, onSearch, onOpenSettings, onToggleMenu }) {
  const [query, setQuery] = useState('');

  const handleChange = (e) => {
    setQuery(e.target.value);
    onSearch(e.target.value);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <header className="header">
      <div className="header-left">
        <button className="btn-menu" onClick={onToggleMenu} aria-label="Ouvrir le menu">☰</button>
        <h1 className="page-title">{title}</h1>
        {loading ? (
          <span className="loading-pill">Chargement…</span>
        ) : (
          <span className="channel-count">
            {channelCount} chaîne{channelCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="header-right">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            type="text"
            placeholder="Rechercher une chaîne…"
            value={query}
            onChange={handleChange}
          />
          {query && (
            <button className="search-clear" onClick={handleClear} title="Effacer">×</button>
          )}
        </div>

        <button
          className="btn-settings"
          onClick={onOpenSettings}
          title="Paramètres lecteur"
        >
          ⚙
        </button>
      </div>
    </header>
  );
}
