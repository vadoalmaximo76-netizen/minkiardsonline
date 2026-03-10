import React, { useState, useEffect } from "react";
import { Trophy, Medal, Gamepad2, Clock, Crown, X, Loader2, Swords, ArrowLeft, RefreshCw } from "lucide-react";

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
    if (isOpen) fetchLeaderboard();
  }, [isOpen]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (e) {
      console.error('Error fetching leaderboard:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleChallenge = async (player: LeaderboardEntry) => {
    if (!currentUserId) { alert('Devi essere loggato per sfidare un giocatore'); return; }
    if (!currentGameId) { alert('Devi essere in una stanza di gioco per sfidare un giocatore.'); return; }
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch('/api/friends/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ receiverId: player.id, gameId: currentGameId })
      });
      if (res.ok) {
        setChallengeSent(player.id);
        setTimeout(() => setChallengeSent(null), 3000);
      } else {
        const err = await res.json();
        alert(err.error || 'Impossibile inviare la sfida');
      }
    } catch { alert('Errore di connessione'); }
  };

  const getAvatar = (avatarId: string | null) => {
    if (!avatarId) return "👤";
    const idx = parseInt(avatarId.replace('avatar-', '')) - 1;
    return AVATAR_EMOJIS[idx] || "👤";
  };

  const getBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  const getRowBg = (rank: number, isMe: boolean) => {
    if (isMe) return 'bg-cyan-950/40 border-l-2 border-cyan-500/60';
    if (rank === 1) return 'bg-yellow-950/30';
    if (rank === 2) return 'bg-slate-800/30';
    if (rank === 3) return 'bg-amber-950/30';
    return 'hover:bg-white/5';
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60), m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  if (!isOpen) return null;

  const listRows = (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-white/40 gap-3">
          <Trophy className="w-12 h-12 opacity-40" />
          <p className="text-sm">Nessun giocatore in classifica</p>
        </div>
      ) : (
        leaderboard.map((player, index) => {
          const rank = index + 1;
          const isMe = player.id === currentUserId;
          const sent = challengeSent === player.id;
          const badge = getBadge(rank);
          const winRate = player.gamesPlayed > 0 ? Math.round((player.gamesWon / player.gamesPlayed) * 100) : 0;

          return (
            <div key={player.id} className={`border-b border-white/5 transition-colors ${getRowBg(rank, isMe)}`}>
              {/* Mobile */}
              <div className="flex sm:hidden items-center gap-3 px-3 py-3">
                <div className="w-8 text-center shrink-0">
                  {badge ? <span className="text-xl">{badge}</span>
                    : <span className="text-white/40 text-sm font-medium">{rank}</span>}
                </div>
                <span className="text-2xl shrink-0">{getAvatar(player.avatar)}</span>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-sm truncate ${isMe ? 'text-cyan-300' : rank <= 3 ? 'text-white' : 'text-white/85'}`}>
                    {player.username}{isMe ? ' (tu)' : ''}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 mt-0.5 text-xs text-white/45">
                    <span className="flex items-center gap-1"><Gamepad2 className="w-3 h-3" />{player.gamesPlayed}</span>
                    <span className="flex items-center gap-1">
                      <Medal className="w-3 h-3 text-green-400" />
                      <span className="text-green-400">{player.gamesWon}</span>
                      {player.gamesPlayed > 0 && <span className="text-white/30">({winRate}%)</span>}
                    </span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(player.minutesPlayed)}</span>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <span className="text-yellow-400 font-bold text-sm">{player.puntiRankiard} <span className="text-yellow-600 text-xs font-normal">PR</span></span>
                  {currentGameId && !isMe && (
                    <button onClick={() => handleChallenge(player)} disabled={sent}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold transition-all ${sent ? 'bg-green-700/40 text-green-400 cursor-default' : 'bg-red-700/40 hover:bg-red-600/60 text-red-300 hover:text-white'}`}>
                      <Swords className="w-3 h-3" />
                      {sent ? '✓' : 'Sfida'}
                    </button>
                  )}
                </div>
              </div>

              {/* Desktop */}
              <div className="hidden sm:grid items-center px-4 py-3 gap-2"
                style={{ gridTemplateColumns: currentGameId ? '48px 1fr 90px 80px 90px 80px 90px' : '48px 1fr 90px 80px 90px 80px' }}>
                <div className="text-center">
                  {badge ? <span className="text-xl">{badge}</span>
                    : <span className="text-white/40 text-sm font-medium">{rank}</span>}
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl shrink-0">{getAvatar(player.avatar)}</span>
                  <span className={`font-medium text-sm truncate ${isMe ? 'text-cyan-300' : rank <= 3 ? 'text-white' : 'text-white/85'}`}>
                    {player.username}{isMe ? ' (tu)' : ''}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-yellow-400 font-bold">{player.puntiRankiard}</span>
                </div>
                <div className="text-center text-white/55 text-sm">{player.gamesPlayed}</div>
                <div className="text-center text-sm">
                  <span className="text-green-400 font-medium">{player.gamesWon}</span>
                  {player.gamesPlayed > 0 && <span className="text-white/30 text-xs ml-1">({winRate}%)</span>}
                </div>
                <div className="text-center text-white/55 text-sm">{formatTime(player.minutesPlayed)}</div>
                {currentGameId && (
                  <div className="flex justify-center">
                    {isMe ? <span className="text-white/20 text-xs">—</span> : (
                      <button onClick={() => handleChallenge(player)} disabled={sent}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${sent ? 'bg-green-700/40 text-green-400 cursor-default' : 'bg-red-700/40 hover:bg-red-600/60 text-red-300 hover:text-white'}`}>
                        <Swords className="w-3 h-3" />
                        {sent ? 'Inviato!' : 'Sfida'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </>
  );

  const desktopHeaders = (
    <div className="hidden sm:grid shrink-0 px-4 py-2 text-xs text-white/40 font-semibold uppercase tracking-wide border-b border-white/8"
      style={{
        gridTemplateColumns: currentGameId ? '48px 1fr 90px 80px 90px 80px 90px' : '48px 1fr 90px 80px 90px 80px',
        background: 'rgba(0,0,0,0.25)'
      }}>
      <div className="text-center">#</div>
      <div className="pl-1">Giocatore</div>
      <div className="text-center flex items-center justify-center gap-1"><Crown className="w-3 h-3 text-yellow-400" /> PR</div>
      <div className="text-center flex items-center justify-center gap-1"><Gamepad2 className="w-3 h-3" /> Partite</div>
      <div className="text-center flex items-center justify-center gap-1"><Medal className="w-3 h-3 text-green-400" /> Vinte</div>
      <div className="text-center flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> Tempo</div>
      {currentGameId && <div className="text-center">Sfida</div>}
    </div>
  );

  /* ── FULL-PAGE (from home nav, no active game) ─────────────────────────── */
  if (isFullPage) {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col"
        style={{ background: 'linear-gradient(180deg, #050810 0%, #0a0f1e 40%, #0d1228 70%, #080c18 100%)' }}>
        {/* Top bar */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/15 rounded-lg">
              <Trophy className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">Classifica Rankiard</h1>
              <p className="text-xs text-white/45">Top 100 giocatori</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={fetchLeaderboard} title="Aggiorna"
              className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={onClose}
              className="flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Indietro</span>
            </button>
          </div>
        </div>

        {desktopHeaders}

        {/* Scrollable list fills remaining height */}
        <div className="flex-1 overflow-y-auto">
          {listRows}
          <div className="py-4 text-center text-xs text-white/25">
            I dati vengono aggiornati automaticamente durante le partite
          </div>
        </div>
      </div>
    );
  }

  /* ── MODAL (from within a game) ────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)' }}>
      <div className="flex flex-col w-full rounded-xl border border-yellow-500/25 shadow-2xl overflow-hidden"
        style={{
          maxWidth: 700,
          maxHeight: 'min(90vh, 640px)',
          background: 'linear-gradient(180deg, #111827 0%, #0a0f1e 100%)'
        }}>
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10"
          style={{ background: 'linear-gradient(90deg, rgba(120,53,15,0.35), rgba(124,45,18,0.25))' }}>
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <div>
              <h2 className="text-base font-bold text-white leading-tight">Classifica Rankiard</h2>
              <p className="text-xs text-white/45">Top 100 giocatori</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={fetchLeaderboard} title="Aggiorna"
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {desktopHeaders}

        <div className="overflow-y-auto flex-1">
          {listRows}
        </div>

        <div className="shrink-0 py-2 px-4 border-t border-white/8 text-center text-xs text-white/30"
          style={{ background: 'rgba(0,0,0,0.3)' }}>
          Sfida un giocatore — riceverà una notifica in gioco
        </div>
      </div>
    </div>
  );
};

export default RankiardLeaderboard;
