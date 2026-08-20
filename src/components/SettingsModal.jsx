import React, { useState, useEffect } from 'react';

export default function SettingsModal({ onClose }) {
  const [settings, setSettings]     = useState(null);
  const [browsing, setBrowsing]     = useState(false);
  const [saved, setSaved]           = useState(false);

  useEffect(() => {
    window.iptv.getSettings().then(setSettings);
  }, []);

  const handleSelectPreset = async (playerPath) => {
    await window.iptv.setPlayerPath(playerPath);
    setSettings((s) => ({ ...s, playerPath, playerMode: 'external' }));
    flash();
  };

  const handleClear = async () => {
    await window.iptv.setPlayerPath(null);
    setSettings((s) => ({ ...s, playerPath: null, playerMode: 'external' }));
    flash();
  };

  const handleSelectMode = async (mode) => {
    await window.iptv.setPlayerMode(mode);
    setSettings((s) => ({ ...s, playerMode: mode }));
    flash();
  };

  const handleBrowse = async () => {
    setBrowsing(true);
    try {
      const chosen = await window.iptv.browsePlayer();
      if (chosen) {
        setSettings((s) => ({ ...s, playerPath: chosen, playerMode: 'external' }));
        flash();
      }
    } finally {
      setBrowsing(false);
    }
  };

  const flash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const internal     = settings?.playerMode === 'internal';
  const activePlayer = internal ? null : settings?.playerPath;
  const detected     = settings?.detectedPlayers ?? [];
  const autoPlayer   = !activePlayer && detected.length > 0 ? detected[0] : null;

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal settings-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>⚙ Paramètres — Lecteur vidéo</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Lecteur actuel */}
          <div className="settings-current">
            <p className="settings-label">Lecteur sélectionné</p>
            {internal ? (
              <div className="player-auto">
                📺 <strong>Lecteur interne</strong> — lecture dans l'application
              </div>
            ) : activePlayer ? (
              <div className="player-active">
                <span className="player-path" title={activePlayer}>
                  {shortPath(activePlayer)}
                </span>
                <button className="btn-icon btn-delete" onClick={handleClear} title="Réinitialiser">×</button>
              </div>
            ) : (
              <div className="player-auto">
                {autoPlayer
                  ? <>⚡ Détection automatique : <strong>{autoPlayer.name}</strong></>
                  : '⚠ Aucun lecteur trouvé — le navigateur sera utilisé'}
              </div>
            )}
          </div>

          {/* Mode de lecture */}
          <div className="settings-section">
            <p className="settings-label">Mode de lecture</p>
            <div className="player-list">
              <button
                className={`player-btn mode-btn ${internal ? 'selected' : ''}`}
                onClick={() => handleSelectMode('internal')}
              >
                <span className="player-icon">📺</span>
                <span className="mode-text">
                  Lecteur interne
                  <small>Lecture directe dans la fenêtre</small>
                </span>
                {internal && <span className="check">✓</span>}
              </button>
              <button
                className={`player-btn mode-btn ${!internal ? 'selected' : ''}`}
                onClick={() => handleSelectMode('external')}
              >
                <span className="player-icon">🖥</span>
                <span className="mode-text">
                  Lecteur externe
                  <small>VLC, MPC-HC, PotPlayer…</small>
                </span>
                {!internal && <span className="check">✓</span>}
              </button>
            </div>
          </div>

          {/* Lecteurs détectés */}
          {detected.length > 0 && !internal && (
            <div className="settings-section">
              <p className="settings-label">Lecteurs détectés</p>
              <div className="player-list">
                {detected.map((pl) => (
                  <button
                    key={pl.path}
                    className={`player-btn ${activePlayer === pl.path ? 'selected' : ''}`}
                    onClick={() => handleSelectPreset(pl.path)}
                    title={pl.path}
                  >
                    <span className="player-icon">{playerIcon(pl.name)}</span>
                    {pl.name}
                    {activePlayer === pl.path && <span className="check">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Parcourir */}
          {!internal && (
            <div className="settings-section">
              <p className="settings-label">Lecteur personnalisé</p>
              <button
                className="btn-secondary browse-btn"
                onClick={handleBrowse}
                disabled={browsing}
              >
                {browsing ? 'Ouverture…' : '📂 Parcourir…'}
              </button>
              <p className="settings-hint">
                Fonctionne avec tout lecteur acceptant une URL en argument (VLC, MPC-HC, MPC-BE, PotPlayer…)
              </p>
            </div>
          )}

          {internal && (
            <p className="settings-hint">
              Le lecteur interne gère les flux HLS (.m3u8) et MPEG-TS. Raccourcis : Espace = lecture/pause,
              F = plein écran, M = muet, Échap = fermer.
            </p>
          )}

          {saved && <div className="settings-saved">✓ Enregistré</div>}

          <div className="form-actions">
            <button className="btn-primary" onClick={onClose}>Fermer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function shortPath(p) {
  if (!p) return '';
  const parts = p.replace(/\\/g, '/').split('/');
  return parts.length > 3
    ? '…/' + parts.slice(-3).join('/')
    : p;
}

function playerIcon(name) {
  if (name.includes('VLC'))       return '🟠';
  if (name.includes('MPC'))       return '🔵';
  if (name.includes('Pot'))       return '🟢';
  if (name.includes('Windows'))   return '🪟';
  return '▶';
}
