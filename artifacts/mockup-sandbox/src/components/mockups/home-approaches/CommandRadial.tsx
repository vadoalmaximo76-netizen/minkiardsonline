import React, { useState, useEffect } from 'react';

// Hardcoded Data
const PLAYER_DATA = {
  playerName: "Fake",
  puntiRankiard: 1276,
  partite: 63,
  vittorie: 45,
  winRate: 71,
};

const RADIAL_ITEMS = [
  { id: 'allenamento', label: 'ALLENAMENTO', icon: '📚', color: 'from-blue-500 to-cyan-400' },
  { id: 'palestre', label: 'PALESTRE', icon: '🛡️', color: 'from-orange-500 to-red-500' },
  { id: 'stanze', label: 'STANZE', icon: '👥', color: 'from-green-500 to-emerald-400' },
  { id: 'profilo', label: 'PROFILO', icon: '👤', color: 'from-purple-500 to-indigo-500' },
  { id: 'draft', label: 'DRAFT', icon: '🔀', color: 'from-yellow-400 to-orange-500' },
  { id: 'classifica', label: 'CLASSIFICA', icon: '🏆', color: 'from-amber-300 to-yellow-500' },
  { id: 'fanta', label: 'FANTA', icon: '👑', color: 'from-pink-500 to-rose-400' },
];

export function CommandRadial() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate positions for radial items
  const radius = 130; // pixels
  const centerOffset = 58 / 2; // half of item size
  const totalItems = RADIAL_ITEMS.length;
  
  // Custom styles for animations
  const customStyles = `
    @keyframes pulse-ring {
      0% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.5); }
      70% { transform: scale(1); box-shadow: 0 0 0 20px rgba(139, 92, 246, 0); }
      100% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
    }
    .animate-pulse-ring {
      animation: pulse-ring 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
    .animate-float {
      animation: float 4s ease-in-out infinite;
    }
    .vignette-bg {
      background: radial-gradient(circle at center, #1a1f35 0%, #060a14 100%);
    }
  `;

  return (
    <div className="relative w-full min-h-[844px] max-w-[390px] mx-auto overflow-hidden text-white font-sans flex flex-col items-center vignette-bg shadow-2xl shadow-black/50">
      <style>{customStyles}</style>

      {/* Header Stats */}
      <div className="w-full flex justify-between items-start px-6 pt-12 pb-4 z-10">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
            MINKIARDS
          </h1>
          <div className="flex items-center gap-2 mt-1 opacity-80 text-xs font-medium">
            <span className="bg-white/10 px-2 py-0.5 rounded-full backdrop-blur-sm">P: {PLAYER_DATA.partite}</span>
            <span className="bg-white/10 px-2 py-0.5 rounded-full backdrop-blur-sm">V: {PLAYER_DATA.vittorie} ({PLAYER_DATA.winRate}%)</span>
          </div>
        </div>
        <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-colors">
          ⚙️
        </button>
      </div>

      {/* Radial UI Container */}
      <div className="flex-1 flex items-center justify-center w-full relative z-10 my-8">
        <div className="relative w-[320px] h-[320px] flex items-center justify-center">
          
          {/* Connecting Lines SVG */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" style={{ zIndex: 0 }}>
            {RADIAL_ITEMS.map((_, index) => {
              const angle = (index * (360 / totalItems) * Math.PI) / 180 - Math.PI / 2;
              const x2 = 160 + radius * Math.cos(angle);
              const y2 = 160 + radius * Math.sin(angle);
              return (
                <line 
                  key={`line-${index}`}
                  x1="160" y1="160" 
                  x2={x2} y2={y2} 
                  stroke="white" 
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              );
            })}
          </svg>

          {/* Center Player Node */}
          <div className="relative z-20 flex flex-col items-center justify-center" style={{ zIndex: 20 }}>
            <div className="absolute inset-0 rounded-full animate-pulse-ring"></div>
            <button 
              className="relative w-24 h-24 rounded-full bg-gradient-to-br from-violet-600 to-indigo-900 border-4 border-indigo-400/50 shadow-[0_0_30px_rgba(99,102,241,0.5)] flex items-center justify-center overflow-hidden hover:scale-105 transition-transform"
              onClick={() => setActiveTab('profilo')}
            >
              <div className="absolute inset-0 bg-[url('https://api.dicebear.com/7.x/avataaars/svg?seed=Fake')] bg-cover opacity-50 mix-blend-overlay"></div>
              <span className="text-4xl font-bold text-white relative z-10 drop-shadow-md">F</span>
            </button>
            <div className="mt-3 flex flex-col items-center bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-2xl border border-white/10">
              <span className="text-sm font-bold tracking-wide">{PLAYER_DATA.playerName}</span>
              <span className="text-xs text-yellow-400 font-semibold flex items-center gap-1">
                ⭐ {PLAYER_DATA.puntiRankiard}
              </span>
            </div>
          </div>

          {/* Radial Nodes */}
          {RADIAL_ITEMS.map((item, index) => {
            // Start from top (-90deg) and go clockwise
            const angle = (index * (360 / totalItems) * Math.PI) / 180 - Math.PI / 2;
            const left = 160 + radius * Math.cos(angle) - centerOffset;
            const top = 160 + radius * Math.sin(angle) - centerOffset;
            const delay = index * 100;

            return (
              <div 
                key={item.id}
                className={`absolute flex flex-col items-center justify-center transition-all duration-700 ease-out ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
                style={{ 
                  left: \`\${left}px\`, 
                  top: \`\${top}px\`,
                  transitionDelay: \`\${delay}ms\`,
                  zIndex: 10
                }}
              >
                <button 
                  className={\`w-[58px] h-[58px] rounded-full bg-gradient-to-br \${item.color} p-[2px] shadow-lg hover:scale-110 transition-transform focus:outline-none animate-float\`}
                  style={{ animationDelay: \`\${index * 0.2}s\` }}
                  onClick={() => setActiveTab(item.id)}
                >
                  <div className="w-full h-full rounded-full bg-[#060a14] flex items-center justify-center relative overflow-hidden">
                    <div className={\`absolute inset-0 bg-gradient-to-br \${item.color} opacity-20\`}></div>
                    <span className="text-2xl relative z-10">{item.icon}</span>
                  </div>
                </button>
                <span className="text-[10px] font-bold mt-2 tracking-wider text-white/80 bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Play Action */}
      <div className="w-full px-6 pb-12 pt-6 z-20 mt-auto">
        <button 
          className="w-full relative group overflow-hidden rounded-2xl"
          onClick={() => setActiveTab('gioca')}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl"></div>
          
          {/* Shine effect */}
          <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
          
          <div className="relative px-6 py-5 flex items-center justify-center gap-3 bg-black/20 hover:bg-transparent transition-colors">
            <span className="text-2xl filter drop-shadow-md">🎮</span>
            <span className="text-xl font-black tracking-widest text-white drop-shadow-md">
              GIOCA ORA
            </span>
          </div>
          
          <style>{`
            @keyframes shimmer {
              100% { transform: translateX(50%); }
            }
          `}</style>
        </button>
      </div>

      {/* Simple Active Tab Overlay for interactivity demonstration */}
      {activeTab && activeTab !== 'gioca' && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-[#1a1f35] border border-white/10 rounded-2xl p-6 w-full max-w-sm flex flex-col items-center text-center shadow-2xl">
            <span className="text-6xl mb-4">
              {RADIAL_ITEMS.find(i => i.id === activeTab)?.icon || '🎮'}
            </span>
            <h2 className="text-2xl font-bold mb-2 text-white">
              {RADIAL_ITEMS.find(i => i.id === activeTab)?.label || 'GIOCA'}
            </h2>
            <p className="text-white/60 mb-6 text-sm">
              This section is under construction. Navigate here to access related features.
            </p>
            <button 
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors font-bold"
              onClick={() => setActiveTab(null)}
            >
              TORNA AL COMANDO
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
