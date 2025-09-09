import React from "react";
import { useGameState } from "../lib/stores/useGameState";

export const OtherPlayersHands: React.FC = () => {
  const { gameState, playerName } = useGameState();
  
  if (!gameState?.players) return null;

  // Get all players except the current player
  const otherPlayers = Object.entries(gameState.players).filter(
    ([name]) => name !== playerName
  );

  if (otherPlayers.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-white font-bold text-2xl mb-4">ALTRI GIOCATORI</h2>
      <div className="flex gap-6 overflow-x-auto pb-4">
        {otherPlayers.map(([name, player]) => {
          const handCount = player.hand.length;
          
          return (
            <div key={name} className="bg-gray-800/80 rounded-lg p-4 flex-shrink-0 min-w-[200px]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold text-lg">{name}</h3>
                <span className="text-yellow-400 font-semibold">
                  {handCount} {handCount === 1 ? 'carta' : 'carte'}
                </span>
              </div>
              
              {handCount > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {player.hand.map((card, index) => (
                    <div key={`${card.id}-${index}`} className="flex-shrink-0">
                      <img
                        src={card.backImage}
                        alt="Carta coperta"
                        className="w-12 h-16 md:w-16 md:h-20 rounded object-cover shadow-lg border border-gray-600"
                      />
                    </div>
                  ))}
                </div>
              )}
              
              {handCount === 0 && (
                <p className="text-white/70 italic text-sm">Nessuna carta in mano</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};