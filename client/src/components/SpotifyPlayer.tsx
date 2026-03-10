import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';

const PLAYLIST_ID = 'PLX6i-6a7orEU-L1GdfUDtepT-pW4tYl4j';
const PLAYER_DIV_ID = 'mink-yt-player';
const FADE_MS = 1000;
const FADE_STEPS = 25;
const FADE_TICK = FADE_MS / FADE_STEPS; // 40ms per step

interface BannerInfo { title: string; artist: string; }

interface MinkYTState {
  player: any;
  volume: number;           // desired volume 0-100
  currentVideoId: string | null;
  fadeTimer: ReturnType<typeof setInterval> | null;
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
    window.__minkYT = {
      player: null, volume: 80, currentVideoId: null,
      fadeTimer: null, bannerSubs: new Set(),
    };
  }
  return window.__minkYT;
}

// ── Hidden off-screen div for the YT player ───────────────────────────────
function getPlayerDiv(): HTMLDivElement {
  let el = document.getElementById(PLAYER_DIV_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = PLAYER_DIV_ID;
    Object.assign(el.style, {
      position: 'fixed', left: '-9999px', top: '-9999px',
      width: '1px', height: '1px', overflow: 'hidden', pointerEvents: 'none',
    });
    document.body.appendChild(el);
  }
  return el;
}

// ── Volume fades ──────────────────────────────────────────────────────────
function clearFade() {
  const st = gs();
  if (st.fadeTimer) { clearInterval(st.fadeTimer); st.fadeTimer = null; }
}

function fadeOut() {
  const st = gs();
  if (!st.player) return;
  clearFade();
  const savedVol = st.volume;
  const dec = savedVol / FADE_STEPS;
  let vol = savedVol;
  st.fadeTimer = setInterval(() => {
    vol = Math.max(0, vol - dec);
    try { st.player.setVolume(Math.round(vol)); } catch { /* player gone */ }
    if (vol <= 0) {
      clearFade();
      try { st.player.pauseVideo(); st.player.setVolume(savedVol); } catch {}
    }
  }, FADE_TICK);
}

function fadeIn() {
  const st = gs();
  if (!st.player) return;
  clearFade();
  const targetVol = st.volume;
  try { st.player.setVolume(0); st.player.playVideo(); } catch { return; }
  let vol = 0;
  const inc = targetVol / FADE_STEPS;
  st.fadeTimer = setInterval(() => {
    vol = Math.min(targetVol, vol + inc);
    try { st.player.setVolume(Math.round(vol)); } catch {}
    if (vol >= targetVol) clearFade();
  }, FADE_TICK);
}

// ── YT Iframe Player init ─────────────────────────────────────────────────
function buildYTPlayer() {
  const st = gs();
  if (st.player) return;

  const container = document.createElement('div');
  getPlayerDiv().appendChild(container);

  st.player = new window.YT.Player(container, {
    height: '1', width: '1',
    playerVars: {
      listType: 'playlist',
      list: PLAYLIST_ID,
      controls: 0,
      fs: 0,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      origin: window.location.origin,
    },
    events: {
      onReady: (e: any) => {
        e.target.setVolume(gs().volume);
        e.target.setShuffle(true);
        setTimeout(() => {
          const playlist: string[] | null = e.target.getPlaylist();
          const size = playlist?.length ?? 50;
          const randomIndex = Math.floor(Math.random() * size);
          console.log(`[YT] player ready — starting at index ${randomIndex}/${size}`);
          e.target.playVideoAt(randomIndex);
        }, 800);
      },
      onStateChange: (e: any) => {
        if (e.data === window.YT.PlayerState.ENDED) {
          const playlist: string[] | null = e.target.getPlaylist();
          const size = playlist?.length ?? 50;
          const currentIndex: number = e.target.getPlaylistIndex() ?? 0;
          let nextIndex: number;
          do { nextIndex = Math.floor(Math.random() * size); }
          while (nextIndex === currentIndex && size > 1);
          console.log(`[YT] track ended — jumping to random index ${nextIndex}/${size}`);
          try { e.target.playVideoAt(nextIndex); } catch {}
        }
        if (e.data === window.YT.PlayerState.PLAYING) {
          const data = e.target.getVideoData();
          const videoId: string = data?.video_id ?? '';
          const title: string = data?.title ?? '';
          const artist: string = data?.author ?? '';
          console.log('[YT] now playing:', title);
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
  if (window.YT && window.YT.Player) { buildYTPlayer(); return; }
  if (document.getElementById('yt-iframe-api')) return;
  const sc = document.createElement('script');
  sc.id = 'yt-iframe-api';
  sc.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(sc);
  window.onYouTubeIframeAPIReady = () => {
    console.log('[YT] API ready');
    buildYTPlayer();
  };
}

// ── Icons ─────────────────────────────────────────────────────────────────
function VolumeIcon({ vol }: { vol: number }) {
  if (vol === 0) return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
    </svg>
  );
  if (vol < 50) return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
    </svg>
  );
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#FF0000" style={{ flexShrink: 0 }}>
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────
export function SpotifyPlayer({ disabled = false }: { disabled?: boolean }) {
  const [volume, setVolume] = useState<number>(() => gs().volume);
  const [sliderOpen, setSliderOpen] = useState(false);
  const [banner, setBanner] = useState<BannerInfo | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mount: init or resume; Unmount: fade out (dissolvenza 1s)
  useEffect(() => {
    const st = gs();
    if (st.player) {
      // Returning from game → fade in
      fadeIn();
    } else {
      // First load → create player (autoplay in onReady)
      initYT();
    }
    return () => {
      // Leaving to game → smooth fade out
      fadeOut();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Banner subscription
  useEffect(() => {
    const cb = (b: BannerInfo) => {
      setBanner(b);
      setBannerVisible(true);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      bannerTimer.current = setTimeout(() => setBannerVisible(false), 5000);
    };
    gs().bannerSubs.add(cb);
    return () => { gs().bannerSubs.delete(cb); };
  }, []);

  const handleVolume = (v: number) => {
    clearFade();
    gs().volume = v;
    setVolume(v);
    try { gs().player?.setVolume(v); } catch {}
  };

  const openSlider = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setSliderOpen(true);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setSliderOpen(false), 1200);
  };

  return ReactDOM.createPortal(
    <>
      {/* Volume button — always visible (music plays automatically) */}
      {!disabled && (
        <div
          style={{
            position: 'fixed', bottom: '1.25rem', right: '0',
            zIndex: 100000, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
            pointerEvents: 'none',
          }}
        >
          {/* Slider panel */}
          <div
            onMouseEnter={openSlider}
            onMouseLeave={scheduleClose}
            style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: 'rgba(0,0,0,0.88)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '2rem', padding: '0.75rem 0.6rem',
            backdropFilter: 'blur(14px)', boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
            opacity: sliderOpen ? 1 : 0,
            transform: sliderOpen ? 'translateY(0)' : 'translateY(6px)',
            pointerEvents: sliderOpen ? 'auto' : 'none',
          }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.58rem', marginBottom: '0.3rem' }}>
              {volume}%
            </span>
            <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <input
                type="range" min={0} max={100} value={volume}
                onChange={e => handleVolume(Number(e.target.value))}
                style={{
                  transform: 'rotate(-90deg)',
                  width: '76px',
                  cursor: 'pointer',
                  accentColor: '#FF0000',
                }}
              />
            </div>
          </div>

          {/* Volume icon button — also kicks off playback if autoplay was blocked */}
          <button
            onMouseEnter={openSlider}
            onMouseLeave={scheduleClose}
            onClick={() => {
              setSliderOpen(v => !v);
              const st = gs();
              if (st.player) {
                const state: number = st.player.getPlayerState?.() ?? -1;
                if (state === 0) {
                  // ended → jump to a new random track
                  clearFade();
                  st.player.setVolume(st.volume);
                  const pl: string[] | null = st.player.getPlaylist?.() ?? null;
                  const sz = pl?.length ?? 50;
                  const cur: number = st.player.getPlaylistIndex?.() ?? 0;
                  let nx: number;
                  do { nx = Math.floor(Math.random() * sz); } while (nx === cur && sz > 1);
                  st.player.playVideoAt(nx);
                } else if ([-1, 2, 5].includes(state)) {
                  // unstarted / paused / cued → resume current track
                  clearFade();
                  st.player.setVolume(st.volume);
                  st.player.playVideo();
                }
              }
            }}
            title="Volume musica"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '2.2rem', height: '2.2rem',
              background: 'rgba(0,0,0,0.82)', border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: '50%', color: '#fff',
              cursor: 'pointer', backdropFilter: 'blur(12px)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
              pointerEvents: 'auto',
            }}
          >
            <VolumeIcon vol={volume} />
          </button>
        </div>
      )}

      {/* Banner — bottom left, slide in on track change */}
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
        <NoteIcon />
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
