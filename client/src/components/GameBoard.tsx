import React, { useState, useEffect } from "react";
import { Deck } from "./Deck";
import { PlayerHand } from "./PlayerHand";
import { GameField } from "./GameField";
import { Graveyard } from "./Graveyard";
import { Chat } from "./Chat";
import { CardModal } from "./CardModal";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";
import { Button } from "./ui/button";
import { MessageCircle } from "lucide-react";

export const GameBoard: React.FC = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const [graveyardOpen, setGraveyardOpen] = useState(false);
  const { selectedCard, gameId } = useGameState();

  const shareInviteLink = () => {
    const link = `${window.location.origin}?game=${gameId}`;
    navigator.clipboard.writeText(link);
    alert("Invitation link copied to clipboard!");
  };

  const handleResetGame = () => {
    if (confirm("Sei sicuro di voler ricominciare la partita? Tutte le carte verranno rimesse nei mazzi.")) {
      socket.emit('reset-game', { gameId });
    }
  };

  useEffect(() => {
    const handleGameReset = ({ message }: { message: string }) => {
      alert(message);
    };

    socket.on('game-reset', handleGameReset);

    return () => {
      socket.off('game-reset', handleGameReset);
    };
  }, []);

  return (
    <div className="min-h-screen bg-royal-blue p-4 relative">
      {/* Background image */}
      <div 
        className="fixed inset-0 bg-cover bg-center opacity-50"
        style={{
          backgroundImage: 'url(https://files.123freevectors.com/wp-content/original/113342-royal-blue-blurred-background-vector.jpg)'
        }}
      />
      
      {/* Game content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-4xl font-bold text-white">MINKIARDS</h1>
          <div className="flex gap-4">
            <Button
              onClick={() => setGraveyardOpen(!graveyardOpen)}
              className="bg-sky-blue hover:bg-sky-blue/80 text-white font-bold"
            >
              CIMITERO
            </Button>
            <Button
              onClick={shareInviteLink}
              className="bg-sky-blue hover:bg-sky-blue/80 text-white font-bold"
            >
              INVITE LINK
            </Button>
            <Button
              onClick={handleResetGame}
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              RICOMINCIA PARTITA
            </Button>
          </div>
        </div>

        {/* Decks */}
        <div className="flex gap-4 mb-8 justify-center">
          <Deck
            name="PERSONAGGI"
            backImage="https://i.imgur.com/r1rfUAB.png"
            type="personaggi"
          />
          <Deck
            name="MOSSE"
            backImage="https://i.imgur.com/6MUXCZO.png"
            type="mosse"
          />
          <Deck
            name="BONUS"
            backImage="https://i.imgur.com/lEROr3r.png"
            type="bonus"
          />
          <Deck
            name="PERSONAGGI SPECIALI"
            backImage="https://i.imgur.com/ipVd57A.png"
            type="personaggi_speciali"
          />
        </div>

        {/* Player Hand */}
        <PlayerHand />

        {/* Game Field */}
        <GameField />

        {/* Graveyard Modal */}
        {graveyardOpen && (
          <Graveyard onClose={() => setGraveyardOpen(false)} />
        )}

        {/* Chat Button */}
        <Button
          onClick={() => setChatOpen(!chatOpen)}
          className="fixed bottom-4 right-4 bg-sky-blue hover:bg-sky-blue/80 text-white font-bold rounded-full p-3"
        >
          <MessageCircle size={24} />
        </Button>

        {/* Chat */}
        {chatOpen && (
          <div className="fixed bottom-16 right-4 w-80 h-96">
            <Chat onClose={() => setChatOpen(false)} />
          </div>
        )}

        {/* Card Modal */}
        {selectedCard && <CardModal />}
      </div>
    </div>
  );
};
