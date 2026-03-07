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
    SpotifyIframeApi?: any;
    __minkSpotify?: {
      controller: SpotifyController | null;
      embedEl: HTMLDivElement | null;
      ready: boolean;
      started: boolean;
      disabled: boolean;
      currentTrackUri: string | null;
      pendingPlay: boolean;
      renderSubs: Set<() => void>;
      bannerSubs: Set<(b: BannerInfo) => void>;
    };
  }
}

// ── Singleton on window — survives Vite HMR ───────────────────────────────────
function getState() {
  if (!window.__minkSpotify) {
    window.__minkSpotify = {
      controller: null,
      embedEl: null,
      ready: false,
      started: false,
      disabled: false,
      currentTrackUri: null,
      pendingPlay: false,
      renderSubs: new Set(),
      bannerSubs: new Set(),
    };
  }
  return window.__minkSpotify;
}

function notifyRender() { getState().renderSubs.forEach(fn => fn()); }
function notifyBanner(b: BannerInfo) { getState().bannerSubs.forEach(fn => fn(b)); }

// ── Embed element ─────────────────────────────────────────────────────────────
// Lives in document.body and is NEVER moved — moving reloads the iframe.
function getOrCreateEmbedEl(): HTMLDivElement {
  const s = getState();
  if (s.embedEl) return s.embedEl;
  const existing = document.getElementById('spotify-embed-wrapper') as HTMLDivElement | null;
  if (existing) { s.embedEl = existing; return existing; }
  const el = document.createElement('div');
  el.id = 'spotify-embed-wrapper';
  // Initially hidden; becomes visible after music starts
  el.style.cssText = [
    'position:fixed',
    'bottom:1.25rem',
    'right:1.25rem',
    'width:320px',
    'height:152px',
    'z-index:99999',
    'border-radius:12px',
    'overflow:hidden',
    'opacity:0',
    'pointer-events:none',
    'transition:opacity 0.4s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
    'transform:translateY(10px)',
    'box-shadow:0 6px 28px rgba(0,0,0,0.75)',
  ].join(';');
  document.body.appendChild(el);
  s.embedEl = el;
  return el;
}

function showEmbed() {
  const el = getState().embedEl;
  if (!el) return;
  el.style.opacity = '1';
  el.style.pointerEvents = 'auto';
  el.style.transform = 'translateY(0)';
}

function hideEmbed() {
  const el = getState().embedEl;
  if (!el) return;
  el.style.opacity = '0';
  el.style.pointerEvents = 'none';
  el.style.transform = 'translateY(10px)';
}

// ── Spotify API ───────────────────────────────────────────────────────────────
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
        console.log('[Spotify] playback_update:', JSON.stringify(e));
        const d = e?.data ?? e;
        const track = d?.track;
        const isPaused: boolean = d?.isPaused ?? true;
        const uri: string | undefined = track?.uri;
        const title: string | undefined = track?.name;
        const artist: string | undefined = track?.artists?.[0]?.name;

        if (!isPaused && !st.started) {
          st.started = true;
          showEmbed();
          notifyRender();
        }

        if (uri && uri !== st.currentTrackUri && !isPaused && title && artist) {
          st.currentTrackUri = uri;
          if (!st.disabled) {
            notifyBanner({ title, artist, ts: Date.now() });
          }
        }
      });

      // Play if requested before controller was ready, or if returning visitor
      if (!state.disabled && (state.pendingPlay || !!localStorage.getItem(AUTOPLAY_KEY))) {
        ctrl.play();
        // Show the embed immediately — don't wait for playback_update event
        state.started = true;
        showEmbed();
      }

      notifyRender();
    }
  );
}

function ensureSpotifyApi() {
  const s = getState();
  getOrCreateEmbedEl();
  if (s.controller) return; // already alive

  if (document.getElementById('spotify-iframe-api')) {
    if (window.SpotifyIframeApi) buildController(window.SpotifyIframeApi); // HMR recovery
    return;
  }

  const script = document.createElement('script');
  script.id = 'spotify-iframe-api';
  script.src = 'https://open.spotify.com/embed/iframe-api/v1';
  script.async = true;
  document.head.appendChild(script);

  window.onSpotifyIframeApiReady = (IFrameAPI: any) => {
    window.SpotifyIframeApi = IFrameAPI;
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
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => forceUpdate(n => n + 1), []);

  // Boot + subscribe to render signals
  useEffect(() => {
    const s = getState();
    s.renderSubs.add(refresh);
    ensureSpotifyApi();
    // If controller is already live (nav-back), attempt play if not started
    if (s.controller && !s.started && !s.disabled) s.controller.play();
    return () => { getState().renderSubs.delete(refresh); };
  }, [refresh]);

  // Track-change banner subscription
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

  // Pause/resume when section changes (disabled prop)
  useEffect(() => {
    const s = getState();
    s.disabled = disabled;
    if (disabled) {
      hideEmbed();
      s.controller?.pause();
    } else {
      if (s.started) { showEmbed(); s.controller?.play(); }
    }
  }, [disabled]);

  // "Avvia musica" click
  const handleStart = () => {
    const s = getState();
    console.log('[Spotify] Avvia click — controller:', s.controller ? 'ready' : 'loading');
    s.started = true;
    s.pendingPlay = true;
    localStorage.setItem(AUTOPLAY_KEY, '1');
    showEmbed();
    if (s.controller) s.controller.play();
    forceUpdate(n => n + 1);
  };

  const s = getState();
  const showStartButton = !s.started && !disabled;

  return ReactDOM.createPortal(
    <>
      {/* "Avvia musica" — visible until user starts playback */}
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
            background: 'rgba(0,0,0,0.85)',
            border: '1px solid rgba(29,185,84,0.6)',
            borderRadius: '2rem',
            padding: '0.5rem 1rem',
            color: '#1DB954',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            backdropFilter: 'blur(12px)',
            letterSpacing: '0.02em',
          }}
        >
          <SpotifyIcon />
          Avvia musica
        </button>
      )}

      {/* Track-change banner — bottom-left, 5 s auto-hide */}
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
          <div style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {banner?.title}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.52)', fontSize: '0.67rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
