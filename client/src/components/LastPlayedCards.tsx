import React from "react";
import { History } from "lucide-react";

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
  const recentCards = cards.slice(-maxCards).reverse();

  if (recentCards.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 bg-black/80 rounded-lg p-2 backdrop-blur-sm border border-white/20">
      <div className="flex items-center gap-1 mb-1">
        <History className="w-3 h-3 text-white/70" />
        <span className="text-xs text-white/70 font-medium">Ultime carte</span>
      </div>
      <div className="flex gap-1">
        {recentCards.map((card, index) => (
          <div 
            key={`${card.id}-${card.timestamp}`}
            className="relative group"
            style={{ 
              opacity: 1 - (index * 0.15),
              transform: `scale(${1 - (index * 0.05)})`
            }}
          >
            <div className="w-10 h-14 rounded overflow-hidden border border-white/30 shadow-lg transition-transform hover:scale-150 hover:z-50">
              <img 
                src={card.frontImage} 
                alt={card.name || card.id}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 px-1.5 py-0.5 rounded text-[10px] text-white whitespace-nowrap z-50 pointer-events-none">
              <span className="font-medium">{card.name || card.cardType}</span>
              <span className="text-white/60 ml-1">- {card.playerName}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
