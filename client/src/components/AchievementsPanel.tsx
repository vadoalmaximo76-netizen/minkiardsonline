import React, { useState, useEffect } from "react";
import { Trophy, Gift, CheckCircle, Loader2, X, Lock, Star } from "lucide-react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { CoinAnimation } from "./CoinAnimation";

interface Achievement {
  id: number;
  code: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  requirement: number;
  rewardPoints: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

interface AchievementsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string | null;
  onPointsUpdated?: (newTotal: number) => void;
}

const CATEGORY_ORDER = ['bronze', 'silver', 'gold', 'legendary'];

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  bronze: { 
    bg: 'from-amber-900/30 to-amber-950/30', 
    border: 'border-amber-600/50', 
    text: 'text-amber-400',
    glow: 'shadow-amber-500/20'
  },
  silver: { 
    bg: 'from-slate-400/20 to-slate-600/20', 
    border: 'border-slate-400/50', 
    text: 'text-slate-300',
    glow: 'shadow-slate-400/20'
  },
  gold: { 
    bg: 'from-yellow-600/30 to-yellow-800/30', 
    border: 'border-yellow-500/50', 
    text: 'text-yellow-400',
    glow: 'shadow-yellow-500/30'
  },
  legendary: { 
    bg: 'from-purple-600/30 to-pink-600/30', 
    border: 'border-purple-500/50', 
    text: 'text-purple-400',
    glow: 'shadow-purple-500/30'
  }
};

const CATEGORY_LABELS: Record<string, string> = {
  bronze: 'Bronzo',
  silver: 'Argento',
  gold: 'Oro',
  legendary: 'Leggendario'
};

export const AchievementsPanel: React.FC<AchievementsPanelProps> = ({
  isOpen,
  onClose,
  authToken,
  onPointsUpdated
}) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [coinAnimation, setCoinAnimation] = useState<{ active: boolean; points: number }>({ active: false, points: 0 });

  useEffect(() => {
    if (isOpen && authToken) {
      fetchAchievements();
    }
  }, [isOpen, authToken]);

  const fetchAchievements = async () => {
    if (!authToken) return;
    
    try {
      setLoading(true);
      const response = await fetch('/api/achievements', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAchievements(data.achievements || []);
      }
    } catch (error) {
      console.error('Error fetching achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const claimReward = async (achievementId: number) => {
    if (!authToken) return;
    
    try {
      setClaiming(achievementId);
      const response = await fetch('/api/achievements/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ achievementId })
      });

      if (response.ok) {
        const data = await response.json();
        const claimedAchievement = achievements.find(a => a.id === achievementId);
        setAchievements(prev => prev.map(a => 
          a.id === achievementId ? { ...a, claimed: true } : a
        ));
        if (claimedAchievement) {
          setCoinAnimation({ active: true, points: claimedAchievement.rewardPoints });
        }
        if (onPointsUpdated && data.newTotal !== undefined) {
          onPointsUpdated(data.newTotal);
        }
      }
    } catch (error) {
      console.error('Error claiming achievement:', error);
    } finally {
      setClaiming(null);
    }
  };

  const filteredAchievements = selectedCategory === 'all' 
    ? achievements 
    : achievements.filter(a => a.category === selectedCategory);

  const groupedAchievements = CATEGORY_ORDER.reduce((acc, category) => {
    const categoryAchievements = filteredAchievements.filter(a => a.category === category);
    if (categoryAchievements.length > 0) {
      acc[category] = categoryAchievements;
    }
    return acc;
  }, {} as Record<string, Achievement[]>);

  const completedCount = achievements.filter(a => a.completed).length;
  const totalCount = achievements.length;

  if (!isOpen) return null;

  return (
    <>
      <CoinAnimation
        isActive={coinAnimation.active}
        pointsAwarded={coinAnimation.points}
        onComplete={() => setCoinAnimation({ active: false, points: 0 })}
      />
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-xl border border-purple-500/30 shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Trophy className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Achievements</h2>
              <p className="text-xs text-white/60 flex items-center gap-1">
                <Star className="w-3 h-3" />
                {completedCount} / {totalCount} completati
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <div className="flex gap-2 p-3 border-b border-white/10 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-white text-black'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Tutti
          </button>
          {CATEGORY_ORDER.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                selectedCategory === category
                  ? `bg-gradient-to-r ${CATEGORY_COLORS[category].bg} ${CATEGORY_COLORS[category].text} ${CATEGORY_COLORS[category].border} border`
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>

        <div className="p-4 overflow-y-auto max-h-[55vh] space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            </div>
          ) : Object.keys(groupedAchievements).length === 0 ? (
            <div className="text-center py-8 text-white/60">
              <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nessun achievement trovato</p>
            </div>
          ) : (
            Object.entries(groupedAchievements).map(([category, categoryAchievements]) => (
              <div key={category}>
                <h3 className={`text-lg font-bold mb-3 ${CATEGORY_COLORS[category].text}`}>
                  {CATEGORY_LABELS[category]}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {categoryAchievements.map((achievement) => (
                    <div 
                      key={achievement.id}
                      className={`p-4 rounded-lg border transition-all bg-gradient-to-br ${CATEGORY_COLORS[category].bg} ${
                        achievement.claimed 
                          ? 'border-green-500/50' 
                          : achievement.completed 
                            ? `${CATEGORY_COLORS[category].border} shadow-lg ${CATEGORY_COLORS[category].glow}`
                            : 'border-white/10'
                      } ${!achievement.completed ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`text-3xl ${achievement.completed ? '' : 'grayscale opacity-50'}`}>
                          {achievement.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-white truncate">{achievement.name}</h4>
                            {achievement.claimed && (
                              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                            )}
                            {!achievement.completed && (
                              <Lock className="w-4 h-4 text-white/40 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-white/60 mb-2">{achievement.description}</p>
                          
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-white/50">
                                {Math.min(achievement.progress, achievement.requirement)} / {achievement.requirement}
                              </span>
                              <span className="text-yellow-400 font-medium flex items-center gap-1">
                                <Gift className="w-3 h-3" />
                                +{achievement.rewardPoints}
                              </span>
                            </div>
                            <Progress 
                              value={Math.min((achievement.progress / achievement.requirement) * 100, 100)} 
                              className="h-1.5"
                            />
                          </div>

                          {achievement.completed && !achievement.claimed && (
                            <Button
                              onClick={() => claimReward(achievement.id)}
                              disabled={claiming === achievement.id}
                              size="sm"
                              className="w-full mt-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold text-xs h-7"
                            >
                              {claiming === achievement.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>Riscatta</>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
    </>
  );
};
