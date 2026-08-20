import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';

/**
 * Lecteur interne : lit le flux directement dans l'application.
 *  - .m3u8              → hls.js
 *  - .ts / sans ext.    → mpegts.js (flux MPEG-TS live, typique Xtream Codes)
 *  - .mp4/.webm/.ogg    → <video> natif
 */
export default function PlayerOverlay({ channel, onClose, onPlayExternal }) {
  const videoRef     = useRef(null);
  const engineRef    = useRef(null);      // instance hls.js / mpegts.js à détruire
  const containerRef = useRef(null);
  const hideTimer    = useRef(null);

  const [status, setStatus]       = useState('loading'); // loading | playing | paused | error
  const [errorMsg, setErrorMsg]   = useState('');
  const [volume, setVolume]       = useState(1);
  const [muted, setMuted]         = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [attempt, setAttempt]     = useState(0);         // incrémenté pour relancer

  // ─── Chargement du flux ────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let destroyed = false;
    setStatus('loading');
    setErrorMsg('');

    const fail = (msg) => {
      if (destroyed) return;
      setErrorMsg(msg);
      setStatus('error');
    };

    const kind = streamKind(channel.url);

    if (kind === 'hls') {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          liveDurationInfinity: true,
          manifestLoadingTimeOut: 20000,
          fragLoadingTimeOut: 30000,
        });
        engineRef.current = hls;
        hls.loadSource(channel.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR)      hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR)   hls.recoverMediaError();
          else fail('Flux illisible (' + (data.details || 'erreur fatale') + ')');
        });
      } else {
        video.src = channel.url;
        video.play().catch(() => {});
      }
    } else if (kind === 'ts') {
      if (mpegts.isSupported()) {
        const player = mpegts.createPlayer(
          { type: 'mpegts', isLive: true, url: channel.url },
          { enableWorker: true, liveBufferLatencyChasing: true, lazyLoad: false }
        );
        engineRef.current = player;
        player.attachMediaElement(video);
        player.on(mpegts.Events.ERROR, (type, detail) =>
          fail('Flux illisible (' + (detail || type) + ')')
        );
        player.load();
        Promise.resolve(player.play()).catch(() => {});
      } else {
        fail("Ce format n'est pas supporté par le lecteur interne");
      }
    } else {
      video.src = channel.url;
      video.play().catch(() => {});
    }

    return () => {
      destroyed = true;
      const engine = engineRef.current;
      engineRef.current = null;
      // destroy() libère tout (hls.js comme mpegts.js, qui décharge et détache seul)
      try { engine?.destroy?.(); } catch { /* ignoré */ }
      try { video.pause(); video.removeAttribute('src'); video.load(); } catch { /* ignoré */ }
    };
  }, [channel.url, attempt]);

  // ─── Événements <video> ────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlaying  = () => setStatus('playing');
    const onWaiting  = () => setStatus((s) => (s === 'error' ? s : 'loading'));
    const onPause    = () => setStatus((s) => (s === 'error' ? s : 'paused'));
    const onError    = () => {
      setErrorMsg('Impossible de lire ce flux');
      setStatus('error');
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('pause',   onPause);
    video.addEventListener('error',   onError);
    return () => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('pause',   onPause);
      video.removeEventListener('error',   onError);
    };
  }, []);

  // ─── Volume ────────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (video) { video.volume = volume; video.muted = muted; }
  }, [volume, muted]);

  // ─── Plein écran ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen?.();
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, []);

  const close = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onClose();
  }, [onClose]);

  // ─── Raccourcis clavier ────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      switch (e.key) {
        case 'Escape':
          if (!document.fullscreenElement) close();
          break;
        case ' ': case 'k':
          e.preventDefault(); togglePlay(); break;
        case 'f':
          toggleFullscreen(); break;
        case 'm':
          setMuted((m) => !m); break;
        case 'ArrowUp':
          e.preventDefault(); setVolume((v) => Math.min(1, +(v + 0.05).toFixed(2))); break;
        case 'ArrowDown':
          e.preventDefault(); setVolume((v) => Math.max(0, +(v - 0.05).toFixed(2))); break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, togglePlay, toggleFullscreen]);

  // ─── Masquage auto des contrôles ───────────────────────────────────────
  const wakeUi = useCallback(() => {
    setUiVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setUiVisible(false), 3000);
  }, []);

  useEffect(() => {
    wakeUi();
    return () => clearTimeout(hideTimer.current);
  }, [wakeUi]);

  const playing = status === 'playing';

  return (
    <div
      ref={containerRef}
      className={`player-overlay ${uiVisible || !playing ? 'ui-on' : 'ui-off'}`}
      onMouseMove={wakeUi}
      onDoubleClick={toggleFullscreen}
    >
      <video
        ref={videoRef}
        className="player-video"
        autoPlay
        playsInline
        onClick={togglePlay}
      />

      {/* Barre supérieure */}
      <div className="player-top">
        <div className="player-title">
          <span className="player-live">● LIVE</span>
          <span className="player-name" title={channel.name}>{channel.name}</span>
          {channel.group_title && <span className="player-group">{channel.group_title}</span>}
        </div>
        <button className="player-btn-icon" onClick={close} title="Fermer (Échap)">✕</button>
      </div>

      {/* États */}
      {status === 'loading' && (
        <div className="player-center">
          <div className="spinner" />
          <p>Connexion au flux…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="player-center player-error">
          <span className="player-error-icon">⚠</span>
          <p className="player-error-msg">{errorMsg}</p>
          <div className="player-error-actions">
            <button className="btn-secondary" onClick={() => setAttempt((a) => a + 1)}>
              ↻ Réessayer
            </button>
            <button className="btn-primary" onClick={() => onPlayExternal(channel)}>
              ▶ Ouvrir dans le lecteur externe
            </button>
          </div>
        </div>
      )}

      {/* Contrôles */}
      <div className="player-controls">
        <button className="player-btn-icon" onClick={togglePlay} title="Lecture / Pause (Espace)">
          {playing ? '❚❚' : '▶'}
        </button>

        <button className="player-btn-icon" onClick={() => setMuted((m) => !m)} title="Muet (M)">
          {muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
        </button>

        <input
          className="player-volume"
          type="range" min="0" max="1" step="0.01"
          value={muted ? 0 : volume}
          onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }}
          title="Volume"
        />

        <div className="player-spacer" />

        <button
          className="player-btn-icon"
          onClick={() => onPlayExternal(channel)}
          title="Ouvrir dans le lecteur externe"
        >
          ⧉
        </button>
        <button className="player-btn-icon" onClick={toggleFullscreen} title="Plein écran (F)">
          {fullscreen ? '⤡' : '⤢'}
        </button>
      </div>
    </div>
  );
}

function streamKind(url) {
  const path = String(url).split('?')[0].toLowerCase();
  if (path.endsWith('.m3u8') || path.includes('.m3u8')) return 'hls';
  if (path.endsWith('.ts') || path.endsWith('.mpegts') || path.endsWith('.m2ts')) return 'ts';
  if (/\.(mp4|webm|ogg|ogv|m4v|mov)$/.test(path)) return 'native';
  return 'ts'; // Xtream Codes live : URL sans extension = MPEG-TS
}
