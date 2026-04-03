import React, { useEffect, useRef, useState } from 'react';

interface SorosActivationProps {
  activator: string;
  cardImage: string;
  onComplete: () => void;
}

export const SorosActivation: React.FC<SorosActivationProps> = ({ activator, cardImage, onComplete }) => {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [phase, setPhase] = useState<1 | 2>(1);

  useEffect(() => {
    const phaseTimer = setTimeout(() => {
      setPhase(2);
    }, 3000);

    const completeTimer = setTimeout(() => {
      onCompleteRef.current();
    }, 8000);

    return () => {
      clearTimeout(phaseTimer);
      clearTimeout(completeTimer);
    };
  }, []);

  const flameParticles = useRef(
    Array.from({ length: 28 }).map(() => ({
      left: Math.random() * 100,
      delay: Math.random() * 1,
      duration: 2.5 + Math.random() * 0.5,
    }))
  );

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className={`absolute inset-0 bg-black ${phase === 1 ? 'soros-black-screen' : 'soros-black-screen-phase2'}`} />

      {phase === 2 && (
        <>
          <div className="absolute inset-0 overflow-hidden">
            {flameParticles.current.map((p, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${p.left}%`,
                  bottom: '-50px',
                  width: '60px',
                  height: '100px',
                  backgroundImage: 'linear-gradient(to top, #FF6B00, #FFD700, transparent)',
                  clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 50% 85%, 18% 100%, 0% 38%)',
                  animation: `soros-flames ${p.duration}s ease-in-out ${p.delay}s forwards`,
                  opacity: 0.8,
                  filter: 'drop-shadow(0 0 10px #FF4500)',
                }}
              />
            ))}
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <img
                src={cardImage}
                alt="SOROS"
                className="w-64 h-96 rounded-lg shadow-2xl soros-card-appear object-cover"
                style={{
                  filter: 'drop-shadow(0 0 30px rgba(255, 200, 0, 0.8))',
                }}
              />
              <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 text-white text-2xl font-bold whitespace-nowrap text-center">
                🎭 SOROS ACTIVATED BY {activator.toUpperCase()}! 🎭
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
