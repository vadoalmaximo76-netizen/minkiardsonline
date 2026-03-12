import React from "react";
import { useGameState } from "../lib/stores/useGameState";
import { getAvatarEmoji } from "../lib/avatars";

export const OtherPlayersHands: React.FC = () => {
  const { gameState, playerName } = useGameState();
  
  if (!gameState?.players) return null;

  const otherPlayers = Object.entries(gameState.players).filter(
    ([name]) => name !== playerName
  );

  if (otherPlayers.length === 0) return null;

  const charLimit = gameState.characterLimit;
  const isUnlimited = charLimit === 'unlimited';
  const baseLimit = isUnlimited ? 0 : parseInt(charLimit ?? '0') || 0;
  const deathModifiers: Record<string, number> = gameState.playerDeathModifiers || {};

  const getDeathCount = (name: string): number => {
    if (!gameState.graveyard) return 0;
    return gameState.graveyard.filter(
      (c: any) => c.owner === name && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
    ).length;
  };

  const getDeathLimit = (name: string): number => {
    const modifier = deathModifiers[name] || 0;
    return Math.max(1, baseLimit + modifier);
  };

  return (
    <div className="mb-8">
      <h2 className="text-white font-bold text-2xl mb-4">ALTRI GIOCATORI</h2>
      <div className="flex gap-6 overflow-x-auto pb-4">
        {otherPlayers.map(([name, player]) => {
          const handCount = player.hand.length;
          const avatarEmoji = player.avatar ? getAvatarEmoji(player.avatar) : '👤';
          const isOnline = player.socketId != null;
          const deaths = getDeathCount(name);
          const limit = getDeathLimit(name);
          const isEliminated = gameState.eliminatedPlayers?.includes(name);
          
          return (
            <div key={name} className={`bg-gray-800/80 rounded-lg p-4 flex-shrink-0 min-w-[200px] border ${isEliminated ? 'border-red-800/50 opacity-50' : 'border-transparent'}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <span className="relative">
                    <span className="text-2xl">{avatarEmoji}</span>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-gray-800 ${isOnline ? 'bg-green-400' : 'bg-red-500'}`} />
                  </span>
                  <span className="flex flex-col">
                    <span className="leading-tight">{name}</span>
                    {!isUnlimited && (
                      <span className={`text-[10px] font-normal leading-tight ${deaths >= limit ? 'text-red-400' : deaths >= limit - 1 ? 'text-yellow-400' : 'text-gray-400'}`}>
                        💀 {deaths}/{limit}
                      </span>
                    )}
                  </span>
                </h3>
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
