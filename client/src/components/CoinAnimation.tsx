import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Coin {
  id: number;
  startX: number;
  startY: number;
  delay: number;
  size: number;
  rotation: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
}

interface CoinAnimationProps {
  isActive: boolean;
  pointsAwarded: number;
  onComplete?: () => void;
  targetPosition?: { x: number; y: number };
}

export const CoinAnimation: React.FC<CoinAnimationProps> = ({
  isActive,
  pointsAwarded,
  onComplete,
  targetPosition = { x: window.innerWidth / 2, y: 80 }
}) => {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showPointsText, setShowPointsText] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);
  
  const soundIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const textTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const completeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playCoinSound = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/success.mp3');
      }
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 0.4;
      audioRef.current.play().catch(() => {});
    } catch (e) {}
  }, []);

  useEffect(() => {
    return () => {
      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
      if (textTimeoutRef.current) clearTimeout(textTimeoutRef.current);
      if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (isActive && pointsAwarded > 0) {
      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
      if (textTimeoutRef.current) clearTimeout(textTimeoutRef.current);
      if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
      
      setAnimationComplete(false);
      setShowPointsText(false);
      
      const coinCount = Math.min(Math.max(5, Math.floor(pointsAwarded / 10)), 20);
      const newCoins: Coin[] = [];
      const newParticles: Particle[] = [];

      for (let i = 0; i < coinCount; i++) {
        newCoins.push({
          id: Date.now() + i,
          startX: Math.random() * window.innerWidth * 0.6 + window.innerWidth * 0.2,
          startY: window.innerHeight + 50,
          delay: i * 0.08,
          size: 30 + Math.random() * 20,
          rotation: Math.random() * 360
        });
      }

      for (let i = 0; i < 30; i++) {
        newParticles.push({
          id: Date.now() + 1000 + i,
          x: targetPosition.x + (Math.random() - 0.5) * 200,
          y: targetPosition.y + (Math.random() - 0.5) * 100,
          size: 3 + Math.random() * 8,
          color: ['#FFD700', '#FFA500', '#FFFF00', '#FFE4B5', '#FFFFFF'][Math.floor(Math.random() * 5)],
          delay: 0.8 + Math.random() * 0.5
        });
      }

      setCoins(newCoins);
      setParticles(newParticles);

      playCoinSound();
      let soundCount = 0;
      soundIntervalRef.current = setInterval(() => {
        soundCount++;
        if (soundCount >= 3) {
          if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
        } else {
          playCoinSound();
        }
      }, 400);

      textTimeoutRef.current = setTimeout(() => {
        setShowPointsText(true);
      }, 600);

      completeTimeoutRef.current = setTimeout(() => {
        setAnimationComplete(true);
        setShowPointsText(false);
        setCoins([]);
        setParticles([]);
        onComplete?.();
      }, 3000);
    }
  }, [isActive, pointsAwarded, targetPosition, onComplete, playCoinSound]);

  if (!isActive || animationComplete) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      <AnimatePresence>
        {coins.map((coin) => (
          <motion.div
            key={coin.id}
            initial={{
              x: coin.startX,
              y: coin.startY,
              scale: 0,
              rotate: coin.rotation,
              opacity: 0
            }}
            animate={{
              x: targetPosition.x,
              y: targetPosition.y,
              scale: [0, 1.2, 1, 0.8],
              rotate: coin.rotation + 720,
              opacity: [0, 1, 1, 0]
            }}
            transition={{
              duration: 1.2,
              delay: coin.delay,
              ease: [0.25, 0.46, 0.45, 0.94]
            }}
            className="absolute"
            style={{ width: coin.size, height: coin.size }}
          >
            <div 
              className="w-full h-full rounded-full relative"
              style={{
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%)',
                boxShadow: '0 0 20px rgba(255, 215, 0, 0.8), inset 0 -3px 6px rgba(0,0,0,0.3), inset 0 3px 6px rgba(255,255,255,0.5)'
              }}
            >
              <div 
                className="absolute inset-2 rounded-full flex items-center justify-center font-bold text-amber-900"
                style={{
                  background: 'linear-gradient(135deg, #FFEC8B 0%, #FFD700 100%)',
                  fontSize: coin.size * 0.4,
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                }}
              >
                R
              </div>
            </div>
            <motion.div
              className="absolute inset-0 rounded-full"
              animate={{
                boxShadow: [
                  '0 0 10px rgba(255, 215, 0, 0.5)',
                  '0 0 30px rgba(255, 215, 0, 0.8)',
                  '0 0 10px rgba(255, 215, 0, 0.5)'
                ]
              }}
              transition={{
                duration: 0.3,
                repeat: Infinity
              }}
            />
          </motion.div>
        ))}

        {particles.map((particle) => (
          <motion.div
            key={`particle-${particle.id}`}
            initial={{
              x: targetPosition.x,
              y: targetPosition.y,
              scale: 0,
              opacity: 0
            }}
            animate={{
              x: particle.x,
              y: particle.y,
              scale: [0, 1.5, 0],
              opacity: [0, 1, 0]
            }}
            transition={{
              duration: 1,
              delay: particle.delay,
              ease: 'easeOut'
            }}
            className="absolute rounded-full"
            style={{
              width: particle.size,
              height: particle.size,
              background: particle.color,
              boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`
            }}
          />
        ))}

        {showPointsText && (
          <motion.div
            initial={{ scale: 0, opacity: 0, y: targetPosition.y + 50 }}
            animate={{ 
              scale: [0, 1.3, 1],
              opacity: [0, 1, 1, 0],
              y: [targetPosition.y + 50, targetPosition.y - 20]
            }}
            transition={{ duration: 2, times: [0, 0.2, 0.5, 1] }}
            className="absolute left-1/2 -translate-x-1/2 text-center"
            style={{ top: targetPosition.y }}
          >
            <div 
              className="text-4xl md:text-6xl font-bold"
              style={{
                background: 'linear-gradient(180deg, #FFD700 0%, #FF8C00 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 30px rgba(255, 215, 0, 0.5)',
                filter: 'drop-shadow(0 0 10px rgba(255, 165, 0, 0.8))'
              }}
            >
              +{pointsAwarded} PR
            </div>
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{
                duration: 0.5,
                repeat: Infinity
              }}
              className="text-yellow-300 text-lg md:text-xl mt-2"
              style={{ textShadow: '0 0 10px rgba(255, 215, 0, 0.8)' }}
            >
              Punti Rankiard!
            </motion.div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.3, 0] }}
          transition={{ duration: 1.5, delay: 0.5 }}
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at center, rgba(255, 215, 0, 0.3) 0%, transparent 70%)'
          }}
        />
      </AnimatePresence>
    </div>
  );
};

export default CoinAnimation;
