import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';

const PLAYLIST_ID = '0FM7kVe0ByicC44ACzvWbY';

interface BannerInfo { title: string; artist: string; }
interface MinkState {
  controller: any;
  started: boolean;
  currentTrackUri: string | null;
  bannerSubs: Set<(b: BannerInfo) => void>;
}

declare global { interface Window { __minkS?: MinkState; SpotifyIframeApi?: any; onSpotifyIframeApiReady?: (api: any) => void; } }

function gs(): MinkState {
  if (!window.__minkS) {
    window.__minkS = { controller: null, started: false, currentTrackUri: null, bannerSubs: new Set() };
  }
  return window.__minkS;
}

function getEmbed(): HTMLDivElement {
  let el = document.getElementById('mink-spe') as HTMLDivElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = 'mink-spe';
    Object.assign(el.style, {
      position: 'fixed', bottom: '1.25rem', right: '1.25rem',
      width: '320px', height: '152px', zIndex: '99999',
      borderRadius: '12px', overflow: 'hidden',
      opacity: '0', pointerEvents: 'none',
      transition: 'opacity 0.4s ease, transform 0.35s ease',
      transform: 'translateY(10px)',
      boxShadow: '0 6px 28px rgba(0,0,0,0.7)',
    });
    document.body.appendChild(el);
  }
  return el;
}

function showEmbed() {
  const el = getEmbed();
  el.style.opacity = '1';
  el.style.pointerEvents = 'auto';
  el.style.transform = 'translateY(0)';
}

function initSpotify() {
  const st = gs();
  if (st.controller) { if (st.started) showEmbed(); return; }

  const el = getEmbed();

  function build(API: any) {
    if (gs().controller) return;
    console.log('[Spotify] createController...');
    API.createController(
      el,
      { uri: `spotify:playlist:${PLAYLIST_ID}`, height: 152 },
      (ctrl: any) => {
        console.log('[Spotify] controller ready');
        gs().controller = ctrl;
        ctrl.play();

        ctrl.addListener('playback_update', (e: any) => {
          const d = e?.data ?? e;
          const paused: boolean = d?.isPaused ?? true;
          const uri: string = d?.track?.uri ?? '';
          const title: string = d?.track?.name ?? 'Spotify';
          const artist: string = d?.track?.artists?.[0]?.name ?? '';
          console.log('[Spotify] playback_update paused=%s title=%s', paused, title);
          if (!paused && uri && uri !== gs().currentTrackUri) {
            gs().currentTrackUri = uri;
            gs().bannerSubs.forEach(fn => fn({ title, artist }));
          }
        });
      }
    );
  }

  if (document.getElementById('spotify-iframe-api')) {
    if (window.SpotifyIframeApi) build(window.SpotifyIframeApi);
    return;
  }
  const sc = document.createElement('script');
  sc.id = 'spotify-iframe-api';
  sc.src = 'https://open.spotify.com/embed/iframe-api/v1';
  sc.async = true;
  document.head.appendChild(sc);
  window.onSpotifyIframeApiReady = (API: any) => {
    window.SpotifyIframeApi = API;
    build(API);
  };
}

function SpotifyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#1DB954" style={{ flexShrink: 0 }}>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

export function SpotifyPlayer({ disabled = false }: { disabled?: boolean }) {
  const [started, setStarted] = useState<boolean>(() => gs().started);
  const [banner, setBanner] = useState<BannerInfo | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    initSpotify();
  }, []);

  useEffect(() => {
    if (started && !disabled) showEmbed();
  }, [started, disabled]);

  useEffect(() => {
    const cb = (b: BannerInfo) => {
      setBanner(b);
      setBannerVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setBannerVisible(false), 5000);
    };
    gs().bannerSubs.add(cb);
    return () => { gs().bannerSubs.delete(cb); };
  }, []);

  const handleStart = () => {
    gs().started = true;
    setStarted(true);
    showEmbed();
    const ctrl = gs().controller;
    if (ctrl) ctrl.play();
  };

  const showBtn = !started && !disabled;

  return ReactDOM.createPortal(
    <>
      {showBtn && (
        <button
          onClick={handleStart}
          style={{
            position: 'fixed', bottom: '1.25rem', right: '1.25rem',
            zIndex: 100000, display: 'flex', alignItems: 'center', gap: '0.45rem',
            background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(29,185,84,0.6)',
            borderRadius: '2rem', padding: '0.5rem 1rem',
            color: '#1DB954', fontSize: '0.8rem', fontWeight: 700,
            cursor: 'pointer', backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          <SpotifyIcon /> Avvia musica
        </button>
      )}

      <div
        style={{
          position: 'fixed', bottom: '1.25rem', left: '1.25rem', zIndex: 99999,
          maxWidth: '260px',
          background: 'rgba(0,0,0,0.88)', border: '1px solid rgba(29,185,84,0.4)',
          borderRadius: '12px', padding: '0.6rem 0.85rem',
          backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', gap: '0.6rem',
          transition: 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease',
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
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.67rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {banner?.artist}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
