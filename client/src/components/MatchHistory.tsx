import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Calendar, Clock, Users, Trophy, Play } from 'lucide-react';

interface Match {
  id: number;
  gameId: string;
  players: string[];
  startedAt: string;
  endedAt?: string;
  winnerPlayer?: string;
  gameMode: string;
  totalEvents: number;
  duration?: number;
}

interface MatchHistoryProps {
  onSelectReplay: (matchId: number) => void;
  onClose: () => void;
}

export const MatchHistory: React.FC<MatchHistoryProps> = ({ onSelectReplay, onClose }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatchHistory();
  }, []);

  const fetchMatchHistory = async () => {
    try {
      const response = await fetch('/api/matches/history');
      if (response.ok) {
        const data = await response.json();
        setMatches(data);
      }
    } catch (error) {
      console.error('Failed to fetch match history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'In corso...';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
            <p>Caricamento cronologia partite...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-white font-bold text-2xl flex items-center gap-2">
            <Trophy className="text-yellow-500" />
            Cronologia Partite
          </h2>
          <Button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Chiudi
          </Button>
        </div>

        <div className="overflow-y-auto max-h-[calc(80vh-120px)]">
          {matches.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p>Nessuna partita trovata</p>
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map((match) => (
                <div
                  key={match.id}
                  className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar size={16} className="text-blue-400" />
                        <span className="text-white font-medium">
                          {formatDate(match.startedAt)}
                        </span>
                        {match.endedAt && (
                          <>
                            <Clock size={16} className="text-green-400 ml-4" />
                            <span className="text-white">
                              {formatDuration(match.duration)}
                            </span>
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mb-2">
                        <Users size={16} className="text-purple-400" />
                        <span className="text-gray-300">
                          Giocatori: {match.players.join(', ')}
                        </span>
                      </div>

                      {match.winnerPlayer && (
                        <div className="flex items-center gap-2">
                          <Trophy size={16} className="text-yellow-500" />
                          <span className="text-yellow-300">
                            Vincitore: {match.winnerPlayer}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 items-end">
                      <div className="text-sm text-gray-400">
                        {match.totalEvents} eventi
                      </div>
                      <Button
                        onClick={() => onSelectReplay(match.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                        size="sm"
                      >
                        <Play size={16} />
                        Guarda Replay
                      </Button>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 mt-2">
                    ID Partita: {match.gameId}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};