import React, { useEffect, useState, useMemo } from 'react';

interface PersonaggioNotificationProps {
  isVisible: boolean;
  cardName: string;
  message: string;
  cardImage: string;
}

export const PersonaggioNotification: React.FC<PersonaggioNotificationProps> = ({
  isVisible,
  cardName,
  message,
  cardImage
}) => {
  const [animationPhase, setAnimationPhase] = useState(0);
  
  const particles = useMemo(() => 
    [...Array(20)].map((_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2,
      size: 2 + Math.random() * 4
    })), []
  );

  const glowParticles = useMemo(() =>
    [...Array(12)].map((_, i) => ({
      angle: (i / 12) * 360,
      delay: i * 0.1,
      distance: 60 + Math.random() * 40
    })), []
  );

  useEffect(() => {
    if (isVisible) {
      setAnimationPhase(0);
      const timer1 = setTimeout(() => setAnimationPhase(1), 100);
      const timer2 = setTimeout(() => setAnimationPhase(2), 400);
      const timer3 = setTimeout(() => setAnimationPhase(3), 700);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        style={{
          animation: 'neon-backdrop-fade 0.5s ease-out forwards'
        }}
      />
      
      <div 
        className="relative flex flex-col items-center gap-6"
        style={{
          animation: 'neon-container-enter 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
        }}
      >
        <div className="absolute inset-0 -m-20 overflow-hidden pointer-events-none">
          {particles.map((p, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${p.left}%`,
                bottom: '-10%',
                width: `${p.size}px`,
                height: `${p.size}px`,
                background: i % 3 === 0 
                  ? 'rgba(0, 255, 255, 0.8)' 
                  : i % 3 === 1 
                    ? 'rgba(255, 0, 255, 0.8)' 
                    : 'rgba(139, 92, 246, 0.8)',
                boxShadow: i % 3 === 0 
                  ? '0 0 10px rgba(0, 255, 255, 0.8), 0 0 20px rgba(0, 255, 255, 0.4)' 
                  : i % 3 === 1 
                    ? '0 0 10px rgba(255, 0, 255, 0.8), 0 0 20px rgba(255, 0, 255, 0.4)'
                    : '0 0 10px rgba(139, 92, 246, 0.8), 0 0 20px rgba(139, 92, 246, 0.4)',
                animation: `neon-particle-rise ${p.duration}s ease-out infinite`,
                animationDelay: `${p.delay}s`
              }}
            />
          ))}
        </div>

        {cardImage && (
          <div 
            className="relative"
            style={{
              animation: animationPhase >= 1 
                ? 'neon-card-reveal 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' 
                : 'none',
              opacity: animationPhase >= 1 ? 1 : 0
            }}
          >
            <div 
              className="absolute -inset-3 rounded-xl opacity-75"
              style={{
                background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.4), rgba(255, 0, 255, 0.4), rgba(139, 92, 246, 0.4))',
                filter: 'blur(15px)',
                animation: 'neon-glow-pulse 2s ease-in-out infinite'
              }}
            />
            
            <div 
              className="absolute -inset-1 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, #00ffff, #ff00ff, #8b5cf6, #00ffff)',
                backgroundSize: '300% 300%',
                animation: 'neon-border-flow 3s linear infinite',
                padding: '3px'
              }}
            >
              <div className="w-full h-full bg-black rounded-lg" />
            </div>
            
            <img
              src={cardImage}
              alt={cardName}
              className="relative w-40 h-56 rounded-lg object-contain z-10"
              style={{
                filter: 'drop-shadow(0 0 30px rgba(0, 255, 255, 0.6))',
                animation: 'neon-card-float 3s ease-in-out infinite'
              }}
              onError={(e) => {
                console.error('Failed to load card image:', cardImage);
                e.currentTarget.style.display = 'none';
              }}
            />

            {glowParticles.map((gp, i) => (
              <div
                key={i}
                className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full"
                style={{
                  background: i % 2 === 0 ? '#00ffff' : '#ff00ff',
                  boxShadow: i % 2 === 0 
                    ? '0 0 10px #00ffff, 0 0 20px #00ffff' 
                    : '0 0 10px #ff00ff, 0 0 20px #ff00ff',
                  transform: `rotate(${gp.angle}deg) translateX(${gp.distance}px)`,
                  animation: `neon-orbit 4s linear infinite`,
                  animationDelay: `${gp.delay}s`,
                  opacity: 0.8
                }}
              />
            ))}
          </div>
        )}

        <div 
          className="relative overflow-hidden rounded-2xl"
          style={{
            animation: animationPhase >= 2 
              ? 'neon-text-reveal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' 
              : 'none',
            opacity: animationPhase >= 2 ? 1 : 0,
            transform: animationPhase >= 2 ? 'translateY(0)' : 'translateY(20px)'
          }}
        >
          <div 
            className="absolute -inset-1 rounded-2xl"
            style={{
              background: 'linear-gradient(90deg, #00ffff, #ff00ff, #8b5cf6, #00ffff)',
              backgroundSize: '300% 100%',
              animation: 'neon-border-flow 2s linear infinite',
              padding: '2px'
            }}
          >
            <div className="w-full h-full bg-black/90 rounded-2xl backdrop-blur-xl" />
          </div>
          
          <div 
            className="relative px-12 py-6 rounded-2xl z-10"
            style={{
              background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.9), rgba(20, 10, 30, 0.95))',
              backdropFilter: 'blur(20px)'
            }}
          >
            <div 
              className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden rounded-2xl"
              style={{
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 255, 0.03) 2px, rgba(0, 255, 255, 0.03) 4px)',
                animation: 'neon-scanlines 8s linear infinite'
              }}
            />

            <h2 
              className="text-4xl md:text-5xl font-black text-center mb-3 tracking-wider relative"
              style={{
                background: 'linear-gradient(135deg, #00ffff, #ffffff, #ff00ff)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 40px rgba(0, 255, 255, 0.5)',
                filter: 'drop-shadow(0 0 10px rgba(0, 255, 255, 0.8))',
                animation: 'neon-text-glow 2s ease-in-out infinite alternate'
              }}
            >
              {cardName}
            </h2>
            
            <p 
              className="text-xl md:text-2xl font-bold text-center tracking-widest uppercase relative"
              style={{
                color: '#ff00ff',
                textShadow: '0 0 20px rgba(255, 0, 255, 0.8), 0 0 40px rgba(255, 0, 255, 0.4)',
                animation: animationPhase >= 3 ? 'neon-message-pulse 1.5s ease-in-out infinite' : 'none'
              }}
            >
              {message}
            </p>

            <div className="flex justify-center gap-2 mt-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: '#00ffff',
                    boxShadow: '0 0 10px #00ffff, 0 0 20px #00ffff',
                    animation: 'neon-dot-pulse 1s ease-in-out infinite',
                    animationDelay: `${i * 0.15}s`
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div 
          className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-64 h-1 rounded-full"
          style={{
            background: 'linear-gradient(90deg, transparent, #00ffff, #ff00ff, #00ffff, transparent)',
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.6), 0 0 40px rgba(255, 0, 255, 0.4)',
            animation: 'neon-line-pulse 2s ease-in-out infinite'
          }}
        />
      </div>

      <style>{`
        @keyframes neon-backdrop-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes neon-container-enter {
          0% { 
            opacity: 0; 
            transform: scale(0.8) translateY(30px);
          }
          100% { 
            opacity: 1; 
            transform: scale(1) translateY(0);
          }
        }
        
        @keyframes neon-card-reveal {
          0% { 
            opacity: 0; 
            transform: scale(0.5) rotateY(90deg);
          }
          60% {
            transform: scale(1.1) rotateY(-10deg);
          }
          100% { 
            opacity: 1; 
            transform: scale(1) rotateY(0deg);
          }
        }
        
        @keyframes neon-card-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        
        @keyframes neon-glow-pulse {
          0%, 100% { 
            opacity: 0.6; 
            transform: scale(1);
          }
          50% { 
            opacity: 0.9; 
            transform: scale(1.05);
          }
        }
        
        @keyframes neon-border-flow {
          0% { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
        
        @keyframes neon-text-reveal {
          0% { 
            opacity: 0; 
            transform: translateY(30px) scale(0.9);
          }
          100% { 
            opacity: 1; 
            transform: translateY(0) scale(1);
          }
        }
        
        @keyframes neon-text-glow {
          0% { 
            filter: drop-shadow(0 0 10px rgba(0, 255, 255, 0.8)) drop-shadow(0 0 20px rgba(0, 255, 255, 0.4));
          }
          100% { 
            filter: drop-shadow(0 0 20px rgba(255, 0, 255, 0.8)) drop-shadow(0 0 40px rgba(255, 0, 255, 0.4));
          }
        }
        
        @keyframes neon-message-pulse {
          0%, 100% { 
            opacity: 1;
            transform: scale(1);
          }
          50% { 
            opacity: 0.8;
            transform: scale(1.02);
          }
        }
        
        @keyframes neon-particle-rise {
          0% { 
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          100% { 
            transform: translateY(-400px) scale(0);
            opacity: 0;
          }
        }
        
        @keyframes neon-orbit {
          0% { 
            transform: rotate(0deg) translateX(60px) rotate(0deg);
          }
          100% { 
            transform: rotate(360deg) translateX(60px) rotate(-360deg);
          }
        }
        
        @keyframes neon-scanlines {
          0% { transform: translateY(0); }
          100% { transform: translateY(100%); }
        }
        
        @keyframes neon-dot-pulse {
          0%, 100% { 
            opacity: 0.4;
            transform: scale(0.8);
          }
          50% { 
            opacity: 1;
            transform: scale(1.2);
          }
        }
        
        @keyframes neon-line-pulse {
          0%, 100% { 
            opacity: 0.6;
            transform: translateX(-50%) scaleX(1);
          }
          50% { 
            opacity: 1;
            transform: translateX(-50%) scaleX(1.2);
          }
        }
      `}</style>
    </div>
  );
};
