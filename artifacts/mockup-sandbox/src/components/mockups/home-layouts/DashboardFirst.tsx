import React from "react";
import { Bell, Trophy, Zap, Crosshair, Users, User, Shuffle, Crown, PlayCircle } from "lucide-react";

export function DashboardFirst() {
  const playerData = {
    playerName: "Fake",
    puntiRankiard: 1276,
    partite: 63,
    vittorie: 45,
    winRate: "71%"
  };

  const actions = [
    { id: "allenamento", label: "ALLENAMENTO", icon: <Zap size={24} />, color: "bg-slate-800" },
    { id: "palestre", label: "PALESTRE", icon: <Crosshair size={24} />, color: "bg-slate-800" },
    { id: "stanze", label: "STANZE", icon: <Users size={24} />, color: "bg-slate-800" },
    { id: "profilo", label: "PROFILO", icon: <User size={24} />, color: "bg-slate-800" },
    { id: "draft", label: "DRAFT", icon: <Shuffle size={24} />, color: "bg-slate-800" },
    { id: "classifica", label: "CLASSIFICA", icon: <Trophy size={24} />, color: "bg-slate-800" },
    { id: "fanta", label: "FANTA", icon: <Crown size={24} />, color: "bg-slate-800" },
  ];

  return (
    <div className="min-h-screen text-white font-sans overflow-hidden flex flex-col relative" style={{ backgroundColor: "#0a0e1a" }}>
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(124, 58, 237, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(124, 58, 237, 0); }
        }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
          100% { transform: translateY(0px); }
        }
        .animate-pulse-ring {
          animation: pulse-ring 2s infinite;
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .bg-grad-purple {
          background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
        }
        .bg-card-dark {
          background-color: #12183a;
        }
        .text-accent-purple {
          color: #a855f7;
        }
        .border-accent-purple {
          border-color: #7c3aed;
        }
      `}</style>

      {/* Header */}
      <header className="flex justify-between items-center p-4 z-10">
        <h1 className="text-sm font-black tracking-widest text-white opacity-80">MINKIARDS</h1>
        <button className="relative p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
          <Bell size={20} className="text-gray-300" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 border border-[#0a0e1a]"></span>
        </button>
      </header>

      {/* Player Card Section (~40% height visually) */}
      <div className="flex-1 px-4 pt-2 pb-6 flex flex-col justify-center items-center z-10 min-h-[40vh]">
        <div 
          className="bg-card-dark w-full max-w-sm rounded-3xl border border-accent-purple p-6 flex flex-col items-center relative overflow-hidden shadow-[0_0_30px_rgba(124,58,237,0.15)]"
        >
          {/* Background decoration */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-600/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl"></div>

          <div className="relative mb-4">
            <div className="w-[72px] h-[72px] rounded-full bg-grad-purple p-[2px] animate-pulse-ring">
              <div className="w-full h-full rounded-full bg-[#0a0e1a] flex items-center justify-center overflow-hidden">
                <div className="w-full h-full bg-grad-purple opacity-80 flex items-center justify-center">
                  <User size={32} className="text-white drop-shadow-md" />
                </div>
              </div>
            </div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#0a0e1a] border border-accent-purple rounded-full px-2 py-0.5 flex items-center shadow-lg">
              <span className="text-[10px] font-bold text-white whitespace-nowrap">LVL 42</span>
            </div>
          </div>

          <h2 className="text-2xl font-black text-white mb-1 tracking-tight">{playerData.playerName}</h2>
          
          <div className="flex items-center space-x-2 mb-6">
            <Trophy size={14} className="text-yellow-400" />
            <span className="text-sm font-bold text-yellow-400">{playerData.puntiRankiard} Rankiard</span>
          </div>

          <div className="flex w-full space-x-2">
            <div className="flex-1 bg-white/5 rounded-2xl p-3 flex flex-col items-center border border-white/5">
              <span className="text-xs text-gray-400 font-medium mb-1">Win Rate</span>
              <span className="text-xl font-black text-green-400">{playerData.winRate}</span>
            </div>
            <div className="flex-[1.5] bg-white/5 rounded-2xl p-3 flex flex-col items-center justify-center border border-white/5">
              <span className="text-xs text-gray-400 font-medium mb-1">Score</span>
              <span className="text-sm font-bold text-white">{playerData.vittorie} <span className="text-gray-500 font-medium">Vittorie su</span> {playerData.partite}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="px-4 pb-8 z-10">
        <div className="w-full max-w-sm mx-auto grid grid-cols-2 gap-3">
          
          {/* Main Action (GIOCA) */}
          <button 
            className="col-span-2 relative overflow-hidden rounded-2xl p-4 flex items-center justify-center space-x-3 transition-transform active:scale-95 shadow-[0_4px_20px_rgba(22,163,74,0.3)]"
            style={{ backgroundColor: "#16a34a" }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite]"></div>
            <PlayCircle size={28} className="text-white animate-float" />
            <span className="text-xl font-black text-white tracking-wider">GIOCA</span>
          </button>

          {/* Other Actions */}
          {actions.map((action) => (
            <button 
              key={action.id}
              className={`col-span-1 rounded-2xl p-4 flex flex-col items-center justify-center space-y-2 transition-transform active:scale-95 border border-white/5 hover:bg-white/10`}
              style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
            >
              <div className="text-gray-300 group-hover:text-white transition-colors">
                {action.icon}
              </div>
              <span className="text-[11px] font-bold text-gray-400 tracking-wider uppercase">{action.label}</span>
            </button>
          ))}
          
        </div>
      </div>

      {/* Global decorative styles that tailwind might not support perfectly inline */}
      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
