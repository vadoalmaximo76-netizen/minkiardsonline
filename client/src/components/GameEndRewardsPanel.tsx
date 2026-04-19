import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { gsap } from 'gsap';
import { Crown, Trophy, Star, Home, Play, Medal, Share2, Download } from 'lucide-react';
import { AdBanner } from './AdBanner';
import { useGameState } from '../lib/stores/useGameState';
import VictoryCard from './VictoryCard';
import { useShareVictory } from '../hooks/useShareVictory';

interface GameEndRewardsPanelProps {
  visible: boolean;
  pointsEarned: number;
  previousTotal: number;
  newTotal: number;
  placement: number;
  isWinner: boolean;
  winnerName: string;
  playerName: string;
  onGoHome: () => void;
  onNewGame: () => void;
  rematchSection?: React.ReactNode;
  onContinueTournament?: () => void;
  gameStats?: {
    totalDamageDealt: number;
    cardsPlayed: number;
    turnsPlayed: number;
    matchDuration: number;
  };
}

export const GameEndRewardsPanel: React.FC<GameEndRewardsPanelProps> = ({
  visible,
  rematchSection,
  pointsEarned,
  previousTotal,
  newTotal,
  placement,
  isWinner,
  winnerName,
  playerName,
  onGoHome,
  onNewGame,
  onContinueTournament,
  gameStats,
}) => {
  const { containerRef: victoryCardRef, shareVictory, isGenerating } = useShareVictory();
  const [phase, setPhase] = useState<'rewards' | 'ad'>('rewards');
  const [displayedPoints, setDisplayedPoints] = useState(previousTotal);

  const panelRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const counterAreaRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLSpanElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<(HTMLDivElement | null)[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gsapCtx = useRef<gsap.Context | null>(null);

  const targetPosition = useMemo(() => ({
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 300,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 - 40 : 300,
  }), []);

  const playCoinSound = useCallback(() => {
    try {
      if (!audioRef.current) audioRef.current = new Audio('/sounds/success.mp3');
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 0.3;
      audioRef.current.play().catch(() => {});
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!visible) {
      setPhase('rewards');
      setDisplayedPoints(previousTotal);
      if (gsapCtx.current) { gsapCtx.current.revert(); gsapCtx.current = null; }
      return;
    }

    setDisplayedPoints(previousTotal);
    const container = panelRef.current?.parentElement;

    // Declared outside context so cleanup can remove nodes on early unmount
    const coinEls: HTMLDivElement[] = [];

    gsapCtx.current = gsap.context(() => {
      const coinCount = Math.min(Math.max(8, Math.floor(pointsEarned * 2)), 25);

      if (container) {
        for (let i = 0; i < coinCount; i++) {
          const size = 28 + Math.random() * 16;
          const coin = document.createElement('div');
          coin.style.cssText = `
            position: fixed; pointer-events: none; z-index: 10005;
            width: ${size}px; height: ${size}px; border-radius: 50%; opacity: 0;
            background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%);
            box-shadow: 0 0 20px rgba(255,215,0,0.8), inset 0 -3px 6px rgba(0,0,0,0.3), inset 0 3px 6px rgba(255,255,255,0.5);
          `;
          const inner = document.createElement('div');
          inner.style.cssText = `
            position: absolute; inset: 4px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-weight: 900; color: #78350f; font-size: ${size * 0.4}px;
            background: linear-gradient(135deg, #FFEC8B 0%, #FFD700 100%);
            transform: perspective(200px) rotateY(15deg);
          `;
          inner.textContent = 'R';
          coin.appendChild(inner);
          document.body.appendChild(coin);
          coinEls.push(coin);
        }
      }

      const masterTl = gsap.timeline();

      if (panelRef.current) {
        masterTl.fromTo(panelRef.current,
          { scale: 0.75, opacity: 0, y: 30 },
          { scale: 1, opacity: 1, y: 0, duration: 0.55, ease: 'back.out(1.7)' }
        );
      }

      if (iconRef.current) {
        masterTl.fromTo(iconRef.current,
          { y: -30, opacity: 0, scale: 0.5 },
          { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: 'elastic.out(1.5, 0.5)' },
          0.15
        );
      }

      if (titleRef.current) {
        masterTl.fromTo(titleRef.current,
          { y: 15, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out' },
          0.3
        );
      }

      masterTl.call(() => {
        playCoinSound();
        coinEls.forEach((coin, i) => {
          const startX = Math.random() * window.innerWidth * 0.6 + window.innerWidth * 0.1;
          const startY = -60 - Math.random() * 200;
          const rotation = Math.random() * 360;
          const midX = (startX + targetPosition.x) / 2 + (Math.random() - 0.5) * 80;
          const midY = (startY + targetPosition.y) / 2 - 80;
          const delay = 0.8 + i * 0.06;

          gsap.set(coin, { x: startX, y: startY, scale: 0, rotation, opacity: 0 });
          gsap.timeline({ delay })
            .to(coin, { x: midX, y: midY, scale: 1.2, rotation: rotation + 360, opacity: 1, duration: 0.65, ease: 'power2.out' })
            .to(coin, { x: targetPosition.x, y: targetPosition.y, scale: 0.5, rotation: rotation + 720, opacity: 0, duration: 0.65, ease: 'power3.in' });
        });
      }, [], 0.5);

      if (badgeRef.current) {
        masterTl.fromTo(badgeRef.current,
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.45, ease: 'elastic.out(1.5, 0.5)' },
          0.8
        );
      }

      if (counterAreaRef.current) {
        masterTl.fromTo(counterAreaRef.current,
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.5, ease: 'elastic.out(1.2, 0.5)' },
          0.9
        );
      }

      masterTl.call(() => {
        if (pointsEarned > 0) {
          const obj = { val: previousTotal };
          const steps = Math.min(pointsEarned, 30);
          playCoinSound();
          gsap.to(obj, {
            val: newTotal,
            duration: 1.2,
            ease: 'power1.inOut',
            onUpdate: () => { setDisplayedPoints(Math.round(obj.val)); },
            onComplete: () => { setDisplayedPoints(newTotal); },
          });
        } else {
          setDisplayedPoints(newTotal);
        }
      }, [], 1.2);

      if (plusRef.current && pointsEarned > 0) {
        masterTl.fromTo(plusRef.current,
          { y: 20, opacity: 0, scale: 0.5 },
          { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: 'elastic.out(1.5, 0.5)' },
          1.5
        );
      }

      if (detailsRef.current) {
        masterTl.fromTo(detailsRef.current,
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' },
          2.5
        );
      }

      starsRef.current.forEach((star, i) => {
        if (!star) return;
        masterTl.fromTo(star,
          { scale: 0, rotation: -180, opacity: 0 },
          { scale: 1, rotation: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' },
          2.7 + i * 0.1
        );
      });

      if (buttonsRef.current) {
        masterTl.fromTo(buttonsRef.current,
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' },
          3.2
        );
      }

      masterTl.call(() => {
        coinEls.forEach(el => el.parentNode && el.remove());
      }, [], 3.0);
    });

    return () => {
      if (gsapCtx.current) { gsapCtx.current.revert(); gsapCtx.current = null; }
      // Remove any coin nodes that weren't cleaned up by the scheduled timeline callback
      coinEls.forEach(el => el.parentNode && el.remove());
    };
  }, [visible, pointsEarned, previousTotal, newTotal]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  const placementLabels: Record<number, string> = {
    1: '1° Posto - VINCITORE',
    2: '2° Posto',
    3: '3° Posto',
    4: '4° Posto',
    5: '5° Posto',
    6: '6° Posto',
  };

  const placementColors: Record<number, string> = {
    1: 'from-yellow-400 to-amber-600',
    2: 'from-gray-300 to-gray-500',
    3: 'from-amber-600 to-amber-800',
  };

  if (phase === 'ad') {
    return (
      <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center p-4" style={{ zIndex: 10000 }}>
        <div className="w-full max-w-lg flex flex-col items-center gap-6">
          <AdBanner format="rectangle" className="w-full" style={{ minHeight: '250px' }} />

          {rematchSection && <div className="w-full">{rematchSection}</div>}

          {onContinueTournament && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onContinueTournament(); }}
              className="w-full flex items-center justify-center gap-2 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg cursor-pointer"
              style={{ position: 'relative', zIndex: 9999, background: 'linear-gradient(135deg, #7c3aed, #2563eb)', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}
            >
              <Trophy size={20} />
              Prosegui torneo
            </button>
          )}
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation(); e.preventDefault();
                try { useGameState.getState().clearSession(); } catch (err) { console.error('[REWARDS-PANEL] clearSession error:', err); }
                window.location.href = window.location.origin;
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-500/30 cursor-pointer"
              style={{ position: 'relative', zIndex: 9999 }}
            >
              <Home size={20} />
              Torna alla home
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation(); e.preventDefault();
                try { useGameState.getState().clearSession(); } catch (err) { console.error('[REWARDS-PANEL] clearSession error:', err); }
                const newGameId = Math.random().toString(36).substring(2, 8).toUpperCase();
                window.location.href = `${window.location.origin}?game=${newGameId}`;
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-green-500/30 cursor-pointer"
              style={{ position: 'relative', zIndex: 9999 }}
            >
              <Play size={20} />
              Nuova partita
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 overflow-y-auto" style={{ zIndex: 10000 }}>
      <div
        ref={panelRef}
        className="relative w-full max-w-md mx-auto"
        style={{ opacity: 0 }}
      >
        <div
          className="rounded-2xl p-6 md:p-8 text-center border-2 relative overflow-hidden"
          style={{
            background: isWinner
              ? 'linear-gradient(135deg, rgba(180,130,20,0.3) 0%, rgba(120,80,10,0.4) 100%)'
              : 'linear-gradient(135deg, rgba(60,60,100,0.4) 0%, rgba(40,40,80,0.5) 100%)',
            borderColor: isWinner ? 'rgba(255,215,0,0.5)' : 'rgba(100,100,200,0.3)',
            backdropFilter: 'blur(20px)',
            boxShadow: isWinner
              ? '0 0 60px rgba(255,215,0,0.2), inset 0 0 60px rgba(255,215,0,0.05)'
              : '0 0 40px rgba(100,100,200,0.15), inset 0 0 40px rgba(100,100,200,0.05)',
          }}
        >
          <div ref={iconRef} className="mb-4" style={{ opacity: 0 }}>
            {isWinner ? (
              <Crown className="w-14 h-14 mx-auto text-yellow-400 mb-2" style={{ filter: 'drop-shadow(0 0 15px rgba(255,215,0,0.6))' }} />
            ) : (
              <Medal className="w-14 h-14 mx-auto text-blue-300 mb-2" style={{ filter: 'drop-shadow(0 0 10px rgba(147,197,253,0.5))' }} />
            )}
            <div ref={titleRef} style={{ opacity: 0 }}>
              <h2 className="text-xl md:text-2xl font-bold text-white mb-1" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                PARTITA CONCLUSA
              </h2>
              <p className="text-sm text-white/70">
                {isWinner ? `Hai vinto! Complimenti ${playerName}!` : `Vincitore: ${winnerName}`}
              </p>
            </div>
          </div>

          <div className="mb-4">
            <div ref={badgeRef} style={{ opacity: 0, display: 'inline-block', marginBottom: 12 }}>
              <div
                className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold bg-gradient-to-r ${placementColors[placement] || 'from-slate-500 to-slate-700'}`}
                style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
              >
                <span className="text-white">{placementLabels[placement] || `${placement}° Posto`}</span>
              </div>
            </div>

            <div ref={counterAreaRef} className="relative py-4" style={{ opacity: 0 }}>
              <div
                className="text-5xl md:text-6xl font-black tabular-nums"
                style={{
                  background: 'linear-gradient(180deg, #FFD700 0%, #FF8C00 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 0 15px rgba(255,165,0,0.5))',
                }}
              >
                {displayedPoints.toLocaleString()}
              </div>
              <div className="text-yellow-300/80 text-sm mt-1" style={{ textShadow: '0 0 8px rgba(255,215,0,0.4)' }}>
                Punti Rankiard Totali
              </div>

              {pointsEarned > 0 && (
                <span
                  ref={plusRef}
                  className="inline-block text-2xl md:text-3xl font-bold px-4 py-1 rounded-full mt-2"
                  style={{
                    opacity: 0,
                    background: 'linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(16,185,129,0.3) 100%)',
                    color: '#4ade80',
                    textShadow: '0 0 12px rgba(74,222,128,0.6)',
                    border: '1px solid rgba(74,222,128,0.3)',
                  }}
                >
                  +{pointsEarned} PR
                </span>
              )}
            </div>
          </div>

          <div ref={detailsRef} className="mb-4 space-y-2" style={{ opacity: 0 }}>
            <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
              <Trophy size={14} className="text-yellow-400" />
              <span>Classifica finale: {placement}° posto</span>
            </div>
            {isWinner && (
              <div className="flex items-center justify-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    ref={(el) => { starsRef.current[i] = el; }}
                    style={{ opacity: 0, display: 'inline-flex' }}
                  >
                    <Star size={18} className="text-yellow-400 fill-yellow-400" style={{ filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))' }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div ref={buttonsRef} style={{ opacity: 0 }} className="space-y-2">
            {isWinner && (
              <button
                onClick={() => shareVictory({
                  winnerName: playerName,
                  pointsEarned,
                  totalDamageDealt: gameStats?.totalDamageDealt ?? 0,
                  cardsPlayed: gameStats?.cardsPlayed ?? 0,
                  turnsPlayed: gameStats?.turnsPlayed ?? 0,
                  matchDuration: gameStats?.matchDuration ?? 0,
                })}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 text-white font-bold py-2.5 px-6 rounded-xl transition-all border border-yellow-500/40 hover:border-yellow-400/60 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.25))' }}
              >
                {isGenerating ? (
                  <>
                    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fbbf24', borderRadius: '50%' }} />
                    Generazione...
                  </>
                ) : navigator.canShare ? (
                  <>
                    <Share2 size={16} className="text-yellow-400" />
                    Condividi Vittoria
                  </>
                ) : (
                  <>
                    <Download size={16} className="text-yellow-400" />
                    Scarica Card
                  </>
                )}
              </button>
            )}
            <button
              onClick={() => setPhase('ad')}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50"
            >
              Continua
            </button>
          </div>
        </div>
      </div>
    </div>

    {isWinner && (
      <VictoryCard
        cardRef={victoryCardRef}
        stats={{
          winnerName: playerName,
          pointsEarned,
          totalDamageDealt: gameStats?.totalDamageDealt ?? 0,
          cardsPlayed: gameStats?.cardsPlayed ?? 0,
          turnsPlayed: gameStats?.turnsPlayed ?? 0,
          matchDuration: gameStats?.matchDuration ?? 0,
        }}
      />
    )}
  </>
  );
};

export default GameEndRewardsPanel;
