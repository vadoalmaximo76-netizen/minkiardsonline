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
      started: boolean;      // true only after user interaction or confirmed playback
      disabled: boolean;
      currentTrackUri: string | null;
      renderSubs: Set<() => void>;
      bannerSubs: Set<(b: BannerInfo) => void>;
    };
  }
}

// Stamped once per actual page load (survives HMR but resets on F5/navigation).
if (!(window as any).__minkPageId) (window as any).__minkPageId = String(Date.now());
const PAGE_KEY: string = (window as any).__minkPageId;

// ── Window-level singleton (survives Vite HMR reloads) ───────────────────────
function S() {
  if (!window.__minkSpotify || (window.__minkSpotify as any).__pageKey !== PAGE_KEY) {
    // Fresh page load — reset started/currentTrackUri so the button shows again
    const prev = window.__minkSpotify;
    window.__minkSpotify = {
      controller: prev?.controller ?? null,
      embedEl: prev?.embedEl ?? null,
      ready: prev?.ready ?? false,
      started: false,               // always reset on page load
      disabled: false,
      currentTrackUri: null,        // always reset on page load
      renderSubs: prev?.renderSubs ?? new Set(),
      bannerSubs: prev?.bannerSubs ?? new Set(),
    };
    (window.__minkSpotify as any).__pageKey = PAGE_KEY;
  }
  return window.__minkSpotify;
}

function notifyRender() { S().renderSubs.forEach(fn => fn()); }
function notifyBanner(b: BannerInfo) { S().bannerSubs.forEach(fn => fn(b)); }

// ── Embed div (lives in body, never moved) ────────────────────────────────────
function getOrCreateEmbed(): HTMLDivElement {
  const s = S();
  if (s.embedEl) return s.embedEl;
  const existing = document.getElementById('spotify-embed-root') as HTMLDivElement | null;
  if (existing) { s.embedEl = existing; return existing; }
  const el = document.createElement('div');
  el.id = 'spotify-embed-root';
  el.style.cssText = [
    'position:fixed', 'bottom:1.25rem', 'right:1.25rem',
    'width:320px', 'height:152px', 'z-index:99999',
    'border-radius:12px', 'overflow:hidden',
    'opacity:0', 'pointer-events:none',
    'transition:opacity 0.4s ease, transform 0.35s ease',
    'transform:translateY(10px)',
    'box-shadow:0 6px 28px rgba(0,0,0,0.7)',
  ].join(';');
  document.body.appendChild(el);
  s.embedEl = el;
  return el;
}

function revealEmbed() {
  const el = S().embedEl; if (!el) return;
  el.style.opacity = '1'; el.style.pointerEvents = 'auto'; el.style.transform = 'translateY(0)';
}

function concealEmbed() {
  const el = S().embedEl; if (!el) return;
  el.style.opacity = '0'; el.style.pointerEvents = 'none'; el.style.transform = 'translateY(10px)';
}

// ── Spotify Iframe API ────────────────────────────────────────────────────────
function buildController(API: any) {
  const s = S();
  console.log('[Spotify] buildController — controller already?', !!s.controller);
  if (s.controller) return; // already built
  API.createController(
    getOrCreateEmbed(),
    { uri: `spotify:playlist:${PLAYLIST_ID}`, height: 152 },
    (ctrl: SpotifyController) => {
      s.controller = ctrl;
      s.ready = true;

      ctrl.addListener('playback_update', (e: any) => {
        const st = S();
        const d = e?.data ?? e;
        const isPaused: boolean = d?.isPaused ?? true;
        const track = d?.track;
        const uri: string | undefined = track?.uri;
        const title: string | undefined = track?.name;
        const artist: string | undefined = track?.artists?.[0]?.name;

        console.log('[Spotify] update isPaused=%s uri=%s title=%s', isPaused, uri, title);

        // Show embed whenever playback is confirmed — regardless of button state
        if (!isPaused && !st.started) {
          revealEmbed();
          // Note: we do NOT set started=true here so the button stays pressable
        }

        // Banner on track change while playing
        if (!isPaused && uri && uri !== st.currentTrackUri) {
          st.currentTrackUri = uri;
          if (!st.disabled && (title || artist)) {
            notifyBanner({ title: title ?? 'Spotify', artist: artist ?? '', ts: Date.now() });
          }
        }
      });

      // Attempt autoplay (works only if browser/user has already interacted).
      // We deliberately do NOT set started=true here — we wait for playback_update
      // to confirm, so the "Avvia musica" button stays visible until play is confirmed.
      if (!s.disabled) ctrl.play();

      notifyRender();
    }
  );
}

function ensureApi() {
  console.log('[Spotify] ensureApi — controller?', !!S().controller, 'script?', !!document.getElementById('spotify-iframe-api'));
  getOrCreateEmbed();
  const s = S();
  if (s.controller) return;
  if (document.getElementById('spotify-iframe-api')) {
    if (window.SpotifyIframeApi) buildController(window.SpotifyIframeApi);
    return;
  }
  const sc = document.createElement('script');
  sc.id = 'spotify-iframe-api';
  sc.src = 'https://open.spotify.com/embed/iframe-api/v1';
  sc.async = true;
  document.head.appendChild(sc);
  window.onSpotifyIframeApiReady = (API: any) => {
    window.SpotifyIframeApi = API;
    buildController(API);
  };
}
// ─────────────────────────────────────────────────────────────────────────────

export function SpotifyPlayer({ disabled = false }: { disabled?: boolean }) {
  const [, tick] = useState(0);
  const [banner, setBanner] = useState<BannerInfo | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useCallback(() => tick(n => n + 1), []);

  // Boot
  useEffect(() => {
    S().renderSubs.add(refresh);
    ensureApi();
    const s = S();
    if (s.controller && !s.started && !s.disabled) s.controller.play();
    return () => { S().renderSubs.delete(refresh); };
  }, [refresh]);

  // Banner subscription
  useEffect(() => {
    const cb = (b: BannerInfo) => {
      setBanner(b); setBannerVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setBannerVisible(false), 5000);
    };
    S().bannerSubs.add(cb);
    return () => { S().bannerSubs.delete(cb); };
  }, []);

  // Pause/resume on section change
  useEffect(() => {
    const s = S(); s.disabled = disabled;
    if (disabled) { concealEmbed(); s.controller?.pause(); }
    else if (s.started) { revealEmbed(); s.controller?.play(); }
  }, [disabled]);

  // "Avvia musica" clicked
  const start = () => {
    const s = S();
    // Mark started immediately so the button disappears and embed shows
    s.started = true;
    localStorage.setItem(AUTOPLAY_KEY, '1');
    revealEmbed();
    if (s.controller) s.controller.play();
    tick(n => n + 1);
  };

  const s = S();
  const showBtn = !s.started && !disabled;

  return ReactDOM.createPortal(
    <>
      {showBtn && (
        <button onClick={start} style={{
          position: 'fixed', bottom: '1.25rem', right: '1.25rem',
          zIndex: 100000, display: 'flex', alignItems: 'center', gap: '0.45rem',
          background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(29,185,84,0.6)',
          borderRadius: '2rem', padding: '0.5rem 1rem',
          color: '#1DB954', fontSize: '0.8rem', fontWeight: 700,
          cursor: 'pointer', backdropFilter: 'blur(12px)',
        }}>
          <Icon /> Avvia musica
        </button>
      )}

      {/* Banner bottom-left */}
      <div style={{
        position: 'fixed', bottom: '1.25rem', left: '1.25rem', zIndex: 99999,
        maxWidth: '260px',
        background: 'rgba(0,0,0,0.88)', border: '1px solid rgba(29,185,84,0.4)',
        borderRadius: '12px', padding: '0.6rem 0.85rem',
        backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', gap: '0.6rem',
        transition: 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1), opacity 0.45s ease',
        transform: bannerVisible && !disabled ? 'translateX(0)' : 'translateX(-130%)',
        opacity: bannerVisible && !disabled ? 1 : 0,
        pointerEvents: 'none',
      }}>
        <Icon />
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {banner?.title}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.67rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {banner?.artist}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

function Icon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#1DB954" style={{ flexShrink: 0 }}>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}
