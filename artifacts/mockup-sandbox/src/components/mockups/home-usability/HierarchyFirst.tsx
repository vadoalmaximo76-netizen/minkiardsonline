import React from 'react';

export function HierarchyFirst() {
  const player = {
    name: "Fake",
    puntiRankiard: 1276,
    partite: 63,
    vittorie: 45,
    winRate: 71,
    rango: "Sfidante"
  };

  const menuItems = [
    { id: '02', title: 'ALLENAMENTO', icon: '📚', desc: 'Pratica contro l\\'IA' },
    { id: '03', title: 'PALESTRE', icon: '🛡️', desc: 'Sfide settimanali' },
    { id: '04', title: 'STANZE', icon: '👥', desc: 'Gioca con amici' },
    { id: '05', title: 'PROFILO', icon: '👤', desc: 'Statistiche e deck' },
    { id: '06', title: 'DRAFT', icon: '🔀', desc: 'Costruisci e combatti' },
    { id: '07', title: 'CLASSIFICA', icon: '🏆', desc: 'Top giocatori globali' },
    { id: '08', title: 'FANTA', icon: '👑', desc: 'FantaMinkiards' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white font-sans flex flex-col items-center">
      <style>{`
        .pulse-subtle {
          animation: pulse-subtle 2s infinite;
        }
        @keyframes pulse-subtle {
          0% { opacity: 1; }
          50% { opacity: 0.8; }
          100% { opacity: 1; }
        }
      `}</style>

      <div className="w-full max-w-[390px] min-h-screen flex flex-col pt-6 pb-8 px-4 relative">
        
        {/* Header - Player Identity */}
        <div className="flex justify-between items-center mb-6 px-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#8a2be2] flex items-center justify-center font-bold text-[13px]">
              {player.name.charAt(0)}
            </div>
            <div>
              <div className="text-[13px] font-bold text-white">{player.name}</div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wider">{player.rango}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[13px] font-mono text-[#8a2be2]">{player.puntiRankiard} PR</div>
            <div className="text-[10px] text-gray-400">Rankiard</div>
          </div>
        </div>

        {/* 01 - GIOCA: Primary Action */}
        <div className="flex items-stretch gap-3 mb-6">
          <div className="w-4 flex flex-col justify-center items-center">
            <div className="text-[9px] text-gray-500 font-mono rotate-180" style={{ writingMode: 'vertical-rl' }}>01 / ACTION</div>
            <div className="flex-1 w-[1px] bg-gray-800 my-2"></div>
          </div>
          
          <button className="flex-1 h-[72px] bg-[#10b981] hover:bg-[#059669] active:bg-[#047857] rounded-lg flex items-center justify-center gap-3 transition-colors pulse-subtle group">
            <span className="text-[24px] group-hover:scale-110 transition-transform">🎮</span>
            <span className="text-[20px] font-black tracking-widest text-white shadow-sm">GIOCA ORA</span>
          </button>
        </div>

        {/* 02 - IL TUO RANGO: Horizontal Strip */}
        <div className="flex items-stretch gap-3 mb-6">
          <div className="w-4 flex flex-col justify-center items-center">
            <div className="text-[9px] text-gray-500 font-mono rotate-180" style={{ writingMode: 'vertical-rl' }}>02 / STATUS</div>
            <div className="flex-1 w-[1px] bg-gray-800 my-2"></div>
          </div>

          <div className="flex-1 bg-[#151b2b] rounded-lg p-3 flex items-center border border-gray-800/50">
            <div className="w-[48px] h-[48px] bg-gradient-to-br from-[#8a2be2] to-[#4b0082] rounded flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(138,43,226,0.2)]">
              <span className="text-[24px]">🛡️</span>
            </div>
            <div className="ml-4 flex-1">
              <div className="flex justify-between items-end mb-1">
                <span className="text-[15px] font-bold text-white tracking-wide">{player.rango}</span>
                <span className="text-[10px] text-gray-400 font-mono">{player.puntiRankiard} / 1500 PR</span>
              </div>
              <div className="w-full h-[4px] bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-[#8a2be2] w-[85%] rounded-full"></div>
              </div>
              <div className="flex gap-4 mt-2">
                <div className="text-[10px] text-gray-400"><span className="text-white font-mono">{player.vittorie}</span> Vinte</div>
                <div className="text-[10px] text-gray-400"><span className="text-white font-mono">{player.winRate}%</span> WR</div>
              </div>
            </div>
          </div>
        </div>

        {/* 03 - SEZIONI: Vertical List */}
        <div className="flex items-stretch gap-3 mb-6 flex-1">
          <div className="w-4 flex flex-col items-center">
            <div className="text-[9px] text-gray-500 font-mono rotate-180 mt-2" style={{ writingMode: 'vertical-rl' }}>03 / NAV</div>
            <div className="flex-1 w-[1px] bg-gray-800 my-2"></div>
          </div>

          <div className="flex-1 flex flex-col gap-2">
            {menuItems.map((item, index) => (
              <button 
                key={item.id}
                className="w-full bg-[#111623] hover:bg-[#1a2133] active:bg-[#20283d] rounded p-3 flex items-center transition-colors border border-transparent hover:border-gray-700/50 text-left"
              >
                <div className="w-8 flex justify-center text-[18px] opacity-80">{item.icon}</div>
                <div className="ml-3 flex-1">
                  <div className="text-[15px] font-bold tracking-wide text-gray-100">{item.title}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{item.desc}</div>
                </div>
                <div className="text-[10px] text-gray-600 font-mono">{item.id}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 04 - NEWS: Last Row */}
        <div className="flex items-stretch gap-3 mt-auto">
          <div className="w-4 flex flex-col justify-center items-center">
            <div className="text-[9px] text-gray-500 font-mono rotate-180" style={{ writingMode: 'vertical-rl' }}>04 / INFO</div>
          </div>

          <div className="flex-1 bg-[#151b2b] rounded p-3 flex items-center justify-between border-l-2 border-[#10b981]">
            <div className="flex flex-col">
              <span className="text-[10px] text-[#10b981] font-bold uppercase tracking-wider mb-1">Stagione 4 Live</span>
              <span className="text-[13px] text-gray-300">Nuove carte disponibili nello shop!</span>
            </div>
            <span className="text-[15px]">🔥</span>
          </div>
        </div>

      </div>
    </div>
  );
}
