import React, { useState, useEffect } from "react";
import { Trophy, Medal, Gamepad2, Clock, Crown, X, Loader2, Swords, ArrowLeft } from "lucide-react";
import { socket } from "../lib/socket";

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
  const isFullPage = !currentGameId; // Full-page when no active game context

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
      alert('Devi essere in una stanza di gioco per sfidare un giocatore. Crea o entra in una stanza prima.');
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
    } catch (e) {
      alert('Errore di connessione');
    }
  };

  const getAvatar = (avatarId: string | null): string => {
    if (!avatarId) return "👤";
    const index = parseInt(avatarId.replace('avatar-', '')) - 1;
    return AVATAR_EMOJIS[index] || "👤";
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { bg: 'from-yellow-600/40 to-yellow-800/40', border: 'border-yellow-500', icon: '🥇' };
    if (rank === 2) return { bg: 'from-slate-400/30 to-slate-600/30', border: 'border-slate-400', icon: '🥈' };
    if (rank === 3) return { bg: 'from-amber-700/30 to-amber-900/30', border: 'border-amber-600', icon: '🥉' };
    return { bg: 'from-gray-700/20 to-gray-800/20', border: 'border-gray-600', icon: null };
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
    <div className={`bg-gradient-to-b from-gray-900 to-gray-950 rounded-xl border border-yellow-500/30 shadow-2xl w-full ${isFullPage ? 'max-w-3xl h-full flex flex-col' : 'max-w-2xl max-h-[85vh] overflow-hidden'}`}>
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-yellow-900/30 to-orange-900/30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <Trophy className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Classifica Rankiard</h2>
            <p className="text-xs text-white/60">Top 100 giocatori</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
        >
          {isFullPage ? (
            <>
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Torna alla home</span>
            </>
          ) : (
            <X className="w-5 h-5" />
          )}
        </button>
      </div>

      <div className={`grid gap-2 px-4 py-2 bg-black/30 text-xs text-white/60 font-medium border-b border-white/10 ${showChallengeCol ? 'grid-cols-13' : 'grid-cols-12'}`}
           style={{ gridTemplateColumns: showChallengeCol ? '1fr 3fr 2fr 2fr 1fr 2fr 2fr' : '1fr 4fr 2fr 2fr 1fr 2fr' }}>
        <div className="text-center">#</div>
        <div>Giocatore</div>
        <div className="text-center flex items-center justify-center gap-1">
          <Crown className="w-3 h-3 text-yellow-400" /> PR
        </div>
        <div className="text-center flex items-center justify-center gap-1">
          <Gamepad2 className="w-3 h-3" /> Partite
        </div>
        <div className="text-center flex items-center justify-center gap-1">
          <Medal className="w-3 h-3 text-green-400" /> V
        </div>
        <div className="text-center flex items-center justify-center gap-1">
          <Clock className="w-3 h-3" /> Tempo
        </div>
        {showChallengeCol && <div className="text-center">Sfida</div>}
      </div>

      <div className="overflow-y-auto flex-1" style={{ maxHeight: isFullPage ? undefined : '60vh' }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-12 text-white/60">
            <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
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
                className={`grid gap-2 px-4 py-3 border-b border-white/5 bg-gradient-to-r ${style.bg} ${isMe ? 'ring-1 ring-inset ring-cyan-500/40' : 'hover:bg-white/5'} transition-colors items-center`}
                style={{ gridTemplateColumns: showChallengeCol ? '1fr 3fr 2fr 2fr 1fr 2fr 2fr' : '1fr 4fr 2fr 2fr 1fr 2fr' }}
              >
                <div className="text-center">
                  {style.icon ? (
                    <span className="text-lg">{style.icon}</span>
                  ) : (
                    <span className="text-white/60 font-medium">{rank}</span>
                  )}
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-2xl">{getAvatar(player.avatar)}</span>
                  <span className={`font-medium truncate ${rank <= 3 ? 'text-white' : 'text-white/80'} ${isMe ? 'text-cyan-300' : ''}`}>
                    {player.username}{isMe ? ' (tu)' : ''}
                  </span>
                </div>

                <div className="text-center">
                  <span className="text-yellow-400 font-bold">{player.puntiRankiard}</span>
                </div>

                <div className="text-center text-white/70">
                  {player.gamesPlayed}
                </div>

                <div className="text-center">
                  <span className="text-green-400">{player.gamesWon}</span>
                  {player.gamesPlayed > 0 && (
                    <span className="text-white/40 text-xs ml-1">({winRate}%)</span>
                  )}
                </div>

                <div className="text-center text-white/70">
                  {formatMinutes(player.minutesPlayed)}
                </div>

                {showChallengeCol && (
                  <div className="text-center">
                    {isMe ? (
                      <span className="text-white/20 text-xs">—</span>
                    ) : (
                      <button
                        onClick={() => handleChallenge(player)}
                        disabled={sent}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all mx-auto ${
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
            );
          })
        )}
      </div>

      <div className="p-3 bg-black/30 border-t border-white/10 text-center text-xs text-white/50">
        {showChallengeCol
          ? 'Sfida un giocatore dalla classifica — riceverà una notifica in gioco'
          : 'I dati vengono aggiornati automaticamente durante le partite'}
      </div>
    </div>
  );

  if (isFullPage) {
    return (
      <div className="fixed inset-0 bg-arena-deep flex items-center justify-center p-4 z-[60]">
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
