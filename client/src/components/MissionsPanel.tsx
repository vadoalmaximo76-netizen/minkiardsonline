import React, { useState, useEffect } from "react";
import { Target, Gift, Clock, CheckCircle, Loader2, X, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { CoinAnimation } from "./CoinAnimation";
import { useAudio } from "../lib/stores/useAudio";

interface Mission {
  id: number;
  missionId: number;
  name: string;
  description: string;
  type: string;
  requirement: number;
  rewardPoints: number;
  difficulty: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

interface MissionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string | null;
  onPointsUpdated?: (newTotal: number) => void;
}

export const MissionsPanel: React.FC<MissionsPanelProps> = ({
  isOpen,
  onClose,
  authToken,
  onPointsUpdated
}) => {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [coinAnimation, setCoinAnimation] = useState<{ active: boolean; points: number }>({ active: false, points: 0 });
  const { playPanelOpen, playButtonClick } = useAudio();

  useEffect(() => {
    if (isOpen) {
      playPanelOpen();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && authToken) {
      fetchMissions();
    }
  }, [isOpen, authToken]);

  const fetchMissions = async () => {
    if (!authToken) return;
    
    try {
      setLoading(true);
      const response = await fetch('/api/missions', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMissions(data.missions || []);
      }
    } catch (error) {
      console.error('Error fetching missions:', error);
    } finally {
      setLoading(false);
    }
  };

  const claimReward = async (missionId: number) => {
    playButtonClick();
    if (!authToken) return;
    
    try {
      setClaiming(missionId);
      const response = await fetch('/api/missions/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ missionId })
      });

      if (response.ok) {
        const data = await response.json();
        const claimedMission = missions.find(m => m.id === missionId);
        setMissions(prev => prev.map(m => 
          m.id === missionId ? { ...m, claimed: true } : m
        ));
        if (claimedMission) {
          setCoinAnimation({ active: true, points: claimedMission.rewardPoints });
        }
        if (onPointsUpdated && data.newTotal !== undefined) {
          onPointsUpdated(data.newTotal);
        }
      }
    } catch (error) {
      console.error('Error claiming reward:', error);
    } finally {
      setClaiming(null);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'hard': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'Facile';
      case 'medium': return 'Media';
      case 'hard': return 'Difficile';
      default: return difficulty;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <CoinAnimation
        isActive={coinAnimation.active}
        pointsAwarded={coinAnimation.points}
        onComplete={() => setCoinAnimation({ active: false, points: 0 })}
      />
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-xl border border-cyan-500/30 shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Target className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Missioni Giornaliere</h2>
              <p className="text-xs text-white/60 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Si resettano ogni giorno a mezzanotte
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

        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          ) : missions.length === 0 ? (
            <div className="text-center py-8 text-white/60">
              <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nessuna missione disponibile</p>
              <p className="text-sm">Accedi per vedere le tue missioni</p>
            </div>
          ) : (
            missions.map((mission) => (
              <div 
                key={mission.id}
                className={`p-4 rounded-lg border transition-all ${
                  mission.claimed 
                    ? 'bg-green-900/20 border-green-500/30' 
                    : mission.completed 
                      ? 'bg-yellow-900/20 border-yellow-500/50 shadow-lg shadow-yellow-500/10'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white">{mission.name}</h3>
                      <span className={`text-xs ${getDifficultyColor(mission.difficulty)}`}>
                        {getDifficultyLabel(mission.difficulty)}
                      </span>
                    </div>
                    <p className="text-sm text-white/70">{mission.description}</p>
                  </div>
                  <div className="flex items-center gap-1 text-yellow-400">
                    <Gift className="w-4 h-4" />
                    <span className="font-bold">+{mission.rewardPoints}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Progresso</span>
                    <span className="text-white font-medium">
                      {Math.min(mission.progress, mission.requirement)} / {mission.requirement}
                    </span>
                  </div>
                  <Progress 
                    value={Math.min((mission.progress / mission.requirement) * 100, 100)} 
                    className="h-2"
                  />
                </div>

                {mission.claimed ? (
                  <div className="mt-3 flex items-center justify-center gap-2 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Ricompensa riscattata!</span>
                  </div>
                ) : mission.completed ? (
                  <Button
                    onClick={() => claimReward(mission.id)}
                    disabled={claiming === mission.id}
                    className="w-full mt-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold"
                  >
                    {claiming === mission.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Gift className="w-4 h-4 mr-2" />
                        Riscatta +{mission.rewardPoints} Punti
                      </>
                    )}
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
    </>
  );
};
