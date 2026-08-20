import React from 'react';
import ChannelCard from './ChannelCard';

export default function ChannelGrid({ channels, loading, onToggleFavorite, onOpenStream }) {
  if (loading && channels.length === 0) {
    return (
      <div className="state-box">
        <div className="spinner" />
      </div>
    );
  }

  if (!loading && channels.length === 0) {
    return (
      <div className="state-box">
        <span className="state-icon">📭</span>
        <p>Aucune chaîne trouvée</p>
      </div>
    );
  }

  return (
    <div className="channel-grid">
      {channels.map((ch) => (
        <ChannelCard
          key={ch.id}
          channel={ch}
          onToggleFavorite={onToggleFavorite}
          onOpenStream={onOpenStream}
        />
      ))}
    </div>
  );
}
