import React, { useState, useEffect, useRef } from 'react';
import { X, Zap } from 'lucide-react';

export interface RevealedCard {
  cardId: string;
  deckType: string;
  rarity: 'comune' | 'rara' | 'epica' | 'leggendaria';
  frontImage: string;
  name: string;
  draftCost: number;
}

export interface PackType {
  id: string;
  name: string;
  creditsRequired: number;
  cardCount: number;
  description: string;
  gradient: string;
  glowColor: string;
  composition: string;
}

interface PackOpeningAnimationProps {
  pack: PackType;
  cards: RevealedCard[];
  onClose: () => void;
}

type Phase = 'shaking' | 'opening' | 'revealing' | 'done';

const RARITY_CONFIG = {
  comune: {
    label: 'Comune',
    color: '#a0a0a0',
    glow: 'rgba(160,160,160,0.6)',
    textClass: 'text-gray-300',
    bgClass: 'bg-gray-500/20 border-gray-400/40',
  },
  rara: {
    label: 'Rara',
    color: '#3b82f6',
    glow: 'rgba(59,130,246,0.7)',
    textClass: 'text-blue-300',
    bgClass: 'bg-blue-500/20 border-blue-400/40',
  },
  epica: {
    label: 'Epica',
    color: '#a855f7',
    glow: 'rgba(168,85,247,0.8)',
    textClass: 'text-purple-300',
    bgClass: 'bg-purple-500/20 border-purple-400/40',
  },
  leggendaria: {
    label: 'Leggendaria',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.9)',
    textClass: 'text-yellow-300',
    bgClass: 'bg-yellow-500/20 border-yellow-400/40',
  },
};

export function PackOpeningAnimation({ pack, cards, onClose }: PackOpeningAnimationProps) {
  const [phase, setPhase] = useState<Phase>('shaking');
  const [revealedCount, setRevealedCount] = useState(0);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [showParticles, setShowParticles] = useState<number | null>(null);
  const [packScale, setPackScale] = useState(1);
  const [packOpacity, setPackOpacity] = useState(1);
  const [flashOpacity, setFlashOpacity] = useState(0);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    if (phaseTimer.current) clearTimeout(phaseTimer.current);
  };

  useEffect(() => {
    phaseTimer.current = setTimeout(() => {
      setPhase('opening');
      setPackScale(1.4);
      setTimeout(() => {
        setFlashOpacity(1);
        setTimeout(() => {
          setPackOpacity(0);
          setPackScale(2);
          setTimeout(() => {
            setFlashOpacity(0);
            setPhase('revealing');
          }, 300);
        }, 200);
      }, 400);
    }, 900);
    return clearTimers;
  }, []);

  useEffect(() => {
    if (phase !== 'revealing') return;
    revealCard(0);
  }, [phase]);

  const revealCard = (index: number) => {
    if (index >= cards.length) {
      revealTimer.current = setTimeout(() => setPhase('done'), 600);
      return;
    }
    revealTimer.current = setTimeout(() => {
      setRevealedCount(index + 1);
      setFlippedCards(prev => new Set([...prev, index]));
      setShowParticles(index);
      setTimeout(() => setShowParticles(null), 900);
      revealCard(index + 1);
    }, index === 0 ? 400 : 1350);
  };

  const skipToEnd = () => {
    clearTimers();
    setRevealedCount(cards.length);
    setFlippedCards(new Set(cards.map((_, i) => i)));
    setPhase('done');
  };

  const getCardCols = () => {
    if (cards.length <= 5) return cards.length;
    if (cards.length <= 8) return 4;
    return 5;
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at center, #0f0f23 0%, #000008 100%)' }}>

      <style>{`
        @keyframes packShake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          15% { transform: translateX(-12px) rotate(-3deg); }
          30% { transform: translateX(12px) rotate(3deg); }
          45% { transform: translateX(-8px) rotate(-2deg); }
          60% { transform: translateX(8px) rotate(2deg); }
          75% { transform: translateX(-4px) rotate(-1deg); }
          90% { transform: translateX(4px) rotate(1deg); }
        }
        @keyframes floatIn {
          from { opacity: 0; transform: translateY(60px) scale(0.8); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes particleBurst {
          0% { transform: scale(0.5); opacity: 1; }
          60% { transform: scale(2.5); opacity: 0.6; }
          100% { transform: scale(3.5); opacity: 0; }
        }
        @keyframes rarityPulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes starSpin {
          0% { transform: rotate(0deg) scale(1); opacity: 1; }
          100% { transform: rotate(360deg) scale(0); opacity: 0; }
        }
        .pack-shake { animation: packShake 0.8s ease-in-out infinite; }
        .card-float-in { animation: floatIn 0.5s ease-out forwards; }
        .rarity-pulse { animation: rarityPulse 1.5s ease-in-out infinite; }
      `}</style>

      <div
        className="absolute inset-0 pointer-events-none transition-all duration-300"
        style={{ background: `white`, opacity: flashOpacity }}
      />

      <div className="absolute top-3 left-0 right-0 flex justify-between items-center px-4 z-10">
        <div className="text-white/60 text-sm font-medium">{pack.name}</div>
        {phase !== 'done' && (
          <button
            onClick={skipToEnd}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-xs px-3 py-1.5 rounded-full transition-all"
          >
            <Zap size={12} /> Salta
          </button>
        )}
      </div>

      {(phase === 'shaking' || phase === 'opening') && (
        <div className="flex flex-col items-center gap-6">
          <div
            className={phase === 'shaking' ? 'pack-shake' : ''}
            style={{
              transform: phase === 'opening' ? `scale(${packScale})` : undefined,
              opacity: packOpacity,
              transition: phase === 'opening' ? 'transform 0.5s ease-out, opacity 0.3s ease-out' : undefined,
            }}
          >
            <div
              className="w-44 h-64 rounded-2xl flex flex-col items-center justify-center shadow-2xl border border-white/20 relative overflow-hidden cursor-pointer"
              style={{
                background: pack.gradient,
                boxShadow: `0 0 60px ${pack.glowColor}60, 0 0 120px ${pack.glowColor}30`,
              }}
              onClick={phase === 'shaking' ? skipToEnd : undefined}
            >
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%, rgba(255,255,255,0.1) 100%)',
                }}
              />
              <div className="relative z-10 text-center px-4">
                <div className="text-5xl mb-3">🃏</div>
                <div className="text-white font-black text-xl tracking-wider drop-shadow-lg">{pack.name}</div>
                <div className="text-white/70 text-sm mt-1">{cards.length} carte</div>
              </div>
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.1) 3px, rgba(255,255,255,0.1) 4px)',
                }}
              />
            </div>
          </div>
          {phase === 'shaking' && (
            <div className="text-white/50 text-sm animate-pulse">Tocca per aprire</div>
          )}
        </div>
      )}

      {(phase === 'revealing' || phase === 'done') && (
        <div className="w-full max-w-5xl px-4 flex flex-col items-center gap-6">
          {phase === 'revealing' && (
            <div className="text-white/60 text-sm">
              {revealedCount}/{cards.length} carte rivelate
            </div>
          )}
          {phase === 'done' && (
            <div className="text-center">
              <div className="text-2xl font-black text-white mb-1">{cards.length} carte ottenute!</div>
              <div className="text-white/50 text-sm">Le carte sono state aggiunte alla tua collezione</div>
            </div>
          )}

          <div
            className="flex flex-wrap justify-center gap-3"
            style={{ maxWidth: `${getCardCols() * 130 + (getCardCols() - 1) * 12}px` }}
          >
            {cards.map((card, index) => {
              const isFlipped = flippedCards.has(index);
              const isVisible = index < revealedCount + 1;
              const rarityConfig = RARITY_CONFIG[card.rarity];
              const isParticle = showParticles === index;

              return (
                <div
                  key={card.cardId}
                  className="relative flex flex-col items-center"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    animation: isVisible && !isFlipped ? 'floatIn 0.4s ease-out forwards' : undefined,
                  }}
                >
                  {isParticle && (
                    <div
                      className="absolute inset-0 rounded-xl pointer-events-none"
                      style={{
                        background: `radial-gradient(circle, ${rarityConfig.glow} 0%, transparent 70%)`,
                        animation: 'particleBurst 0.9s ease-out forwards',
                        zIndex: 20,
                      }}
                    />
                  )}
                  <div
                    className="relative"
                    style={{
                      perspective: '800px',
                      width: '100px',
                      height: '140px',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                        transformStyle: 'preserve-3d',
                        transition: 'transform 0.65s cubic-bezier(0.4, 0, 0.2, 1)',
                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backfaceVisibility: 'hidden',
                          borderRadius: '10px',
                          background: `linear-gradient(135deg, #1a1a2e, #16213e)`,
                          border: '2px solid rgba(255,255,255,0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span style={{ fontSize: '2rem' }}>🂠</span>
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          border: `2px solid ${rarityConfig.color}`,
                          boxShadow: isFlipped ? `0 0 20px ${rarityConfig.glow}, 0 0 40px ${rarityConfig.glow}50` : 'none',
                          transition: 'box-shadow 0.3s ease',
                        }}
                      >
                        <img
                          src={card.frontImage}
                          alt={card.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        {card.rarity !== 'comune' && isFlipped && (
                          <div
                            className="absolute inset-0 pointer-events-none rarity-pulse"
                            style={{
                              background: `linear-gradient(135deg, ${rarityConfig.glow}20, transparent 60%)`,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {isFlipped && (
                    <div className="mt-1.5 flex flex-col items-center gap-0.5" style={{ animation: 'floatIn 0.3s ease-out forwards' }}>
                      <div
                        className={`text-xs font-bold px-2 py-0.5 rounded-full border ${rarityConfig.bgClass} ${rarityConfig.textClass}`}
                      >
                        {rarityConfig.label}
                      </div>
                      <div className="text-white/60 text-xs text-center max-w-[100px] truncate">{card.name}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {phase === 'done' && (
            <div className="flex flex-col items-center gap-3 mt-2">
              <div className="flex flex-wrap justify-center gap-3 text-xs">
                {Object.entries(
                  cards.reduce((acc, c) => { acc[c.rarity] = (acc[c.rarity] || 0) + 1; return acc; }, {} as Record<string, number>)
                ).map(([rarity, count]) => (
                  <span
                    key={rarity}
                    className={`px-3 py-1 rounded-full border font-semibold ${RARITY_CONFIG[rarity as keyof typeof RARITY_CONFIG]?.bgClass || ''} ${RARITY_CONFIG[rarity as keyof typeof RARITY_CONFIG]?.textClass || ''}`}
                  >
                    {count}× {RARITY_CONFIG[rarity as keyof typeof RARITY_CONFIG]?.label || rarity}
                  </span>
                ))}
              </div>
              <button
                onClick={onClose}
                className="mt-1 flex items-center gap-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-white font-bold px-8 py-3 rounded-full text-base shadow-lg transition-all hover:scale-105"
                style={{ boxShadow: '0 0 30px rgba(20,184,166,0.5)' }}
              >
                <X size={16} /> Chiudi
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
