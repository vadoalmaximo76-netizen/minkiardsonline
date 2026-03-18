import React, { useState } from 'react';

const CARDS = [
  {
    id: 'gioca',
    title: 'GIOCA',
    subtitle: 'Partita multiplayer',
    icon: '🎮',
    gradient: 'from-emerald-400 to-emerald-700',
    shadow: 'shadow-[0_12px_40px_rgba(16,185,129,0.4)]',
    badge: '🏆 1276 Rankiard'
  },
  {
    id: 'allenamento',
    title: 'ALLENAMENTO',
    subtitle: 'Sfida la CPU',
    icon: '📚',
    gradient: 'from-blue-400 to-blue-700',
    shadow: 'shadow-[0_12px_40px_rgba(59,130,246,0.4)]',
    badge: 'Bots di vario livello'
  },
  {
    id: 'palestre',
    title: 'PALESTRE',
    subtitle: 'Eventi speciali',
    icon: '🛡️',
    gradient: 'from-purple-400 to-purple-700',
    shadow: 'shadow-[0_12px_40px_rgba(168,85,247,0.4)]',
    badge: 'Premi esclusivi'
  }
];

export function CardDeck() {
  const [activeIndex, setActiveIndex] = useState(0);

  const nextCard = () => {
    setActiveIndex((prev) => (prev + 1) % CARDS.length);
  };

  const prevCard = () => {
    setActiveIndex((prev) => (prev - 1 + CARDS.length) % CARDS.length);
  };

  // Touch handling for swipe
  const [touchStart, setTouchStart] = useState<number | null>(null);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    
    if (diff > 50) {
      nextCard();
    } else if (diff < -50) {
      prevCard();
    }
    setTouchStart(null);
  };

  return (
    <div className="min-h-screen bg-[#0F1115] text-white font-sans overflow-hidden flex flex-col relative w-full max-w-[390px] mx-auto border-x border-white/10 shadow-2xl">
      <style>{`
        .card-enter {
          animation: card-in 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        @keyframes card-in {
          from { opacity: 0; transform: translateY(40px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Header */}
      <header className="flex justify-between items-center p-6 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-lg shadow-lg">M</div>
          <span className="font-bold tracking-wider text-sm">MINKIARDS</span>
        </div>
        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5">
          <div className="flex items-center gap-1.5">
            <span className="text-yellow-400 text-xs">⭐</span>
            <span className="font-semibold text-sm">1276</span>
          </div>
          <div className="w-[1px] h-3 bg-white/20"></div>
          <div className="text-sm font-semibold text-emerald-400">71%</div>
        </div>
      </header>

      {/* Main Deck Area */}
      <main className="flex-1 flex flex-col items-center justify-center relative pb-10"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}>
        
        {/* Card Stack Container */}
        <div className="relative w-[340px] h-[340px] flex items-center justify-center">
          
          {CARDS.map((card, idx) => {
            // Calculate relative position (-1, 0, 1)
            let relIndex = (idx - activeIndex + CARDS.length) % CARDS.length;
            if (relIndex > 2) relIndex = -1; // Hide others
            
            if (relIndex === -1) return null; // Don't render cards far away

            const isTop = relIndex === 0;
            const isSecond = relIndex === 1;
            const isThird = relIndex === 2;

            return (
              <div 
                key={card.id}
                className={`absolute w-full h-[200px] rounded-3xl border-2 transition-all duration-300 ease-out overflow-hidden cursor-pointer
                  bg-gradient-to-br ${card.gradient}
                  ${isTop ? `border-white/80 z-30 ${card.shadow}` : 'border-white/20 opacity-90'}
                  ${isSecond ? 'z-20' : ''}
                  ${isThird ? 'z-10' : ''}
                `}
                style={{
                  transform: `
                    translateY(${relIndex * 28}px) 
                    scale(${1 - relIndex * 0.05})
                  `,
                  filter: !isTop ? `brightness(${1 - relIndex * 0.2})` : 'none',
                }}
                onClick={() => {
                  if (!isTop) {
                    setActiveIndex(idx);
                  }
                }}
              >
                {/* Card Pattern/Texture Overlay */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
                
                {/* Shine effect on top card */}
                {isTop && (
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 transform -translate-x-full animate-[shimmer_3s_infinite]"></div>
                )}

                <div className="relative h-full flex flex-col justify-between p-6">
                  {/* Top: Icon */}
                  <div className="text-4xl filter drop-shadow-md">
                    {card.icon}
                  </div>

                  {/* Middle: Title & Subtitle */}
                  <div className="text-center transform -translate-y-2">
                    <h2 className="text-3xl font-black tracking-tight text-white drop-shadow-lg">
                      {card.title}
                    </h2>
                    {isTop && (
                      <p className="text-sm font-medium text-white/90 mt-1 drop-shadow">
                        {card.subtitle}
                      </p>
                    )}
                  </div>

                  {/* Bottom: Badge */}
                  <div className="flex justify-center">
                    <div className="bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20 text-xs font-semibold shadow-inner">
                      {card.badge}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Swipe Label */}
        <div className="mt-8 flex flex-col items-center gap-4">
          <p className="text-[11px] text-white/40 uppercase tracking-widest font-semibold flex items-center gap-2">
            Scorri per cambiare 
            <span className="inline-block animate-bounce-x">→</span>
          </p>

          {/* Dots */}
          <div className="flex gap-2">
            {CARDS.map((_, i) => (
              <div 
                key={i} 
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i === activeIndex ? 'bg-white w-6' : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Bar */}
      <nav className="bg-[#161920]/90 backdrop-blur-xl border-t border-white/5 px-2 py-4 pb-8 z-40">
        <div className="flex justify-around items-end max-w-sm mx-auto">
          {[
            { icon: '👥', label: 'STANZE', id: 'stanze' },
            { icon: '👤', label: 'PROFILO', id: 'profilo' },
            { icon: '🔀', label: 'DRAFT', id: 'draft', active: true },
            { icon: '🏆', label: 'RANK', id: 'classifica' },
            { icon: '👑', label: 'FANTA', id: 'fanta' }
          ].map((item) => (
            <button 
              key={item.id} 
              className={`flex flex-col items-center gap-1.5 transition-all ${
                item.active ? '-translate-y-2' : 'hover:-translate-y-1'
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all ${
                item.active 
                  ? 'bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-[0_8px_24px_rgba(99,102,241,0.4)] text-white' 
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}>
                {item.icon}
              </div>
              <span className={`text-[9px] font-bold tracking-wide ${
                item.active ? 'text-white' : 'text-white/40'
              }`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      <style>{`
        @keyframes bounce-x {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(4px); }
        }
        .animate-bounce-x {
          animation: bounce-x 1.5s ease-in-out infinite;
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
