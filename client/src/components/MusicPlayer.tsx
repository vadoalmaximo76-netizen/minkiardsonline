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

// Local audio files
const MUSIC_TRACKS = [
  "/audio/dbz-music-part1.mp3",
  "/audio/dbz-music-part2.mp3"
];

export const MusicPlayer: React.FC<MusicPlayerProps> = ({ isOpen, onClose }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTrack, setCurrentTrack] = useState<string>("");
  const { playerName, gameId } = useGameState();
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    // Listen for music control events from server
    socket.on('music-control', (data: {
      action: 'play' | 'pause' | 'seek' | 'load';
      trackUrl?: string;
      time?: number;
      volume?: number;
    }) => {
      console.log('🎵 Received music control:', data);
      
      if (data.action === 'load' && data.trackUrl && audioRef.current) {
        console.log('🎵 Loading track:', data.trackUrl);
        setCurrentTrack(data.trackUrl);
        audioRef.current.src = data.trackUrl;
        audioRef.current.load();
      } else if (data.action === 'play' && audioRef.current) {
        console.log('🎵 Playing music');
        if (data.time !== undefined) {
          audioRef.current.currentTime = data.time;
        }
        audioRef.current.play().catch(e => console.error('Play error:', e));
        setIsPlaying(true);
      } else if (data.action === 'pause' && audioRef.current) {
        console.log('🎵 Pausing music');
        audioRef.current.pause();
        setIsPlaying(false);
      } else if (data.action === 'seek' && data.time !== undefined && audioRef.current) {
        console.log('🎵 Seeking to:', data.time);
        audioRef.current.currentTime = data.time;
      }
    });

    return () => {
      socket.off('music-control');
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      console.log('🎵 Audio duration loaded:', audio.duration);
      setDuration(audio.duration);
    };
    const handleEnded = () => {
      console.log('🎵 Audio ended');
      setIsPlaying(false);
    };
    const handleError = (e: Event) => {
      console.error('🎵 Audio error:', e);
      const audioElement = e.target as HTMLAudioElement;
      if (audioElement.error) {
        console.error('🎵 Audio error code:', audioElement.error.code);
        console.error('🎵 Audio error message:', audioElement.error.message);
      }
    };
    const handleCanPlay = () => {
      console.log('🎵 Audio can play');
    };
    const handleLoadStart = () => {
      console.log('🎵 Audio load started');
    };
    const handleLoadedData = () => {
      console.log('🎵 Audio data loaded');
    };
    
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('loadeddata', handleLoadedData);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('loadeddata', handleLoadedData);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      // Pause
      socket.emit('music-action', {
        gameId,
        playerName,
        action: 'pause'
      });
    } else {
      // Play - if no track loaded, pick random one
      if (!currentTrack) {
        const randomTrack = MUSIC_TRACKS[Math.floor(Math.random() * MUSIC_TRACKS.length)];
        console.log('🎵 Selected random track:', randomTrack);
        socket.emit('music-action', {
          gameId,
          playerName,
          action: 'load',
          trackUrl: randomTrack
        });
        // Wait a bit for load, then play
        setTimeout(() => {
          socket.emit('music-action', {
            gameId,
            playerName,
            action: 'play',
            time: 0
          });
        }, 500);
      } else {
        socket.emit('music-action', {
          gameId,
          playerName,
          action: 'play',
          time: audioRef.current.currentTime
        });
      }
    }
  };

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    if (audioRef.current) {
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
      {/* Audio element - always exists even when panel is closed */}
      <audio ref={audioRef} />
      
      {/* Only show UI when isOpen is true */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-[100]"
            onClick={onClose}
          />
          
          {/* Music Player Panel */}
          <div 
            className="fixed bottom-16 landscape:bottom-20 md:bottom-20 left-2 landscape:left-4 md:left-4 bg-gray-900 rounded-lg shadow-2xl border-2 border-purple-600 p-4 z-[101] w-80"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
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

            {/* Progress Bar */}
            <div className="mb-3">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={0.1}
                onValueChange={handleSeek}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 mb-3">
              {/* Play/Pause */}
              <Button
                onClick={handlePlayPause}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-3"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </Button>

              {/* Volume Control */}
              <div className="flex items-center gap-2 flex-1">
                <Button
                  onClick={toggleMute}
                  className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.01}
                  onValueChange={handleVolumeChange}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Info */}
            <div className="text-xs text-gray-400 text-center">
              {currentTrack ? "🎵 Music synchronized across all players" : "Click Play to start random track"}
            </div>
          </div>
        </>
      )}
    </>
  );
};
