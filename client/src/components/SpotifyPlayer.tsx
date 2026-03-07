import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';

const PLAYLIST_ID = '0FM7kVe0ByicC44ACzvWbY';
const AUTOPLAY_KEY = 'minkiards_music_started';

interface SpotifyController {
  play: () => void;
  pause: () => void;
  addListener: (event: string, cb: (data: any) => void) => void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (IFrameAPI: any) => void;
  }
}

// ── Singleton module-level state ──────────────────────────────────────────────
let _controller: SpotifyController | null = null;
let _embedEl: HTMLDivElement | null = null;
let _started = false;
let _disabled = false;
let _currentTrackUri: string | null = null;
let _autoplayBlocked = false;   // true = browser refused autoplay
let _autoplayAttempted = false; // true = we already tried

type BannerInfo = { title: string; artist: string; ts: number };
let _lastBanner: BannerInfo | null = null;

const _renderSubs: Set<() => void> = new Set();
const _bannerSubs: Set<(b: BannerInfo) => void> = new Set();

function notifyRender() { _renderSubs.forEach(fn => fn()); }
function notifyBanner(b: BannerInfo) {
  _lastBanner = b;
  _bannerSubs.forEach(fn => fn(b));
}

// The embed wrapper lives in document.body and is NEVER moved.
// It must stay in the visible viewport so the browser doesn't throttle its events.
function getOrCreateEmbedEl(): HTMLDivElement {
  if (!_embedEl) {
    _embedEl = document.createElement('div');
    _embedEl.id = 'spotify-embed-wrapper';
    _embedEl.style.cssText = [
      'position:fixed',
      'bottom:1.25rem',
      'right:1.25rem',
      'width:320px',
      'height:80px',
      'z-index:9997',
      'border-radius:12px',
      'overflow:hidden',
      // Hidden initially, shown after first play
      'opacity:0',
      'pointer-events:none',
      'transition:opacity 0.3s ease',
      'box-shadow:0 4px 20px rgba(0,0,0,0.5)',
    ].join(';');
    document.body.appendChild(_embedEl);
  }
  return _embedEl;
}

function setEmbedVisible(visible: boolean) {
  const el = _embedEl;
  if (!el) return;
  el.style.opacity = visible ? '1' : '0';
  el.style.pointerEvents = visible ? 'auto' : 'none';
}

function ensureSpotifyApi() {
  // Pre-create the embed element so it's in the DOM early
  getOrCreateEmbedEl();

  if (document.getElementById('spotify-iframe-api')) return;

  const script = document.createElement('script');
  script.id = 'spotify-iframe-api';
  script.src = 'https://open.spotify.com/embed/iframe-api/v1';
  script.async = true;
  document.head.appendChild(script);

  window.onSpotifyIframeApiReady = (IFrameAPI: any) => {
    const el = getOrCreateEmbedEl();
    IFrameAPI.createController(
      el,
      { uri: `spotify:playlist:${PLAYLIST_ID}`, height: 80 },
      (ctrl: SpotifyController) => {
        _controller = ctrl;

        ctrl.addListener('playback_update', (e: any) => {
          const track = e?.data?.track;
          const isPaused: boolean = e?.data?.isPaused ?? true;
          const uri: string | undefined = track?.uri;
          const title: string | undefined = track?.name;
          const artist: string | undefined = track?.artists?.[0]?.name;

          if (!isPaused && !_started) {
            _started = true;
            _autoplayBlocked = false;
            notifyRender();
          }

          if (uri && uri !== _currentTrackUri && !isPaused && title && artist) {
            _currentTrackUri = uri;
            if (!_disabled) {
              notifyBanner({ title, artist, ts: Date.now() });
              notifyRender();
            }
          }
        });

        // ── Autoplay attempt ──────────────────────────────────────────────────
        if (!_autoplayAttempted && !_disabled) {
          _autoplayAttempted = true;
          // Try immediately — works if browser allows it (return visitor / user gesture)
          ctrl.play();
          // After 2.5 s, check if playback actually started
          setTimeout(() => {
            if (!_started) {
              _autoplayBlocked = true;
              notifyRender(); // show the fallback "Avvia musica" button
            }
          }, 2500);
        }

        notifyRender();
      }
    );
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

  // Init Spotify API once, subscribe to render signals
  useEffect(() => {
    _renderSubs.add(refresh);
    ensureSpotifyApi();
    return () => { _renderSubs.delete(refresh); };
  }, [refresh]);

  // Subscribe to track-change events for banner
  useEffect(() => {
    const onBanner = (b: BannerInfo) => {
      setBanner(b);
      setBannerVisible(true);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      bannerTimer.current = setTimeout(() => setBannerVisible(false), 5000);
    };
    _bannerSubs.add(onBanner);
    return () => { _bannerSubs.delete(onBanner); };
  }, []);

  // Sync disabled → show/hide embed, pause/resume
  useEffect(() => {
    _disabled = disabled;
    setEmbedVisible(_started && !disabled);
    if (!_controller) return;
    if (disabled) {
      _controller.pause();
    } else if (_started) {
      _controller.play();
    }
  }, [disabled]);

  // Show embed when started
  useEffect(() => {
    if (_started && !disabled) setEmbedVisible(true);
  });

  const handleStart = () => {
    const ctrl = _controller;
    if (!ctrl) return;
    ctrl.play();
    _started = true;
    _autoplayBlocked = false;
    localStorage.setItem(AUTOPLAY_KEY, '1');
    setEmbedVisible(true);
    forceUpdate(n => n + 1);
  };

  // Show the manual button only when:
  // – music is not yet playing, AND
  // – we're not mid-autoplay attempt (first 2.5s window), OR autoplay was definitively blocked
  const midAttempt = _autoplayAttempted && !_autoplayBlocked && !_started;
  const showStartButton = !_started && !disabled && !midAttempt;

  return ReactDOM.createPortal(
    <>
      {/* ── "Avvia musica" pill — appears before first play ── */}
      {showStartButton && (
        <button
          onClick={handleStart}
          style={{
            position: 'fixed',
            bottom: '1.25rem',
            right: '1.25rem',
            zIndex: 9998,
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

      {/* ── Track-change banner — bottom left, auto-hides after 5 s ── */}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: '1.25rem',
          left: '1.25rem',
          zIndex: 9999,
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
