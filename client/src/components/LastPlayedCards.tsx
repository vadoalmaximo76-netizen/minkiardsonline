import React, { useState } from "react";
import { History, X } from "lucide-react";
import { Button } from "./ui/button";

interface PlayedCard {
  id: string;
  frontImage: string;
  name?: string;
  playerName: string;
  timestamp: number;
  cardType: string;
}

interface LastPlayedCardsProps {
  cards: PlayedCard[];
  maxCards?: number;
}

export const LastPlayedCards: React.FC<LastPlayedCardsProps> = ({ 
  cards, 
  maxCards = 5 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const recentCards = cards.slice(-maxCards).reverse();

  return (
    <>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-2 landscape:bottom-4 md:bottom-4 left-2 landscape:left-4 md:left-4 btn-neon-cyan text-white font-bold rounded-full p-2 landscape:p-3 md:p-3 shadow-lg hover:shadow-xl transition-all duration-200 relative pointer-events-auto"
        style={{ position: 'fixed', zIndex: 9999 }}
        title="Ultime carte giocate"
      >
        <History size={16} className="landscape:w-6 landscape:h-6 md:w-6 md:h-6" />
        {recentCards.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-orange-500 text-white rounded-full text-xs w-4 h-4 flex items-center justify-center font-bold">
            {recentCards.length}
          </span>
        )}
      </Button>
      
      {isOpen && recentCards.length > 0 && (
        <div className="fixed bottom-16 landscape:bottom-20 md:bottom-20 left-2 landscape:left-4 md:left-4 bg-black/90 rounded-lg p-3 backdrop-blur-sm border border-white/20 shadow-xl pointer-events-auto" style={{ zIndex: 9998 }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <History className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-white font-medium">Ultime carte giocate</span>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-white/60 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex gap-2">
            {recentCards.map((card, index) => (
              <div 
                key={`${card.id}-${card.timestamp}`}
                className="relative group"
                style={{ 
                  opacity: 1 - (index * 0.12),
                  transform: `scale(${1 - (index * 0.03)})`
                }}
              >
                <div className="w-12 h-16 rounded overflow-hidden border border-white/30 shadow-lg transition-transform hover:scale-125 hover:z-50">
                  <img 
                    src={card.frontImage} 
                    alt={card.name || card.id}
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                </div>
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap z-50 pointer-events-none">
                  <span className="font-medium">{card.name || card.cardType}</span>
                  <span className="text-white/60 ml-1">- {card.playerName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
