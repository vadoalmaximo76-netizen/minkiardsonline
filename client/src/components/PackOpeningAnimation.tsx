import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Zap, Plus, Check } from 'lucide-react';
import { useAudio } from '../lib/stores/useAudio';

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
  onCardAdded?: () => void;
}

type Phase = 'shaking' | 'opening' | 'revealing' | 'done';
type AddState = 'idle' | 'loading' | 'added' | 'duplicate';

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

export function PackOpeningAnimation({ pack, cards, onClose, onCardAdded }: PackOpeningAnimationProps) {
  const [phase, setPhase] = useState<Phase>('shaking');
  const [revealedCount, setRevealedCount] = useState(0);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [showParticles, setShowParticles] = useState<number | null>(null);
  const [packScale, setPackScale] = useState(1);
  const [packOpacity, setPackOpacity] = useState(1);
  const [flashOpacity, setFlashOpacity] = useState(0);
  const [addStates, setAddStates] = useState<Record<string, AddState>>({});
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rumbleStopRef = useRef<(() => void) | null>(null);

  const { audioContext, isMuted } = useAudio();

  const clearTimers = () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    if (phaseTimer.current) clearTimeout(phaseTimer.current);
  };

  const startRumble = useCallback(() => {
    if (isMuted || !audioContext) return;
    const ctx = audioContext;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.5);
    masterGain.connect(ctx.destination);

    const oscillators: OscillatorNode[] = [];
    const freqs = [30, 45, 60, 90];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq + Math.sin(i) * 5, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(freq * 1.05, ctx.currentTime + 0.8);
      gain.gain.setValueAtTime(0.25 - i * 0.04, ctx.currentTime);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(ctx.currentTime);
      oscillators.push(osc);
    });

    const bufLen = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, ctx.currentTime);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.08, ctx.currentTime);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start(ctx.currentTime);

    rumbleStopRef.current = () => {
      try {
        masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        setTimeout(() => {
          oscillators.forEach(o => { try { o.stop(); } catch {} });
          try { noise.stop(); } catch {}
        }, 350);
      } catch {}
    };
  }, [audioContext, isMuted]);

  const playPackBurst = useCallback(() => {
    if (isMuted || !audioContext) return;
    const ctx = audioContext;
    const t = ctx.currentTime;

    const boomOsc = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boomOsc.type = 'sine';
    boomOsc.frequency.setValueAtTime(80, t);
    boomOsc.frequency.exponentialRampToValueAtTime(20, t + 0.6);
    boomGain.gain.setValueAtTime(0.35, t);
    boomGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    boomOsc.connect(boomGain);
    boomGain.connect(ctx.destination);
    boomOsc.start(t);
    boomOsc.stop(t + 0.6);

    const noiseLen = ctx.sampleRate * 0.4;
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) nd[i] = Math.random() * 2 - 1;
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(800, t);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSrc.start(t);
    noiseSrc.stop(t + 0.4);

    [523, 659, 784].forEach((freq, i) => {
      setTimeout(() => {
        const ct = ctx.currentTime;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ct);
        g.gain.setValueAtTime(0.12, ct);
        g.gain.exponentialRampToValueAtTime(0.001, ct + 0.25);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(ct);
        osc.stop(ct + 0.25);
      }, i * 60);
    });
  }, [audioContext, isMuted]);

  const playRevealSound = useCallback((rarity: RevealedCard['rarity']) => {
    if (isMuted || !audioContext) return;
    const ctx = audioContext;
    const t = ctx.currentTime;

    if (rarity === 'comune') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.linearRampToValueAtTime(660, t + 0.15);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);

    } else if (rarity === 'rara') {
      [[523, 0], [659, 80], [784, 160]].forEach(([freq, delay]) => {
        setTimeout(() => {
          const ct = ctx.currentTime;
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const g1 = ctx.createGain();
          const g2 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(freq, ct);
          g1.gain.setValueAtTime(0.14, ct);
          g1.gain.exponentialRampToValueAtTime(0.001, ct + 0.3);
          osc1.connect(g1);
          g1.connect(ctx.destination);
          osc1.start(ct);
          osc1.stop(ct + 0.3);

          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(freq * 2, ct);
          g2.gain.setValueAtTime(0.06, ct);
          g2.gain.exponentialRampToValueAtTime(0.001, ct + 0.25);
          osc2.connect(g2);
          g2.connect(ctx.destination);
          osc2.start(ct);
          osc2.stop(ct + 0.25);
        }, delay);
      });

    } else if (rarity === 'epica') {
      const chordFreqs = [349, 440, 523, 698];
      chordFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i % 2 === 0 ? 'sawtooth' : 'square';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.linearRampToValueAtTime(freq * 1.02, t + 0.5);
        gain.gain.setValueAtTime(0.0, t);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
        gain.gain.linearRampToValueAtTime(0.07, t + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.7);
      });

      const impact = ctx.createOscillator();
      const impGain = ctx.createGain();
      impact.type = 'sine';
      impact.frequency.setValueAtTime(60, t);
      impact.frequency.exponentialRampToValueAtTime(20, t + 0.4);
      impGain.gain.setValueAtTime(0.25, t);
      impGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      impact.connect(impGain);
      impGain.connect(ctx.destination);
      impact.start(t);
      impact.stop(t + 0.4);

    } else if (rarity === 'leggendaria') {
      const fanfare = [523, 659, 784, 1047, 1319, 1568];
      fanfare.forEach((freq, i) => {
        setTimeout(() => {
          const ct = ctx.currentTime;
          [1, 1.25, 1.5].forEach((mult) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = mult === 1 ? 'square' : mult === 1.25 ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(freq * mult * 0.5, ct);
            osc.frequency.linearRampToValueAtTime(freq, ct + 0.08);
            gain.gain.setValueAtTime(0.0, ct);
            gain.gain.linearRampToValueAtTime(0.12 / mult, ct + 0.04);
            gain.gain.linearRampToValueAtTime(0.08 / mult, ct + 0.2);
            gain.gain.exponentialRampToValueAtTime(0.001, ct + 0.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ct);
            osc.stop(ct + 0.5);
          });
        }, i * 110);
      });

      setTimeout(() => {
        const ct = ctx.currentTime;
        const boomOsc = ctx.createOscillator();
        const boomGain = ctx.createGain();
        boomOsc.type = 'sine';
        boomOsc.frequency.setValueAtTime(50, ct);
        boomOsc.frequency.exponentialRampToValueAtTime(15, ct + 0.8);
        boomGain.gain.setValueAtTime(0.3, ct);
        boomGain.gain.exponentialRampToValueAtTime(0.001, ct + 0.8);
        boomOsc.connect(boomGain);
        boomGain.connect(ctx.destination);
        boomOsc.start(ct);
        boomOsc.stop(ct + 0.8);
      }, 200);
    }
  }, [audioContext, isMuted]);

  useEffect(() => {
    startRumble();
    phaseTimer.current = setTimeout(() => {
      if (rumbleStopRef.current) rumbleStopRef.current();
      setPhase('opening');
      setPackScale(1.4);
      setTimeout(() => {
        setFlashOpacity(1);
        playPackBurst();
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
    return () => {
      clearTimers();
      if (rumbleStopRef.current) rumbleStopRef.current();
    };
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
      playRevealSound(cards[index].rarity);
      setTimeout(() => setShowParticles(null), 900);
      revealCard(index + 1);
    }, index === 0 ? 400 : 1350);
  };

  const skipToEnd = () => {
    clearTimers();
    if (rumbleStopRef.current) rumbleStopRef.current();
    setRevealedCount(cards.length);
    setFlippedCards(new Set(cards.map((_, i) => i)));
    setPhase('done');
  };

  const addToDeck = async (card: RevealedCard) => {
    const key = card.cardId;
    if (addStates[key] === 'added' || addStates[key] === 'loading') return;
    setAddStates(prev => ({ ...prev, [key]: 'loading' }));
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/draft/deck/add-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cardId: card.cardId, deckType: card.deckType }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAddStates(prev => ({ ...prev, [key]: 'added' }));
        onCardAdded?.();
      } else {
        setAddStates(prev => ({ ...prev, [key]: 'idle' }));
      }
    } catch {
      setAddStates(prev => ({ ...prev, [key]: 'idle' }));
    }
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
        @keyframes btnPop {
          0% { transform: scale(0.85); opacity: 0; }
          70% { transform: scale(1.08); }
          100% { transform: scale(1); opacity: 1; }
        }
        .pack-shake { animation: packShake 0.8s ease-in-out infinite; }
        .card-float-in { animation: floatIn 0.5s ease-out forwards; }
        .rarity-pulse { animation: rarityPulse 1.5s ease-in-out infinite; }
        .btn-pop { animation: btnPop 0.3s ease-out forwards; }
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
        <div className="w-full max-w-5xl px-4 flex flex-col items-center gap-6 overflow-y-auto max-h-screen py-12">
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
            className="flex flex-wrap justify-center gap-4"
            style={{ maxWidth: `${getCardCols() * 130 + (getCardCols() - 1) * 16}px` }}
          >
            {cards.map((card, index) => {
              const isFlipped = flippedCards.has(index);
              const isVisible = index < revealedCount + 1;
              const rarityConfig = RARITY_CONFIG[card.rarity];
              const isParticle = showParticles === index;
              const addState = addStates[card.cardId] || 'idle';

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
                    style={{ perspective: '800px', width: '100px', height: '140px' }}
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
                          position: 'absolute', inset: 0,
                          backfaceVisibility: 'hidden', borderRadius: '10px',
                          background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                          border: '2px solid rgba(255,255,255,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <span style={{ fontSize: '2rem' }}>🂠</span>
                      </div>
                      <div
                        style={{
                          position: 'absolute', inset: 0,
                          backfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)',
                          borderRadius: '10px', overflow: 'hidden',
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
                            style={{ background: `linear-gradient(135deg, ${rarityConfig.glow}20, transparent 60%)` }}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {isFlipped && (
                    <div className="mt-1.5 flex flex-col items-center gap-1" style={{ animation: 'floatIn 0.3s ease-out forwards' }}>
                      <div className={`text-xs font-bold px-2 py-0.5 rounded-full border ${rarityConfig.bgClass} ${rarityConfig.textClass}`}>
                        {rarityConfig.label}
                      </div>
                      <div className="text-white/60 text-xs text-center max-w-[100px] truncate">{card.name}</div>
                      <button
                        onClick={() => addToDeck(card)}
                        disabled={addState === 'loading' || addState === 'added'}
                        className={`btn-pop flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full transition-all mt-0.5 ${
                          addState === 'added'
                            ? 'bg-green-500/30 border border-green-400/50 text-green-300 cursor-default'
                            : addState === 'loading'
                            ? 'bg-white/10 border border-white/20 text-white/40 cursor-wait'
                            : `border text-white hover:scale-105 active:scale-95 ${rarityConfig.bgClass} ${rarityConfig.textClass} hover:bg-white/20`
                        }`}
                        style={{ fontSize: '10px' }}
                      >
                        {addState === 'added' ? (
                          <><Check size={10} /> Aggiunta</>
                        ) : addState === 'loading' ? (
                          <>...</>
                        ) : (
                          <><Plus size={10} /> Al mazzo</>
                        )}
                      </button>
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
