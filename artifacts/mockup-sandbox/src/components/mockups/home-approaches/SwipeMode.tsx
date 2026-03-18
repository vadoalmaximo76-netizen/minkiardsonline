import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Types
type GameMode = {
  id: string;
  title: string;
  icon: string;
  description: string;
  badge: string;
  colorFrom: string;
  colorTo: string;
};

const MODES: GameMode[] = [
  {
    id: 'gioca',
    title: 'GIOCA',
    icon: '🎮',
    description: 'Partita multiplayer classificata contro altri giocatori.',
    badge: '1276 Rankiard',
    colorFrom: 'from-green-500',
    colorTo: 'to-emerald-700',
  },
  {
    id: 'allenamento',
    title: 'ALLENAMENTO',
    icon: '📚',
    description: 'Migliora le tue strategie giocando contro il bot.',
    badge: '63 Partite',
    colorFrom: 'from-blue-500',
    colorTo: 'to-indigo-700',
  },
  {
    id: 'palestre',
    title: 'PALESTRE',
    icon: '🛡️',
    description: 'Sconfiggi i capipalestra e conquista le medaglie.',
    badge: '45 Vittorie',
    colorFrom: 'from-orange-500',
    colorTo: 'to-red-700',
  },
  {
    id: 'stanze',
    title: 'STANZE',
    icon: '👥',
    description: 'Crea o unisciti a stanze private con i tuoi amici.',
    badge: 'Attivo',
    colorFrom: 'from-purple-500',
    colorTo: 'to-fuchsia-700',
  },
  {
    id: 'profilo',
    title: 'PROFILO',
    icon: '👤',
    description: 'Visualizza e personalizza le tue statistiche.',
    badge: 'Win Rate 71%',
    colorFrom: 'from-slate-500',
    colorTo: 'to-slate-800',
  },
  {
    id: 'draft',
    title: 'DRAFT',
    icon: '🔀',
    description: 'Crea il tuo mazzo al volo con scelte casuali.',
    badge: 'Nuovo',
    colorFrom: 'from-pink-500',
    colorTo: 'to-rose-700',
  },
  {
    id: 'classifica',
    title: 'CLASSIFICA',
    icon: '🏆',
    description: 'Scopri i migliori giocatori di Minkiards.',
    badge: 'Stagione 4',
    colorFrom: 'from-yellow-400',
    colorTo: 'to-amber-600',
  },
  {
    id: 'fanta',
    title: 'FANTA',
    icon: '👑',
    description: 'Gestisci il tuo FantaMinkiards e vinci premi.',
    badge: 'In corso',
    colorFrom: 'from-cyan-500',
    colorTo: 'to-blue-700',
  }
];

export function SwipeMode() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextMode = () => {
    setCurrentIndex((prev) => (prev + 1) % MODES.length);
  };

  const prevMode = () => {
    setCurrentIndex((prev) => (prev - 1 + MODES.length) % MODES.length);
  };

  const currentMode = MODES[currentIndex];

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans overflow-hidden flex flex-col items-center">
      <style>{`
        .carousel-container {
          perspective: 1000px;
          transform-style: preserve-3d;
        }
        .card-transition {
          transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
      `}</style>

      {/* Mobile container constraint */}
      <div className="w-full max-w-[390px] h-[100dvh] bg-neutral-900 shadow-2xl relative flex flex-col">
        
        {/* Header */}
        <header className="px-6 pt-12 pb-4 flex flex-col items-center z-10">
          <div className="text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-2 drop-shadow-sm">
            MINKIARDS
          </div>
          <h1 className="text-[18px] text-neutral-300 font-medium">
            Cosa vuoi fare, <span className="text-white font-bold">Fake</span>?
          </h1>
        </header>

        {/* Central Zone - Carousel */}
        <div className="flex-1 relative w-full flex items-center justify-center carousel-container touch-pan-y">
          {MODES.map((mode, idx) => {
            // Calculate relative position
            let diff = idx - currentIndex;
            if (diff > MODES.length / 2) diff -= MODES.length;
            if (diff < -MODES.length / 2) diff += MODES.length;

            // Only render cards close to current for performance
            if (Math.abs(diff) > 2) return null;

            const isCurrent = diff === 0;
            const translateX = diff * 240; // Spacing between cards
            const scale = isCurrent ? 1 : 0.85;
            const zIndex = 10 - Math.abs(diff);
            const opacity = isCurrent ? 1 : Math.max(0.2, 1 - Math.abs(diff) * 0.6);

            return (
              <div
                key={mode.id}
                className="absolute w-[280px] h-[420px] rounded-3xl card-transition cursor-grab active:cursor-grabbing"
                style={{
                  transform: \`translateX(\${translateX}px) scale(\${scale})\`,
                  zIndex,
                  opacity,
                }}
                onClick={() => {
                  if (diff === 1) nextMode();
                  if (diff === -1) prevMode();
                }}
              >
                {/* Card Content */}
                <div className={\`w-full h-full rounded-3xl bg-gradient-to-br \${mode.colorFrom} \${mode.colorTo} p-1 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)]\`}>
                  <div className="w-full h-full rounded-[20px] bg-black/40 backdrop-blur-sm border border-white/10 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
                    {/* Decorative background circle */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-white/5 rounded-full blur-2xl"></div>
                    
                    <div className="text-[80px] leading-none mb-6 drop-shadow-2xl z-10 select-none">
                      {mode.icon}
                    </div>
                    
                    <h2 className="text-[28px] font-black tracking-tight text-white mb-3 z-10 shadow-black drop-shadow-md uppercase">
                      {mode.title}
                    </h2>
                    
                    <p className="text-sm text-white/80 leading-snug line-clamp-2 px-2 z-10 mb-6 font-medium">
                      {mode.description}
                    </p>
                    
                    <div className="mt-auto z-10 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-inner">
                      <span className="text-sm font-bold text-white tracking-wide uppercase">
                        {mode.badge}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Navigation Overlay Hints */}
          <div className="absolute inset-y-0 left-0 w-16 z-20 flex items-center justify-start pl-2 pointer-events-none">
            <button 
              onClick={(e) => { e.stopPropagation(); prevMode(); }}
              className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/50 pointer-events-auto hover:text-white transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          </div>
          <div className="absolute inset-y-0 right-0 w-16 z-20 flex items-center justify-end pr-2 pointer-events-none">
            <button 
              onClick={(e) => { e.stopPropagation(); nextMode(); }}
              className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/50 pointer-events-auto hover:text-white transition-colors"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>

        {/* Indicators */}
        <div className="py-6 flex justify-center gap-2 z-10">
          {MODES.map((_, idx) => (
            <div 
              key={idx} 
              className={\`h-2 rounded-full transition-all duration-300 \${idx === currentIndex ? 'w-6 bg-white' : 'w-2 bg-white/20'}\`}
            />
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="p-6 pb-8 z-10 w-full">
          <button className={\`w-full h-[56px] rounded-xl font-black text-lg tracking-wider transition-all duration-300 transform active:scale-[0.98] shadow-lg flex items-center justify-center bg-gradient-to-r \${currentMode.colorFrom} \${currentMode.colorTo} text-white\`}>
            ENTRA IN {currentMode.title} <ChevronRight className="ml-2" />
          </button>
        </div>

      </div>
    </div>
  );
}
