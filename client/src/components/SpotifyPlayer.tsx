import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';

const PLAYLIST_ID = '0FM7kVe0ByicC44ACzvWbY';
const AUTOPLAY_KEY = 'minkiards_music_started';

interface SpotifyController {
  play: () => void;
  pause: () => void;
  addListener: (event: string, cb: (data: any) => void) => void;
}

type BannerInfo = { title: string; artist: string; ts: number };

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (IFrameAPI: any) => void;
    __minkSpotify?: {
      controller: SpotifyController | null;
      embedEl: HTMLDivElement | null;
      ready: boolean;
      started: boolean;
      disabled: boolean;
      currentTrackUri: string | null;
      renderSubs: Set<() => void>;
      bannerSubs: Set<(b: BannerInfo) => void>;
    };
  }
}

// ── Singleton stored on window so it survives Vite HMR hot-module-replacement ─
function getState() {
  if (!window.__minkSpotify) {
    window.__minkSpotify = {
      controller: null,
      embedEl: null,
      ready: false,
      started: false,
      disabled: false,
      currentTrackUri: null,
      renderSubs: new Set(),
      bannerSubs: new Set(),
    };
  }
  return window.__minkSpotify;
}

// Convenience accessors (always go through getState() to stay in sync)
function notifyRender() { getState().renderSubs.forEach(fn => fn()); }
function notifyBanner(b: BannerInfo) { getState().bannerSubs.forEach(fn => fn(b)); }

// ── Embed DOM element ─────────────────────────────────────────────────────────
// Lives in document.body and is NEVER moved (moving reloads the iframe).
function getOrCreateEmbedEl(): HTMLDivElement {
  const s = getState();
  if (s.embedEl) return s.embedEl;

  // Re-use an existing element from a previous module load (HMR scenario)
  const existing = document.getElementById('spotify-embed-wrapper') as HTMLDivElement | null;
  if (existing) {
    s.embedEl = existing;
    return existing;
  }

  const el = document.createElement('div');
  el.id = 'spotify-embed-wrapper';
  el.style.cssText = [
    'position:fixed',
    'bottom:4rem',
    'right:1.25rem',
    'width:320px',
    'height:152px',
    'z-index:99999',
    'border-radius:12px',
    'overflow:hidden',
    'opacity:0',
    'pointer-events:none',
    'transition:opacity 0.35s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
    'transform:translateY(8px)',
    'box-shadow:0 4px 24px rgba(0,0,0,0.7)',
  ].join(';');
  document.body.appendChild(el);
  s.embedEl = el;
  return el;
}

function applyEmbedVisibility(show: boolean) {
  const el = getState().embedEl;
  if (!el) return;
  el.style.opacity = show ? '1' : '0';
  el.style.pointerEvents = show ? 'auto' : 'none';
  el.style.transform = show ? 'translateY(0)' : 'translateY(8px)';
}

// ── Spotify Iframe API loader ─────────────────────────────────────────────────
function buildController(IFrameAPI: any) {
  const state = getState();
  const el = getOrCreateEmbedEl();
  IFrameAPI.createController(
    el,
    { uri: `spotify:playlist:${PLAYLIST_ID}`, height: 152 },
    (ctrl: SpotifyController) => {
      state.controller = ctrl;
      state.ready = true;

      ctrl.addListener('playback_update', (e: any) => {
        const st = getState();
        console.log('[Spotify] playback_update raw:', JSON.stringify(e));

        const d = e?.data ?? e;
        const track = d?.track;
        const isPaused: boolean = d?.isPaused ?? true;
        const uri: string | undefined = track?.uri;
        const title: string | undefined = track?.name;
        const artist: string | undefined = track?.artists?.[0]?.name;

        console.log('[Spotify] parsed → isPaused:', isPaused, '| uri:', uri, '| title:', title, '| artist:', artist);

        if (!isPaused && !st.started) {
          st.started = true;
          notifyRender();
        }

        if (uri && uri !== st.currentTrackUri && !isPaused && title && artist) {
          st.currentTrackUri = uri;
          if (!st.disabled) {
            console.log('[Spotify] 🎵 Banner:', title, '-', artist);
            notifyBanner({ title, artist, ts: Date.now() });
          }
        }
      });

      if (!state.disabled) ctrl.play();
      notifyRender();
    }
  );
}

function ensureSpotifyApi() {
  const s = getState();
  getOrCreateEmbedEl();

  // Controller already alive — nothing to do
  if (s.controller) return;

  // Script already in DOM: re-register callback in case of HMR (previous
  // onSpotifyIframeApiReady may have used a stale closure).
  // The Spotify script exposes window.SpotifyIframeApi after it loads.
  const W = window as any;
  if (document.getElementById('spotify-iframe-api')) {
    if (W.SpotifyIframeApi) {
      // API already loaded — build controller directly
      buildController(W.SpotifyIframeApi);
    }
    // else: still loading, onSpotifyIframeApiReady will fire when ready
    return;
  }

  const script = document.createElement('script');
  script.id = 'spotify-iframe-api';
  script.src = 'https://open.spotify.com/embed/iframe-api/v1';
  script.async = true;
  document.head.appendChild(script);

  window.onSpotifyIframeApiReady = (IFrameAPI: any) => {
    (window as any).SpotifyIframeApi = IFrameAPI; // stash for HMR re-init
    buildController(IFrameAPI);
  };
}
// ─────────────────────────────────────────────────────────────────────────────

interface SpotifyPlayerProps {
  disabled?: boolean;
}

export function SpotifyPlayer({ disabled = false }: SpotifyPlayerProps) {
  const [, forceUpdate] = useState(0);
  const [banner, setBanner] = useState<BannerInfo | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => forceUpdate(n => n + 1), []);

  // Init API + subscribe to render signals
  useEffect(() => {
    const s = getState();
    s.renderSubs.add(refresh);
    ensureSpotifyApi();

    // Controller already alive (HMR or nav back): attempt play if not started
    if (s.ready && !s.disabled && !s.started && s.controller) {
      s.controller.play();
    }

    return () => { getState().renderSubs.delete(refresh); };
  }, [refresh]);

  // Subscribe to track-change banner events
  useEffect(() => {
    const onBanner = (b: BannerInfo) => {
      setBanner(b);
      setBannerVisible(true);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      bannerTimer.current = setTimeout(() => setBannerVisible(false), 5000);
    };
    getState().bannerSubs.add(onBanner);
    return () => { getState().bannerSubs.delete(onBanner); };
  }, []);

  // Sync disabled ↔ pause/resume
  useEffect(() => {
    const s = getState();
    s.disabled = disabled;
    if (disabled) {
      applyEmbedVisibility(false);
      s.controller?.pause();
    } else {
      if (s.started) s.controller?.play();
    }
  }, [disabled]);

  // Sync embedOpen ↔ embed DOM visibility
  useEffect(() => {
    if (disabled) return;
    applyEmbedVisibility(embedOpen);
  }, [embedOpen, disabled]);

  // Manual start: called when user clicks "Avvia musica"
  const handleStart = () => {
    const s = getState();
    if (!s.controller) return;
    s.controller.play();
    s.started = true;
    localStorage.setItem(AUTOPLAY_KEY, '1');
    setEmbedOpen(true);
    forceUpdate(n => n + 1);
  };

  // Toggle embed open/closed (volume button)
  const handleToggleEmbed = () => {
    setEmbedOpen(prev => !prev);
  };

  const s = getState();
  const showStartButton = !s.started && !disabled;

  return ReactDOM.createPortal(
    <>
      {/* ── "Avvia musica" pill — visible until playback actually starts ── */}
      {showStartButton && (
        <button
          onClick={handleStart}
          style={{
            position: 'fixed',
            bottom: '1.25rem',
            right: '1.25rem',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            background: 'rgba(0,0,0,0.82)',
            border: '1px solid rgba(29,185,84,0.55)',
            borderRadius: '2rem',
            padding: '0.45rem 0.9rem',
            color: '#1DB954',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(12px)',
          }}
        >
          <SpotifyIcon />
          Avvia musica
        </button>
      )}

      {/* ── Volume / player toggle — shown when music is playing ── */}
      {s.started && !disabled && (
        <button
          onClick={handleToggleEmbed}
          title={embedOpen ? 'Nascondi player' : 'Mostra player / Volume'}
          style={{
            position: 'fixed',
            bottom: '1.25rem',
            right: '1.25rem',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: embedOpen ? 'rgba(29,185,84,0.18)' : 'rgba(0,0,0,0.82)',
            border: `1px solid ${embedOpen ? 'rgba(29,185,84,0.8)' : 'rgba(29,185,84,0.45)'}`,
            borderRadius: '2rem',
            padding: '0.45rem 0.85rem',
            color: '#1DB954',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(12px)',
            transition: 'background 0.2s, border-color 0.2s',
          }}
        >
          <SpotifyIcon />
          {embedOpen ? 'Chiudi' : 'Volume'}
        </button>
      )}

      {/* ── Track-change banner — bottom left, auto-hides after 5 s ── */}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: '1.25rem',
          left: '1.25rem',
          zIndex: 99999,
          maxWidth: '265px',
          background: 'rgba(0,0,0,0.88)',
          border: '1px solid rgba(29,185,84,0.4)',
          borderRadius: '12px',
          padding: '0.6rem 0.85rem',
          backdropFilter: 'blur(14px)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          transition: 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1), opacity 0.45s ease',
          transform: bannerVisible && !disabled ? 'translateX(0)' : 'translateX(-130%)',
          opacity: bannerVisible && !disabled ? 1 : 0,
          pointerEvents: 'none',
        }}
      >
        <SpotifyIcon />
        <div style={{ minWidth: 0 }}>
          <div style={{
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {banner?.title}
          </div>
          <div style={{
            color: 'rgba(255,255,255,0.52)',
            fontSize: '0.67rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {banner?.artist}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

function SpotifyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#1DB954" style={{ flexShrink: 0 }}>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}
