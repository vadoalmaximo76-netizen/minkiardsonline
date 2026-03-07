import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';

const PLAYLIST_ID = '0FM7kVe0ByicC44ACzvWbY';

interface SpotifyController {
  play: () => void;
  pause: () => void;
  addListener: (event: string, cb: (data: any) => void) => void;
  removeListener: (event: string, cb: (data: any) => void) => void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (IFrameAPI: any) => void;
  }
}

// ── Singleton module-level state ──────────────────────────────────────────────
let _controller: SpotifyController | null = null;
let _iframeEl: HTMLDivElement | null = null;
let _started = false;
let _disabled = false;
let _currentTrackUri: string | null = null;

type BannerInfo = { title: string; artist: string; ts: number };
let _lastBanner: BannerInfo | null = null;

const _renderSubscribers: Set<() => void> = new Set();
const _bannerSubscribers: Set<(b: BannerInfo) => void> = new Set();

function notifyRender() {
  _renderSubscribers.forEach(fn => fn());
}
function notifyBanner(b: BannerInfo) {
  _lastBanner = b;
  _bannerSubscribers.forEach(fn => fn(b));
}

// The iframe wrapper is ALWAYS in document.body and NEVER moved —
// moving it causes iframe reload which kills the audio stream.
function getOrCreateIframeEl(): HTMLDivElement {
  if (!_iframeEl) {
    _iframeEl = document.createElement('div');
    _iframeEl.id = 'spotify-singleton-embed';
    _iframeEl.style.cssText = [
      'position:fixed',
      'right:1.25rem',
      'bottom:3.5rem',   // sits above the control bar
      'width:320px',
      'height:80px',
      'z-index:9997',
      'border-radius:12px',
      'overflow:hidden',
      'opacity:0',
      'pointer-events:none',
      'transition:opacity 0.3s ease',
    ].join(';');
    document.body.appendChild(_iframeEl);
  }
  return _iframeEl;
}

function setEmbedVisible(visible: boolean) {
  const el = _iframeEl;
  if (!el) return;
  if (visible) {
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';
  } else {
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
  }
}

function ensureSpotifyApi() {
  if (document.getElementById('spotify-iframe-api')) return;

  // Create and position the iframe element before the API loads
  getOrCreateIframeEl();

  const script = document.createElement('script');
  script.id = 'spotify-iframe-api';
  script.src = 'https://open.spotify.com/embed/iframe-api/v1';
  script.async = true;
  document.head.appendChild(script);

  window.onSpotifyIframeApiReady = (IFrameAPI: any) => {
    const el = getOrCreateIframeEl();
    IFrameAPI.createController(
      el,
      { uri: `spotify:playlist:${PLAYLIST_ID}`, height: 80 },
      (controller: SpotifyController) => {
        _controller = controller;

        controller.addListener('playback_update', (data: any) => {
          const uri: string | undefined = data?.data?.track?.uri;
          const title: string | undefined = data?.data?.track?.name;
          const artist: string | undefined = data?.data?.track?.artists?.[0]?.name;
          const isPaused: boolean = data?.data?.isPaused ?? true;

          if (!isPaused && !_started) {
            _started = true;
            notifyRender();
          }

          // New track started (not paused, different URI)
          if (uri && uri !== _currentTrackUri && !isPaused) {
            _currentTrackUri = uri;
            if (title && artist && !_disabled) {
              notifyBanner({ title, artist, ts: Date.now() });
            }
          }
        });

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
  const [embedOpen, setEmbedOpen] = useState(false);
  const [banner, setBanner] = useState<BannerInfo | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => forceUpdate(n => n + 1), []);

  // Init
  useEffect(() => {
    _renderSubscribers.add(refresh);
    ensureSpotifyApi();
    return () => {
      _renderSubscribers.delete(refresh);
    };
  }, [refresh]);

  // Banner listener
  useEffect(() => {
    const onBanner = (b: BannerInfo) => {
      setBanner(b);
      setBannerVisible(true);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      bannerTimer.current = setTimeout(() => setBannerVisible(false), 5000);
    };
    _bannerSubscribers.add(onBanner);
    // If there's already a banner from before mount, restore it
    if (_lastBanner) onBanner(_lastBanner);
    return () => {
      _bannerSubscribers.delete(onBanner);
    };
  }, []);

  // Sync disabled → pause/resume
  useEffect(() => {
    _disabled = disabled;
    const ctrl = _controller;
    if (!ctrl) return;
    if (disabled) {
      ctrl.pause();
    } else if (_started) {
      ctrl.play();
    }
  }, [disabled]);

  // Sync embedOpen → show/hide iframe via CSS (no DOM move)
  useEffect(() => {
    if (!_started) return;
    setEmbedVisible(embedOpen && !disabled);
  }, [embedOpen, disabled]);

  const handleStart = () => {
    const ctrl = _controller;
    if (!ctrl) return;
    ctrl.play();
    _started = true;
    forceUpdate(n => n + 1);
  };

  const handleToggleEmbed = () => {
    setEmbedOpen(o => !o);
  };

  const showStartButton = !_started && !disabled;
  const showControls = !disabled; // always show the control bar once rendered

  return ReactDOM.createPortal(
    <>
      {/* ── Control bar — bottom right ── */}
      {showControls && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.25rem',
            right: '1.25rem',
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {showStartButton ? (
            <button
              onClick={handleStart}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'rgba(0,0,0,0.80)',
                border: '1px solid rgba(29,185,84,0.5)',
                borderRadius: '2rem',
                padding: '0.45rem 0.85rem',
                color: '#1DB954',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                backdropFilter: 'blur(10px)',
              }}
            >
              <SpotifyIcon />
              Avvia musica
            </button>
          ) : (
            <button
              onClick={handleToggleEmbed}
              title={embedOpen ? 'Nascondi controllo volume' : 'Mostra controllo volume'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: embedOpen ? 'rgba(29,185,84,0.2)' : 'rgba(0,0,0,0.75)',
                border: `1px solid ${embedOpen ? 'rgba(29,185,84,0.7)' : 'rgba(29,185,84,0.35)'}`,
                borderRadius: '2rem',
                padding: '0.35rem 0.7rem',
                color: '#1DB954',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                backdropFilter: 'blur(10px)',
                transition: 'background 0.2s, border-color 0.2s',
              }}
            >
              <SpotifyIcon />
              <VolumeIcon />
            </button>
          )}
        </div>
      )}

      {/* ── Track change banner — bottom left, auto-hide after 5s ── */}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: '1.25rem',
          left: '1.25rem',
          zIndex: 9999,
          maxWidth: '260px',
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
            color: 'rgba(255,255,255,0.5)',
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

function VolumeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)" style={{ flexShrink: 0 }}>
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  );
}
