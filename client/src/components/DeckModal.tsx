import React from "react";
import { Button } from "./ui/button";
import { X } from "lucide-react";
import { useGameState } from "../lib/stores/useGameState";
import { Deck } from "./Deck";

interface DeckModalProps {
  onClose: () => void;
}

export const DeckModal: React.FC<DeckModalProps> = ({ onClose }) => {
  const { gameState } = useGameState();

  const decks = [
    {
      name: "PERSONAGGI",
      type: "personaggi" as const,
      backImage: "https://i.imgur.com/r1rfUAB.png"
    },
    {
      name: "MOSSE", 
      type: "mosse" as const,
      backImage: "https://i.imgur.com/dJhXdF8.png"
    },
    {
      name: "BONUS",
      type: "bonus" as const, 
      backImage: "https://i.imgur.com/sBdj9Ta.png"
    },
    {
      name: "SPECIALI",
      type: "personaggi_speciali" as const,
      backImage: "https://i.imgur.com/XCmjr6s.png" 
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-bold text-2xl">PESCA CARTE</h2>
          <Button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 text-white rounded-full p-2"
            title="Chiudi"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Decks Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 justify-center">
          {decks.map((deck) => (
            <div key={deck.type} className="flex justify-center">
              <Deck
                name={deck.name}
                backImage={deck.backImage}
                type={deck.type}
              />
            </div>
          ))}
        </div>

        {/* Instructions */}
        <div className="mt-6 text-center">
          <p className="text-white/70 text-sm">
            Clicca su un mazzo per pescare una carta casuale, o usa "SCEGLI" per selezionare una carta specifica.
          </p>
        </div>
      </div>
    </div>
  );
};