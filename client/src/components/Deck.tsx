import React from "react";
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
  
  const remainingCards = gameState?.decks?.[type]?.length || 0;

  const handleShuffle = () => {
    socket.emit('shuffle-deck', { deckType: type });
  };

  const handlePickCard = () => {
    if (remainingCards > 0) {
      socket.emit('pick-card', { deckType: type, playerName });
    }
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

      <Button
        onClick={handleShuffle}
        className="bg-sky-blue hover:bg-sky-blue/80 text-white font-bold px-4 py-2"
      >
        MISCHIA
      </Button>
    </div>
  );
};
