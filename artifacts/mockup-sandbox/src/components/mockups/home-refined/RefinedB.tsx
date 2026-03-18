import React from 'react';

export function RefinedB() {
  const data = {
    playerName: "Fake",
    puntiRankiard: 1276,
    partite: 63,
    vittorie: 45,
    winRate: "71%",
    rango: "Sfidante"
  };

  const gridPanels = [
    { id: 'stanze', title: 'Stanze', icon: '👥', color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { id: 'profilo', title: 'Profilo', icon: '👤', color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { id: 'fanta', title: 'Fanta', icon: '👑', color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { id: 'allenamento', title: 'Allenamento', icon: '📚', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { id: 'palestre', title: 'Palestre', icon: '🛡️', color: 'text-rose-400', bg: 'bg-rose-400/10' },
    { id: 'draft', title: 'Draft', icon: '🔀', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  ];

  return (
    <div className="flex justify-center items-center min-h-screen bg-black overflow-hidden font-sans select-none">
      <style>{`
        @keyframes subtle-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(16, 185, 129, 0.4); }
          50% { transform: scale(1.02); box-shadow: 0 0 30px rgba(16, 185, 129, 0.6); }
        }
        .animate-gioca {
          animation: subtle-pulse 3s infinite ease-in-out;
        }
        @keyframes float-badge {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }
        .animate-badge {
          animation: float-badge 4s infinite ease-in-out;
        }
      `}</style>

      {/* Main Container - Strict Mobile Boundary */}
      <div className="w-full max-w-[390px] h-[844px] bg-zinc-950 text-zinc-50 flex flex-col relative overflow-hidden ring-1 ring-zinc-800/50 shadow-2xl">
        
        {/* Decorative Background Glows */}
        <div className="absolute top-[-100px] left-[-100px] w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-[-100px] right-[-100px] w-[300px] h-[300px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        {/* 1. HEADER (56px) */}
        <header className="h-[56px] shrink-0 flex items-center justify-between px-5 border-b border-zinc-800/60 z-10 bg-zinc-950/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-xs font-black text-black">M</div>
            <div className="font-bold text-lg tracking-tight">MINKIARDS</div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded-full border border-zinc-800">
            <span className="text-xs font-medium text-zinc-300">Ciao {data.playerName}</span>
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
          </div>
        </header>

        {/* 2. RANK STRIP (90px) */}
        <section className="h-[90px] shrink-0 flex items-center px-5 gap-4 bg-gradient-to-r from-zinc-900/80 to-zinc-900/40 border-b border-zinc-800/40 relative z-10 overflow-hidden">
          {/* Rank Badge */}
          <div className="w-[64px] h-[64px] shrink-0 relative flex items-center justify-center animate-badge">
            <div 
              className="absolute inset-0 bg-gradient-to-br from-amber-300 via-amber-500 to-orange-600 shadow-lg shadow-amber-500/20"
              style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
            ></div>
            <div 
              className="absolute inset-[3px] bg-zinc-900 flex items-center justify-center"
              style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
            >
              <span className="text-2xl font-black bg-gradient-to-br from-amber-200 to-amber-500 bg-clip-text text-transparent">S</span>
            </div>
          </div>

          {/* Rank Info */}
          <div className="flex flex-col justify-center gap-1.5 flex-1">
            <div className="flex items-baseline gap-2">
              <h2 className="text-xl font-bold text-zinc-100 leading-none tracking-tight">{data.rango}</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden flex-1">
                <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300 w-[70%] rounded-full relative">
                  <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]"></div>
                </div>
              </div>
              <span className="text-[10px] font-bold text-amber-500 whitespace-nowrap">{data.puntiRankiard} PT</span>
            </div>
          </div>

          {/* Stats Column */}
          <div className="flex flex-col items-end justify-center gap-1 shrink-0 pl-3 border-l border-zinc-800/60">
            <div className="text-[10px] font-medium tracking-wide"><span className="text-zinc-500">PARTITE</span> <span className="text-zinc-200 ml-1">{data.partite}</span></div>
            <div className="text-[10px] font-medium tracking-wide"><span className="text-zinc-500">VITTORIE</span> <span className="text-zinc-200 ml-1">{data.vittorie}</span></div>
            <div className="text-[10px] font-bold tracking-wide"><span className="text-zinc-500">WIN RATE</span> <span className="text-emerald-400 ml-1">{data.winRate}</span></div>
          </div>
        </section>

        {/* 3. GRID 2x3 (270px) */}
        <section className="h-[270px] shrink-0 grid grid-cols-2 grid-rows-3 gap-3 px-5 pt-5 z-10">
          {gridPanels.map((panel) => (
            <button 
              key={panel.id}
              className="h-[75px] bg-zinc-900/60 hover:bg-zinc-800/80 active:bg-zinc-800 border border-zinc-800/80 rounded-2xl flex items-center px-3 gap-3 transition-all active:scale-[0.97] group"
            >
              <div className={`w-[42px] h-[42px] shrink-0 rounded-xl ${panel.bg} flex items-center justify-center text-xl shadow-inner border border-white/5`}>
                {panel.icon}
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-[13px] text-zinc-200 group-hover:text-white transition-colors">{panel.title}</div>
              </div>
              <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
            </button>
          ))}
        </section>

        {/* 4. GIOCA BUTTON (68px = 56px h + 12px mt) */}
        <section className="px-5 mt-4 h-[56px] shrink-0 z-10">
          <button className="w-full h-full bg-emerald-500 text-zinc-950 font-black text-xl rounded-2xl flex items-center justify-center gap-2 animate-gioca active:scale-[0.98] transition-transform">
            <span>GIOCA ORA</span>
            <span className="text-2xl drop-shadow-sm">🎮</span>
          </button>
        </section>

        {/* Spacer to push Quick Links down if needed, but we keep it static */}
        <div className="flex-1"></div>

        {/* 5. QUICK LINKS (60px) */}
        <section className="h-[60px] shrink-0 flex items-center justify-between px-5 gap-2 z-10 border-t border-zinc-800/40 bg-zinc-950/50 mt-auto">
          {['Allena', 'Palestre', 'Draft', 'Classifica'].map((label, i) => (
            <button 
              key={label}
              className={`flex-1 h-[38px] rounded-xl text-[11px] font-bold flex items-center justify-center transition-colors active:scale-95
                ${i === 3 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'}`}
            >
              {label}
            </button>
          ))}
        </section>

        {/* 6. PADDING BOTTOM (30px) */}
        <div className="h-[30px] shrink-0 w-full bg-zinc-950 z-10"></div>

      </div>
    </div>
  );
}
