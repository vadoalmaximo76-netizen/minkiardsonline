import React, { useState } from "react";

export function MagazineGrid() {
  const [clickedCard, setClickedCard] = useState<string | null>(null);

  const handleCardClick = (cardName: string) => {
    setClickedCard(cardName);
    setTimeout(() => setClickedCard(null), 300);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0E] text-white font-sans flex flex-col items-center overflow-x-hidden pb-10">
      <style>{`
        @keyframes pulse-click {
          0% { transform: scale(1); }
          50% { transform: scale(0.96); }
          100% { transform: scale(1); }
        }
        .click-anim {
          animation: pulse-click 0.3s ease-out;
        }
        .text-shadow {
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }
      `}</style>

      {/* Mobile Container max-width 390px */}
      <div className="w-full max-w-[390px] px-[10px] pt-4 flex flex-col gap-[10px]">
        
        {/* Header minimo */}
        <div className="flex justify-between items-center mb-2 px-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center font-bold shadow-lg shadow-purple-500/20">
              F
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-bold leading-tight tracking-wide text-gray-100">Fake</span>
              <span className="text-[11px] font-medium text-amber-400 leading-tight">1276 Punti</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-400 font-medium tracking-wider uppercase">Vittorie</span>
              <span className="text-[14px] font-bold text-gray-200">45<span className="text-gray-500 text-[11px]">/63</span></span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-400 font-medium tracking-wider uppercase">WR</span>
              <span className="text-[14px] font-bold text-green-400">71%</span>
            </div>
          </div>
        </div>

        {/* Riga 1: GIOCA (Hero) */}
        <div 
          onClick={() => handleCardClick('GIOCA')}
          className={`relative w-full h-[180px] rounded-[20px] overflow-hidden cursor-pointer shadow-lg shadow-emerald-900/20 flex flex-col justify-end p-5 transition-transform ${clickedCard === 'GIOCA' ? 'click-anim' : ''}`}
          style={{
            background: 'linear-gradient(135deg, #064E3B 0%, #022C22 100%)',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}
        >
          {/* Decorative shapes */}
          <div className="absolute top-[-20%] right-[-10%] w-[150px] h-[150px] bg-emerald-500/10 rounded-full blur-[30px]" />
          <div className="absolute bottom-0 right-4 text-[80px] opacity-10 drop-shadow-2xl translate-y-4 translate-x-4">🎮</div>
          
          <div className="absolute top-4 left-4 bg-emerald-500 text-black text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
            Multiplayer
          </div>
          
          <div className="relative z-10">
            <div className="text-[48px] mb-[-5px]">🎮</div>
            <h2 className="text-[32px] font-black tracking-tight text-white text-shadow leading-none mt-2">GIOCA</h2>
          </div>
        </div>

        {/* Riga 2: ALLENAMENTO + PALESTRE */}
        <div className="flex w-full gap-[10px]">
          <div 
            onClick={() => handleCardClick('ALLENAMENTO')}
            className={`relative w-[calc(50%-5px)] h-[130px] rounded-[16px] overflow-hidden cursor-pointer shadow-md flex flex-col justify-end p-4 ${clickedCard === 'ALLENAMENTO' ? 'click-anim' : ''}`}
            style={{
              background: 'linear-gradient(135deg, #1E3A8A 0%, #172554 100%)',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}
          >
            <div className="absolute top-[-10%] right-[-10%] w-[80px] h-[80px] bg-blue-500/10 rounded-full blur-[20px]" />
            <div className="absolute top-3 right-3 text-[32px] opacity-20">📚</div>
            
            <div className="relative z-10">
              <div className="text-[28px] mb-1">📚</div>
              <h3 className="text-[14px] font-bold text-white text-shadow leading-tight uppercase tracking-wide">Allenamento</h3>
            </div>
          </div>

          <div 
            onClick={() => handleCardClick('PALESTRE')}
            className={`relative w-[calc(50%-5px)] h-[130px] rounded-[16px] overflow-hidden cursor-pointer shadow-md flex flex-col justify-end p-4 ${clickedCard === 'PALESTRE' ? 'click-anim' : ''}`}
            style={{
              background: 'linear-gradient(135deg, #7F1D1D 0%, #450A0A 100%)',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}
          >
            <div className="absolute top-[-10%] right-[-10%] w-[80px] h-[80px] bg-red-500/10 rounded-full blur-[20px]" />
            <div className="absolute top-3 right-3 text-[32px] opacity-20">🛡️</div>
            
            <div className="relative z-10">
              <div className="text-[28px] mb-1">🛡️</div>
              <h3 className="text-[14px] font-bold text-white text-shadow leading-tight uppercase tracking-wide">Palestre</h3>
            </div>
          </div>
        </div>

        {/* Riga 3: STANZE + PROFILO + DRAFT */}
        <div className="flex w-full gap-[10px]">
          <div 
            onClick={() => handleCardClick('STANZE')}
            className={`relative w-[calc(33.333%-6.666px)] h-[100px] rounded-[14px] overflow-hidden cursor-pointer flex flex-col items-center justify-center p-2 ${clickedCard === 'STANZE' ? 'click-anim' : ''}`}
            style={{
              background: 'linear-gradient(135deg, #4C1D95 0%, #2E1065 100%)',
              border: '1px solid rgba(139, 92, 246, 0.2)'
            }}
          >
            <div className="text-[28px] mb-1">👥</div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-100">Stanze</span>
          </div>

          <div 
            onClick={() => handleCardClick('PROFILO')}
            className={`relative w-[calc(33.333%-6.666px)] h-[100px] rounded-[14px] overflow-hidden cursor-pointer flex flex-col items-center justify-center p-2 ${clickedCard === 'PROFILO' ? 'click-anim' : ''}`}
            style={{
              background: 'linear-gradient(135deg, #854D0E 0%, #422006 100%)',
              border: '1px solid rgba(234, 179, 8, 0.2)'
            }}
          >
            <div className="text-[28px] mb-1">👤</div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-yellow-100">Profilo</span>
          </div>

          <div 
            onClick={() => handleCardClick('DRAFT')}
            className={`relative w-[calc(33.333%-6.666px)] h-[100px] rounded-[14px] overflow-hidden cursor-pointer flex flex-col items-center justify-center p-2 ${clickedCard === 'DRAFT' ? 'click-anim' : ''}`}
            style={{
              background: 'linear-gradient(135deg, #0F766E 0%, #042F2E 100%)',
              border: '1px solid rgba(20, 184, 166, 0.2)'
            }}
          >
            <div className="text-[28px] mb-1">🔀</div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-100">Draft</span>
          </div>
        </div>

        {/* Riga 4: CLASSIFICA + FANTA */}
        <div className="flex w-full gap-[10px]">
          <div 
            onClick={() => handleCardClick('CLASSIFICA')}
            className={`relative w-[calc(50%-5px)] h-[80px] rounded-[14px] overflow-hidden cursor-pointer flex flex-row items-center justify-start px-4 gap-3 ${clickedCard === 'CLASSIFICA' ? 'click-anim' : ''}`}
            style={{
              background: 'linear-gradient(135deg, #B45309 0%, #78350F 100%)',
              border: '1px solid rgba(245, 158, 11, 0.2)'
            }}
          >
            <div className="text-[24px]">🏆</div>
            <span className="text-[13px] font-bold uppercase tracking-wider text-orange-100">Classifica</span>
          </div>

          <div 
            onClick={() => handleCardClick('FANTA')}
            className={`relative w-[calc(50%-5px)] h-[80px] rounded-[14px] overflow-hidden cursor-pointer flex flex-row items-center justify-start px-4 gap-3 ${clickedCard === 'FANTA' ? 'click-anim' : ''}`}
            style={{
              background: 'linear-gradient(135deg, #BE185D 0%, #831843 100%)',
              border: '1px solid rgba(236, 72, 153, 0.2)'
            }}
          >
            <div className="text-[24px]">👑</div>
            <span className="text-[13px] font-bold uppercase tracking-wider text-pink-100">Fanta</span>
          </div>
        </div>

      </div>
    </div>
  );
}
