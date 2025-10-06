import React, { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Play, Pause, Volume2, VolumeX, Music } from "lucide-react";
import { socket } from "../lib/socket";
import { useGameState } from "../lib/stores/useGameState";

interface MusicPlayerProps {
  isOpen: boolean;
  onClose: () => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const YOUTUBE_PLAYLIST_ID = "PL7127269AE81ABA2A";

export const MusicPlayer: React.FC<MusicPlayerProps> = ({ isOpen, onClose }) => {
  const playerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const { playerName, gameId } = useGameState();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      console.log('🎵 YouTube IFrame API ready');
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '0',
        width: '0',
        playerVars: {
          listType: 'playlist',
          list: YOUTUBE_PLAYLIST_ID,
          autoplay: 0,
          controls: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event: any) => {
            console.log('🎵 YouTube player ready');
            setIsPlayerReady(true);
            event.target.setVolume(volume);
          },
          onStateChange: (event: any) => {
            console.log('🎵 YouTube player state:', event.data);
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              setDuration(event.target.getDuration());
              if (!intervalRef.current) {
                intervalRef.current = setInterval(() => {
                  if (playerRef.current && playerRef.current.getCurrentTime) {
                    setCurrentTime(playerRef.current.getCurrentTime());
                  }
                }, 100);
              }
            } else if (event.data === window.YT.PlayerState.PAUSED || 
                       event.data === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
            }
          },
        },
      });
    };

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    socket.on('music-control', (data: {
      action: 'play' | 'pause' | 'seek';
      time?: number;
    }) => {
      console.log('🎵 Received music control:', data);
      
      if (!playerRef.current || !isPlayerReady) return;

      if (data.action === 'play') {
        if (data.time !== undefined) {
          playerRef.current.seekTo(data.time, true);
        }
        playerRef.current.playVideo();
      } else if (data.action === 'pause') {
        playerRef.current.pauseVideo();
      } else if (data.action === 'seek' && data.time !== undefined) {
        playerRef.current.seekTo(data.time, true);
      }
    });

    return () => {
      socket.off('music-control');
    };
  }, [isPlayerReady]);

  useEffect(() => {
    if (playerRef.current && isPlayerReady) {
      playerRef.current.setVolume(isMuted ? 0 : volume);
    }
  }, [volume, isMuted, isPlayerReady]);

  const handlePlayPause = () => {
    if (!playerRef.current || !isPlayerReady) return;

    if (isPlaying) {
      socket.emit('music-action', {
        gameId,
        playerName,
        action: 'pause'
      });
    } else {
      socket.emit('music-action', {
        gameId,
        playerName,
        action: 'play',
        time: playerRef.current.getCurrentTime()
      });
    }
  };

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    if (playerRef.current && isPlayerReady) {
      socket.emit('music-action', {
        gameId,
        playerName,
        action: 'seek',
        time: newTime
      });
    }
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <div id="youtube-player" style={{ display: 'none' }}></div>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-[100]"
            onClick={onClose}
          />
          
          <div 
            className="fixed bottom-16 landscape:bottom-20 md:bottom-20 left-2 landscape:left-4 md:left-4 bg-gray-900 rounded-lg shadow-2xl border-2 border-purple-600 p-4 z-[101] w-80"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Music className="w-5 h-5 text-purple-400" />
                <h3 className="text-white font-bold text-lg">Music Player</h3>
              </div>
              <Button
                onClick={onClose}
                className="bg-gray-700 hover:bg-gray-600 text-white p-1 h-auto rounded"
              >
                ✕
              </Button>
            </div>

            <div className="mb-3">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={0.1}
                onValueChange={handleSeek}
                className="w-full"
                disabled={!isPlayerReady}
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <Button
                onClick={handlePlayPause}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-3"
                disabled={!isPlayerReady}
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </Button>

              <div className="flex items-center gap-2 flex-1">
                <Button
                  onClick={toggleMute}
                  className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={100}
                  step={1}
                  onValueChange={handleVolumeChange}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="text-xs text-gray-400 text-center">
              {isPlayerReady ? "🎵 YouTube Music synchronized across all players" : "⏳ Loading YouTube player..."}
            </div>
          </div>
        </>
      )}
    </>
  );
};
