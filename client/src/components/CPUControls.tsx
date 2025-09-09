import React from "react";
import { Button } from "./ui/button";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";
import { Bot, Users } from "lucide-react";

export const CPUControls: React.FC = () => {
  const { gameId, gameState } = useGameState();

  const handleAddCPU = () => {
    if (gameId) {
      socket.emit('add-cpu-player', { gameId });
    }
  };

  const cpuPlayers = gameState?.players ? 
    Object.values(gameState.players).filter((player: any) => player.name.startsWith('CPU-')) : [];

  const humanPlayers = gameState?.players ? 
    Object.values(gameState.players).filter((player: any) => !player.name.startsWith('CPU-')) : [];

  return (
    <div className="bg-gray-800/90 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
          <Bot size={20} />
          Giocatori CPU
        </h3>
        <Button
          onClick={handleAddCPU}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2"
          disabled={cpuPlayers.length >= 3} // Max 3 CPU players
        >
          <Bot size={16} className="mr-2" />
          Aggiungi CPU
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-green-400 font-semibold mb-2 flex items-center gap-2">
            <Users size={16} />
            Giocatori Umani ({humanPlayers.length})
          </h4>
          <div className="space-y-1">
            {humanPlayers.map((player: any) => (
              <div key={player.name} className="text-white text-sm bg-green-600/20 rounded px-2 py-1">
                {player.name}
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="text-purple-400 font-semibold mb-2 flex items-center gap-2">
            <Bot size={16} />
            Giocatori CPU ({cpuPlayers.length})
          </h4>
          <div className="space-y-1">
            {cpuPlayers.map((player: any) => (
              <div key={player.name} className="text-white text-sm bg-purple-600/20 rounded px-2 py-1">
                {player.name}
              </div>
            ))}
            {cpuPlayers.length === 0 && (
              <p className="text-gray-400 text-xs italic">Nessun CPU aggiunto</p>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-3 text-xs text-gray-400">
        <p>💡 I giocatori CPU analizzeranno le carte usando l'AI e giocheranno automaticamente</p>
        <p>🎯 Seguiranno le regole ufficiali di MINKIARDS e leggeranno il testo delle carte</p>
      </div>
    </div>
  );
};