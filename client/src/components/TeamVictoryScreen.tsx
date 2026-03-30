import React from "react";
import { Shield, Trophy, Sword, Heart, Zap, Gift, Star } from "lucide-react";

interface TeamPlayerStats {
  damageDealt: number;
  damageReceived: number;
  eliminationsCount: number;
  movesUsed: number;
  movesDonated: number;
}

interface TeamVictoryData {
  isTeamVictory: boolean;
  winningTeam: 'teamA' | 'teamB';
  winningPlayers: string[];
  teams: { teamA: string[]; teamB: string[] } | null;
  teamPlayerStats: Record<string, TeamPlayerStats> | null;
}

interface TeamVictoryScreenProps {
  teamVictoryData: TeamVictoryData;
  playerName: string;
  matchDuration?: number;
  onClose: () => void;
}

const formatDuration = (secs: number): string => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

export const TeamVictoryScreen: React.FC<TeamVictoryScreenProps> = ({
  teamVictoryData,
  playerName,
  matchDuration,
  onClose,
}) => {
  const { winningTeam, winningPlayers, teams, teamPlayerStats } = teamVictoryData;
  const myTeam = teams
    ? (teams.teamA.includes(playerName) ? 'teamA' : teams.teamB.includes(playerName) ? 'teamB' : null)
    : null;
  const isWinner = myTeam === winningTeam;

  const getTeamLabel = (t: 'teamA' | 'teamB') => t === 'teamA' ? 'Team A' : 'Team B';
  const winnerLabel = getTeamLabel(winningTeam);
  const losingTeam = winningTeam === 'teamA' ? 'teamB' : 'teamA';

  const allPlayers = teams ? [...teams.teamA, ...teams.teamB] : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-auto rounded-3xl overflow-hidden shadow-2xl border border-white/10" style={{ background: 'linear-gradient(135deg, rgba(10,5,30,0.98) 0%, rgba(5,3,20,0.99) 100%)' }}>
        <div className={`px-6 pt-8 pb-6 text-center ${isWinner ? 'bg-gradient-to-b from-yellow-500/15 to-transparent' : 'bg-gradient-to-b from-red-900/20 to-transparent'}`}>
          {isWinner ? (
            <>
              <div className="text-5xl mb-2">🏆</div>
              <h2 className="text-3xl font-black text-yellow-300 tracking-tight">VITTORIA!</h2>
              <p className="text-white/60 text-sm mt-1">{winnerLabel} ha vinto la partita</p>
            </>
          ) : (
            <>
              <div className="text-5xl mb-2">💀</div>
              <h2 className="text-3xl font-black text-red-400 tracking-tight">SCONFITTA</h2>
              <p className="text-white/60 text-sm mt-1">{winnerLabel} ha vinto la partita</p>
            </>
          )}
          {matchDuration && (
            <p className="text-white/40 text-xs mt-2">Durata: {formatDuration(matchDuration)}</p>
          )}
        </div>

        {teams && (
          <div className="px-5 pb-4 space-y-3">
            {(['teamA', 'teamB'] as const).map((team) => {
              const isWinningTeam = team === winningTeam;
              return (
                <div key={team} className={`rounded-2xl border p-4 ${isWinningTeam ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-white/10 bg-white/3'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    {isWinningTeam ? (
                      <Trophy size={15} className="text-yellow-400" />
                    ) : (
                      <Shield size={15} className="text-white/40" />
                    )}
                    <span className={`text-sm font-bold ${isWinningTeam ? 'text-yellow-300' : 'text-white/50'}`}>
                      {getTeamLabel(team)} {isWinningTeam ? '— Vincitori' : '— Eliminati'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {teams[team].map((pName) => {
                      const stats = teamPlayerStats?.[pName];
                      const isMe = pName === playerName;
                      return (
                        <div key={pName} className={`rounded-xl p-3 ${isMe ? 'bg-white/8 border border-white/15' : 'bg-white/3'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${isWinningTeam ? 'bg-gradient-to-br from-yellow-500 to-amber-600' : 'bg-gradient-to-br from-gray-600 to-gray-700'}`}>
                              {pName.charAt(0).toUpperCase()}
                            </div>
                            <span className={`text-sm font-semibold ${isMe ? 'text-white' : 'text-white/80'}`}>
                              {pName} {isMe && <span className="text-white/40 text-xs font-normal">(tu)</span>}
                            </span>
                          </div>
                          {stats ? (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-9">
                              <div className="flex items-center gap-1.5 text-xs text-white/50">
                                <Sword size={10} className="text-red-400 flex-shrink-0" />
                                <span>Danno inflitto: <span className="text-white/80 font-medium">{stats.damageDealt}</span></span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-white/50">
                                <Heart size={10} className="text-rose-400 flex-shrink-0" />
                                <span>Danno ricevuto: <span className="text-white/80 font-medium">{stats.damageReceived}</span></span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-white/50">
                                <Zap size={10} className="text-yellow-400 flex-shrink-0" />
                                <span>Eliminazioni: <span className="text-white/80 font-medium">{stats.eliminationsCount}</span></span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-white/50">
                                <Star size={10} className="text-purple-400 flex-shrink-0" />
                                <span>Mosse speciali: <span className="text-white/80 font-medium">{stats.movesUsed ?? 0}</span></span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-white/50 col-span-2">
                                <Gift size={10} className="text-emerald-400 flex-shrink-0" />
                                <span>Mosse donate: <span className="text-white/80 font-medium">{stats.movesDonated}</span></span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-white/30 text-xs pl-9">Statistiche non disponibili</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="px-5 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm border border-white/15 transition-all"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
