import React, { useState } from 'react';
import { Gamepad2, GraduationCap, Shield, Users, User, Shuffle, Trophy, Crown } from 'lucide-react';

export function CardFan() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const stats = {
    playerName: "Fake",
    puntiRankiard: 1276,
    gamesPlayed: 63,
    gamesWon: 45,
    winRate: "71%"
  };

  const cards = [
    { id: 'profilo', title: 'PROFILO', icon: User, color: 'from-blue-500 to-cyan-400', rotation: -35, tx: -110, ty: 80, z: 10 },
    { id: 'allenamento', title: 'ALLENAMENTO', icon: GraduationCap, color: 'from-green-500 to-emerald-400', rotation: -20, tx: -70, ty: 30, z: 20 },
    { id: 'palestre', title: 'PALESTRE', icon: Shield, color: 'from-red-500 to-rose-400', rotation: -10, tx: -30, ty: 10, z: 30 },
    { id: 'gioca', title: 'GIOCA', icon: Gamepad2, color: 'from-amber-400 to-orange-500', rotation: 0, tx: 0, ty: -20, z: 50, isMain: true },
    { id: 'stanze', title: 'STANZE', icon: Users, color: 'from-indigo-500 to-purple-400', rotation: 10, tx: 30, ty: 10, z: 30 },
    { id: 'draft', title: 'DRAFT', icon: Shuffle, color: 'from-fuchsia-500 to-pink-400', rotation: 20, tx: 70, ty: 30, z: 20 },
    { id: 'classifica', title: 'CLASSIFICA', icon: Trophy, color: 'from-yellow-400 to-amber-300', rotation: 30, tx: 110, ty: 70, z: 15 },
    { id: 'fanta', title: 'FANTA', icon: Crown, color: 'from-violet-500 to-purple-500', rotation: 40, tx: 140, ty: 110, z: 10 },
  ];

  return (
    <div className="relative w-full min-h-screen max-w-[414px] mx-auto overflow-hidden bg-[#08091a] font-sans flex flex-col items-center select-none">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/20 to-transparent pointer-events-none" />

      {/* Header Section */}
      <div className="w-full pt-16 pb-8 px-6 flex flex-col items-center z-10 relative">
        <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-purple-200 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)] mb-2">
          MINKIARDS
        </h1>
        <p className="text-purple-200 font-medium text-lg mb-6">
          Ciao, {stats.playerName}
        </p>

        {/* Stats Pill */}
        <div className="flex items-center space-x-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-xl">
          <span className="flex items-center gap-1 text-yellow-400"><span className="text-base">⭐</span> {stats.puntiRankiard}</span>
          <div className="w-px h-4 bg-white/20" />
          <span className="flex items-center gap-1 text-blue-300"><span className="text-base">🎮</span> {stats.gamesPlayed}</span>
          <div className="w-px h-4 bg-white/20" />
          <span className="flex items-center gap-1 text-green-400"><span className="text-base">🏆</span> {stats.gamesWon}</span>
          <div className="w-px h-4 bg-white/20" />
          <span className="text-purple-300">{stats.winRate}</span>
        </div>
      </div>

      {/* Cards Fan Container */}
      <div className="absolute bottom-[-40px] left-1/2 -translate-x-1/2 w-[300px] h-[400px] flex justify-center items-end pb-20 perspective-[1000px]">
        {cards.map((card, idx) => {
          const isHovered = hoveredIndex === idx;
          const isAnyHovered = hoveredIndex !== null;
          
          // Compute spacing to make room for hovered card
          let pushX = 0;
          if (isAnyHovered && !isHovered) {
            pushX = idx < hoveredIndex ? -20 : 20;
          }

          const hoverScale = card.isMain ? 1.05 : 1.08;
          const hoverTy = card.isMain ? -30 : -20;
          
          const currentScale = isHovered ? hoverScale : 1;
          const currentTy = card.ty + (isHovered ? hoverTy : 0);
          const currentTx = card.tx + pushX;
          const currentRot = isHovered ? 0 : card.rotation;
          const currentZ = isHovered ? 100 : card.z;

          return (
            <div
              key={card.id}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="absolute origin-bottom transition-all duration-300 ease-out cursor-pointer"
              style={{
                width: card.isMain ? '160px' : '130px',
                height: card.isMain ? '220px' : '190px',
                transform: `translateX(${currentTx}px) translateY(${currentTy}px) rotate(${currentRot}deg) scale(${currentScale})`,
                zIndex: currentZ,
                opacity: (isAnyHovered && !isHovered) ? 0.6 : 1,
              }}
            >
              <div className={`relative w-full h-full rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 border-2 ${card.isMain ? 'border-amber-400/80 shadow-[0_0_30px_rgba(245,158,11,0.4)]' : 'border-white/10'} bg-gradient-to-b from-[#151936] to-[#0d1024]`}>
                
                {/* Glow & Border Gradients */}
                <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-20`} />
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50" />
                
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

                {/* Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                  <div className={`p-4 rounded-full mb-3 bg-gradient-to-br ${card.color} shadow-lg relative`}>
                    <div className="absolute inset-0 bg-black/20 rounded-full" />
                    <card.icon className={`relative z-10 ${card.isMain ? 'w-10 h-10' : 'w-7 h-7'} text-white`} strokeWidth={2.5} />
                  </div>
                  
                  <h3 className={`font-bold text-center tracking-wide text-white drop-shadow-md ${card.isMain ? 'text-xl' : 'text-sm'}`}>
                    {card.title}
                  </h3>
                  
                  {card.isMain && (
                    <div className="mt-3 px-3 py-1 bg-amber-500/20 text-amber-300 text-xs font-bold rounded-full border border-amber-500/30">
                      MULTIPLAYER
                    </div>
                  )}
                </div>

                {/* Glossy reflection */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none transform -skew-x-12" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
