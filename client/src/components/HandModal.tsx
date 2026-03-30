import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "./Card";
import { Button } from "./ui/button";
import { X } from "lucide-react";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";

interface HandModalProps {
  onClose: () => void;
}

const cardVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.88 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.055,
      type: 'spring' as const,
      stiffness: 420,
      damping: 26,
    },
  }),
  exit: { opacity: 0, scale: 0.85, transition: { duration: 0.15 } },
};

const panelVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 380, damping: 28 },
  },
  exit: { opacity: 0, y: 30, scale: 0.97, transition: { duration: 0.18 } },
};

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
    <div data-modal="hand" className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <motion.div
        className="bg-slate-950 border border-purple-500/30 rounded-3xl p-8 w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-purple-900/20"
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
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
              <motion.div
                className="text-sm font-bold text-white bg-purple-600/20 border border-purple-500/30 px-4 py-2 rounded-xl"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                {endTurnMessage}
              </motion.div>
            )}
          </div>
          <Button
            data-modal-cancel
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 text-white rounded-full p-2"
            title="Chiudi"
          >
            <X size={20} />
          </Button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory md:flex-wrap md:justify-center md:overflow-x-visible scrollbar-thin" style={{ WebkitOverflowScrolling: 'touch' }}>
          <AnimatePresence>
            {playerCards.map((card, i) => (
              <motion.div
                key={card.id}
                data-modal-option
                className="snap-center flex-shrink-0 md:flex-shrink"
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Card
                  card={card}
                  location="hand"
                  onCardPlayed={onClose}
                />
              </motion.div>
            ))}
          </AnimatePresence>
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
      </motion.div>
    </div>
  );
};
