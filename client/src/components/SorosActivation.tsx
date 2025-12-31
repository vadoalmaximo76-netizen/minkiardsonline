import React, { useEffect, useState } from 'react';
import { socket } from '../lib/socket';

interface SorosActivationProps {
  activator: string;
  cardImage: string;
  onComplete: () => void;
}

export const SorosActivation: React.FC<SorosActivationProps> = ({ activator, cardImage, onComplete }) => {
  useEffect(() => {
    // Timeline:
    // 0-1s: Black screen
    // 1-4s: Flames animation + card appear
    // 4s+: Fade out and complete

    const timer = setTimeout(() => {
      onComplete();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Black Screen Overlay */}
      <div className="absolute inset-0 bg-black soros-black-screen" />

      {/* Flames Effect - 28 random flame particles */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 28 }).map((_, i) => {
          const randomLeft = Math.random() * 100;
          const randomDelay = Math.random() * 1;
          const randomDuration = 2.5 + Math.random() * 0.5;

          return (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${randomLeft}%`,
                bottom: '-50px',
                width: '60px',
                height: '100px',
                backgroundImage: 'linear-gradient(to top, #FF6B00, #FFD700, transparent)',
                clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 50% 85%, 18% 100%, 0% 38%)',
                animation: `soros-flames ${randomDuration}s ease-in-out ${randomDelay}s forwards`,
                opacity: 0.8,
                filter: 'drop-shadow(0 0 10px #FF4500)',
              }}
            />
          );
        })}
      </div>

      {/* SOROS Card Appearance - Centered */}
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
    </div>
  );
};
