import React, { useState, useEffect } from 'react';
import { X, Gift, Lock, Check, Star, Crown, Zap, Clock } from 'lucide-react';

interface SeasonalPass {
  id: number;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  maxLevel: number;
  isActive: boolean;
}

interface PassReward {
  id: number;
  passId: number;
  level: number;
  rewardType: string;
  rewardValue: string;
  isPremium: boolean;
}

interface PlayerProgress {
  currentLevel: number;
  currentXp: number;
  hasPremium: boolean;
}

interface SeasonalPassPanelProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string | null;
}

export function SeasonalPassPanel({ isOpen, onClose, authToken }: SeasonalPassPanelProps) {
  const [activePass, setActivePass] = useState<SeasonalPass | null>(null);
  const [rewards, setRewards] = useState<PassReward[]>([]);
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && authToken) {
      fetchActivePass();
    }
  }, [isOpen, authToken]);

  const fetchActivePass = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/seasonal-pass/active');
      const data = await res.json();
      if (data.success && data.pass) {
        setActivePass(data.pass);
        fetchRewards(data.pass.id);
        fetchProgress(data.pass.id);
      }
    } catch (error) {
      console.error('Failed to fetch active pass:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRewards = async (passId: number) => {
    try {
      const res = await fetch(`/api/seasonal-pass/${passId}/rewards`);
      const data = await res.json();
      if (data.success) {
        setRewards(data.rewards);
      }
    } catch (error) {
      console.error('Failed to fetch rewards:', error);
    }
  };

  const fetchProgress = async (passId: number) => {
    if (!authToken) return;
    try {
      const res = await fetch(`/api/seasonal-pass/${passId}/progress`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setProgress(data.progress);
      }
    } catch (error) {
      console.error('Failed to fetch progress:', error);
    }
  };

  const claimReward = async (rewardId: number) => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/seasonal-pass/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ rewardId })
      });
      const data = await res.json();
      if (data.success) {
        fetchProgress(activePass!.id);
      }
    } catch (error) {
      console.error('Failed to claim reward:', error);
    }
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const getXpForNextLevel = (level: number) => {
    return 100 + (level - 1) * 25;
  };

  const getRewardIcon = (type: string) => {
    switch (type) {
      case 'rankiard': return '⭐';
      case 'skin': return '🎨';
      case 'card': return '🃏';
      case 'avatar': return '👤';
      case 'title': return '🏆';
      default: return '🎁';
    }
  };

  const isRewardUnlocked = (reward: PassReward) => {
    if (!progress) return false;
    if (reward.isPremium && !progress.hasPremium) return false;
    return progress.currentLevel >= reward.level;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-slate-600">
        <div className="flex items-center justify-between p-4 border-b border-slate-600 bg-gradient-to-r from-amber-600 via-orange-500 to-red-500">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Crown className="w-6 h-6" />
            Pass Stagionale
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {loading && (
            <div className="text-center py-12 text-slate-400">
              Caricamento...
            </div>
          )}

          {!loading && !activePass && (
            <div className="text-center py-12">
              <Crown className="w-16 h-16 mx-auto mb-4 text-amber-400 opacity-50" />
              <p className="text-slate-400">Nessun pass stagionale attivo</p>
              <p className="text-slate-500 text-sm mt-2">Il prossimo pass arriverà presto!</p>
            </div>
          )}

          {activePass && (
            <>
              <div className="bg-gradient-to-r from-amber-900/50 to-orange-900/50 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                      <Zap className="w-6 h-6 text-yellow-400" />
                      {activePass.name}
                    </h3>
                    {activePass.description && (
                      <p className="text-slate-300 mt-1">{activePass.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-amber-400">
                      <Clock className="w-4 h-4" />
                      <span>{getDaysRemaining(activePass.endDate)} giorni rimasti</span>
                    </div>
                  </div>
                </div>

                {progress && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-bold">Livello {progress.currentLevel}</span>
                      <span className="text-slate-400 text-sm">
                        {progress.currentXp} / {getXpForNextLevel(progress.currentLevel)} XP
                      </span>
                    </div>
                    <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
                        style={{ width: `${(progress.currentXp / getXpForNextLevel(progress.currentLevel)) * 100}%` }}
                      />
                    </div>
                    {!progress.hasPremium && (
                      <button className="mt-4 w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2">
                        <Crown className="w-5 h-5" />
                        Sblocca Pass Premium
                      </button>
                    )}
                  </div>
                )}
              </div>

              <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                Ricompense ({rewards.length})
              </h4>

              <div className="space-y-3">
                {Array.from({ length: activePass.maxLevel }, (_, i) => i + 1).map(level => {
                  const freeReward = rewards.find(r => r.level === level && !r.isPremium);
                  const premiumReward = rewards.find(r => r.level === level && r.isPremium);
                  const unlocked = progress && progress.currentLevel >= level;

                  return (
                    <div key={level} className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        unlocked 
                          ? 'bg-green-500 text-white' 
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        {unlocked ? <Check className="w-5 h-5" /> : level}
                      </div>

                      <div className="flex-1 grid grid-cols-2 gap-3">
                        {freeReward ? (
                          <div className={`p-3 rounded-lg border ${
                            unlocked 
                              ? 'bg-green-900/30 border-green-600' 
                              : 'bg-slate-800 border-slate-700'
                          }`}>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{getRewardIcon(freeReward.rewardType)}</span>
                              <div>
                                <p className="text-white text-sm font-medium">{freeReward.rewardValue}</p>
                                <p className="text-slate-400 text-xs capitalize">{freeReward.rewardType}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50" />
                        )}

                        {premiumReward ? (
                          <div className={`p-3 rounded-lg border relative ${
                            unlocked && progress?.hasPremium
                              ? 'bg-amber-900/30 border-amber-600' 
                              : 'bg-slate-800 border-amber-700/50'
                          }`}>
                            <div className="absolute -top-2 -right-2">
                              <Crown className="w-5 h-5 text-amber-400" />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{getRewardIcon(premiumReward.rewardType)}</span>
                              <div>
                                <p className="text-white text-sm font-medium">{premiumReward.rewardValue}</p>
                                <p className="text-amber-400 text-xs capitalize">{premiumReward.rewardType}</p>
                              </div>
                            </div>
                            {!progress?.hasPremium && (
                              <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                                <Lock className="w-5 h-5 text-amber-400" />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-3 rounded-lg bg-slate-800/50 border border-amber-700/30" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
