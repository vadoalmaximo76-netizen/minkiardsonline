import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface YouTubeVideoModalProps {
  youtubeUrl: string;
  cardName: string;
  playerName: string;
  onClose: () => void;
}

const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

export const YouTubeVideoModal: React.FC<YouTubeVideoModalProps> = ({
  youtubeUrl,
  cardName,
  playerName,
  onClose
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoId = extractVideoId(youtubeUrl);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      
      // If exiting fullscreen, close the modal
      if (!isNowFullscreen && isVisible) {
        console.log('📺 Exited fullscreen, closing modal');
        handleClose();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isVisible]);

  // Load YouTube IFrame API and create player
  useEffect(() => {
    if (!videoId) return;

    // Load YouTube IFrame API if not already loaded
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      if (containerRef.current && (window as any).YT?.Player) {
        playerRef.current = new (window as any).YT.Player(containerRef.current, {
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            rel: 0,
            modestbranding: 1,
            loop: 0,
            fs: 1
          },
          events: {
            onReady: (event: any) => {
              console.log('📺 YouTube player ready, requesting fullscreen');
              // Request fullscreen on the wrapper div
              if (wrapperRef.current) {
                try {
                  wrapperRef.current.requestFullscreen?.() ||
                  (wrapperRef.current as any).webkitRequestFullscreen?.() ||
                  (wrapperRef.current as any).mozRequestFullScreen?.() ||
                  (wrapperRef.current as any).msRequestFullscreen?.();
                  setIsFullscreen(true);
                } catch (err) {
                  console.log('📺 Fullscreen not available, playing in modal');
                }
              }
            },
            onStateChange: (event: any) => {
              // YT.PlayerState.ENDED = 0
              if (event.data === 0) {
                console.log('📺 YouTube video ended, closing modal');
                // Exit fullscreen first if active
                if (document.fullscreenElement) {
                  document.exitFullscreen?.();
                }
                handleClose();
              }
            }
          }
        });
      }
    };

    // Check if API is already loaded
    if ((window as any).YT?.Player) {
      initPlayer();
    } else {
      // Wait for API to load
      (window as any).onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      // Exit fullscreen on cleanup
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
      }
    };
  }, [videoId]);

  const handleClose = () => {
    setIsVisible(false);
    // Exit fullscreen if active
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    }
    if (playerRef.current?.destroy) {
      playerRef.current.destroy();
    }
    setTimeout(onClose, 300);
  };

  if (!videoId) {
    console.error('Invalid YouTube URL:', youtubeUrl);
    setTimeout(onClose, 1000);
    return null;
  }

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-all duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.95)' }}
    >
      <div 
        ref={wrapperRef}
        className={`relative bg-black overflow-hidden transition-transform duration-300 ${
          isVisible ? 'scale-100' : 'scale-75'
        } ${isFullscreen ? '' : 'rounded-2xl border-4 border-red-600'}`}
        style={{ 
          width: isFullscreen ? '100vw' : 'min(95vw, 1280px)',
          height: isFullscreen ? '100vh' : 'auto',
          maxHeight: '95vh'
        }}
      >
        {/* Header - only show when not fullscreen */}
        {!isFullscreen && (
          <div className="bg-gradient-to-r from-red-700 via-red-600 to-red-700 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
              <span className="text-white font-bold text-lg">
                {cardName}
              </span>
              <span className="text-red-200 text-sm">
                - giocata da {playerName}
              </span>
            </div>
            <button
              onClick={handleClose}
              className="p-2 bg-red-800 hover:bg-red-900 rounded-full transition-colors"
            >
              <X size={24} className="text-white" />
            </button>
          </div>
        )}

        {/* Video container */}
        <div 
          className="relative w-full" 
          style={{ 
            paddingBottom: isFullscreen ? '0' : '56.25%',
            height: isFullscreen ? '100%' : 'auto'
          }}
        >
          <div 
            ref={containerRef}
            className="absolute inset-0 w-full h-full"
          />
        </div>

        {/* Footer - only show when not fullscreen */}
        {!isFullscreen && (
          <div className="bg-gray-900 px-6 py-3 flex justify-center">
            <button
              onClick={handleClose}
              className="px-8 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
            >
              <X size={18} />
              CHIUDI VIDEO
            </button>
          </div>
        )}

        {/* Fullscreen close button */}
        {isFullscreen && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-50 p-3 bg-red-600/80 hover:bg-red-700 rounded-full transition-colors"
          >
            <X size={28} className="text-white" />
          </button>
        )}
      </div>
    </div>
  );
};
