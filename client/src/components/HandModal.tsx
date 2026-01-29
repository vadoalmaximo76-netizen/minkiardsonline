import React, { useState, useEffect } from "react";
import { Card } from "./Card";
import { Button } from "./ui/button";
import { X } from "lucide-react";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";

interface HandModalProps {
  onClose: () => void;
}

export const HandModal: React.FC<HandModalProps> = ({ onClose }) => {
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-slate-950 border border-purple-500/30 rounded-3xl p-8 w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-purple-900/20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 border-b border-purple-500/20 pb-6">
          <div className="flex items-center gap-6">
            <h2 className="text-white font-black text-3xl tracking-tight">CARTE IN MANO</h2>
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleEndTurn}
                className="sky-blue-button"
                title="Termina il turno del giocatore corrente e passa al successivo"
              >
                FINE TURNO
              </Button>
              <div className="text-white/70 text-sm font-medium italic">
                Ora è il turno di: <span className="text-yellow-400 font-bold uppercase">
                  {gameState && gameState.turnOrder && gameState.turnOrder[gameState.currentTurnIndex] ? gameState.turnOrder[gameState.currentTurnIndex] : "..."}
                </span>
              </div>
            </div>
            {endTurnMessage && (
              <div className="text-sm font-bold text-white bg-purple-600/20 border border-purple-500/30 px-4 py-2 rounded-xl animate-in fade-in zoom-in-95">
                {endTurnMessage}
              </div>
            )}
          </div>
          <Button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 text-white rounded-full p-2"
            title="Chiudi"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Cards Grid */}
        <div className="flex flex-wrap gap-4 justify-center">
          {playerCards.map((card) => (
            <Card
              key={card.id}
              card={card}
              location="hand"
              onCardPlayed={onClose}
            />
          ))}
          {playerCards.length === 0 && (
            <p className="text-white/70 italic text-center w-full py-8">
              Nessuna carta in mano
            </p>
          )}
        </div>

        {/* Cards count */}
        {playerCards.length > 0 && (
          <div className="text-center mt-4">
            <p className="text-white/80 text-sm">
              Totale: {playerCards.length} {playerCards.length === 1 ? 'carta' : 'carte'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};