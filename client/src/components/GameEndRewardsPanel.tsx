import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Trophy, Star, Home, Play, Medal } from 'lucide-react';
import { AdBanner } from './AdBanner';
import { useGameState } from '../lib/stores/useGameState';

interface Coin {
  id: number;
  startX: number;
  startY: number;
  delay: number;
  size: number;
  rotation: number;
}

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
}

export const GameEndRewardsPanel: React.FC<GameEndRewardsPanelProps> = ({
  visible,
  pointsEarned,
  previousTotal,
  newTotal,
  placement,
  isWinner,
  winnerName,
  playerName,
  onGoHome,
  onNewGame,
}) => {
  const [phase, setPhase] = useState<'rewards' | 'ad'>('rewards');
  const [displayedPoints, setDisplayedPoints] = useState(previousTotal);
  const [showCoins, setShowCoins] = useState(false);
  const [showCounter, setShowCounter] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  const [coins, setCoins] = useState<Coin[]>([]);
  const counterRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const targetPosition = useMemo(() => ({
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 300,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 - 40 : 300,
  }), []);

  const playCoinSound = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/success.mp3');
      }
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 0.3;
      audioRef.current.play().catch(() => {});
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!visible) {
      setPhase('rewards');
      setShowCoins(false);
      setShowCounter(false);
      setShowDetails(false);
      setShowButtons(false);
      setCoins([]);
      return;
    }

    setDisplayedPoints(previousTotal);

    const coinCount = Math.min(Math.max(8, Math.floor(pointsEarned * 2)), 25);
    const newCoins: Coin[] = [];
    for (let i = 0; i < coinCount; i++) {
      newCoins.push({
        id: Date.now() + i,
        startX: Math.random() * (typeof window !== 'undefined' ? window.innerWidth * 0.6 : 400) + (typeof window !== 'undefined' ? window.innerWidth * 0.2 : 100),
        startY: -60 - Math.random() * 200,
        delay: 0.8 + i * 0.06,
        size: 28 + Math.random() * 16,
        rotation: Math.random() * 360,
      });
    }

    const t1 = setTimeout(() => setShowCoins(true), 500);
    const t2 = setTimeout(() => {
      setCoins(newCoins);
      playCoinSound();
    }, 800);
    const t3 = setTimeout(() => setShowCounter(true), 1200);

    const t4 = setTimeout(() => {
      if (pointsEarned > 0) {
        const steps = Math.min(pointsEarned, 30);
        const increment = pointsEarned / steps;
        let current = previousTotal;
        let step = 0;
        counterRef.current = setInterval(() => {
          step++;
          current = Math.min(previousTotal + Math.round(increment * step), newTotal);
          setDisplayedPoints(current);
          if (step % 5 === 0) playCoinSound();
          if (step >= steps) {
            if (counterRef.current) clearInterval(counterRef.current);
            setDisplayedPoints(newTotal);
          }
        }, 60);
      } else {
        setDisplayedPoints(newTotal);
      }
    }, 1600);

    const t5 = setTimeout(() => setShowDetails(true), 2800);
    const t6 = setTimeout(() => setShowButtons(true), 3500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
      if (counterRef.current) clearInterval(counterRef.current);
    };
  }, [visible, pointsEarned, previousTotal, newTotal, playCoinSound, targetPosition]);

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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg flex flex-col items-center gap-6"
        >
          <AdBanner
            format="rectangle"
            className="w-full"
            style={{ minHeight: '250px' }}
          />

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('[REWARDS-PANEL] Torna alla home clicked');
                try {
                  useGameState.getState().clearSession();
                } catch (err) {
                  console.error('[REWARDS-PANEL] clearSession error:', err);
                }
                window.location.href = window.location.origin;
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 cursor-pointer"
              style={{ position: 'relative', zIndex: 9999 }}
            >
              <Home size={20} />
              Torna alla home
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('[REWARDS-PANEL] Nuova partita clicked');
                try {
                  useGameState.getState().clearSession();
                } catch (err) {
                  console.error('[REWARDS-PANEL] clearSession error:', err);
                }
                window.location.href = window.location.origin;
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-green-500/30 hover:shadow-green-500/50 cursor-pointer"
              style={{ position: 'relative', zIndex: 9999 }}
            >
              <Play size={20} />
              Nuova partita
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 overflow-hidden" style={{ zIndex: 10000 }}>
      <AnimatePresence>
        {showCoins && coins.map((coin) => (
          <motion.div
            key={coin.id}
            initial={{
              x: coin.startX,
              y: coin.startY,
              scale: 0,
              rotate: coin.rotation,
              opacity: 0,
            }}
            animate={{
              x: targetPosition.x,
              y: targetPosition.y,
              scale: [0, 1.2, 1, 0.6],
              rotate: coin.rotation + 720,
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: 1.4,
              delay: coin.delay,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className="absolute pointer-events-none"
            style={{ width: coin.size, height: coin.size }}
          >
            <div
              className="w-full h-full rounded-full relative"
              style={{
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%)',
                boxShadow: '0 0 20px rgba(255, 215, 0, 0.8), inset 0 -3px 6px rgba(0,0,0,0.3), inset 0 3px 6px rgba(255,255,255,0.5)',
                transform: 'perspective(200px) rotateY(15deg)',
              }}
            >
              <div
                className="absolute inset-2 rounded-full flex items-center justify-center font-bold text-amber-900"
                style={{
                  background: 'linear-gradient(135deg, #FFEC8B 0%, #FFD700 100%)',
                  fontSize: coin.size * 0.4,
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }}
              >
                R
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative w-full max-w-md mx-auto"
      >
        <div
          className="rounded-2xl p-6 md:p-8 text-center border-2 relative overflow-hidden"
          style={{
            background: isWinner
              ? 'linear-gradient(135deg, rgba(180, 130, 20, 0.3) 0%, rgba(120, 80, 10, 0.4) 100%)'
              : 'linear-gradient(135deg, rgba(60, 60, 100, 0.4) 0%, rgba(40, 40, 80, 0.5) 100%)',
            borderColor: isWinner ? 'rgba(255, 215, 0, 0.5)' : 'rgba(100, 100, 200, 0.3)',
            backdropFilter: 'blur(20px)',
            boxShadow: isWinner
              ? '0 0 60px rgba(255, 215, 0, 0.2), inset 0 0 60px rgba(255, 215, 0, 0.05)'
              : '0 0 40px rgba(100, 100, 200, 0.15), inset 0 0 40px rgba(100, 100, 200, 0.05)',
          }}
        >
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-4"
          >
            {isWinner ? (
              <Crown className="w-14 h-14 mx-auto text-yellow-400 mb-2" style={{ filter: 'drop-shadow(0 0 15px rgba(255, 215, 0, 0.6))' }} />
            ) : (
              <Medal className="w-14 h-14 mx-auto text-blue-300 mb-2" style={{ filter: 'drop-shadow(0 0 10px rgba(147, 197, 253, 0.5))' }} />
            )}
            <h2 className="text-xl md:text-2xl font-bold text-white mb-1" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
              PARTITA CONCLUSA
            </h2>
            <p className="text-sm text-white/70">
              {isWinner ? `Hai vinto! Complimenti ${playerName}!` : `Vincitore: ${winnerName}`}
            </p>
          </motion.div>

          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: showCounter ? 1 : 0, opacity: showCounter ? 1 : 0 }}
            transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            className="mb-4"
          >
            <div
              className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-3 bg-gradient-to-r ${placementColors[placement] || 'from-slate-500 to-slate-700'}`}
              style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
            >
              <span className="text-white">{placementLabels[placement] || `${placement}° Posto`}</span>
            </div>

            <div className="relative py-4">
              <div
                className="text-5xl md:text-6xl font-black tabular-nums"
                style={{
                  background: 'linear-gradient(180deg, #FFD700 0%, #FF8C00 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 0 15px rgba(255, 165, 0, 0.5))',
                }}
              >
                {displayedPoints.toLocaleString()}
              </div>
              <div className="text-yellow-300/80 text-sm mt-1" style={{ textShadow: '0 0 8px rgba(255, 215, 0, 0.4)' }}>
                Punti Rankiard Totali
              </div>

              <AnimatePresence>
                {showCounter && pointsEarned > 0 && (
                  <motion.div
                    initial={{ y: 20, opacity: 0, scale: 0.5 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                    className="mt-2"
                  >
                    <span
                      className="inline-block text-2xl md:text-3xl font-bold px-4 py-1 rounded-full"
                      style={{
                        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(16, 185, 129, 0.3) 100%)',
                        color: '#4ade80',
                        textShadow: '0 0 12px rgba(74, 222, 128, 0.6)',
                        border: '1px solid rgba(74, 222, 128, 0.3)',
                      }}
                    >
                      +{pointsEarned} PR
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="mb-4 space-y-2"
              >
                <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
                  <Trophy size={14} className="text-yellow-400" />
                  <span>Classifica finale: {placement}° su {Object.keys({}).length || '?'} giocatori</span>
                </div>
                {isWinner && (
                  <div className="flex items-center justify-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.1 * i, duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
                      >
                        <Star size={18} className="text-yellow-400 fill-yellow-400" style={{ filter: 'drop-shadow(0 0 4px rgba(250, 204, 21, 0.6))' }} />
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showButtons && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                <button
                  onClick={() => setPhase('ad')}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50"
                >
                  Continua
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default GameEndRewardsPanel;
