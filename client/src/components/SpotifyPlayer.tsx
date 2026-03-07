import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';

const PLAYLIST_ID = 'PLX6i-6a7orEU-L1GdfUDtepT-pW4tYl4j';
const PLAYER_DIV_ID = 'mink-yt-player';

interface BannerInfo { title: string; artist: string; }
interface MinkYTState {
  player: any;
  started: boolean;
  currentVideoId: string | null;
  bannerSubs: Set<(b: BannerInfo) => void>;
}

declare global {
  interface Window {
    __minkYT?: MinkYTState;
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function gs(): MinkYTState {
  if (!window.__minkYT) {
    window.__minkYT = { player: null, started: false, currentVideoId: null, bannerSubs: new Set() };
  }
  return window.__minkYT;
}

function getPlayerDiv(): HTMLDivElement {
  let el = document.getElementById(PLAYER_DIV_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = PLAYER_DIV_ID;
    Object.assign(el.style, {
      position: 'fixed',
      bottom: '1.25rem',
      right: '1.25rem',
      width: '320px',
      height: '80px',
      zIndex: '99999',
      borderRadius: '12px',
      overflow: 'hidden',
      opacity: '0',
      pointerEvents: 'none',
      transition: 'opacity 0.4s ease, transform 0.35s ease',
      transform: 'translateY(10px)',
      boxShadow: '0 6px 28px rgba(0,0,0,0.7)',
    });
    document.body.appendChild(el);
  }
  return el;
}

function showPlayer() {
  const el = getPlayerDiv();
  el.style.opacity = '1';
  el.style.pointerEvents = 'auto';
  el.style.transform = 'translateY(0)';
}

function hidePlayer() {
  const el = getPlayerDiv();
  el.style.opacity = '0';
  el.style.pointerEvents = 'none';
  el.style.transform = 'translateY(10px)';
}

function buildYTPlayer() {
  const st = gs();
  if (st.player) return;

  const container = document.createElement('div');
  getPlayerDiv().appendChild(container);

  st.player = new window.YT.Player(container, {
    height: '80',
    width: '320',
    playerVars: {
      listType: 'playlist',
      list: PLAYLIST_ID,
      autoplay: 1,
      controls: 1,
      fs: 0,
      modestbranding: 1,
      rel: 0,
      shuffle: 1,
      origin: window.location.origin,
    },
    events: {
      onReady: (e: any) => {
        console.log('[YT] player ready');
        e.target.setShuffle(true);
        if (gs().started) {
          e.target.playVideo();
          showPlayer();
        }
      },
      onStateChange: (e: any) => {
        if (e.data === window.YT.PlayerState.PLAYING) {
          const data = e.target.getVideoData();
          const videoId: string = data?.video_id ?? '';
          const title: string = data?.title ?? '';
          const artist: string = data?.author ?? '';
          console.log('[YT] playing:', title, '|', artist);
          if (videoId && videoId !== gs().currentVideoId) {
            gs().currentVideoId = videoId;
            gs().bannerSubs.forEach(fn => fn({ title, artist }));
          }
        }
      },
    },
  });
}

function initYT() {
  getPlayerDiv();
  if (window.YT && window.YT.Player) {
    buildYTPlayer();
    return;
  }
  if (document.getElementById('yt-iframe-api')) return;
  const sc = document.createElement('script');
  sc.id = 'yt-iframe-api';
  sc.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(sc);
  window.onYouTubeIframeAPIReady = () => {
    console.log('[YT] IFrame API ready');
    buildYTPlayer();
  };
}

function MusicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#FF0000" style={{ flexShrink: 0 }}>
      <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
    </svg>
  );
}

export function SpotifyPlayer({ disabled = false }: { disabled?: boolean }) {
  const [started, setStarted] = useState<boolean>(() => gs().started);
  const [banner, setBanner] = useState<BannerInfo | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    initYT();
  }, []);

  useEffect(() => {
    if (disabled) {
      hidePlayer();
      gs().player?.pauseVideo?.();
    } else if (started) {
      showPlayer();
      gs().player?.playVideo?.();
    }
  }, [disabled, started]);

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
    showPlayer();
    const p = gs().player;
    if (p) {
      p.playVideo?.();
    } else {
      initYT();
    }
  };

  const showBtn = !started && !disabled;

  return ReactDOM.createPortal(
    <>
      {showBtn && (
        <button
          onClick={handleStart}
          style={{
            position: 'fixed', bottom: '1.25rem', right: '1.25rem',
            zIndex: 100000, display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,0,0,0.5)',
            borderRadius: '2rem', padding: '0.5rem 1.1rem',
            color: '#fff', fontSize: '0.8rem', fontWeight: 700,
            cursor: 'pointer', backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          <MusicIcon /> Avvia musica
        </button>
      )}

      <div
        style={{
          position: 'fixed', bottom: '1.25rem', left: '1.25rem', zIndex: 99999,
          maxWidth: '270px',
          background: 'rgba(0,0,0,0.88)', border: '1px solid rgba(255,0,0,0.35)',
          borderRadius: '12px', padding: '0.6rem 0.85rem',
          backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', gap: '0.6rem',
          transition: 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease',
          transform: bannerVisible && !disabled ? 'translateX(0)' : 'translateX(-130%)',
          opacity: bannerVisible && !disabled ? 1 : 0,
          pointerEvents: 'none',
        }}
      >
        <MusicIcon />
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
