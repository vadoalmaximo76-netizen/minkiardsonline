import React, { useEffect, useRef, useState, useCallback } from 'react';

const DEFAULT_PLAYLIST_ID = '37i9dQZF1DX4jP4eebSWR9';

interface SpotifyPlayerProps {
  disabled?: boolean;
  playlistId?: string;
}

interface SpotifyController {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setVolume: (vol: number) => void;
  nextTrack: () => void;
  addListener: (event: string, cb: (data: any) => void) => void;
  destroy: () => void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (IFrameAPI: any) => void;
    SpotifyIframeApiReadyCallback?: (IFrameAPI: any) => void;
  }
}

export function SpotifyPlayer({ disabled = false, playlistId }: SpotifyPlayerProps) {
  const PLAYLIST_ID = playlistId || DEFAULT_PLAYLIST_ID;
  const embedRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SpotifyController | null>(null);
  const volumeRef = useRef(60);
  const [volume, setVolume] = useState(60);
  const [started, setStarted] = useState(false);
  const [showStartButton, setShowStartButton] = useState(true);
  const [nowPlaying, setNowPlaying] = useState<{ title: string; artist: string } | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTrackRef = useRef<string | null>(null);
  const disabledRef = useRef(disabled);
  const apiReadyRef = useRef(false);

  disabledRef.current = disabled;

  const showBanner = useCallback((title: string, artist: string) => {
    setNowPlaying({ title, artist });
    setBannerVisible(true);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => setBannerVisible(false), 5000);
  }, []);

  const initPlayer = useCallback((IFrameAPI: any) => {
    if (!embedRef.current || controllerRef.current) return;

    const options = {
      uri: `spotify:playlist:${PLAYLIST_ID}`,
      height: 80,
    };

    IFrameAPI.createController(embedRef.current, options, (controller: SpotifyController) => {
      controllerRef.current = controller;

      controller.addListener('playback_update', (data: any) => {
        const isPaused = data?.data?.isPaused;
        const uri = data?.data?.track?.uri;
        const title = data?.data?.track?.name;
        const artist = data?.data?.track?.artists?.[0]?.name;

        if (uri && uri !== currentTrackRef.current) {
          currentTrackRef.current = uri;
          if (title && artist && !disabledRef.current) {
            showBanner(title, artist);
          }
        }

        if (!isPaused && !disabledRef.current) {
          setStarted(true);
          setShowStartButton(false);
        }
      });

      controller.setVolume(volumeRef.current / 100);
    });
  }, [PLAYLIST_ID, showBanner]);

  useEffect(() => {
    if (apiReadyRef.current) return;

    const existingScript = document.getElementById('spotify-iframe-api');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'spotify-iframe-api';
      script.src = 'https://open.spotify.com/embed/iframe-api/v1';
      script.async = true;
      document.head.appendChild(script);
    }

    window.onSpotifyIframeApiReady = (IFrameAPI: any) => {
      apiReadyRef.current = true;
      initPlayer(IFrameAPI);
    };

    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, [initPlayer]);

  useEffect(() => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    if (disabled) {
      ctrl.setVolume(0);
      ctrl.pause();
    } else {
      ctrl.setVolume(volumeRef.current / 100);
      if (started) ctrl.play();
    }
  }, [disabled, started]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setVolume(val);
    volumeRef.current = val;
    const ctrl = controllerRef.current;
    if (ctrl && !disabledRef.current) {
      ctrl.setVolume(val / 100);
    }
  };

  const handleStartClick = () => {
    const ctrl = controllerRef.current;
    if (ctrl) {
      ctrl.play();
      setStarted(true);
      setShowStartButton(false);
    }
  };

  return (
    <>
      <div
        ref={embedRef}
        style={{ position: 'fixed', left: '-9999px', top: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        aria-hidden="true"
      />

      {!disabled && showStartButton && (
        <button
          onClick={handleStartClick}
          style={{
            position: 'fixed',
            bottom: '1.25rem',
            left: '1.25rem',
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(0,0,0,0.75)',
            border: '1px solid rgba(29,185,84,0.5)',
            borderRadius: '2rem',
            padding: '0.5rem 1rem',
            color: '#1DB954',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s',
          }}
          title="Avvia musica di sottofondo"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#1DB954">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          Avvia musica
        </button>
      )}

      {!disabled && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.25rem',
            right: '1.25rem',
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(0,0,0,0.70)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '2rem',
            padding: '0.4rem 0.8rem',
            backdropFilter: 'blur(10px)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={handleVolumeChange}
            style={{
              width: '70px',
              accentColor: '#1DB954',
              cursor: 'pointer',
            }}
            title={`Volume: ${volume}%`}
          />
        </div>
      )}

      <div
        style={{
          position: 'fixed',
          bottom: '1.25rem',
          left: '1.25rem',
          zIndex: 9999,
          maxWidth: '280px',
          background: 'rgba(0,0,0,0.85)',
          border: '1px solid rgba(29,185,84,0.4)',
          borderRadius: '12px',
          padding: '0.65rem 0.9rem',
          backdropFilter: 'blur(14px)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease',
          transform: bannerVisible && !disabled ? 'translateX(0)' : 'translateX(-120%)',
          opacity: bannerVisible && !disabled ? 1 : 0,
          pointerEvents: 'none',
        }}
        aria-live="polite"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#1DB954" style={{ flexShrink: 0 }}>
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {nowPlaying?.title}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {nowPlaying?.artist}
          </div>
        </div>
      </div>
    </>
  );
}
