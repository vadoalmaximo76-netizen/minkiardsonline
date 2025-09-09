import React, { useState } from 'react';
import { Button } from './ui/button';
import { X } from 'lucide-react';
import { socket } from '../lib/socket';

interface SuperDiceProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  playerName: string;
}

export const SuperDice: React.FC<SuperDiceProps> = ({ isOpen, onClose, gameId, playerName }) => {
  const [isRolling, setIsRolling] = useState(false);
  const [rolledCard, setRolledCard] = useState<{image: string, name: string} | null>(null);

  // The 6 super dice cards
  const diceCards = [
    { name: 'AGO DI PINO', image: 'https://i.ibb.co/Ld485J59/ago-di-pino.png', type: 'mosse' },
    { name: 'UNIONE CLANDESTINA', image: 'https://i.postimg.cc/44YxzKww/UNIONE-CLANDESTINA.png', type: 'bonus' },
    { name: 'BARATTO', image: 'https://i.postimg.cc/sgFmd7b6/baratto.png', type: 'bonus' },
    { name: 'PORTALE SPECIALE', image: 'https://i.postimg.cc/3JbNsXRs/portale-speciale.png', type: 'bonus' },
    { name: 'MINKIARDS N 200', image: 'https://i.postimg.cc/7hk0Tg7s/minkiards-n-200.png', type: 'bonus' },
    // Adding a 6th card to complete the dice
    { name: 'MACUMBA', image: 'https://i.postimg.cc/SNG7CtgW/macumba.png', type: 'bonus' }
  ];

  const handleRollDice = () => {
    if (isRolling) return;
    
    setIsRolling(true);
    setRolledCard(null);
    
    // Simulate dice rolling with multiple quick changes
    let rollCount = 0;
    const rollInterval = setInterval(() => {
      const randomCard = diceCards[Math.floor(Math.random() * diceCards.length)];
      setRolledCard(randomCard);
      rollCount++;
      
      if (rollCount >= 10) {
        clearInterval(rollInterval);
        // Final roll
        const finalCard = diceCards[Math.floor(Math.random() * diceCards.length)];
        setRolledCard(finalCard);
        setIsRolling(false);
        
        // Emit the result to all players
        socket.emit('super-dice-rolled', { 
          gameId, 
          playerName, 
          rolledCard: finalCard 
        });
      }
    }, 100);
  };

  const handlePlaceCard = () => {
    if (!rolledCard) return;
    
    // Emit event to place the rolled card directly on the field
    socket.emit('place-super-dice-card', {
      gameId,
      playerName,
      cardData: rolledCard
    });
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full text-center relative">
        {/* Close button */}
        <Button
          onClick={onClose}
          className="absolute top-2 right-2 bg-transparent hover:bg-gray-700 text-white p-1 h-8 w-8 rounded-full"
          size="sm"
        >
          <X size={16} />
        </Button>

        <h2 className="text-white font-bold text-xl mb-4" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
          SUPER DADO MINKIARDS
        </h2>

        {/* Dice visualization */}
        <div className="mb-6">
          {rolledCard ? (
            <div className="flex flex-col items-center gap-3">
              <img
                src={rolledCard.image}
                alt={rolledCard.name}
                className={`w-32 h-44 rounded-lg shadow-lg object-contain ${isRolling ? 'animate-pulse' : ''}`}
              />
              <p className="text-white font-bold text-sm" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                {rolledCard.name}
              </p>
            </div>
          ) : (
            <div className="w-32 h-44 mx-auto bg-gray-600 rounded-lg flex items-center justify-center">
              <div className="text-white text-6xl animate-spin">🎲</div>
            </div>
          )}
        </div>

        {/* Control buttons */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={handleRollDice}
            disabled={isRolling}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6"
            style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
          >
            {isRolling ? 'TIRANDO IL DADO...' : 'TIRA IL DADO'}
          </Button>

          {rolledCard && !isRolling && (
            <Button
              onClick={handlePlaceCard}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4"
              style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
            >
              METTI SUL TAVOLO
            </Button>
          )}
        </div>

        {/* Dice faces preview */}
        <div className="mt-4">
          <p className="text-white/80 text-xs mb-2" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
            Facce del dado:
          </p>
          <div className="grid grid-cols-3 gap-1">
            {diceCards.map((card, index) => (
              <img
                key={index}
                src={card.image}
                alt={card.name}
                className="w-12 h-16 rounded object-contain opacity-60"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};