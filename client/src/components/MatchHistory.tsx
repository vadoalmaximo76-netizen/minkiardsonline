import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Calendar, Clock, Users, Trophy, X } from 'lucide-react';

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
  onClose: () => void;
  playerName?: string;
}

export const MatchHistory: React.FC<MatchHistoryProps> = ({ onClose, playerName }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatchHistory();
  }, [playerName]);

  const fetchMatchHistory = async () => {
    setLoading(true);
    try {
      const url = playerName
        ? `/api/matches?player=${encodeURIComponent(playerName)}&limit=30`
        : '/api/matches?limit=30';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setMatches(data.matches ?? data);
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

  const wins = playerName ? matches.filter(m => m.winnerPlayer === playerName).length : 0;
  const total = matches.length;
  const losses = playerName ? total - wins : 0;

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
      <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[85vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white font-bold text-2xl flex items-center gap-2">
            <Trophy className="text-yellow-500" />
            {playerName ? `Partite di ${playerName}` : 'Cronologia Partite'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {playerName && total > 0 && (
          <div className="flex gap-4 mb-4">
            <div className="bg-gray-700 rounded-lg px-4 py-2 text-center">
              <div className="text-2xl font-bold text-white">{total}</div>
              <div className="text-xs text-gray-400">Partite</div>
            </div>
            <div className="bg-green-900/50 border border-green-700 rounded-lg px-4 py-2 text-center">
              <div className="text-2xl font-bold text-green-400">{wins}</div>
              <div className="text-xs text-gray-400">Vittorie</div>
            </div>
            <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-2 text-center">
              <div className="text-2xl font-bold text-red-400">{losses}</div>
              <div className="text-xs text-gray-400">Sconfitte</div>
            </div>
            {total > 0 && (
              <div className="bg-blue-900/50 border border-blue-700 rounded-lg px-4 py-2 text-center">
                <div className="text-2xl font-bold text-blue-300">{Math.round((wins / total) * 100)}%</div>
                <div className="text-xs text-gray-400">Win Rate</div>
              </div>
            )}
          </div>
        )}

        <div className="overflow-y-auto flex-1">
          {matches.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <Trophy size={48} className="mx-auto mb-3 opacity-30" />
              <p>Nessuna partita trovata</p>
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((match) => {
                const isWin = playerName && match.winnerPlayer === playerName;
                const isLoss = playerName && match.winnerPlayer && match.winnerPlayer !== playerName;
                return (
                  <div
                    key={match.id}
                    className={`rounded-lg p-4 transition-colors border ${
                      isWin
                        ? 'bg-green-900/30 border-green-700/50'
                        : isLoss
                        ? 'bg-red-900/20 border-red-800/30'
                        : 'bg-gray-700 border-transparent hover:bg-gray-600'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          {playerName && match.winnerPlayer && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              isWin ? 'bg-green-600 text-white' : 'bg-red-700 text-white'
                            }`}>
                              {isWin ? '🏆 VITTORIA' : '💀 SCONFITTA'}
                            </span>
                          )}
                          <span className="text-gray-400 text-xs flex items-center gap-1">
                            <Calendar size={12} />
                            {formatDate(match.startedAt)}
                          </span>
                          {match.duration && (
                            <span className="text-gray-400 text-xs flex items-center gap-1">
                              <Clock size={12} />
                              {formatDuration(match.duration)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mb-1">
                          <Users size={14} className="text-purple-400 shrink-0" />
                          <span className="text-gray-300 text-sm">
                            {match.players.map(p => (
                              <span key={p} className={playerName && p === playerName ? 'text-white font-semibold' : ''}>
                                {p}
                              </span>
                            )).reduce((prev, curr, i) => i === 0 ? [curr] : [...prev, <span key={`sep-${i}`} className="text-gray-500"> vs </span>, curr] as any, [] as React.ReactNode[])}
                          </span>
                        </div>

                        {match.winnerPlayer && (
                          <div className="flex items-center gap-2 text-sm">
                            <Trophy size={14} className="text-yellow-500 shrink-0" />
                            <span className="text-yellow-300">Vincitore: <span className="font-semibold">{match.winnerPlayer}</span></span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
