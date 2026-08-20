import React, { useState, useRef, useEffect } from 'react';

export default function AddPlaylistModal({ onAdd, onClose, loading }) {
  const [name, setName]   = useState('');
  const [url, setUrl]     = useState('');
  const [error, setError] = useState('');
  const nameRef           = useRef(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimUrl = url.trim();
    if (!trimUrl) { setError("L'URL est obligatoire."); return; }
    if (!/^https?:\/\/.+/.test(trimUrl)) {
      setError('URL invalide. Elle doit commencer par http:// ou https://');
      return;
    }
    let finalName = name.trim();
    if (!finalName) {
      try { finalName = new URL(trimUrl).hostname; } catch { finalName = trimUrl; }
    }
    onAdd({ name: finalName, url: trimUrl });
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>Ajouter une playlist M3U</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="pl-name">Nom de la playlist</label>
            <input
              id="pl-name"
              ref={nameRef}
              className="form-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ma playlist IPTV (optionnel)"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="pl-url">URL de la playlist M3U *</label>
            <input
              id="pl-url"
              className="form-input"
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(''); }}
              placeholder="http://exemple.com/playlist.m3u"
              disabled={loading}
              required
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Chargement…' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
