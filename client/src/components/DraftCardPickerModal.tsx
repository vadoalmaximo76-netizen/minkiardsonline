import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Sparkles, ClipboardList } from 'lucide-react';
import { DECK_BACK_IMAGES } from '../lib/cardData';
import { useAudio } from '../lib/stores/useAudio';
import { CardInfoSheet } from './CardInfoSheet';

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

const RARITY_CONFIG = {
  comune:      { border: '#6b7280', glow: 'rgba(107,114,128,0)', badge: '#374151', badgeText: '#d1d5db', label: 'Comune',      flipDelay: 600,  flipDuration: 0.5, flashColor: 'rgba(107,114,128,0)',   celebrationMs: 0 },
  rara:        { border: '#3b82f6', glow: 'rgba(59,130,246,0.8)', badge: '#1d4ed8', badgeText: '#bfdbfe', label: 'Rara',        flipDelay: 900,  flipDuration: 0.6, flashColor: 'rgba(59,130,246,0.15)',  celebrationMs: 600 },
  epica:       { border: '#a855f7', glow: 'rgba(168,85,247,1)',   badge: '#7e22ce', badgeText: '#e9d5ff', label: 'Epica',       flipDelay: 1400, flipDuration: 0.8, flashColor: 'rgba(168,85,247,0.25)',  celebrationMs: 1200 },
  leggendaria: { border: '#f59e0b', glow: 'rgba(245,158,11,1)',   badge: '#b45309', badgeText: '#fef3c7', label: 'Leggendaria', flipDelay: 2200, flipDuration: 1.0, flashColor: 'rgba(245,158,11,0.35)',  celebrationMs: 2500 },
};

function getBackImage(deckType: string): string {
  if (deckType === 'personaggi') return DECK_BACK_IMAGES.personaggi;
  if (deckType === 'mosse') return DECK_BACK_IMAGES.mosse;
  if (deckType === 'bonus') return DECK_BACK_IMAGES.bonus;
  return DECK_BACK_IMAGES.personaggi;
}

function getAudioCtx(): AudioContext | null {
  const state = useAudio.getState();
  if (state.isMuted) return null;
  const ctx = state.audioContext;
  if (!ctx) return null;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function playFlipSound(rarity: string) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);

  if (rarity === 'leggendaria') {
    // Epic golden fanfare
    [220, 330, 440, 550, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.07);
      g.gain.setValueAtTime(0, t + i * 0.07);
      g.gain.linearRampToValueAtTime(0.25, t + i * 0.07 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.5);
      osc.connect(g); g.connect(masterGain);
      osc.start(t + i * 0.07); osc.stop(t + i * 0.07 + 0.6);
    });
    const boom = ctx.createOscillator();
    const boomG = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(80, t);
    boom.frequency.exponentialRampToValueAtTime(20, t + 0.7);
    boomG.gain.setValueAtTime(0.4, t);
    boomG.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    boom.connect(boomG); boomG.connect(masterGain);
    boom.start(t); boom.stop(t + 0.8);
  } else if (rarity === 'epica') {
    // Dramatic chord
    [261, 329, 392].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.connect(g); g.connect(masterGain);
      osc.start(t); osc.stop(t + 0.7);
    });
  } else {
    // Simple card flip click
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(rarity === 'rara' ? 400 : 280, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.12);
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + 0.2);
  }
}

function playShakeSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  const bufLen = Math.floor(ctx.sampleRate * 0.3);
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(200, t);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, t);
  gain.gain.linearRampToValueAtTime(0, t + 0.3);
  src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  src.start(t); src.stop(t + 0.35);
}

// Particle for legendary/epic reveals
function Particles({ rarity }: { rarity: string }) {
  const count = rarity === 'leggendaria' ? 20 : 10;
  const color = rarity === 'leggendaria' ? '#f59e0b' : '#a855f7';
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 50 + (Math.random() - 0.5) * 80,
    delay: Math.random() * 0.4,
    size: 4 + Math.random() * 8,
    angle: (Math.random() * 360),
    speed: 80 + Math.random() * 120,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: '50%',
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 ${p.size * 2}px ${color}`,
            animation: `particle-burst 0.8s ${p.delay}s ease-out forwards`,
            transform: `rotate(${p.angle}deg)`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}

export function DraftCardPickerModal({ cards, onSelect, onClose, title = 'Scegli la tua ricompensa' }: DraftCardPickerModalProps) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [shakingIdx, setShakingIdx] = useState<number | null>(null);
  const [celebrationIdx, setCelebrationIdx] = useState<number | null>(null);
  const [flashOpacity, setFlashOpacity] = useState(0);
  const [flashColor, setFlashColor] = useState('rgba(255,255,255,0)');
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [scheaCardId, setScheaCardId] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealDone = revealedCount >= cards.length;

  // Entry animation
  useEffect(() => {
    setTimeout(() => setEntered(true), 80);
  }, []);

  // Sequential reveal with per-card suspense
  const revealNextCard = useCallback((nextIdx: number) => {
    if (nextIdx >= cards.length) return;
    const card = cards[nextIdx];
    const cfg = RARITY_CONFIG[card.rarity] || RARITY_CONFIG.comune;

    // Phase 1: shake
    setShakingIdx(nextIdx);
    playShakeSound();

    timerRef.current = setTimeout(() => {
      setShakingIdx(null);
      // Phase 2: flip
      setRevealedCount(nextIdx + 1);
      playFlipSound(card.rarity);

      // Phase 3: flash
      if (cfg.flashColor && cfg.celebrationMs > 0) {
        setFlashColor(cfg.flashColor);
        setFlashOpacity(1);
        setTimeout(() => setFlashOpacity(0), 300);
      }

      // Phase 4: celebration pause (for epic/legendary)
      if (cfg.celebrationMs > 0) {
        setCelebrationIdx(nextIdx);
        timerRef.current = setTimeout(() => {
          setCelebrationIdx(null);
          revealNextCard(nextIdx + 1);
        }, cfg.celebrationMs);
      } else {
        timerRef.current = setTimeout(() => revealNextCard(nextIdx + 1), 500);
      }
    }, cfg.flipDelay);
  }, [cards]);

  useEffect(() => {
    // Start first reveal after entry
    timerRef.current = setTimeout(() => revealNextCard(0), 600);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [revealNextCard]);

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
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.93)', backdropFilter: 'blur(10px)' }}
    >
      {/* Screen flash overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-[201] transition-opacity duration-300"
        style={{ background: flashColor, opacity: flashOpacity }}
      />

      <div
        className="relative w-full max-w-3xl transition-all duration-500"
        style={{ transform: entered ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(30px)', opacity: entered ? 1 : 0 }}
      >
        {/* Header */}
        <div className="text-center mb-5">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Sparkles className="text-yellow-400" size={20} />
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <Sparkles className="text-yellow-400" size={20} />
          </div>
          <p className="text-white/40 text-sm">
            {!revealDone
              ? `Rivelando carta ${Math.min(revealedCount + 1, cards.length)} di ${cards.length}…`
              : selected
              ? 'Conferma la tua scelta'
              : 'Tocca una carta per selezionarla'}
          </p>
        </div>

        {/* Cards row */}
        <div className="flex items-end justify-center gap-2 sm:gap-3 flex-wrap">
          {cards.map((card, idx) => {
            const isRevealed = idx < revealedCount;
            const isShaking = shakingIdx === idx;
            const isCelebrating = celebrationIdx === idx;
            const isSelected = selected === card.cardId;
            const cfg = RARITY_CONFIG[card.rarity] || RARITY_CONFIG.comune;
            const isLeg = card.rarity === 'leggendaria';
            const isEpic = card.rarity === 'epica';
            const backImg = getBackImage(card.deckType);

            return (
              <div
                key={card.cardId}
                className="relative flex-shrink-0 flex flex-col items-center"
                style={{
                  perspective: '900px',
                  width: '130px',
                  transform: isShaking
                    ? 'translateY(-6px) scale(1.06)'
                    : isCelebrating
                    ? 'translateY(-10px) scale(1.08)'
                    : 'translateY(0) scale(1)',
                  transition: 'transform 0.2s ease',
                  zIndex: isShaking || isCelebrating ? 10 : 1,
                }}
              >
                {/* Legendary/Epic glow halo */}
                {isRevealed && (isLeg || isEpic) && (
                  <div
                    className="absolute rounded-xl pointer-events-none"
                    style={{
                      inset: -8,
                      background: `radial-gradient(ellipse at center, ${cfg.glow} 0%, transparent 70%)`,
                      animation: isCelebrating
                        ? (isLeg ? 'legend-pulse 0.6s ease-in-out infinite alternate' : 'epic-pulse 0.5s ease-in-out infinite alternate')
                        : 'none',
                      opacity: isCelebrating ? 1 : 0.6,
                    }}
                  />
                )}

                {/* Flip container */}
                <div
                  style={{
                    transformStyle: 'preserve-3d',
                    transition: `transform ${cfg.flipDuration}s cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
                    transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    height: '190px',
                    width: '130px',
                    position: 'relative',
                  }}
                >
                  {/* Card Back */}
                  <div
                    style={{
                      backfaceVisibility: 'hidden',
                      position: 'absolute', inset: 0,
                      borderRadius: '0.75rem',
                      overflow: 'hidden',
                      border: '2px solid rgba(255,255,255,0.12)',
                    }}
                  >
                    <img
                      src={backImg}
                      alt="retro"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {/* Shaking pulse ring */}
                    {isShaking && (
                      <div
                        className="absolute inset-0 rounded-xl"
                        style={{
                          border: '3px solid rgba(255,255,255,0.8)',
                          animation: 'shake-ring 0.15s ease-in-out infinite alternate',
                          boxShadow: '0 0 20px rgba(255,255,255,0.5)',
                        }}
                      />
                    )}
                  </div>

                  {/* Card Front */}
                  <div
                    style={{
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      position: 'absolute', inset: 0,
                      borderRadius: '0.75rem',
                      overflow: 'hidden',
                      border: `2px solid ${cfg.border}`,
                      boxShadow: isRevealed && (isLeg || isEpic)
                        ? `0 0 ${isLeg ? 30 : 20}px ${cfg.glow}, 0 0 ${isLeg ? 60 : 40}px ${cfg.glow}40`
                        : 'none',
                      cursor: isRevealed && revealDone && !confirmed ? 'pointer' : 'default',
                      transform: `rotateY(180deg) ${isSelected ? 'scale(1.04)' : ''}`,
                      transition: 'box-shadow 0.4s ease, transform 0.2s ease',
                      outline: isSelected ? '3px solid white' : 'none',
                      outlineOffset: '2px',
                    }}
                    onClick={() => isRevealed && revealDone && handleSelect(card)}
                  >
                    {/* Legendary shimmer sweep */}
                    {isRevealed && isLeg && (
                      <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-xl">
                        <div style={{
                          position: 'absolute', top: '-50%', left: '-80%',
                          width: '60%', height: '200%',
                          background: 'linear-gradient(105deg, transparent 30%, rgba(255,220,50,0.5) 50%, rgba(255,255,200,0.3) 55%, transparent 70%)',
                          animation: 'shimmer-sweep 2s infinite linear',
                        }} />
                      </div>
                    )}
                    {/* Epic shimmer */}
                    {isRevealed && isEpic && (
                      <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-xl">
                        <div style={{
                          position: 'absolute', top: '-50%', left: '-80%',
                          width: '50%', height: '200%',
                          background: 'linear-gradient(105deg, transparent 30%, rgba(168,85,247,0.4) 50%, transparent 70%)',
                          animation: 'shimmer-sweep 3s infinite linear',
                        }} />
                      </div>
                    )}

                    {/* Card image */}
                    <div style={{ width: '100%', height: '140px', background: '#111', position: 'relative' }}>
                      {card.frontImage ? (
                        <img src={card.frontImage} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🃏</div>
                      )}
                      {/* Rarity badge */}
                      <span style={{
                        position: 'absolute', top: 4, right: 4,
                        fontSize: '9px', fontWeight: 700, padding: '2px 5px',
                        borderRadius: '999px', background: cfg.badge, color: cfg.badgeText,
                      }}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Card info */}
                    <div style={{ padding: '6px 7px', background: 'rgba(0,0,0,0.88)' }}>
                      <p style={{ color: 'white', fontSize: '10px', fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{card.name}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                        <span style={{ color: '#fbbf24', fontSize: '9px', fontWeight: 700 }}>{card.credits} cr</span>
                        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '9px' }}>{card.deckType}</span>
                      </div>
                    </div>

                    {/* Selected overlay */}
                    {isSelected && (
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: '0.75rem',
                        background: 'rgba(255,255,255,0.08)',
                        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 6,
                        pointerEvents: 'none',
                      }}>
                        <span style={{ color: 'white', fontWeight: 700, fontSize: '10px', background: '#16a34a', padding: '2px 8px', borderRadius: 999 }}>✓ Selezionata</span>
                      </div>
                    )}

                    {/* Particles for epic/legendary celebration */}
                    {isCelebrating && (isLeg || isEpic) && <Particles rarity={card.rarity} />}
                  </div>
                </div>

                {/* Celebration banner */}
                {isCelebrating && isLeg && (
                  <div
                    style={{
                      marginTop: 6,
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: 'linear-gradient(90deg, #b45309, #f59e0b, #b45309)',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.1em',
                      textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                      animation: 'legend-text 0.4s ease-out',
                      boxShadow: '0 0 12px rgba(245,158,11,0.8)',
                    }}
                  >
                    ✨ LEGGENDARIA!
                  </div>
                )}
                {isCelebrating && isEpic && (
                  <div
                    style={{
                      marginTop: 6,
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: 'linear-gradient(90deg, #7e22ce, #a855f7, #7e22ce)',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      animation: 'legend-text 0.4s ease-out',
                      boxShadow: '0 0 12px rgba(168,85,247,0.8)',
                    }}
                  >
                    ⚡ EPICA!
                  </div>
                )}

                {/* Select button */}
                {revealDone && !confirmed && (
                  <>
                    <button
                      onClick={() => handleSelect(card)}
                      style={{
                        width: '100%',
                        marginTop: 6,
                        padding: '5px 0',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        background: isSelected ? '#16a34a' : 'rgba(255,255,255,0.12)',
                        color: isSelected ? 'white' : 'rgba(255,255,255,0.75)',
                      }}
                    >
                      {isSelected ? '✓ Scelta' : 'Scegli'}
                    </button>
                    <button
                      onClick={() => setScheaCardId(card.cardId)}
                      style={{
                        width: '100%',
                        marginTop: 3,
                        padding: '3px 0',
                        borderRadius: 8,
                        fontSize: 10,
                        fontWeight: 600,
                        border: '1px solid rgba(99,102,241,0.4)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        background: 'rgba(99,102,241,0.15)',
                        color: 'rgba(165,180,252,0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                    >
                      📋 Scheda
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Confirm button */}
        {revealDone && selected && !confirmed && (
          <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={handleConfirm}
              style={{
                padding: '12px 36px',
                background: 'linear-gradient(90deg, #f59e0b, #ea580c)',
                color: 'white',
                fontWeight: 700,
                fontSize: 17,
                borderRadius: 14,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(245,158,11,0.4)',
                transition: 'transform 0.15s ease',
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              Conferma Scelta →
            </button>
          </div>
        )}

        {/* Close button */}
        {(!revealDone || confirmed) && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: -8, right: -8,
              padding: 6, borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)',
              border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Card info sheet overlay */}
      {scheaCardId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-end',
          justifyContent: 'center',
        }}>
          <div style={{
            width: '100%', maxWidth: 440,
            background: '#111827',
            borderTop: '1px solid rgba(99,102,241,0.4)',
            borderRadius: '1.5rem 1.5rem 0 0',
            maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
              flexShrink: 0,
            }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                📋 Scheda carta
              </span>
              <button
                onClick={() => setScheaCardId(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)', border: 'none',
                  borderRadius: '50%', width: 28, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'rgba(255,255,255,0.7)',
                }}
              >
                <X size={14} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              <CardInfoSheet cardId={scheaCardId} compact />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer-sweep {
          0%   { left: -80%; }
          100% { left: 140%; }
        }
        @keyframes legend-pulse {
          0%   { opacity: 0.5; transform: scale(0.97); }
          100% { opacity: 1;   transform: scale(1.03); }
        }
        @keyframes epic-pulse {
          0%   { opacity: 0.4; }
          100% { opacity: 0.9; }
        }
        @keyframes shake-ring {
          0%   { transform: scale(1); }
          100% { transform: scale(1.04); }
        }
        @keyframes legend-text {
          0%   { opacity: 0; transform: scale(0.6) translateY(4px); }
          60%  { opacity: 1; transform: scale(1.1) translateY(-2px); }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes particle-burst {
          0%   { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); }
          100% { opacity: 0; transform: translate(var(--dx, 40px), var(--dy, -60px)) rotate(360deg) scale(0.2); }
        }
      `}</style>
    </div>
  );
}
