import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { X } from 'lucide-react';
import { socket } from '../lib/socket';
import { SuperDice3D } from './Dice3D';
import { useAudio } from '../lib/stores/useAudio';

interface SuperDiceProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  playerName: string;
}

export const SuperDice: React.FC<SuperDiceProps> = ({ isOpen, onClose, gameId, playerName }) => {
  const { playModalOpen, playButtonClick } = useAudio();
  const [isRolling, setIsRolling] = useState(false);
  const [rolledCard, setRolledCard] = useState<{image: string, name: string, type: string} | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const hasAutoRolled = useRef(false);
  const rollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  const diceCards = [
    { name: 'AGO DI PINO', image: 'https://i.ibb.co/Ld485J59/ago-di-pino.png', type: 'mosse' },
    { name: 'UNIONE CLANDESTINA', image: 'https://i.postimg.cc/44YxzKww/UNIONE-CLANDESTINA.png', type: 'bonus' },
    { name: 'BARATTO', image: 'https://i.postimg.cc/sgFmd7b6/baratto.png', type: 'bonus' },
    { name: 'PORTALE SPECIALE', image: 'https://i.postimg.cc/3JbNsXRs/portale-speciale.png', type: 'bonus' },
    { name: 'MINKIARDS N 200', image: 'https://i.postimg.cc/7hk0Tg7s/minkiards-n-200.png', type: 'bonus' },
    { name: 'MACUMBA', image: 'https://i.postimg.cc/SNG7CtgW/macumba.png', type: 'bonus' }
  ];

  const finalizeDice = useCallback((card: {image: string, name: string, type: string}) => {
    if (completedRef.current) return;
    completedRef.current = true;

    setRolledCard(card);
    setIsRolling(false);

    socket.emit('super-dice-rolled', {
      gameId,
      playerName,
      rolledCard: card
    });

    setTimeout(() => {
      socket.emit('place-super-dice-card', {
        gameId,
        playerName,
        cardData: card
      });
      onClose();
    }, 2000);
  }, [gameId, playerName, onClose]);

  const handleRollComplete = useCallback(() => {
    const finalCard = diceCards[Math.floor(Math.random() * diceCards.length)];
    finalizeDice(finalCard);
  }, [diceCards, finalizeDice]);

  const startRoll = useCallback(() => {
    if (isRolling) return;

    completedRef.current = false;
    setIsRolling(true);
    setRolledCard(null);

    let rollCount = 0;
    rollIntervalRef.current = setInterval(() => {
      setCurrentIndex(Math.floor(Math.random() * diceCards.length));
      rollCount++;

      if (rollCount >= 15) {
        if (rollIntervalRef.current) {
          clearInterval(rollIntervalRef.current);
          rollIntervalRef.current = null;
        }
        setIsRolling(false);
      }
    }, 80);

    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(() => {
      if (!completedRef.current) {
        console.log('🎲 SuperDice fallback: forcing roll completion');
        const fallbackCard = diceCards[Math.floor(Math.random() * diceCards.length)];
        finalizeDice(fallbackCard);
      }
    }, 4000);
  }, [isRolling, diceCards, finalizeDice]);

  useEffect(() => {
    if (isOpen) {
      playModalOpen();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !hasAutoRolled.current) {
      hasAutoRolled.current = true;
      const timer = setTimeout(() => {
        startRoll();
      }, 600);
      return () => clearTimeout(timer);
    }
    if (!isOpen) {
      hasAutoRolled.current = false;
      completedRef.current = false;
      setRolledCard(null);
      setIsRolling(false);
      if (rollIntervalRef.current) {
        clearInterval(rollIntervalRef.current);
        rollIntervalRef.current = null;
      }
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    }
  }, [isOpen, startRoll]);

  useEffect(() => {
    return () => {
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-purple-900 via-gray-800 to-purple-900 rounded-2xl p-6 max-w-lg w-full text-center relative border border-purple-500/50 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/10 rounded-2xl pointer-events-none" />

        <Button
          onClick={() => { playButtonClick(); onClose(); }}
          className="absolute top-3 right-3 bg-transparent hover:bg-gray-700 text-white p-2 h-8 w-8 rounded-full z-10 transition-all hover:scale-110"
          size="sm"
        >
          <X size={16} />
        </Button>

        <h2 className="text-white font-bold text-2xl mb-4 tracking-wide" style={{textShadow: '0 0 20px rgba(168,85,247,0.8)'}}>
          SUPER DADO MINKIARDS
        </h2>

        <div className="mb-6 h-[220px] relative">
          <div className="absolute inset-0 bg-gradient-radial from-purple-500/30 via-transparent to-transparent rounded-full blur-2xl" />
          <SuperDice3D 
            isRolling={isRolling}
            diceCards={diceCards}
            currentIndex={currentIndex}
            onRollComplete={handleRollComplete}
          />
        </div>

        {rolledCard && !isRolling && (
          <div className="mb-6 animate-in zoom-in-50 fade-in duration-500">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg blur-md opacity-50 animate-pulse" />
                <img
                  src={rolledCard.image}
                  alt={rolledCard.name}
                  className="relative w-28 h-40 rounded-lg shadow-2xl object-contain border-2 border-purple-400/50"
                />
              </div>
              <p className="text-white font-bold text-lg" style={{textShadow: '0 0 10px rgba(168,85,247,0.8)'}}>
                {rolledCard.name}
              </p>
              <p className="text-purple-300 text-sm animate-pulse">
                Piazzamento automatico in campo...
              </p>
            </div>
          </div>
        )}

        {isRolling && (
          <div className="relative z-10">
            <p className="text-purple-300 text-lg font-bold animate-pulse" style={{textShadow: '0 0 10px rgba(168,85,247,0.5)'}}>
              TIRANDO IL DADO...
            </p>
          </div>
        )}

        <div className="mt-5 relative z-10">
          <p className="text-white/70 text-xs mb-2" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
            Facce del dado:
          </p>
          <div className="grid grid-cols-6 gap-1 justify-center">
            {diceCards.map((card, index) => (
              <div key={index} className="relative group">
                <div className={`absolute inset-0 bg-purple-500 rounded opacity-0 group-hover:opacity-30 transition-opacity ${currentIndex === index && isRolling ? 'opacity-50 animate-pulse' : ''}`} />
                <img
                  src={card.image}
                  alt={card.name}
                  className={`w-10 h-14 rounded object-contain opacity-70 group-hover:opacity-100 transition-all ${currentIndex === index && isRolling ? 'scale-110 opacity-100' : ''}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
