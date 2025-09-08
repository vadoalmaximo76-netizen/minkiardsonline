import { create } from "zustand";
import { socket } from "../socket";

interface Card {
  id: string;
  type: string;
  frontImage: string;
  backImage: string;
  owner: string;
  text?: string;
  eliminatedBy?: string;
}

interface Player {
  name: string;
  hand: Card[];
}

interface GameState {
  decks: {
    personaggi: Card[];
    mosse: Card[];
    bonus: Card[];
    personaggi_speciali: Card[];
  };
  players: Record<string, Player>;
  field: Card[];
  graveyard: Card[];
}

interface GameStateStore {
  gameState: GameState | null;
  playerName: string;
  gameId: string;
  selectedCard: Card | null;
  
  setGameState: (state: GameState) => void;
  setPlayerName: (name: string) => void;
  setGameId: (id: string) => void;
  setSelectedCard: (card: Card | null) => void;
}

export const useGameState = create<GameStateStore>((set) => {
  // Listen for game state updates
  socket.on('game-state-update', (gameState: GameState) => {
    set({ gameState });
  });

  return {
    gameState: null,
    playerName: "",
    gameId: "",
    selectedCard: null,
    
    setGameState: (gameState) => set({ gameState }),
    setPlayerName: (playerName) => set({ playerName }),
    setGameId: (gameId) => set({ gameId }),
    setSelectedCard: (selectedCard) => set({ selectedCard }),
  };
});
