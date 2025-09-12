import React, { useEffect, useState } from "react";
import { Card } from "./Card";
import { Button } from "./ui/button";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";

export const PlayerHand: React.FC = () => {
  const { gameState, playerName, gameId } = useGameState();
  const [endTurnMessage, setEndTurnMessage] = useState<string>("");
  
  const playerCards = gameState?.players?.[playerName]?.hand || [];

  useEffect(() => {
    const handleEndTurnSuccess = (data: { message: string; nextPlayer: string }) => {
      setEndTurnMessage(`✅ ${data.message} → Tocca a ${data.nextPlayer}`);
      setTimeout(() => setEndTurnMessage(""), 3000);
    };

    const handleEndTurnError = (data: { message: string }) => {
      setEndTurnMessage(`❌ ${data.message}`);
      setTimeout(() => setEndTurnMessage(""), 3000);
    };

    socket.on('force-end-turn-success', handleEndTurnSuccess);
    socket.on('force-end-turn-error', handleEndTurnError);

    return () => {
      socket.off('force-end-turn-success', handleEndTurnSuccess);
      socket.off('force-end-turn-error', handleEndTurnError);
    };
  }, []);

  const handleEndTurn = () => {
    socket.emit('force-end-turn', { gameId });
  };

  return (
    <div className="mb-8">
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-white font-bold text-2xl">CARTE IN MANO</h2>
        <Button
          onClick={handleEndTurn}
          className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold"
          title="Termina il turno del giocatore corrente e passa al successivo"
        >
          FINE TURNO
        </Button>
        {endTurnMessage && (
          <div className="text-sm font-bold text-white bg-black/50 px-3 py-1 rounded">
            {endTurnMessage}
          </div>
        )}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {playerCards.map((card) => (
          <Card
            key={card.id}
            card={card}
            location="hand"
          />
        ))}
        {playerCards.length === 0 && (
          <p className="text-white/70 italic">No cards in hand</p>
        )}
      </div>
    </div>
  );
};
