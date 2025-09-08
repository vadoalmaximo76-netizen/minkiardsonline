import React, { useState } from "react";
import { Button } from "./ui/button";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";

interface DeckProps {
  name: string;
  backImage: string;
  type: 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali';
}

export const Deck: React.FC<DeckProps> = ({ name, backImage, type }) => {
  const { gameState, playerName } = useGameState();
  const [showBrowser, setShowBrowser] = useState(false);
  
  const remainingCards = gameState?.decks?.[type]?.length || 0;

  const handleShuffle = () => {
    socket.emit('shuffle-deck', { deckType: type });
  };

  const handlePickCard = () => {
    if (remainingCards > 0) {
      socket.emit('pick-card', { deckType: type, playerName });
    }
  };

  const handleChooseCard = () => {
    setShowBrowser(true);
  };

  const handleCardSelect = (cardId: string) => {
    socket.emit('choose-specific-card', { deckType: type, cardId, playerName });
    setShowBrowser(false);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <h3 className="text-white font-bold text-lg">{name}</h3>
      
      <div className="relative">
        <img
          src={backImage}
          alt={`${name} back`}
          className="w-28 h-40 rounded-lg cursor-pointer hover:scale-105 transition-transform shadow-lg"
          onClick={handlePickCard}
        />
        
        {/* Card count */}
        <div className="absolute -bottom-2 -right-2 bg-white text-black rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
          {remainingCards}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          onClick={handleShuffle}
          className="bg-sky-blue hover:bg-sky-blue/80 text-white font-bold px-4 py-2"
        >
          MISCHIA
        </Button>
        <Button
          onClick={handleChooseCard}
          className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2"
        >
          SCEGLI
        </Button>
      </div>

      {/* Deck Browser Modal */}
      {showBrowser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">Scegli una carta da {name}</h3>
              <Button
                onClick={() => setShowBrowser(false)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2"
              >
                Chiudi
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {gameState?.decks?.[type]?.map((card) => (
                <div key={card.id} className="flex flex-col items-center">
                  <img
                    src={card.frontImage}
                    alt="Card"
                    className="w-20 h-28 rounded-lg cursor-pointer hover:scale-105 transition-transform shadow-lg"
                    onClick={() => handleCardSelect(card.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
