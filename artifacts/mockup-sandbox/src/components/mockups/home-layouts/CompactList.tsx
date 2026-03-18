import React from 'react';

export function CompactList() {
  const playerData = {
    playerName: "Fake",
    puntiRankiard: 1276,
    partite: 63,
    vittorie: 45,
    winRate: "71%"
  };

  const listItems = [
    { id: 'allenamento', title: 'ALLENAMENTO', subtitle: 'Impara le meccaniche', icon: '📚', color: 'bg-blue-500/20 text-blue-400', badge: null },
    { id: 'palestre', title: 'PALESTRE', subtitle: 'Sfida i capipalestra', icon: '🛡️', color: 'bg-red-500/20 text-red-400', badge: '3' },
    { id: 'stanze', title: 'STANZE', subtitle: 'Gioca con amici', icon: '👥', color: 'bg-purple-500/20 text-purple-400', badge: null },
    { id: 'profilo', title: 'PROFILO', subtitle: `${playerData.vittorie}V - ${playerData.winRate} WR`, icon: '👤', color: 'bg-slate-500/20 text-slate-400', badge: null },
    { id: 'draft', title: 'DRAFT', subtitle: 'Crea il tuo deck', icon: '🔀', color: 'bg-orange-500/20 text-orange-400', badge: null },
    { id: 'classifica', title: 'CLASSIFICA', subtitle: 'Top giocatori', icon: '🏆', color: 'bg-yellow-500/20 text-yellow-400', badge: null },
    { id: 'fanta', title: 'FANTA', subtitle: 'Fantaminkiards', icon: '👑', color: 'bg-pink-500/20 text-pink-400', badge: 'New' },
  ];

  return (
    <div className="min-h-screen bg-[#070b14] text-white font-sans selection:bg-emerald-500/30 overflow-x-hidden w-full max-w-[390px] mx-auto flex flex-col relative shadow-2xl">
      <style>{`
        @keyframes slideRight {
          0% { transform: translateX(0); }
          50% { transform: translateX(4px); }
          100% { transform: translateX(0); }
        }
        .animate-slide-right {
          animation: slideRight 1.5s ease-in-out infinite;
        }
        .row-bg-even {
          background-color: #0c1120;
        }
        .row-bg-odd {
          background-color: #0a0e1a;
        }
      `}</style>

      {/* Header compatto - 48px */}
      <header className="h-[48px] px-4 flex items-center justify-between bg-[#0a0e1a] border-b border-white/5 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center font-black text-xs text-black">M</div>
          <span className="font-semibold text-[15px] text-slate-200">Ciao {playerData.playerName}</span>
        </div>
        <div className="flex items-center bg-[#151b2d] rounded-full px-2.5 py-1 border border-white/5">
          <span className="text-yellow-400 text-xs mr-1.5">★</span>
          <span className="text-xs font-bold text-slate-200">{playerData.puntiRankiard}</span>
        </div>
      </header>

      {/* Main CTA - GIOCA - 80px */}
      <button className="w-full h-[80px] bg-gradient-to-r from-emerald-600 to-emerald-500 flex items-center px-5 group relative overflow-hidden flex-shrink-0 active:scale-[0.98] transition-transform">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
        <div className="absolute right-0 top-0 w-32 h-full bg-gradient-to-l from-black/20 to-transparent"></div>
        
        <div className="w-12 h-12 bg-black/20 rounded-full flex items-center justify-center text-2xl mr-4 z-10 shadow-inner">
          🎮
        </div>
        
        <div className="flex flex-col items-start z-10">
          <span className="font-black text-[22px] tracking-wide text-white drop-shadow-md leading-tight">GIOCA ORA</span>
          <span className="text-emerald-100 text-[13px] font-medium opacity-90">Trova una partita classificata</span>
        </div>
        
        <div className="ml-auto z-10 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm group-hover:bg-white/30 transition-colors animate-slide-right">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>

      {/* Separator */}
      <div className="h-[1px] w-full bg-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>

      {/* Lista densa */}
      <div className="flex-1 overflow-y-auto pb-8">
        {listItems.map((item, index) => (
          <button 
            key={item.id}
            className={`w-full h-[64px] px-4 flex items-center active:opacity-70 transition-opacity border-b border-white/5 ${index % 2 === 0 ? 'row-bg-even' : 'row-bg-odd'}`}
          >
            {/* Icon Circle */}
            <div className={`w-[40px] h-[40px] rounded-full flex items-center justify-center text-[20px] mr-3.5 flex-shrink-0 ${item.color}`}>
              {item.icon}
            </div>
            
            {/* Text Column */}
            <div className="flex flex-col items-start justify-center flex-1 min-w-0 pr-3">
              <span className="font-bold text-[15px] text-slate-100 leading-tight truncate w-full text-left">{item.title}</span>
              <span className="text-[12px] text-slate-400 font-medium mt-0.5 truncate w-full text-left">{item.subtitle}</span>
            </div>
            
            {/* Right Side (Badge + Chevron) */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {item.badge && (
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  item.badge === 'New' 
                    ? 'bg-pink-500 text-white shadow-[0_0_8px_rgba(236,72,153,0.4)]' 
                    : 'bg-white/10 text-slate-300'
                }`}>
                  {item.badge}
                </div>
              )}
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}

        {/* Info footer */}
        <div className="pt-6 pb-4 px-4 flex justify-between items-center text-[10px] text-slate-600 font-medium uppercase tracking-wider">
          <span>Minkiards v2.4.1</span>
          <span>{playerData.partite} Partite giocate</span>
        </div>
      </div>
    </div>
  );
}
