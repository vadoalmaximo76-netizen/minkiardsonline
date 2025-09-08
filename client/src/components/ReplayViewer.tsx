import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Play, Pause, StepForward, StepBack, RotateCcw, X } from 'lucide-react';

interface ReplayViewerProps {
  matchId: number;
  onClose: () => void;
}

interface GameEvent {
  id: number;
  eventType: string;
  eventData: any;
  playerName: string;
  timestamp: string;
  eventOrder: number;
}

interface Match {
  id: number;
  gameId: string;
  players: string[];
  startedAt: string;
  endedAt?: string;
  winnerPlayer?: string;
  duration?: number;
}

export const ReplayViewer: React.FC<ReplayViewerProps> = ({ matchId, onClose }) => {
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [currentEventIndex, setCurrentEventIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReplayData();
  }, [matchId]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isPlaying && currentEventIndex < events.length - 1) {
      interval = setInterval(() => {
        setCurrentEventIndex(prev => {
          if (prev >= events.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, currentEventIndex, events.length, playbackSpeed]);

  const fetchReplayData = async () => {
    try {
      const response = await fetch(`/api/matches/${matchId}/replay`);
      if (response.ok) {
        const data = await response.json();
        setMatch(data.match);
        setEvents(data.events);
      } else {
        console.error('Failed to fetch replay data');
      }
    } catch (error) {
      console.error('Error fetching replay:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleStepForward = () => {
    if (currentEventIndex < events.length - 1) {
      setCurrentEventIndex(prev => prev + 1);
    }
  };

  const handleStepBack = () => {
    if (currentEventIndex > -1) {
      setCurrentEventIndex(prev => prev - 1);
    }
  };

  const handleReset = () => {
    setCurrentEventIndex(-1);
    setIsPlaying(false);
  };

  const formatEventDescription = (event: GameEvent): string => {
    const { eventType, eventData, playerName } = event;
    
    switch (eventType) {
      case 'player-join':
        return `${playerName} si è unito alla partita`;
      case 'pick-card':
        return `${playerName} ha pescato una carta ${eventData.cardType}`;
      case 'play-card':
        return `${playerName} ha giocato ${eventData.cardType}`;
      case 'transfer-card':
        return `${eventData.fromPlayer} ha ceduto una carta a ${eventData.toPlayer}`;
      case 'eliminate-personaggi':
        return `${playerName} ha eliminato un personaggio`;
      case 'return-to-hand':
        return `${playerName} ha rimesso una carta in mano`;
      default:
        return `${playerName}: ${eventType}`;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
            <p>Caricamento replay...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="text-white text-center">
            <p>Partita non trovata</p>
            <Button onClick={onClose} className="mt-4">
              Chiudi
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-white font-bold text-2xl">Replay Partita</h2>
            <p className="text-gray-300">
              {match.players.join(' vs ')} - {new Date(match.startedAt).toLocaleString('it-IT')}
            </p>
          </div>
          <Button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <X size={16} />
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(90vh-120px)]">
          {/* Game State Display */}
          <div className="lg:col-span-2 bg-gray-700 rounded-lg p-4">
            <h3 className="text-white font-bold mb-4">Stato di Gioco</h3>
            <div className="text-center text-gray-300">
              <p>Visualizzazione di gioco sarà disponibile nella prossima versione</p>
              <p className="mt-2">Eventi processati: {currentEventIndex + 1} / {events.length}</p>
            </div>
          </div>

          {/* Event Timeline */}
          <div className="bg-gray-700 rounded-lg p-4 flex flex-col">
            <h3 className="text-white font-bold mb-4">Timeline Eventi</h3>
            
            {/* Playback Controls */}
            <div className="bg-gray-600 rounded-lg p-4 mb-4">
              <div className="flex justify-center gap-2 mb-4">
                <Button
                  onClick={handleReset}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  <RotateCcw size={16} />
                </Button>
                <Button
                  onClick={handleStepBack}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="sm"
                  disabled={currentEventIndex <= -1}
                >
                  <StepBack size={16} />
                </Button>
                <Button
                  onClick={handlePlay}
                  className="bg-green-600 hover:bg-green-700"
                  size="sm"
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </Button>
                <Button
                  onClick={handleStepForward}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="sm"
                  disabled={currentEventIndex >= events.length - 1}
                >
                  <StepForward size={16} />
                </Button>
              </div>
              
              <div className="flex items-center justify-center gap-2">
                <span className="text-white text-sm">Velocità:</span>
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  className="bg-gray-700 text-white px-2 py-1 rounded text-sm"
                >
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={4}>4x</option>
                </select>
              </div>
            </div>

            {/* Event List */}
            <div className="flex-1 overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-gray-400 text-center">Nessun evento trovato</p>
              ) : (
                <div className="space-y-2">
                  {events.map((event, index) => (
                    <div
                      key={event.id}
                      className={`p-3 rounded-lg text-sm ${
                        index === currentEventIndex
                          ? 'bg-blue-600 text-white'
                          : index < currentEventIndex
                          ? 'bg-gray-600 text-gray-300'
                          : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      <div className="font-medium mb-1">
                        {formatEventDescription(event)}
                      </div>
                      <div className="text-xs opacity-75">
                        {new Date(event.timestamp).toLocaleTimeString('it-IT')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};