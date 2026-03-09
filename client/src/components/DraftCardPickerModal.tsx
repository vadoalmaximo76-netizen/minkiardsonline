import React, { useState, useEffect, useRef } from 'react';
import { X, Star, Sparkles } from 'lucide-react';

export interface PickerCard {
  cardId: string;
  name: string;
  frontImage: string;
  deckType: string;
  rarity: 'comune' | 'rara' | 'epica' | 'leggendaria';
  credits: number;
}

interface DraftCardPickerModalProps {
  cards: PickerCard[];
  onSelect: (card: PickerCard) => void;
  onClose: () => void;
  title?: string;
}

const RARITY_STYLES: Record<string, { border: string; glow: string; badge: string; label: string }> = {
  comune:     { border: 'border-gray-500',   glow: '',                                    badge: 'bg-gray-700 text-gray-300',    label: 'Comune' },
  rara:       { border: 'border-blue-400',   glow: 'shadow-blue-500/60',                  badge: 'bg-blue-700 text-blue-100',    label: 'Rara' },
  epica:      { border: 'border-purple-400', glow: 'shadow-purple-500/70 shadow-lg',       badge: 'bg-purple-700 text-purple-100',label: 'Epica' },
  leggendaria:{ border: 'border-yellow-400', glow: 'shadow-yellow-400/80 shadow-xl',       badge: 'bg-yellow-600 text-yellow-100',label: 'Leggendaria' },
};

export function DraftCardPickerModal({ cards, onSelect, onClose, title = 'Scegli la tua ricompensa' }: DraftCardPickerModalProps) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const revealDone = revealedCount >= cards.length;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRevealedCount(prev => {
        if (prev >= cards.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 480);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [cards.length]);

  const handleSelect = (card: PickerCard) => {
    if (!revealDone || selected || confirmed) return;
    setSelected(card.cardId);
  };

  const handleConfirm = () => {
    if (!selected || confirmed) return;
    setConfirmed(true);
    const card = cards.find(c => c.cardId === selected);
    if (card) onSelect(card);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}>
      <div className="relative w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Sparkles className="text-yellow-400" size={22} />
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            <Sparkles className="text-yellow-400" size={22} />
          </div>
          <p className="text-white/50 text-sm">
            {!revealDone ? 'Le carte vengono rivelate…' : selected ? 'Conferma la tua scelta' : 'Scegli una carta'}
          </p>
        </div>

        {/* Cards row */}
        <div className="flex items-stretch justify-center gap-3 flex-wrap">
          {cards.map((card, idx) => {
            const isRevealed = idx < revealedCount;
            const isSelected = selected === card.cardId;
            const style = RARITY_STYLES[card.rarity] || RARITY_STYLES.comune;
            const isLeg = card.rarity === 'leggendaria';
            const isEpic = card.rarity === 'epica';

            return (
              <div
                key={card.cardId}
                className="relative flex-shrink-0"
                style={{ perspective: '800px', width: '140px' }}
              >
                {/* Flip container */}
                <div
                  style={{
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.55s cubic-bezier(0.4,0,0.2,1)',
                    transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    height: '200px',
                    position: 'relative',
                  }}
                >
                  {/* Card Back */}
                  <div
                    style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}
                    className="rounded-xl border-2 border-white/10 flex items-center justify-center"
                  >
                    <div style={{
                      backfaceVisibility: 'hidden',
                      position: 'absolute', inset: 0,
                      borderRadius: '0.75rem',
                      border: '2px solid rgba(255,255,255,0.10)',
                      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div className="text-4xl opacity-40">🃏</div>
                    </div>
                  </div>

                  {/* Card Front */}
                  <div
                    style={{
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      position: 'absolute', inset: 0,
                    }}
                    onClick={() => isRevealed && revealDone && handleSelect(card)}
                    className={`
                      rounded-xl border-2 ${style.border} cursor-pointer overflow-hidden
                      transition-all duration-300
                      ${isSelected ? 'ring-4 ring-white scale-105' : 'hover:scale-102'}
                      ${isLeg || isEpic ? style.glow + ' shadow-lg' : ''}
                    `}
                  >
                    {/* Legendary shimmer */}
                    {isLeg && (
                      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-xl">
                        <div style={{
                          position: 'absolute', top: '-50%', left: '-75%',
                          width: '50%', height: '200%',
                          background: 'linear-gradient(105deg, transparent 40%, rgba(255,220,50,0.35) 50%, transparent 60%)',
                          animation: 'shimmer 2.5s infinite linear',
                        }} />
                      </div>
                    )}

                    {/* Card image */}
                    <div className="w-full h-[148px] bg-gray-900 relative">
                      {card.frontImage ? (
                        <img src={card.frontImage} alt={card.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">🃏</div>
                      )}
                      {/* Rarity badge */}
                      <span className={`absolute top-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${style.badge}`}>
                        {style.label}
                      </span>
                    </div>

                    {/* Card info */}
                    <div className="p-1.5" style={{ background: 'rgba(0,0,0,0.85)' }}>
                      <p className="text-white text-[11px] font-semibold truncate leading-tight">{card.name}</p>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-yellow-400 text-[10px] font-bold">{card.credits} cr</span>
                        <span className="text-white/40 text-[9px]">{card.deckType}</span>
                      </div>
                    </div>

                    {/* Selected overlay */}
                    {isSelected && (
                      <div className="absolute inset-0 rounded-xl bg-white/10 flex items-end justify-center pb-1 pointer-events-none">
                        <span className="text-white font-bold text-xs bg-green-600 px-2 py-0.5 rounded-full">✓ Selezionata</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Select button below card */}
                {revealDone && !confirmed && (
                  <button
                    onClick={() => handleSelect(card)}
                    className={`
                      w-full mt-2 py-1.5 rounded-lg text-xs font-bold transition-all duration-200
                      ${isSelected
                        ? 'bg-green-600 text-white'
                        : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                      }
                    `}
                  >
                    {isSelected ? '✓ Scelta' : 'Scegli'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Confirm button */}
        {revealDone && selected && !confirmed && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleConfirm}
              className="px-10 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold text-lg rounded-xl shadow-lg hover:from-yellow-400 hover:to-orange-400 transition-all duration-200 active:scale-95"
            >
              Conferma Scelta →
            </button>
          </div>
        )}

        {/* Close (only before reveal done or after confirmed) */}
        {(!revealDone || confirmed) && (
          <button onClick={onClose} className="absolute -top-2 -right-2 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { left: -75%; }
          100% { left: 125%; }
        }
      `}</style>
    </div>
  );
}
