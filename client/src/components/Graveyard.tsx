import React from "react";
import { Card } from "./Card";
import { useGameState } from "../lib/stores/useGameState";
import { Button } from "./ui/button";
import { X } from "lucide-react";

interface GraveyardProps {
  onClose: () => void;
}

export const Graveyard: React.FC<GraveyardProps> = ({ onClose }) => {
  const { gameState } = useGameState();
  
  const graveyardCards = gameState?.graveyard || [];

  // Separate regular graveyard cards from deleted cards
  const regularCards = graveyardCards.filter(card => !card.section || card.section !== 'CARTE CANCELLATE');
  const deletedCards = graveyardCards.filter(card => card.section === 'CARTE CANCELLATE');

  const cardsByOwner = regularCards.reduce((acc, card) => {
    const owner = card.owner || 'Unknown';
    if (!acc[owner]) {
      acc[owner] = [];
    }
    acc[owner].push(card);
    return acc;
  }, {} as Record<string, typeof regularCards>);

  const deletedCardsByOwner = deletedCards.reduce((acc, card) => {
    const owner = card.owner || 'Unknown';
    if (!acc[owner]) {
      acc[owner] = [];
    }
    acc[owner].push(card);
    return acc;
  }, {} as Record<string, typeof deletedCards>);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="premium-panel p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto animate-panel-slide-up">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-white font-bold text-2xl">CIMITERO</h2>
          <Button
            onClick={onClose}
            className="bg-sky-blue hover:bg-sky-blue/80 text-white"
            size="sm"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Regular graveyard cards */}
        <div className="mb-8">
          <h3 className="text-white font-bold text-xl mb-4">CARTE ELIMINATE</h3>
          {Object.keys(cardsByOwner).length === 0 ? (
            <p className="text-white/70 italic text-center">Nessuna carta eliminata</p>
          ) : (
            Object.entries(cardsByOwner).map(([owner, cards]) => (
              <div key={owner} className="mb-6">
                <h4 className="text-white font-semibold mb-3">Personaggi di: {owner}</h4>
                <div className="flex gap-4 flex-wrap">
                  {cards.map((card) => (
                    <Card
                      key={card.id}
                      card={card}
                      location="graveyard"
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Deleted cards section */}
        <div>
          <h3 className="text-red-400 font-bold text-xl mb-4">CARTE CANCELLATE</h3>
          {Object.keys(deletedCardsByOwner).length === 0 ? (
            <p className="text-red-400/70 italic text-center">Nessuna carta cancellata</p>
          ) : (
            Object.entries(deletedCardsByOwner).map(([owner, cards]) => (
              <div key={owner} className="mb-6">
                <h4 className="text-red-400 font-semibold mb-3">Cancellate di: {owner}</h4>
                <div className="flex gap-4 flex-wrap">
                  {cards.map((card) => (
                    <div key={card.id} className="opacity-75">
                      <Card
                        card={card}
                        location="graveyard"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
