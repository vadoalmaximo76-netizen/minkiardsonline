import React from 'react';
import { Play, BookOpen, Shield, Users, User, Shuffle, Trophy, Crown } from 'lucide-react';

export function RefinedA() {
  const player = {
    name: "Fake",
    puntiRankiard: 1276,
    partite: 63,
    vittorie: 45,
    winRate: 71,
    rango: "Sfidante"
  };

  const menuItems = [
    { id: 'gioca', label: 'GIOCA', icon: <Play size={36} className="text-emerald-400" />, bg: 'bg-emerald-950/40', border: 'border-emerald-500/20' },
    { id: 'allenamento', label: 'ALLEN.', icon: <BookOpen size={36} className="text-blue-400" />, bg: 'bg-blue-950/40', border: 'border-blue-500/20' },
    { id: 'palestre', label: 'PALESTRE', icon: <Shield size={36} className="text-indigo-400" />, bg: 'bg-indigo-950/40', border: 'border-indigo-500/20' },
    { id: 'stanze', label: 'STANZE', icon: <Users size={36} className="text-orange-400" />, bg: 'bg-orange-950/40', border: 'border-orange-500/20' },
    { id: 'profilo', label: 'PROFILO', icon: <User size={36} className="text-zinc-400" />, bg: 'bg-zinc-900/60', border: 'border-zinc-700/50' },
    { id: 'draft', label: 'DRAFT', icon: <Shuffle size={36} className="text-purple-400" />, bg: 'bg-purple-950/40', border: 'border-purple-500/20' },
    { id: 'classifica', label: 'RANK', icon: <Trophy size={36} className="text-yellow-400" />, bg: 'bg-yellow-950/40', border: 'border-yellow-500/20' },
    { id: 'fanta', label: 'FANTA', icon: <Crown size={36} className="text-pink-400" />, bg: 'bg-pink-950/40', border: 'border-pink-500/20' },
  ];

  return (
    <div className="flex justify-center bg-black min-h-screen font-sans text-white selection:bg-emerald-500/30">
      <style>{`
        .shimmer-btn {
          position: relative;
          overflow: hidden;
        }
        .shimmer-btn::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            to right,
            transparent 0%,
            rgba(255, 255, 255, 0.1) 40%,
            rgba(255, 255, 255, 0.4) 50%,
            rgba(255, 255, 255, 0.1) 60%,
            transparent 100%
          );
          transform: rotate(30deg);
          animation: shimmer 3s infinite;
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%) rotate(30deg); }
          100% { transform: translateX(100%) rotate(30deg); }
        }
        .hexagon {
          clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
        }
        .secondary-label {
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <div className="w-[390px] h-[844px] bg-zinc-950 relative overflow-hidden flex flex-col shadow-2xl border-x border-zinc-900">
        
        {/* Header / Progression - Compact padding */}
        <div className="px-4 pt-6 pb-2 bg-gradient-to-b from-indigo-950/40 to-transparent flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-[52px] h-[52px] bg-gradient-to-br from-indigo-500 to-purple-600 hexagon flex items-center justify-center p-[2px]">
                <div className="w-full h-full bg-zinc-900 hexagon flex items-center justify-center">
                  <span className="font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-purple-400 text-lg">
                    S
                  </span>
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight leading-none">{player.name}</h1>
                <p className="secondary-label text-indigo-400 mt-1">{player.rango}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-white leading-none">{player.puntiRankiard}</div>
              <div className="secondary-label text-zinc-500 mt-1">PUNTI RANKIARD</div>
            </div>
          </div>

          <div className="mt-4 mb-1 relative">
            <div className="relative h-[6px] bg-zinc-800 rounded-full">
              <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full w-[85%]"></div>
              {/* Bubble with exactly 85% */}
              <div className="absolute top-[-26px] left-[85%] -translate-x-1/2 bg-white text-black text-[10px] font-bold px-1.5 py-0.5 rounded shadow-[0_0_10px_rgba(255,255,255,0.3)] after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-white">
                85%
              </div>
            </div>
          </div>

          <div className="flex justify-center mt-0">
            <p className="text-[11px] text-zinc-400 font-medium tracking-wide">
              {player.partite} Partite <span className="text-zinc-600 mx-1">•</span> {player.vittorie} Vittorie <span className="text-zinc-600 mx-1">•</span> {player.winRate}% Win Rate
            </p>
          </div>
        </div>

        {/* CTA Section - Minimal padding */}
        <div className="px-4 py-2 flex flex-col items-center z-10">
          <button className="w-full h-[60px] bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-2xl flex items-center justify-center gap-2 text-white font-black text-xl tracking-wide shadow-[0_4px_20px_rgba(16,185,129,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-transform shimmer-btn border border-emerald-400/30">
            <Play fill="currentColor" size={22} />
            GIOCA ORA
          </button>
          <div className="mt-2.5 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="secondary-label text-emerald-400/80 tracking-wider">3 giocatori online</span>
          </div>
        </div>

        {/* Grid Nav - 3 columns, h:80px, layout orizzontale/aligned to left */}
        <div className="flex-1 px-4 pt-2 pb-6 overflow-y-auto no-scrollbar">
          <div className="grid grid-cols-3 gap-2.5">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className={\`\${item.bg} \${item.border} border rounded-2xl h-[80px] flex flex-col items-start justify-between p-3 hover:bg-opacity-80 transition-colors\`}
              >
                <div className="flex items-center w-[36px] h-[36px] opacity-90">
                  {item.icon}
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold tracking-wide text-left w-full truncate text-zinc-100">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
