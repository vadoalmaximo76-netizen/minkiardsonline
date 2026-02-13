import React, { useEffect, useMemo } from 'react';

interface AttackSlash3DProps {
  isVisible: boolean;
  attackerName: string;
  targetName: string;
  damage: number;
  onComplete: () => void;
}

interface SparkParticle {
  id: number;
  angle: number;
  distance: number;
  delay: number;
}

export const AttackSlash3D: React.FC<AttackSlash3DProps> = ({
  isVisible,
  attackerName,
  targetName,
  damage,
  onComplete,
}) => {
  // Pre-calculate spark positions using useMemo
  const sparkParticles = useMemo<SparkParticle[]>(() => {
    const particles: SparkParticle[] = [];
    for (let i = 0; i < 25; i++) {
      particles.push({
        id: i,
        angle: Math.random() * Math.PI * 2,
        distance: 150 + Math.random() * 200,
        delay: (Math.random() * 0.2),
      });
    }
    return particles;
  }, []);

  // Handle animation completion
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onComplete, 1200);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return (
    <>
      <style>{`
        @keyframes slash-sweep {
          0% {
            transform: translateX(-120%) rotateZ(-45deg) scaleX(0.3);
            opacity: 1;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateX(120%) rotateZ(-45deg) scaleX(1);
            opacity: 0;
          }
        }

        @keyframes shockwave-expand {
          0% {
            transform: scale(0);
            opacity: 1;
          }
          100% {
            transform: scale(3);
            opacity: 0;
          }
        }

        @keyframes spark-scatter {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx), var(--ty)) scale(0);
            opacity: 0;
          }
        }

        @keyframes damage-float {
          0% {
            transform: translateY(0) scale(0.5);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-150px) scale(1.5);
            opacity: 0;
          }
        }

        .attack-slash-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          pointer-events: none;
        }

        .slash-container {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }

        .slash {
          position: absolute;
          top: 50%;
          left: 0;
          width: 100%;
          height: 15%;
          transform: translateY(-50%);
          pointer-events: none;
        }

        .slash-inner {
          width: 100%;
          height: 100%;
          background: linear-gradient(
            to right,
            rgba(255, 68, 68, 0),
            rgba(255, 68, 68, 0.8) 20%,
            rgba(255, 150, 0, 0.8) 50%,
            rgba(255, 68, 68, 0.6) 80%,
            rgba(255, 68, 68, 0)
          );
          box-shadow: 
            0 0 15px rgba(255, 68, 68, 0.6),
            0 0 30px rgba(255, 150, 0, 0.4),
            inset 0 0 10px rgba(255, 255, 255, 0.3);
          transform-origin: center;
          filter: drop-shadow(0 0 8px rgba(255, 100, 0, 0.5));
        }

        .slash-1 {
          animation: slash-sweep 0.4s ease-in-out 0s forwards;
        }

        .slash-2 {
          animation: slash-sweep 0.4s ease-in-out 0.1s forwards;
        }

        .slash-3 {
          animation: slash-sweep 0.4s ease-in-out 0.2s forwards;
        }

        .shockwave-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 80px;
          height: 80px;
          margin-left: -40px;
          margin-top: -40px;
          border: 3px solid rgba(255, 255, 255, 0.8);
          border-radius: 50%;
          box-shadow: 
            0 0 15px rgba(255, 255, 255, 0.6),
            inset 0 0 15px rgba(255, 255, 255, 0.3);
          animation: shockwave-expand 0.6s ease-out 0.4s forwards;
          pointer-events: none;
        }

        .spark {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 8px;
          height: 8px;
          margin-left: -4px;
          margin-top: -4px;
          background: radial-gradient(circle, rgba(255, 150, 0, 1), rgba(255, 100, 0, 0.6));
          border-radius: 50%;
          box-shadow: 0 0 6px rgba(255, 150, 0, 0.8);
          pointer-events: none;
        }

        .damage-info {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          animation: damage-float 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s forwards;
          pointer-events: none;
          white-space: nowrap;
          z-index: 10;
        }

        .attacker-name {
          font-size: 1.1rem;
          font-weight: 800;
          color: #ffaa00;
          text-shadow: 
            0 0 8px rgba(255, 170, 0, 0.8),
            2px 2px 0 rgba(0, 0, 0, 0.9);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .damage-number {
          font-size: 4rem;
          font-weight: 900;
          color: #ff4444;
          text-shadow: 
            0 0 10px rgba(255, 68, 68, 0.8),
            0 0 20px rgba(255, 100, 0, 0.6),
            2px 2px 0 rgba(0, 0, 0, 0.8);
          line-height: 1;
        }

        .target-label {
          font-size: 0.85rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.7);
          text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.9);
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .target-name {
          font-size: 1.1rem;
          font-weight: 800;
          color: #66bbff;
          text-shadow: 
            0 0 8px rgba(102, 187, 255, 0.8),
            2px 2px 0 rgba(0, 0, 0, 0.9);
          text-transform: uppercase;
          letter-spacing: 1px;
        }
      `}</style>

      <div className="attack-slash-overlay">
        {/* Slash container */}
        <div className="slash-container">
          <div className="slash slash-1">
            <div className="slash-inner" />
          </div>
          <div className="slash slash-2">
            <div className="slash-inner" />
          </div>
          <div className="slash slash-3">
            <div className="slash-inner" />
          </div>
        </div>

        {/* Shockwave ring */}
        <div className="shockwave-ring" />

        {/* Spark particles */}
        {sparkParticles.map((spark) => {
          const tx = Math.cos(spark.angle) * spark.distance;
          const ty = Math.sin(spark.angle) * spark.distance;
          
          return (
            <div
              key={spark.id}
              className="spark"
              style={{
                '--tx': `${tx}px`,
                '--ty': `${ty}px`,
                animation: `spark-scatter 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${0.4 + spark.delay}s forwards`,
              } as React.CSSProperties & { '--tx': string; '--ty': string }}
            />
          );
        })}

        {/* Damage info with attacker, damage value, and target */}
        <div className="damage-info">
          <div className="attacker-name">{attackerName}</div>
          <div className="damage-number">{damage}</div>
          <div className="target-label">SU</div>
          <div className="target-name">{targetName}</div>
        </div>
      </div>
    </>
  );
};
