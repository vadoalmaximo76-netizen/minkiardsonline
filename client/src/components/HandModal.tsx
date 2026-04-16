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
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 210);
  };
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
    <div
      data-modal="hand"
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      style={isClosing ? { animation: 'modal-backdrop-out 0.2s ease-in forwards' } : undefined}
    >
      <div
        className="bg-slate-950 border border-purple-500/30 rounded-3xl p-8 w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-purple-900/20"
        style={isClosing
          ? { animation: 'hand-modal-out 0.2s ease-in forwards' }
          : { animation: 'hand-modal-in 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
      >
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
              <div className="text-sm font-bold text-white bg-purple-600/20 border border-purple-500/30 px-4 py-2 rounded-xl">
                {endTurnMessage}
              </div>
            )}
          </div>
          <Button
            data-modal-cancel
            onClick={handleClose}
            className="bg-red-600 hover:bg-red-700 text-white rounded-full p-2"
            title="Chiudi"
          >
            <X size={20} />
          </Button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory md:flex-wrap md:justify-center md:overflow-x-visible scrollbar-thin" style={{ WebkitOverflowScrolling: 'touch' }}>
          {playerCards.map((card, i) => (
            <div
              key={card.id}
              data-modal-option
              className="snap-center flex-shrink-0 md:flex-shrink"
              style={{ animation: `hand-card-in 0.35s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.055}s both` }}
            >
              <Card
                card={card}
                location="hand"
                onCardPlayed={onClose}
              />
            </div>
          ))}
          {playerCards.length === 0 && (
            <p className="text-white/70 italic text-center w-full py-8">
              Nessuna carta in mano
            </p>
          )}
        </div>

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
