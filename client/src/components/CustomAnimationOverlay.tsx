import { useEffect, useState } from 'react';

interface CustomAnimationOverlayProps {
  isVisible: boolean;
  cardName: string;
  animationDescription: string;
  onComplete: () => void;
}

type AnimationType = 'stink' | 'fire' | 'ice' | 'lightning' | 'heal' | 'energy' | 'dark' | 'explosion' | 'wind' | 'water' | 'default';

function detectAnimationType(description: string): AnimationType {
  const lower = description.toLowerCase();
  
  if (lower.includes('puzza') || lower.includes('odore') || lower.includes('fetore') || lower.includes('marcio')) {
    return 'stink';
  }
  if (lower.includes('fuoco') || lower.includes('fiamm') || lower.includes('brucia') || lower.includes('inferno')) {
    return 'fire';
  }
  if (lower.includes('ghiaccio') || lower.includes('gelo') || lower.includes('freddo') || lower.includes('congela')) {
    return 'ice';
  }
  if (lower.includes('fulmine') || lower.includes('elettr') || lower.includes('tuono') || lower.includes('scarica')) {
    return 'lightning';
  }
  if (lower.includes('cura') || lower.includes('heal') || lower.includes('rigenera') || lower.includes('vita')) {
    return 'heal';
  }
  if (lower.includes('energia') || lower.includes('power') || lower.includes('potenza') || lower.includes('aura')) {
    return 'energy';
  }
  if (lower.includes('oscur') || lower.includes('tenebre') || lower.includes('ombra') || lower.includes('dark')) {
    return 'dark';
  }
  if (lower.includes('esplod') || lower.includes('boom') || lower.includes('detona') || lower.includes('blast')) {
    return 'explosion';
  }
  if (lower.includes('vento') || lower.includes('aria') || lower.includes('tornado') || lower.includes('soffia')) {
    return 'wind';
  }
  if (lower.includes('acqua') || lower.includes('onda') || lower.includes('pioggia') || lower.includes('water')) {
    return 'water';
  }
  
  return 'default';
}

export function CustomAnimationOverlay({ isVisible, cardName, animationDescription, onComplete }: CustomAnimationOverlayProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number; size: number }>>([]);
  const animationType = detectAnimationType(animationDescription);
  
  useEffect(() => {
    if (isVisible) {
      const newParticles = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 0.5,
        size: 10 + Math.random() * 40
      }));
      setParticles(newParticles);
      
      const timer = setTimeout(onComplete, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete]);
  
  if (!isVisible) return null;
  
  const getAnimationStyles = () => {
    switch (animationType) {
      case 'stink':
        return {
          background: 'radial-gradient(ellipse at center, rgba(100, 80, 20, 0.8) 0%, rgba(60, 80, 30, 0.6) 40%, transparent 70%)',
          particleColor: '#8B7355',
          particleEmoji: '💨',
          secondaryEmoji: '🤢',
          pulseColor: 'rgba(100, 80, 20, 0.4)'
        };
      case 'fire':
        return {
          background: 'radial-gradient(ellipse at center, rgba(255, 100, 0, 0.8) 0%, rgba(255, 50, 0, 0.5) 40%, transparent 70%)',
          particleColor: '#FF4500',
          particleEmoji: '🔥',
          secondaryEmoji: '💥',
          pulseColor: 'rgba(255, 100, 0, 0.5)'
        };
      case 'ice':
        return {
          background: 'radial-gradient(ellipse at center, rgba(150, 200, 255, 0.8) 0%, rgba(100, 150, 255, 0.5) 40%, transparent 70%)',
          particleColor: '#87CEEB',
          particleEmoji: '❄️',
          secondaryEmoji: '🧊',
          pulseColor: 'rgba(150, 200, 255, 0.5)'
        };
      case 'lightning':
        return {
          background: 'radial-gradient(ellipse at center, rgba(255, 255, 100, 0.8) 0%, rgba(200, 200, 50, 0.5) 40%, transparent 70%)',
          particleColor: '#FFD700',
          particleEmoji: '⚡',
          secondaryEmoji: '✨',
          pulseColor: 'rgba(255, 255, 100, 0.6)'
        };
      case 'heal':
        return {
          background: 'radial-gradient(ellipse at center, rgba(100, 255, 100, 0.8) 0%, rgba(50, 200, 50, 0.5) 40%, transparent 70%)',
          particleColor: '#90EE90',
          particleEmoji: '💚',
          secondaryEmoji: '✨',
          pulseColor: 'rgba(100, 255, 100, 0.5)'
        };
      case 'energy':
        return {
          background: 'radial-gradient(ellipse at center, rgba(200, 100, 255, 0.8) 0%, rgba(150, 50, 200, 0.5) 40%, transparent 70%)',
          particleColor: '#9370DB',
          particleEmoji: '💫',
          secondaryEmoji: '⭐',
          pulseColor: 'rgba(200, 100, 255, 0.5)'
        };
      case 'dark':
        return {
          background: 'radial-gradient(ellipse at center, rgba(50, 0, 80, 0.9) 0%, rgba(20, 0, 40, 0.7) 40%, transparent 70%)',
          particleColor: '#4B0082',
          particleEmoji: '🌑',
          secondaryEmoji: '💀',
          pulseColor: 'rgba(50, 0, 80, 0.6)'
        };
      case 'explosion':
        return {
          background: 'radial-gradient(ellipse at center, rgba(255, 150, 0, 0.9) 0%, rgba(255, 50, 0, 0.6) 40%, transparent 70%)',
          particleColor: '#FF6600',
          particleEmoji: '💥',
          secondaryEmoji: '🔥',
          pulseColor: 'rgba(255, 150, 0, 0.6)'
        };
      case 'wind':
        return {
          background: 'radial-gradient(ellipse at center, rgba(200, 230, 255, 0.7) 0%, rgba(150, 200, 230, 0.4) 40%, transparent 70%)',
          particleColor: '#B0E0E6',
          particleEmoji: '🌀',
          secondaryEmoji: '💨',
          pulseColor: 'rgba(200, 230, 255, 0.4)'
        };
      case 'water':
        return {
          background: 'radial-gradient(ellipse at center, rgba(0, 100, 200, 0.8) 0%, rgba(0, 50, 150, 0.5) 40%, transparent 70%)',
          particleColor: '#1E90FF',
          particleEmoji: '💧',
          secondaryEmoji: '🌊',
          pulseColor: 'rgba(0, 100, 200, 0.5)'
        };
      default:
        return {
          background: 'radial-gradient(ellipse at center, rgba(150, 100, 255, 0.8) 0%, rgba(100, 50, 200, 0.5) 40%, transparent 70%)',
          particleColor: '#8A2BE2',
          particleEmoji: '✨',
          secondaryEmoji: '⭐',
          pulseColor: 'rgba(150, 100, 255, 0.5)'
        };
    }
  };
  
  const styles = getAnimationStyles();
  
  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
      <div 
        className="absolute inset-0 animate-pulse"
        style={{ background: styles.background }}
      />
      
      <div 
        className="absolute inset-0"
        style={{
          animation: 'customPulse 0.5s ease-in-out infinite',
          background: styles.pulseColor
        }}
      />
      
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute text-4xl"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            fontSize: `${p.size}px`,
            animation: `particleFloat 2s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
            opacity: 0.8
          }}
        >
          {p.id % 3 === 0 ? styles.secondaryEmoji : styles.particleEmoji}
        </div>
      ))}
      
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className="text-6xl font-bold text-white drop-shadow-2xl"
          style={{
            animation: 'cardNamePulse 0.8s ease-in-out infinite',
            textShadow: `0 0 20px ${styles.particleColor}, 0 0 40px ${styles.particleColor}`
          }}
        >
          {cardName}
        </div>
      </div>
      
      <style>{`
        @keyframes customPulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.02); }
        }
        
        @keyframes particleFloat {
          0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 0.8; }
          25% { transform: translateY(-20px) rotate(90deg) scale(1.2); opacity: 1; }
          50% { transform: translateY(-10px) rotate(180deg) scale(0.9); opacity: 0.6; }
          75% { transform: translateY(-30px) rotate(270deg) scale(1.1); opacity: 0.9; }
          100% { transform: translateY(0) rotate(360deg) scale(1); opacity: 0.8; }
        }
        
        @keyframes cardNamePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
