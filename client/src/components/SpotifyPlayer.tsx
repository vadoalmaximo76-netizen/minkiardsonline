import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';

const PLAYLIST_ID = '0FM7kVe0ByicC44ACzvWbY';

interface SpotifyController {
  play: () => void;
  pause: () => void;
  nextTrack: () => void;
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
let _shuffleDone = false;

type BannerInfo = { title: string; artist: string; ts: number };
let _lastBanner: BannerInfo | null = null;

const _renderSubscribers: Set<() => void> = new Set();
const _bannerSubscribers: Set<(b: BannerInfo) => void> = new Set();

function notifyRender() {
  _renderSubscribers.forEach(fn => fn());
}
function notifyBanner(b: BannerInfo) {
  _bannerSubscribers.forEach(fn => fn(b));
}

function getOrCreateIframeEl(): HTMLDivElement {
  if (!_iframeEl) {
    _iframeEl = document.createElement('div');
    _iframeEl.id = 'spotify-singleton-embed';
    // Keep off-screen but in DOM so the embed can load and play audio
    _iframeEl.style.cssText =
      'position:fixed;left:-9999px;top:0;width:320px;height:80px;opacity:0.01;pointer-events:none;';
    document.body.appendChild(_iframeEl);
  }
  return _iframeEl;
}

function ensureSpotifyApi() {
  if (document.getElementById('spotify-iframe-api')) return;
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

          // New track started playing
          if (uri && uri !== _currentTrackUri && !isPaused) {
            _currentTrackUri = uri;
            if (title && artist && !_disabled) {
              const banner: BannerInfo = { title, artist, ts: Date.now() };
              _lastBanner = banner;
              notifyBanner(banner);
            }
          }
        });

        notifyRender();
      }
    );
  };
}

async function doShuffle(ctrl: SpotifyController) {
  if (_shuffleDone) return;
  _shuffleDone = true;
  const skips = Math.floor(Math.random() * 12); // skip 0–11 tracks
  for (let i = 0; i < skips; i++) {
    ctrl.nextTrack();
    await new Promise(r => setTimeout(r, 400));
  }
}
// ─────────────────────────────────────────────────────────────────────────────

interface SpotifyPlayerProps {
  disabled?: boolean;
}

export function SpotifyPlayer({ disabled = false }: SpotifyPlayerProps) {
  const [, forceUpdate] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [banner, setBanner] = useState<BannerInfo | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const embedContainerRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => forceUpdate(n => n + 1), []);

  // Subscribe to render signals and start the API
  useEffect(() => {
    _renderSubscribers.add(refresh);
    ensureSpotifyApi();
    return () => {
      _renderSubscribers.delete(refresh);
    };
  }, [refresh]);

  // Subscribe to banner events
  useEffect(() => {
    const onBanner = (b: BannerInfo) => {
      setBanner(b);
      setBannerVisible(true);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      bannerTimer.current = setTimeout(() => setBannerVisible(false), 5500);
    };
    _bannerSubscribers.add(onBanner);
    return () => {
      _bannerSubscribers.delete(onBanner);
    };
  }, []);

  // Sync disabled state with singleton
  useEffect(() => {
    _disabled = disabled;
    const ctrl = _controller;
    if (!ctrl) return;
    if (disabled) {
      ctrl.pause();
    } else {
      if (_started) ctrl.play();
    }
  }, [disabled]);

  // Move the singleton iframe into/out-of the visible container on expand/collapse
  useEffect(() => {
    const iframe = _iframeEl;
    if (!iframe) return;

    if (expanded) {
      const container = embedContainerRef.current;
      if (container) {
        iframe.style.cssText = 'position:relative;width:100%;height:80px;opacity:1;pointer-events:auto;';
        container.appendChild(iframe);
      }
    } else {
      // Return iframe to body, hidden off-screen
      document.body.appendChild(iframe);
      iframe.style.cssText =
        'position:fixed;left:-9999px;top:0;width:320px;height:80px;opacity:0.01;pointer-events:none;';
    }
  }, [expanded]);

  const handleStart = () => {
    const ctrl = _controller;
    if (!ctrl) return;
    ctrl.play();
    _started = true;
    forceUpdate(n => n + 1);
    doShuffle(ctrl);
  };

  const handleToggleExpand = () => setExpanded(e => !e);
  const handlePauseResume = () => {
    const ctrl = _controller;
    if (!ctrl) return;
    if (_started) {
      // toggle: we don't track paused state separately, rely on Spotify embed UI
      ctrl.play();
    }
  };

  const showStartButton = !_started && !disabled;
  const showWidget = _started && !disabled;

  return ReactDOM.createPortal(
    <>
      {/* ── "Avvia musica" button (before first play) ── */}
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
            gap: '0.5rem',
            background: 'rgba(0,0,0,0.80)',
            border: '1px solid rgba(29,185,84,0.5)',
            borderRadius: '2rem',
            padding: '0.5rem 1rem',
            color: '#1DB954',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
          }}
        >
          <SpotifyIcon />
          Avvia musica
        </button>
      )}

      {/* ── Mini-player widget (after first play, not disabled) ── */}
      {showWidget && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.25rem',
            right: '1.25rem',
            zIndex: 9998,
            width: expanded ? '320px' : 'auto',
            background: 'rgba(10,10,10,0.90)',
            border: '1px solid rgba(29,185,84,0.35)',
            borderRadius: '14px',
            backdropFilter: 'blur(16px)',
            overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            transition: 'width 0.3s ease',
          }}
        >
          {/* Collapsed bar: icon + track name + expand toggle */}
          <div
            onClick={handleToggleExpand}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.45rem 0.75rem',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <SpotifyIcon />
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              {banner ? (
                <>
                  <div style={{ color: '#fff', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {banner.title}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {banner.artist}
                  </div>
                </>
              ) : (
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>In riproduzione…</div>
              )}
            </div>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', marginLeft: '0.25rem' }}>
              {expanded ? '▼' : '▲'}
            </span>
          </div>

          {/* Embed container — only visible when expanded */}
          {expanded && (
            <div
              ref={embedContainerRef}
              style={{ width: '100%', height: '80px' }}
            />
          )}
        </div>
      )}

      {/* ── Track change banner (bottom-left slide-in) ── */}
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

function SpotifyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="#1DB954" style={{ flexShrink: 0 }}>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}
