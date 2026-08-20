import React, { useState } from 'react';

export default function ChannelCard({ channel, onToggleFavorite, onOpenStream }) {
  const [imgErr, setImgErr] = useState(false);
  const [pop, setPop]       = useState(false);

  const handleFav = (e) => {
    e.stopPropagation();
    setPop(true);
    setTimeout(() => setPop(false), 300);
    onToggleFavorite(channel.id);
  };

  const initial = channel.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div
      className="channel-card"
      onClick={() => onOpenStream(channel)}
      title={`Lire : ${channel.name}`}
    >
      <div className="channel-logo-wrap">
        {channel.logo && !imgErr ? (
          <img
            src={channel.logo}
            alt={channel.name}
            className="channel-logo"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="channel-logo-ph">{initial}</div>
        )}
      </div>

      <div className="channel-info">
        <span className="channel-name">{channel.name}</span>
        <span className="channel-group">{channel.group_title}</span>
      </div>

      <button
        className={`btn-fav ${channel.is_favorite ? 'on' : ''} ${pop ? 'pop' : ''}`}
        onClick={handleFav}
        title={channel.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      >
        {channel.is_favorite ? '★' : '☆'}
      </button>
    </div>
  );
}
