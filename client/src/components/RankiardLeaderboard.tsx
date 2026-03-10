import React, { useState, useEffect } from "react";
import { Trophy, Medal, Gamepad2, Clock, Crown, X, Loader2, Swords, ArrowLeft } from "lucide-react";

interface LeaderboardEntry {
  id: number;
  username: string;
  avatar: string | null;
  puntiRankiard: number;
  gamesPlayed: number;
  gamesWon: number;
  minutesPlayed: number;
}

interface RankiardLeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: number;
  currentGameId?: string;
}

const AVATAR_EMOJIS = [
  "😎", "🔥", "⚡", "🎮", "👑", "💎", "🐉", "🦁", "🦊", "🐺",
  "🎯", "🚀", "💪", "🏆", "⭐", "🌟", "✨", "💫", "🎭", "🃏",
  "🎲", "🎪", "🎨", "🎬"
];

export const RankiardLeaderboard: React.FC<RankiardLeaderboardProps> = ({
  isOpen,
  onClose,
  currentUserId,
  currentGameId
}) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [challengeSent, setChallengeSent] = useState<number | null>(null);
  const isFullPage = !currentGameId;

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard();
    }
  }, [isOpen]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/leaderboard');
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChallenge = async (player: LeaderboardEntry) => {
    if (!currentUserId) {
      alert('Devi essere loggato per sfidare un giocatore');
      return;
    }
    if (!currentGameId) {
      alert('Devi essere in una stanza di gioco per sfidare un giocatore.');
      return;
    }
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/friends/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ receiverId: player.id, gameId: currentGameId })
      });
      if (response.ok) {
        setChallengeSent(player.id);
        setTimeout(() => setChallengeSent(null), 3000);
      } else {
        const err = await response.json();
        alert(err.error || 'Impossibile inviare la sfida');
      }
    } catch {
      alert('Errore di connessione');
    }
  };

  const getAvatar = (avatarId: string | null): string => {
    if (!avatarId) return "👤";
    const index = parseInt(avatarId.replace('avatar-', '')) - 1;
    return AVATAR_EMOJIS[index] || "👤";
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { bg: 'from-yellow-600/30 to-yellow-800/20', border: 'border-yellow-500/60', badge: '🥇', badgeColor: 'text-yellow-400' };
    if (rank === 2) return { bg: 'from-slate-400/20 to-slate-600/20', border: 'border-slate-400/50', badge: '🥈', badgeColor: 'text-slate-300' };
    if (rank === 3) return { bg: 'from-amber-700/20 to-amber-900/20', border: 'border-amber-600/50', badge: '🥉', badgeColor: 'text-amber-500' };
    return { bg: 'from-transparent to-transparent', border: 'border-white/5', badge: null, badgeColor: 'text-white/50' };
  };

  const formatMinutes = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  if (!isOpen) return null;

  const showChallengeCol = !!currentGameId;

  const content = (
    <div
      className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-xl border border-yellow-500/30 shadow-2xl w-full flex flex-col"
      style={{ maxWidth: 720, maxHeight: isFullPage ? 'calc(100vh - 2rem)' : '85vh' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-yellow-900/30 to-orange-900/30 shrink-0 rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <Trophy className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">Classifica Rankiard</h2>
            <p className="text-xs text-white/50">Top 100 giocatori</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
        >
          {isFullPage ? (
            <>
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium hidden sm:inline">Indietro</span>
            </>
          ) : (
            <X className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Desktop column headers — hidden on mobile */}
      <div className="hidden sm:grid shrink-0 px-4 py-2 bg-black/30 text-xs text-white/50 font-semibold border-b border-white/10 uppercase tracking-wide"
        style={{ gridTemplateColumns: showChallengeCol ? '44px 1fr 80px 70px 70px 80px 80px' : '44px 1fr 80px 70px 70px 80px' }}>
        <div className="text-center">#</div>
        <div className="pl-1">Giocatore</div>
        <div className="text-center flex items-center justify-center gap-1">
          <Crown className="w-3 h-3 text-yellow-400" /> PR
        </div>
        <div className="text-center flex items-center justify-center gap-1">
          <Gamepad2 className="w-3 h-3" /> Partite
        </div>
        <div className="text-center flex items-center justify-center gap-1">
          <Medal className="w-3 h-3 text-green-400" /> Vinte
        </div>
        <div className="text-center flex items-center justify-center gap-1">
          <Clock className="w-3 h-3" /> Tempo
        </div>
        {showChallengeCol && <div className="text-center">Sfida</div>}
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-16 text-white/50">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Nessun giocatore in classifica</p>
          </div>
        ) : (
          leaderboard.map((player, index) => {
            const rank = index + 1;
            const style = getRankStyle(rank);
            const winRate = player.gamesPlayed > 0
              ? Math.round((player.gamesWon / player.gamesPlayed) * 100)
              : 0;
            const isMe = player.id === currentUserId;
            const sent = challengeSent === player.id;

            return (
              <div
                key={player.id}
                className={`border-b bg-gradient-to-r ${style.bg} ${style.border} ${isMe ? 'ring-1 ring-inset ring-cyan-500/40' : ''} transition-colors`}
              >
                {/* Desktop row */}
                <div
                  className="hidden sm:grid items-center px-4 py-3 gap-2 hover:bg-white/5 transition-colors"
                  style={{ gridTemplateColumns: showChallengeCol ? '44px 1fr 80px 70px 70px 80px 80px' : '44px 1fr 80px 70px 70px 80px' }}
                >
                  <div className="text-center">
                    {style.badge ? (
                      <span className="text-xl">{style.badge}</span>
                    ) : (
                      <span className="text-white/50 font-medium text-sm">{rank}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 min-w-0 pl-1">
                    <span className="text-xl shrink-0">{getAvatar(player.avatar)}</span>
                    <span className={`font-medium truncate text-sm ${rank <= 3 ? 'text-white' : 'text-white/80'} ${isMe ? 'text-cyan-300' : ''}`}>
                      {player.username}{isMe ? ' (tu)' : ''}
                    </span>
                  </div>

                  <div className="text-center">
                    <span className="text-yellow-400 font-bold text-sm">{player.puntiRankiard}</span>
                  </div>

                  <div className="text-center text-white/60 text-sm">{player.gamesPlayed}</div>

                  <div className="text-center text-sm">
                    <span className="text-green-400 font-medium">{player.gamesWon}</span>
                    {player.gamesPlayed > 0 && (
                      <span className="text-white/30 text-xs ml-1">({winRate}%)</span>
                    )}
                  </div>

                  <div className="text-center text-white/60 text-sm">{formatMinutes(player.minutesPlayed)}</div>

                  {showChallengeCol && (
                    <div className="flex justify-center">
                      {isMe ? (
                        <span className="text-white/20 text-xs">—</span>
                      ) : (
                        <button
                          onClick={() => handleChallenge(player)}
                          disabled={sent}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                            sent
                              ? 'bg-green-600/30 text-green-400 cursor-default'
                              : 'bg-red-600/30 hover:bg-red-500/50 text-red-300 hover:text-white'
                          }`}
                        >
                          <Swords className="w-3 h-3" />
                          {sent ? 'Inviato!' : 'Sfida'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Mobile card */}
                <div className="sm:hidden flex items-center gap-3 px-3 py-3 hover:bg-white/5 transition-colors">
                  <div className="shrink-0 w-8 text-center">
                    {style.badge ? (
                      <span className="text-xl">{style.badge}</span>
                    ) : (
                      <span className="text-white/50 font-medium text-sm">{rank}</span>
                    )}
                  </div>

                  <span className="text-2xl shrink-0">{getAvatar(player.avatar)}</span>

                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold truncate text-sm ${isMe ? 'text-cyan-300' : rank <= 3 ? 'text-white' : 'text-white/90'}`}>
                      {player.username}{isMe ? ' (tu)' : ''}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-white/50">
                      <span className="flex items-center gap-1">
                        <Gamepad2 className="w-3 h-3" /> {player.gamesPlayed}
                      </span>
                      <span className="flex items-center gap-1">
                        <Medal className="w-3 h-3 text-green-400" />
                        <span className="text-green-400">{player.gamesWon}</span>
                        {player.gamesPlayed > 0 && <span className="text-white/30">({winRate}%)</span>}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatMinutes(player.minutesPlayed)}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className="text-yellow-400 font-bold text-sm">{player.puntiRankiard} PR</span>
                    {showChallengeCol && !isMe && (
                      <button
                        onClick={() => handleChallenge(player)}
                        disabled={sent}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                          sent
                            ? 'bg-green-600/30 text-green-400 cursor-default'
                            : 'bg-red-600/30 hover:bg-red-500/50 text-red-300 hover:text-white'
                        }`}
                      >
                        <Swords className="w-3 h-3" />
                        {sent ? '✓' : 'Sfida'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-2 bg-black/30 border-t border-white/10 text-center text-xs text-white/40 rounded-b-xl">
        {showChallengeCol
          ? 'Sfida un giocatore dalla classifica — riceverà una notifica in gioco'
          : 'I dati vengono aggiornati automaticamente durante le partite'}
      </div>
    </div>
  );

  if (isFullPage) {
    return (
      <div className="fixed inset-0 bg-arena-deep flex items-start justify-center p-4 pt-4 z-[60] overflow-y-auto">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      {content}
    </div>
  );
};

export default RankiardLeaderboard;
