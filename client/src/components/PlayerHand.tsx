import React, { useEffect, useState } from "react";
import { Card } from "./Card";
import { Button } from "./ui/button";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";
import { getAvatarEmoji } from "../lib/avatars";

export const PlayerHand: React.FC = () => {
  const { gameState, playerName, gameId } = useGameState();
  const [endTurnMessage, setEndTurnMessage] = useState<string>("");
  
  const playerCards = gameState?.players?.[playerName]?.hand || [];
  const playerAvatar = gameState?.players?.[playerName]?.avatar;

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
    <div className="mb-4 sm:mb-8">
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-2 sm:mb-4">
        <h2 className="text-white font-bold text-base sm:text-2xl flex items-center gap-1 sm:gap-2">
          <span className="text-xl sm:text-3xl">{playerAvatar ? getAvatarEmoji(playerAvatar) : '👤'}</span>
          <span className="hidden sm:inline">CARTE IN MANO</span>
          <span className="sm:hidden">MANO</span>
        </h2>
        <Button
          onClick={handleEndTurn}
          className="sky-blue-button text-xs sm:text-sm px-2 sm:px-4 py-1 sm:py-2"
          title="Termina il turno del giocatore corrente e passa al successivo"
        >
          <span className="hidden sm:inline">FINE TURNO</span>
          <span className="sm:hidden">FINE</span>
        </Button>
        {endTurnMessage && (
          <div className="text-xs sm:text-sm font-bold text-white bg-purple-600/20 border border-purple-500/30 px-2 sm:px-3 py-1 rounded-xl">
            {endTurnMessage}
          </div>
        )}
      </div>
      <div className="flex gap-2 sm:gap-4 overflow-x-auto pb-2 sm:pb-4 -mx-2 px-2 sm:mx-0 sm:px-0">
        {playerCards.map((card) => (
          <Card
            key={card.id}
            card={card}
            location="hand"
          />
        ))}
        {playerCards.length === 0 && (
          <p className="text-white/70 italic text-sm sm:text-base">Nessuna carta in mano</p>
        )}
      </div>
    </div>
  );
};
