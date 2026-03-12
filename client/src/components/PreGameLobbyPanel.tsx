import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "./ui/button";
import { Users, Search, Send, Check, Skull, Crown, UserPlus, Play } from "lucide-react";

interface PreGameLobbyPanelProps {
  gameId: string;
  playerName: string;
  isCreator: boolean;
  players: { name: string; isCPU?: boolean; avatar?: string }[];
  characterLimit: string;
  authToken?: string | null;
  onCharacterLimitChange: (limit: string) => void;
  onStartGame: () => void;
  roomCode: string;
}

const MORTI_OPTIONS = [
  { value: '1', label: '1', desc: 'Morte singola' },
  { value: '2', label: '2', desc: 'Due vite' },
  { value: '3', label: '3', desc: 'Tre vite' },
  { value: '5', label: '5', desc: 'Cinque vite' },
  { value: 'unlimited', label: '∞', desc: 'Illimitato' },
];

export const PreGameLobbyPanel: React.FC<PreGameLobbyPanelProps> = ({
  gameId,
  playerName,
  isCreator,
  players,
  characterLimit,
  authToken,
  onCharacterLimitChange,
  onStartGame,
  roomCode,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: number; username: string; avatar?: string; puntiRankiard?: number }[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const searchUsers = useCallback(async (query: string) => {
    if (!query || query.length < 2 || !authToken) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success && data.users) {
        const joinedNames = new Set(players.map(p => p.name));
        setSearchResults(data.users.filter((u: any) => !joinedNames.has(u.username)));
      }
    } catch (e) {
      console.error('Search users error:', e);
    } finally {
      setSearching(false);
    }
  }, [authToken, players]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => searchUsers(searchQuery), 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery, searchUsers]);

  const handleInvite = async (userId: number, username: string) => {
    if (!authToken) return;
    setInviting(username);
    try {
      const res = await fetch('/api/friends/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ friendId: userId, gameId }),
      });
      const data = await res.json();
      if (data.success) {
        setInvitedUsers(prev => new Set(prev).add(username));
      }
    } catch (e) {
      console.error('Invite error:', e);
    } finally {
      setInviting(null);
    }
  };

  const canStart = players.length >= 2;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ background: 'radial-gradient(ellipse at center, rgba(15,10,40,0.95) 0%, rgba(5,3,20,0.98) 100%)' }}>
      <div className="w-full max-w-lg mx-auto space-y-4 max-h-[90vh] overflow-y-auto px-1">
        <div className="text-center">
          <h2 className="text-2xl font-black text-white tracking-tight mb-1">SALA D'ATTESA</h2>
          <div className="flex items-center justify-center gap-2">
            <span className="text-white/40 text-xs bg-white/5 px-3 py-1 rounded-full border border-white/10">
              Codice: <span className="text-white/70 font-bold">{roomCode}</span>
            </span>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-blue-400" />
            <span className="text-white/80 text-sm font-semibold">Giocatori ({players.length})</span>
          </div>
          <div className="space-y-2">
            {players.map((p) => (
              <div key={p.name} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {p.isCPU ? '🤖' : p.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-white/90 text-sm font-medium truncate">{p.name}</span>
                {p.name === (players.find(pl => !pl.isCPU)?.name) && isCreator && p.name === playerName && (
                  <Crown size={14} className="text-yellow-400 flex-shrink-0 ml-auto" />
                )}
                {p.isCPU && (
                  <span className="text-purple-400 text-xs ml-auto">CPU</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {isCreator && authToken && (
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-4">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus size={16} className="text-cyan-400" />
              <span className="text-white/80 text-sm font-semibold">Invita Giocatori</span>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca per username..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-cyan-500/50 focus:bg-white/8 transition-all"
              />
            </div>
            {searching && (
              <p className="text-white/40 text-xs mt-2 text-center">Ricerca...</p>
            )}
            {searchResults.length > 0 && (
              <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
                {searchResults.map((user) => (
                  <div key={user.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-white/80 text-sm truncate flex-1">{user.username}</span>
                    {user.puntiRankiard !== undefined && (
                      <span className="text-yellow-400 text-xs font-bold">{user.puntiRankiard}</span>
                    )}
                    {invitedUsers.has(user.username) ? (
                      <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                        <Check size={12} /> Inviato
                      </span>
                    ) : (
                      <button
                        onClick={() => handleInvite(user.id, user.username)}
                        disabled={inviting === user.username}
                        className="flex items-center gap-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-xs font-medium px-2.5 py-1 rounded-lg border border-cyan-500/20 transition-all disabled:opacity-50"
                      >
                        <Send size={10} />
                        {inviting === user.username ? '...' : 'Invita'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <p className="text-white/40 text-xs mt-2 text-center">Nessun utente trovato</p>
            )}
          </div>
        )}

        <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Skull size={16} className="text-red-400" />
            <span className="text-white/80 text-sm font-semibold">Morti (Personaggi per giocatore)</span>
          </div>
          {isCreator ? (
            <div className="grid grid-cols-5 gap-2">
              {MORTI_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onCharacterLimitChange(opt.value)}
                  className={`flex flex-col items-center py-2.5 px-1 rounded-xl border-2 transition-all ${
                    characterLimit === opt.value
                      ? 'border-red-500 bg-red-900/30 text-white shadow-lg shadow-red-500/15'
                      : 'border-white/10 bg-white/5 text-white/60 hover:border-white/30 hover:bg-white/10'
                  }`}
                >
                  <span className="font-bold text-lg">{opt.label}</span>
                  <span className="text-[10px] opacity-70 leading-tight text-center">{opt.desc}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/5">
              <span className="text-white/60 text-sm">Limite personaggi:</span>
              <span className="text-white font-bold text-lg">
                {characterLimit === 'unlimited' ? '∞ Illimitato' : `${characterLimit} personaggi`}
              </span>
            </div>
          )}
        </div>

        {isCreator ? (
          <Button
            onClick={onStartGame}
            disabled={!canStart}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-emerald-500/30 border border-emerald-400/30 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Play size={20} />
            COMINCIA
            {!canStart && <span className="text-xs font-normal opacity-70 ml-1">(min. 2 giocatori)</span>}
          </Button>
        ) : (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 bg-white/5 rounded-2xl px-6 py-3 border border-white/10">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-white/60 text-sm">In attesa che l'host avvii la partita...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
