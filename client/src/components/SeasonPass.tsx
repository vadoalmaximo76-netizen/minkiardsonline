import React, { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Loader2, Lock, CheckCircle2, Trophy, Star, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SeasonPassProps {
  userId: number;
  onClose: () => void;
}

interface Pass {
  id: number;
  name: string;
  maxLevel: number;
  endDate: string;
}

interface ProgressData {
  currentLevel: number;
  currentXp: number;
  hasPremium: boolean;
  claimedLevels: number[];
}

interface Reward {
  level: number;
  rewardType: "credits" | "pack" | "cosmetic";
  rewardValue: string | number;
  isPremium: boolean;
}

interface SeasonPassData {
  pass: Pass | null;
  progress: ProgressData;
  rewards: Reward[];
}

const XP_PER_LEVEL = 500;

const getRewardIcon = (type: string) => {
  switch (type) {
    case "credits":
      return "💰";
    case "pack":
      return "📦";
    case "cosmetic":
      return "🎨";
    default:
      return "🎁";
  }
};

export function SeasonPass({ userId, onClose }: SeasonPassProps) {
  const [data, setData] = useState<SeasonPassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<number | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const response = await fetch("/api/season-pass");
      if (!response.ok) throw new Error("Failed to fetch season pass data");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching season pass:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleClaim = async (level: number) => {
    setClaiming(level);
    try {
      const response = await fetch(`/api/season-pass/claim/${level}`, {
        method: "POST",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to claim reward");
      }
      toast({
        title: "Successo!",
        description: `Livello ${level} riscattato con successo.`,
      });
      await fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message,
      });
    } finally {
      setClaiming(null);
    }
  };

  const timeLeft = useMemo(() => {
    if (!data?.pass?.endDate) return "";
    const end = new Date(data.pass.endDate).getTime();
    const now = new Date().getTime();
    const diff = end - now;
    if (diff <= 0) return "Scaduto";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days}g ${hours}o`;
  }, [data?.pass?.endDate]);

  if (loading) {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="max-w-4xl bg-slate-900/95 text-white border-slate-800 flex items-center justify-center h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </DialogContent>
      </Dialog>
    );
  }

  if (!data?.pass) {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="max-w-4xl bg-slate-900/95 text-white border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Pass Stagionale</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Trophy className="w-16 h-16 text-slate-600" />
            <p className="text-xl text-slate-400">Nessun pass stagionale attivo</p>
            <Button onClick={onClose} variant="outline">Chiudi</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const levels = Array.from({ length: 30 }, (_, i) => i + 1);
  const xpProgress = (data.progress.currentXp / XP_PER_LEVEL) * 100;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] bg-slate-900/95 text-white border-slate-800 p-0 overflow-hidden">
        <div className="p-6 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-3xl font-black bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent uppercase tracking-tighter">
                {data.pass.name}
              </h2>
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Clock className="w-4 h-4" />
                <span>Scade tra: {timeLeft}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {!data.progress.hasPremium && (
                <Button 
                  variant="yellow" 
                  className="bg-yellow-500/10 border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black transition-all font-bold"
                >
                  <Star className="w-4 h-4 mr-2 fill-current" />
                  ATTIVA PREMIUM (500 💰)
                </Button>
              )}
              <div className="bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-700">
                <span className="text-slate-400 text-xs block uppercase font-bold">Livello Corrente</span>
                <span className="text-2xl font-black text-purple-400">{data.progress.currentLevel}</span>
              </div>
            </div>
          </div>

          <ScrollArea className="w-full whitespace-nowrap pb-4">
            <div className="inline-flex flex-col gap-2 min-w-full p-2">
              {/* Premium Row */}
              <div className="flex gap-4">
                <div className="w-24 flex items-center justify-end pr-4 shrink-0">
                  <span className="text-yellow-500 font-bold text-xs uppercase tracking-widest">Premium</span>
                </div>
                {levels.map((lvl) => {
                  const reward = data.rewards.find(r => r.level === lvl && r.isPremium);
                  const isUnlocked = data.progress.currentLevel >= lvl;
                  const isClaimed = data.progress.claimedLevels.includes(lvl) && reward;
                  const canClaim = isUnlocked && !isClaimed && data.progress.hasPremium && reward;

                  return (
                    <div 
                      key={`premium-${lvl}`}
                      className={cn(
                        "w-24 h-32 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all relative shrink-0",
                        data.progress.hasPremium 
                          ? (isUnlocked ? "bg-yellow-500/10 border-yellow-500/50" : "bg-slate-800/50 border-slate-700")
                          : "bg-slate-900/50 border-slate-800 grayscale opacity-50"
                      )}
                    >
                      {!data.progress.hasPremium && <Lock className="w-4 h-4 absolute top-2 right-2 text-yellow-500/50" />}
                      {isClaimed && <CheckCircle2 className="w-4 h-4 absolute top-2 right-2 text-green-500" />}
                      
                      <span className="text-2xl">{reward ? getRewardIcon(reward.rewardType) : "—"}</span>
                      <span className="text-xs font-bold text-yellow-500">{reward?.rewardValue || ""}</span>
                      
                      {canClaim && (
                        <Button 
                          size="sm" 
                          variant="yellow" 
                          className="h-6 text-[10px] px-2"
                          onClick={() => handleClaim(lvl)}
                          disabled={claiming === lvl}
                        >
                          {claiming === lvl ? <Loader2 className="w-3 h-3 animate-spin" /> : "RISCATTA"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Level Indicator Row */}
              <div className="flex gap-4 items-center">
                <div className="w-24 shrink-0" />
                {levels.map((lvl) => (
                  <div 
                    key={`level-${lvl}`}
                    className={cn(
                      "w-24 text-center text-sm font-black py-1 rounded-full shrink-0",
                      data.progress.currentLevel === lvl ? "bg-purple-500 text-white" : "text-slate-500"
                    )}
                  >
                    {lvl}
                  </div>
                ))}
              </div>

              {/* Free Row */}
              <div className="flex gap-4">
                <div className="w-24 flex items-center justify-end pr-4 shrink-0">
                  <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Free</span>
                </div>
                {levels.map((lvl) => {
                  const reward = data.rewards.find(r => r.level === lvl && !r.isPremium);
                  const isUnlocked = data.progress.currentLevel >= lvl;
                  const isClaimed = data.progress.claimedLevels.includes(lvl) && reward;
                  const canClaim = isUnlocked && !isClaimed && reward;

                  return (
                    <div 
                      key={`free-${lvl}`}
                      className={cn(
                        "w-24 h-32 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all relative shrink-0",
                        isUnlocked ? "bg-slate-700/50 border-slate-500" : "bg-slate-800/50 border-slate-700"
                      )}
                    >
                      {isClaimed && <CheckCircle2 className="w-4 h-4 absolute top-2 right-2 text-green-500" />}
                      
                      <span className="text-2xl">{reward ? getRewardIcon(reward.rewardType) : "—"}</span>
                      <span className="text-xs font-bold text-slate-300">{reward?.rewardValue || ""}</span>
                      
                      {canClaim && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-6 text-[10px] px-2 border-slate-400 text-slate-400 hover:bg-slate-400 hover:text-slate-900"
                          onClick={() => handleClaim(lvl)}
                          disabled={claiming === lvl}
                        >
                          {claiming === lvl ? <Loader2 className="w-3 h-3 animate-spin" /> : "RISCATTA"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <div className="space-y-2">
            <div className="flex justify-between text-sm font-bold">
              <span className="text-slate-400 uppercase tracking-tighter">Progresso Livello {data.progress.currentLevel}</span>
              <span className="text-purple-400">{data.progress.currentXp} / {XP_PER_LEVEL} XP</span>
            </div>
            <div className="relative h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner">
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 to-pink-500 transition-all duration-500 ease-out"
                style={{ width: `${xpProgress}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-black text-white/50 drop-shadow-md">
                  {Math.round(xpProgress)}% COMPLETATO
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
