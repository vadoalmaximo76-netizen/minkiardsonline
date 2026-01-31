import React, { useState, useEffect } from 'react';
import { X, Play, Pause, SkipForward, SkipBack, Clock, User, Trophy, Calendar, Search, RefreshCw } from 'lucide-react';

interface Match {
  id: number;
  gameId: string;
  players: string[];
  startedAt: string;
  endedAt: string | null;
  winnerPlayer: string | null;
  totalEvents: number;
  duration: number | null;
}

interface GameEvent {
  id: number;
  eventType: string;
  eventData: any;
  playerName: string;
  timestamp: string;
  eventOrder: number;
}

interface ReplayPanelProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string | null;
}

export function ReplayPanel({ isOpen, onClose, authToken }: ReplayPanelProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  useEffect(() => {
    if (isOpen) {
      fetchMatches();
    }
  }, [isOpen]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying && events.length > 0 && currentEventIndex < events.length - 1) {
      interval = setInterval(() => {
        setCurrentEventIndex(prev => {
          if (prev >= events.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500 / playbackSpeed);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, events.length, playbackSpeed, currentEventIndex]);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/matches');
      const data = await res.json();
      if (data.success) {
        setMatches(data.matches);
      }
    } catch (error) {
      console.error('Failed to fetch matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchEvents = async (matchId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/matches/${matchId}/events`);
      const data = await res.json();
      if (data.success) {
        setEvents(data.events);
        setCurrentEventIndex(0);
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMatchSelect = (match: Match) => {
    setSelectedMatch(match);
    fetchMatchEvents(match.id);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEventDescription = (event: GameEvent) => {
    const data = event.eventData;
    switch (event.eventType) {
      case 'play-card':
        return `${event.playerName} ha giocato ${data.cardName || 'una carta'}`;
      case 'attack':
        return `${event.playerName} ha attaccato ${data.targetName || 'un bersaglio'}`;
      case 'defense':
        return `${event.playerName} si è difeso`;
      case 'draw-card':
        return `${event.playerName} ha pescato una carta`;
      case 'move-to-graveyard':
        return `${data.cardName || 'Una carta'} è andata al cimitero`;
      case 'game-start':
        return 'La partita è iniziata';
      case 'game-end':
        return `Partita terminata - Vincitore: ${data.winner || 'N/A'}`;
      case 'turn-change':
        return `Turno di ${data.nextPlayer || event.playerName}`;
      default:
        return `${event.playerName}: ${event.eventType}`;
    }
  };

  const filteredMatches = matches.filter(m => 
    m.players.some(p => p.toLowerCase().includes(searchQuery.toLowerCase())) ||
    m.gameId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-slate-600">
        <div className="flex items-center justify-between p-4 border-b border-slate-600 bg-gradient-to-r from-indigo-600 to-purple-600">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Play className="w-6 h-6" />
            Replay Partite
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="flex h-[calc(90vh-80px)]">
          <div className="w-1/3 border-r border-slate-600 overflow-y-auto">
            <div className="p-3 border-b border-slate-700 sticky top-0 bg-slate-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cerca partite..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 text-sm"
                />
              </div>
              <button
                onClick={fetchMatches}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Aggiorna
              </button>
            </div>

            {loading && !selectedMatch && (
              <div className="p-8 text-center text-slate-400">
                Caricamento...
              </div>
            )}

            {!loading && filteredMatches.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                Nessuna partita trovata
              </div>
            )}

            {filteredMatches.map(match => (
              <button
                key={match.id}
                onClick={() => handleMatchSelect(match)}
                className={`w-full p-4 text-left border-b border-slate-700 hover:bg-slate-700 transition-colors ${
                  selectedMatch?.id === match.id ? 'bg-indigo-900/50' : ''
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-indigo-400" />
                  <span className="text-white font-medium text-sm truncate">
                    {match.players.join(' vs ')}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(match.startedAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(match.duration)}
                  </span>
                </div>
                {match.winnerPlayer && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-amber-400">
                    <Trophy className="w-3 h-3" />
                    {match.winnerPlayer}
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col">
            {!selectedMatch ? (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <Play className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Seleziona una partita per vedere il replay</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-slate-600 bg-slate-800/50">
                  <h3 className="text-lg font-bold text-white mb-2">
                    {selectedMatch.players.join(' vs ')}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span>{formatDate(selectedMatch.startedAt)}</span>
                    <span>Durata: {formatDuration(selectedMatch.duration)}</span>
                    <span>Eventi: {events.length}</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {events.map((event, idx) => (
                    <div
                      key={event.id}
                      className={`p-3 mb-2 rounded-lg border transition-all ${
                        idx === currentEventIndex
                          ? 'bg-indigo-900/50 border-indigo-500 scale-105'
                          : idx < currentEventIndex
                          ? 'bg-slate-700/30 border-slate-600 opacity-50'
                          : 'bg-slate-800 border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white text-sm">
                          {getEventDescription(event)}
                        </span>
                        <span className="text-xs text-slate-400">
                          #{event.eventOrder}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t border-slate-600 bg-slate-800">
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <button
                      onClick={() => setCurrentEventIndex(0)}
                      className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    >
                      <SkipBack className="w-5 h-5 text-white" />
                    </button>
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-3 bg-indigo-600 hover:bg-indigo-500 rounded-full transition-colors"
                    >
                      {isPlaying ? (
                        <Pause className="w-6 h-6 text-white" />
                      ) : (
                        <Play className="w-6 h-6 text-white" />
                      )}
                    </button>
                    <button
                      onClick={() => setCurrentEventIndex(events.length - 1)}
                      className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    >
                      <SkipForward className="w-5 h-5 text-white" />
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <input
                        type="range"
                        min="0"
                        max={events.length - 1 || 0}
                        value={currentEventIndex}
                        onChange={(e) => setCurrentEventIndex(parseInt(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                    <span className="text-white text-sm min-w-[80px] text-center">
                      {currentEventIndex + 1} / {events.length}
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-2 mt-3">
                    <span className="text-slate-400 text-sm">Velocità:</span>
                    {[0.5, 1, 2, 4].map(speed => (
                      <button
                        key={speed}
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          playbackSpeed === speed
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
