import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "./ui/button";
import { Users, Search, Send, Check, Skull, Crown, UserPlus, Play, Bot, Shield, Shuffle, ChevronRight } from "lucide-react";
import { socket } from "../lib/socket";

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
  isStartingGame?: boolean;
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
  isStartingGame = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: number; username: string; avatar?: string; puntiRankiard?: number }[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isTeamMode, setIsTeamMode] = useState(false);
  const [teamSize, setTeamSize] = useState<2 | 3>(2);
  const [teams, setTeams] = useState<{ teamA: string[]; teamB: string[] } | null>(null);
  const [teamModeError, setTeamModeError] = useState<string | null>(null);

  useEffect(() => {
    const handleTeamModeUpdated = (data: { isTeamMode: boolean; teamSize?: 2 | 3; teams?: { teamA: string[]; teamB: string[] } | null }) => {
      setIsTeamMode(data.isTeamMode);
      if (data.teamSize) setTeamSize(data.teamSize);
      setTeams(data.teams || null);
      setTeamModeError(null);
    };
    const handleTeamModeError = (data: { message: string }) => {
      setTeamModeError(data.message);
    };
    socket.on('team-mode-updated', handleTeamModeUpdated);
    socket.on('team-mode-error', handleTeamModeError);
    return () => {
      socket.off('team-mode-updated', handleTeamModeUpdated);
      socket.off('team-mode-error', handleTeamModeError);
    };
  }, []);

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

  const handleAddCPU = () => {
    socket.emit('add-cpu-player', { gameId });
  };

  const handleToggleTeamMode = (enabled: boolean) => {
    setIsTeamMode(enabled);
    setTeamModeError(null);
    if (!enabled) {
      setTeams(null);
      socket.emit('set-team-mode', { gameId, isTeamMode: false });
    } else {
      socket.emit('set-team-mode', { gameId, isTeamMode: true, teamSize });
    }
  };

  const handleTeamSizeChange = (size: 2 | 3) => {
    setTeamSize(size);
    setTeamModeError(null);
    if (isTeamMode) {
      setTeams(null);
      socket.emit('set-team-mode', { gameId, isTeamMode: true, teamSize: size });
    }
  };

  const handleAutoAssignTeams = () => {
    setTeamModeError(null);
    socket.emit('auto-assign-teams', { gameId });
  };

  const handleAssignPlayerToTeam = (targetPlayer: string, targetTeam: 'teamA' | 'teamB') => {
    setTeamModeError(null);
    socket.emit('assign-player-to-team', { gameId, targetPlayer, targetTeam });
  };

  const getPlayerTeam = (pName: string): 'A' | 'B' | null => {
    if (!teams) return null;
    if (teams.teamA.includes(pName)) return 'A';
    if (teams.teamB.includes(pName)) return 'B';
    return null;
  };

  const expectedCount = teamSize * 2;
  const allPlayers = players;
  const teamACount = teams ? teams.teamA.length : 0;
  const teamBCount = teams ? teams.teamB.length : 0;
  const teamsValid = teams !== null && teamACount === teamSize && teamBCount === teamSize;
  const teamModeWarning = isTeamMode && (!teams || !teamsValid);

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
            {players.map((p) => {
              const team = isTeamMode ? getPlayerTeam(p.name) : null;
              return (
                <div key={p.name} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {p.isCPU ? '🤖' : p.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-white/90 text-sm font-medium truncate flex-1">{p.name}</span>
                  {team && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${team === 'A' ? 'bg-blue-500/25 text-blue-300 border border-blue-500/30' : 'bg-red-500/25 text-red-300 border border-red-500/30'}`}>
                      Team {team}
                    </span>
                  )}
                  {isTeamMode && !team && (
                    <span className="text-white/30 text-xs px-2 py-0.5 rounded-full border border-white/10">non assegnato</span>
                  )}
                  {isCreator && isTeamMode && (
                    <div className="flex gap-1 ml-1">
                      <button
                        onClick={() => handleAssignPlayerToTeam(p.name, 'teamA')}
                        className={`text-xs px-2 py-0.5 rounded-lg font-bold transition-all ${team === 'A' ? 'bg-blue-500 text-white' : 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/30'}`}
                        title="Assegna a Team A"
                      >A</button>
                      <button
                        onClick={() => handleAssignPlayerToTeam(p.name, 'teamB')}
                        className={`text-xs px-2 py-0.5 rounded-lg font-bold transition-all ${team === 'B' ? 'bg-red-500 text-white' : 'bg-red-500/15 text-red-400 hover:bg-red-500/30'}`}
                        title="Assegna a Team B"
                      >B</button>
                    </div>
                  )}
                  {p.name === playerName && isCreator && !isTeamMode && (
                    <Crown size={14} className="text-yellow-400 flex-shrink-0 ml-auto" />
                  )}
                  {p.isCPU && !isTeamMode && (
                    <span className="text-purple-400 text-xs ml-auto">CPU</span>
                  )}
                </div>
              );
            })}
          </div>
          {isCreator && (
            <button
              onClick={handleAddCPU}
              className="mt-3 w-full flex items-center justify-center gap-2 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-sm font-semibold py-2 rounded-xl border border-purple-500/20 hover:border-purple-400/30 transition-all duration-200"
            >
              <Bot size={15} />
              Aggiungi CPU
            </button>
          )}
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

        {isCreator && (
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-emerald-400" />
                <span className="text-white/80 text-sm font-semibold">Modalità Coppia</span>
              </div>
              <button
                onClick={() => handleToggleTeamMode(!isTeamMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isTeamMode ? 'bg-emerald-500' : 'bg-white/15'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isTeamMode ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {isTeamMode && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTeamSizeChange(2)}
                    className={`flex-1 py-2 rounded-xl border-2 text-sm font-bold transition-all ${teamSize === 2 ? 'border-emerald-500 bg-emerald-900/30 text-emerald-300' : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20'}`}
                  >
                    2v2
                  </button>
                  <button
                    onClick={() => handleTeamSizeChange(3)}
                    className={`flex-1 py-2 rounded-xl border-2 text-sm font-bold transition-all ${teamSize === 3 ? 'border-emerald-500 bg-emerald-900/30 text-emerald-300' : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20'}`}
                  >
                    3v3
                  </button>
                </div>

                <button
                  onClick={handleAutoAssignTeams}
                  disabled={allPlayers.length < 2}
                  className="w-full flex items-center justify-center gap-2 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 text-sm font-semibold py-2 rounded-xl border border-blue-500/20 hover:border-blue-400/30 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Shuffle size={14} />
                  Assegna Squadre Automaticamente
                </button>

                <p className="text-white/40 text-[11px] text-center">
                  Oppure usa i pulsanti A/B accanto ai giocatori per assegnarli manualmente.
                </p>

                {teamModeError && (
                  <p className="text-red-400 text-xs text-center bg-red-400/10 rounded-lg py-2 px-3 border border-red-400/20">
                    {teamModeError}
                  </p>
                )}

                {teams && (
                  <div className="grid grid-cols-2 gap-2">
                    {(['teamA', 'teamB'] as const).map((t) => (
                      <div key={t} className={`rounded-xl p-2 border ${t === 'teamA' ? 'border-blue-500/30 bg-blue-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <p className={`text-xs font-bold ${t === 'teamA' ? 'text-blue-300' : 'text-red-300'}`}>
                            {t === 'teamA' ? 'Team A' : 'Team B'}
                          </p>
                          <span className={`text-[10px] ${teams[t].length === teamSize ? 'text-emerald-400' : 'text-white/40'}`}>
                            {teams[t].length}/{teamSize}
                          </span>
                        </div>
                        {teams[t].length === 0 ? (
                          <p className="text-white/30 text-xs italic">Vuoto</p>
                        ) : (
                          teams[t].map(p => (
                            <p key={p} className="text-white/70 text-xs truncate">{p}</p>
                          ))
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {teamModeWarning && !teamModeError && (
                  <p className="text-amber-400 text-xs text-center bg-amber-400/10 rounded-lg py-2 px-3 border border-amber-400/20">
                    Serve {teamSize} giocatore/i per squadra ({teamSize}v{teamSize}). Team A: {teamACount}, Team B: {teamBCount}
                  </p>
                )}

                <p className="text-white/30 text-[11px] text-center">
                  Turni: A1 → B1 → A2 → B2. Un team perde solo quando tutti vengono eliminati.
                </p>
              </div>
            )}
            {!isTeamMode && (
              <p className="text-white/40 text-xs">Attiva per giocare in squadre cooperative (2v2 o 3v3). Supporta anche giocatori CPU.</p>
            )}
          </div>
        )}

        {!isCreator && isTeamMode && (
          <div className="bg-emerald-500/10 backdrop-blur-md rounded-2xl border border-emerald-500/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={16} className="text-emerald-400" />
              <span className="text-emerald-300 text-sm font-semibold">Modalità Coppia {teamSize}v{teamSize} attiva</span>
            </div>
            {teams && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {(['teamA', 'teamB'] as const).map((t) => (
                  <div key={t} className={`rounded-xl p-2 border ${t === 'teamA' ? 'border-blue-500/30 bg-blue-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
                    <p className={`text-xs font-bold mb-1 ${t === 'teamA' ? 'text-blue-300' : 'text-red-300'}`}>
                      {t === 'teamA' ? 'Team A' : 'Team B'}
                    </p>
                    {teams[t].map(p => (
                      <p key={p} className={`text-xs truncate ${p === playerName ? 'text-white font-bold' : 'text-white/60'}`}>{p}</p>
                    ))}
                  </div>
                ))}
              </div>
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
            disabled={!canStart || isStartingGame || (isTeamMode && teamModeWarning)}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-emerald-500/30 border border-emerald-400/30 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Play size={20} />
            {isStartingGame ? 'Avvio in corso...' : 'COMINCIA'}
            {!canStart && !isStartingGame && <span className="text-xs font-normal opacity-70 ml-1">(min. 2 giocatori)</span>}
            {isTeamMode && teamModeWarning && !isStartingGame && <span className="text-xs font-normal opacity-70 ml-1">(configura squadre)</span>}
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
