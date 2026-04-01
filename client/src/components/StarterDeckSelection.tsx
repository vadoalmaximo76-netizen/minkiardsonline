import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

export interface StarterDeckOption {
  name: string;
  imageUrl: string;
  glowColor: string;
  cardIds: string[];
}

interface Props {
  options: StarterDeckOption[];
  playerName: string;
  gymLeaderId: number;
  authToken: string;
  onSelected: (cardIds: string[]) => void;
}

type AnimState = 'idle' | 'expanding' | 'confirmed';

const DEFAULT_COLORS = ['#38bdf8', '#ef4444'];

export function StarterDeckSelection({ options, playerName, gymLeaderId, authToken, onSelected }: Props) {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [animState, setAnimState] = useState<AnimState>('idle');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 120);
    return () => clearTimeout(t);
  }, []);

  const glowFor = (idx: number) => {
    const opt = options[idx];
    const color = opt?.glowColor && opt.glowColor !== '' ? opt.glowColor : DEFAULT_COLORS[idx] ?? '#38bdf8';
    return color;
  };

  const handleSelect = async (idx: number) => {
    if (animState !== 'idle' || loading) return;
    setChosen(idx);
    setAnimState('expanding');
    setLoading(true);

    try {
      const res = await fetch('/api/story-mode/deck/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ gymLeaderId, optionIndex: idx }),
      });
      const data = await res.json();
      const cardIds: string[] = data.cardIds || options[idx]?.cardIds || [];

      setTimeout(() => {
        setAnimState('confirmed');
        setTimeout(() => {
          onSelected(cardIds);
        }, 2200);
      }, 900);
    } catch {
      setTimeout(() => {
        setAnimState('confirmed');
        setTimeout(() => {
          onSelected(options[idx]?.cardIds || []);
        }, 2200);
      }, 900);
    }
  };

  const chosenOpt = chosen !== null ? options[chosen] : null;
  const chosenGlow = chosen !== null ? glowFor(chosen) : '#fff';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #0f172a 0%, #020617 100%)' }}
    >
      {/* Expanding glow overlay */}
      {animState !== 'idle' && (
        <div
          className="absolute inset-0 pointer-events-none transition-all"
          style={{
            background: `radial-gradient(circle at center, ${chosenGlow}55 0%, ${chosenGlow}22 40%, transparent 70%)`,
            opacity: animState === 'expanding' ? 1 : 0,
            transition: 'opacity 0.6s ease',
          }}
        />
      )}

      {/* Full-screen glow flash on confirmed */}
      {animState === 'confirmed' && (
        <div
          className="absolute inset-0 pointer-events-none animate-pulse"
          style={{
            background: `radial-gradient(circle at center, ${chosenGlow}33 0%, transparent 60%)`,
          }}
        />
      )}

      {/* Header */}
      <div
        className={`text-center mb-10 transition-all duration-700 ${visible && animState === 'idle' ? 'opacity-100 translate-y-0' : animState !== 'idle' ? 'opacity-0 -translate-y-4' : 'opacity-0 translate-y-4'}`}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="text-yellow-400 w-5 h-5" />
          <span className="text-yellow-400 font-bold uppercase tracking-widest text-sm">Story Mode</span>
          <Sparkles className="text-yellow-400 w-5 h-5" />
        </div>
        <h1 className="text-white text-3xl md:text-4xl font-extrabold leading-tight">
          Scegli il tuo<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">mazzo iniziale</span>
        </h1>
        <p className="text-white/50 text-sm mt-3">La tua scelta determinerà le carte con cui inizierai il viaggio</p>
      </div>

      {/* Cards row */}
      {animState !== 'confirmed' && (
        <div className="flex gap-6 md:gap-10 items-center justify-center px-4">
          {options.map((opt, idx) => {
            const glow = glowFor(idx);
            const isChosen = chosen === idx;
            const isOther = chosen !== null && chosen !== idx;
            const isHov = hovered === idx && animState === 'idle';

            return (
              <button
                key={idx}
                onClick={() => handleSelect(idx)}
                onMouseEnter={() => animState === 'idle' && setHovered(idx)}
                onMouseLeave={() => setHovered(null)}
                disabled={animState !== 'idle'}
                className="relative flex flex-col items-center cursor-pointer group focus:outline-none"
                style={{
                  transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  transform: isChosen
                    ? 'scale(1.35)'
                    : isOther
                    ? 'scale(0.75) translateY(20px)'
                    : isHov
                    ? 'scale(1.06)'
                    : visible
                    ? 'scale(1)'
                    : 'scale(0.85)',
                  opacity: isOther ? 0 : visible ? 1 : 0,
                  transitionDelay: visible ? `${idx * 80}ms` : '0ms',
                }}
              >
                {/* Card glow ring */}
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{
                    boxShadow: isChosen
                      ? `0 0 60px 20px ${glow}99, 0 0 120px 40px ${glow}44`
                      : isHov
                      ? `0 0 30px 8px ${glow}66, 0 0 60px 20px ${glow}33`
                      : `0 0 20px 4px ${glow}44`,
                    transition: 'box-shadow 0.4s ease',
                    borderRadius: '1rem',
                  }}
                />

                {/* Card image */}
                <div
                  className="relative rounded-2xl overflow-hidden border-2"
                  style={{
                    width: 'clamp(130px, 22vw, 200px)',
                    height: 'clamp(190px, 32vw, 290px)',
                    borderColor: isChosen || isHov ? glow : `${glow}55`,
                    transition: 'border-color 0.3s ease',
                  }}
                >
                  {opt.imageUrl ? (
                    <img
                      src={opt.imageUrl}
                      alt={opt.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-6xl"
                      style={{ background: `linear-gradient(135deg, ${glow}22, ${glow}11)` }}
                    >
                      🃏
                    </div>
                  )}

                  {/* Gradient overlay */}
                  <div
                    className="absolute inset-x-0 bottom-0 h-1/3"
                    style={{ background: `linear-gradient(to top, ${glow}55, transparent)` }}
                  />
                </div>

                {/* Name label */}
                <div
                  className="mt-4 text-center"
                  style={{ transition: 'opacity 0.3s ease', opacity: isOther ? 0 : 1 }}
                >
                  <span
                    className="font-extrabold text-lg md:text-xl tracking-wide"
                    style={{ color: isChosen || isHov ? glow : 'rgba(255,255,255,0.85)' }}
                  >
                    {opt.name}
                  </span>
                  {animState === 'idle' && (
                    <div
                      className="text-xs mt-1 font-medium transition-opacity"
                      style={{ color: `${glow}99`, opacity: isHov ? 1 : 0.6 }}
                    >
                      {opt.cardIds?.length || 0} carte
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Confirmation message */}
      {animState === 'confirmed' && chosenOpt && (
        <div
          className="text-center px-6 animate-in fade-in zoom-in duration-500"
          style={{
            textShadow: `0 0 40px ${chosenGlow}`,
          }}
        >
          <div
            className="text-6xl md:text-7xl mb-6"
            style={{
              filter: `drop-shadow(0 0 20px ${chosenGlow})`,
            }}
          >
            ⚔️
          </div>
          <h2
            className="text-3xl md:text-4xl font-extrabold mb-3"
            style={{ color: chosenGlow }}
          >
            Hai scelto<br />{chosenOpt.name}!
          </h2>
          <p className="text-white/80 text-xl font-semibold">
            Buona fortuna, <span style={{ color: chosenGlow }}>{playerName}</span>!
          </p>
          <p className="text-white/40 text-sm mt-3">Il tuo mazzo da {chosenOpt.cardIds?.length || 0} carte è pronto</p>
        </div>
      )}

      {/* Particle dots decoration */}
      {animState === 'idle' && visible && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full animate-pulse"
              style={{
                width: `${2 + (i % 3)}px`,
                height: `${2 + (i % 3)}px`,
                background: i % 2 === 0 ? '#38bdf855' : '#ef444455',
                left: `${8 + (i * 8) % 85}%`,
                top: `${10 + (i * 13) % 80}%`,
                animationDelay: `${i * 0.3}s`,
                animationDuration: `${2 + i * 0.4}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
