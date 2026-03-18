import React, { useState } from 'react';

export function HeroTray() {
  const [clicked, setClicked] = useState<string | null>(null);

  const stats = {
    playerName: "Fake",
    puntiRankiard: 1276,
    partite: 63,
    vittorie: 45,
    winRate: "71%"
  };

  const sections = [
    { id: 'allenamento', name: 'ALLENAMENTO', icon: '📚', color: 'from-blue-500 to-indigo-600' },
    { id: 'palestre', name: 'PALESTRE', icon: '🛡️', color: 'from-orange-500 to-red-500' },
    { id: 'stanze', name: 'STANZE', icon: '👥', color: 'from-purple-500 to-fuchsia-600' },
    { id: 'profilo', name: 'PROFILO', icon: '👤', color: 'from-zinc-500 to-zinc-700' },
    { id: 'draft', name: 'DRAFT', icon: '🔀', color: 'from-cyan-400 to-blue-500' },
    { id: 'classifica', name: 'CLASSIFICA', icon: '🏆', color: 'from-yellow-400 to-amber-600' },
    { id: 'fanta', name: 'FANTA', icon: '👑', color: 'from-pink-500 to-rose-600' }
  ];

  const handleAction = (action: string) => {
    setClicked(action);
    setTimeout(() => setClicked(null), 300);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#030712] text-white font-sans overflow-hidden select-none touch-manipulation relative">
      <style>
        {`
          @keyframes hero-pulse {
            0%, 100% { box-shadow: 0 0 20px 2px rgba(16, 185, 129, 0.4); }
            50% { box-shadow: 0 0 40px 10px rgba(16, 185, 129, 0.7); }
          }
          @keyframes float-pattern {
            0% { background-position: 0px 0px; }
            100% { background-position: 40px 40px; }
          }
          .hero-bg-pattern {
            background-color: #0a1628;
            background-image: 
              linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.03) 75%, rgba(255,255,255,0.03)), 
              linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.03) 75%, rgba(255,255,255,0.03));
            background-size: 40px 40px;
            background-position: 0 0, 20px 20px;
            animation: float-pattern 30s linear infinite;
          }
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}
      </style>

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
        <div className="font-black text-xl tracking-tighter italic text-white drop-shadow-md">
          MINKIARDS
        </div>
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
          <div className="text-sm font-semibold truncate max-w-[80px] text-zinc-300">{stats.playerName}</div>
          <div className="flex items-center gap-1 bg-yellow-500/20 px-2 py-0.5 rounded-full">
            <span className="text-xs">⭐</span>
            <span className="text-sm font-bold text-yellow-400">{stats.puntiRankiard}</span>
          </div>
        </div>
      </div>

      {/* Hero Zone (55%) */}
      <div className="h-[55vh] relative flex flex-col items-center justify-center hero-bg-pattern shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-10 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a1628] via-transparent to-transparent z-0 pointer-events-none"></div>
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none"></div>
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-teal-500/10 rounded-full blur-[80px] pointer-events-none"></div>

        <button 
          onClick={() => handleAction('gioca')}
          className={\`relative z-10 flex flex-col items-center justify-center w-64 h-64 rounded-full bg-gradient-to-br from-[#059669] to-[#0d9488] transition-transform duration-150 ease-out border-4 border-emerald-400/50 \${clicked === 'gioca' ? 'scale-95' : 'scale-100 hover:scale-[1.02]'}\`}
          style={{ animation: clicked === 'gioca' ? 'none' : 'hero-pulse 3s infinite ease-in-out' }}
        >
          {/* Inner ring */}
          <div className="absolute inset-2 border-2 border-white/20 rounded-full border-dashed"></div>
          
          <div className="text-6xl mb-2 drop-shadow-lg filter">🎮</div>
          <div className="text-4xl font-black tracking-tight text-white drop-shadow-md">GIOCA</div>
          <div className="text-sm font-medium text-emerald-100 mt-1 uppercase tracking-widest bg-black/20 px-3 py-1 rounded-full">Partita multiplayer</div>
        </button>
      </div>

      {/* Tray Zone (45%) */}
      <div className="h-[45vh] bg-[#030712] flex flex-col pt-6 pb-8 relative z-20">
        
        {/* Stats Summary */}
        <div className="px-6 mb-6">
          <div className="flex justify-between items-center text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wider">
            <span>Statistiche Rapide</span>
          </div>
          <div className="flex justify-between bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800/50">
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-white">{stats.partite}</span>
              <span className="text-xs text-zinc-400">Partite</span>
            </div>
            <div className="w-px bg-zinc-800"></div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-white">{stats.vittorie}</span>
              <span className="text-xs text-zinc-400">Vittorie</span>
            </div>
            <div className="w-px bg-zinc-800"></div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-emerald-400">{stats.winRate}</span>
              <span className="text-xs text-zinc-400">Win Rate</span>
            </div>
          </div>
        </div>

        {/* Tray Content */}
        <div className="flex-1 flex flex-col justify-end pb-8">
          <div className="px-6 mb-4 flex items-center gap-2">
            <div className="h-px bg-zinc-800 flex-1"></div>
            <span className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Altro</span>
            <div className="h-px bg-zinc-800 flex-1"></div>
          </div>

          {/* Dock / Tray Row */}
          <div className="w-full overflow-x-auto hide-scrollbar px-4 pb-4">
            <div className="flex gap-4 min-w-max px-2 items-end">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => handleAction(section.id)}
                  className="flex flex-col items-center gap-2 group outline-none"
                >
                  <div className={\`w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-lg bg-gradient-to-br \${section.color} border border-white/10 transition-transform duration-150 \${clicked === section.id ? 'scale-90' : 'scale-100 group-hover:-translate-y-2'}\`}>
                    {section.icon}
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400 group-hover:text-white transition-colors">{section.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
