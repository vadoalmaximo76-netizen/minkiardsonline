import React, { useState, useEffect } from 'react';
import { X, Trophy, Target, Gamepad2, TrendingUp, Award, CheckCircle2 } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';

interface StatsData {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  puntiRankiard: number;
  missionsCompleted: number;
  achievementsCompleted: number;
  topCardTypes: { type: string; count: number }[];
  recentResults: ('win' | 'loss')[];
}

interface StatsPanelProps {
  username: string;
  userId: number;
  onClose: () => void;
}

const StatsPanel: React.FC<StatsPanelProps> = ({ username, userId, onClose }) => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/stats/${encodeURIComponent(username)}`);
        if (!response.ok) {
          throw new Error('Errore nel caricamento delle statistiche');
        }
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Si è verificato un errore');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [username]);

  const getWinrateColor = (rate: number) => {
    if (rate >= 60) return 'bg-green-500';
    if (rate >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const renderSkeleton = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full bg-slate-800/50" />
        ))}
      </div>
      <Skeleton className="h-32 w-full bg-slate-800/50" />
      <Skeleton className="h-48 w-full bg-slate-800/50" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl text-white scrollbar-hide">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 bg-slate-900/95 backdrop-blur border-b border-slate-700">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span role="img" aria-label="stats">📊</span> Statistiche: {username}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            renderSkeleton()
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-400 mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Riprova
              </button>
            </div>
          ) : stats ? (
            <div className="space-y-8">
              {/* Top Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard 
                  icon={<Gamepad2 className="w-5 h-5 text-blue-400" />}
                  label="Partite Giocate"
                  value={stats.gamesPlayed}
                />
                <StatCard 
                  icon={<Trophy className="w-5 h-5 text-yellow-400" />}
                  label="Partite Vinte"
                  value={stats.gamesWon}
                />
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex flex-col items-center justify-center relative overflow-hidden group">
                   <div className="relative w-16 h-16 flex items-center justify-center mb-1">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          className="text-slate-700"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          strokeDasharray={175.9}
                          strokeDashoffset={175.9 - (175.9 * stats.winRate) / 100}
                          className={cn("transition-all duration-1000 ease-out", 
                            stats.winRate >= 60 ? "text-green-500" : stats.winRate >= 40 ? "text-yellow-500" : "text-red-500"
                          )}
                        />
                      </svg>
                      <span className="absolute text-sm font-bold">{stats.winRate}%</span>
                   </div>
                   <span className="text-xs text-slate-400 uppercase tracking-wider">Winrate</span>
                </div>
                <StatCard 
                  icon={<TrendingUp className="w-5 h-5 text-purple-400" />}
                  label="Punti Rankiard"
                  value={stats.puntiRankiard}
                />
              </div>

              {/* Winrate Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Progresso Vittorie</span>
                  <span className="font-medium">{stats.winRate}%</span>
                </div>
                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full transition-all duration-1000", getWinrateColor(stats.winRate))}
                    style={{ width: `${stats.winRate}%` }}
                  />
                </div>
              </div>

              {/* Recent Results */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Target className="w-5 h-5 text-red-400" /> Ultime 10 partite
                </h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {stats.recentResults.map((result, i) => (
                    <div 
                      key={i}
                      className={cn(
                        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border",
                        result === 'win' 
                          ? "bg-green-500/20 border-green-500 text-green-500" 
                          : "bg-red-500/20 border-red-500 text-red-500"
                      )}
                    >
                      {result === 'win' ? 'W' : 'L'}
                    </div>
                  ))}
                  {stats.recentResults.length === 0 && (
                    <p className="text-slate-500 text-sm italic">Nessuna partita giocata di recente</p>
                  )}
                </div>
              </div>

              {/* Grid for Card Types and Missions/Achievements */}
              <div className="grid md:grid-cols-2 gap-8">
                {/* Top Card Types */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Top Card Types</h3>
                  <div className="space-y-3">
                    {stats.topCardTypes.map((item, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs uppercase tracking-wide">
                          <span className="text-slate-400">{item.type}</span>
                          <span>{item.count}</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 transition-all duration-1000"
                            style={{ 
                              width: `${(item.count / Math.max(...stats.topCardTypes.map(t => t.count))) * 100}%` 
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Progress Stats */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Obiettivi e Missioni</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <ProgressItem 
                      icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                      label="Missioni Completate"
                      value={stats.missionsCompleted}
                    />
                    <ProgressItem 
                      icon={<Award className="w-5 h-5 text-yellow-400" />}
                      label="Achievement Sbloccati"
                      value={stats.achievementsCompleted}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: number | string }) => (
  <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex flex-col items-center text-center group hover:border-slate-500 transition-colors">
    <div className="mb-2 p-2 bg-slate-900 rounded-lg">{icon}</div>
    <span className="text-2xl font-bold mb-1">{value}</span>
    <span className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</span>
  </div>
);

const ProgressItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: number }) => (
  <div className="flex items-center gap-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
    <div className="p-2 bg-slate-900 rounded-lg">{icon}</div>
    <div>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  </div>
);

export default StatsPanel;
