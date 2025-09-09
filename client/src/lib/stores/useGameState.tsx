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
  scenarioCardsActive: boolean;
  turnOrder: string[];
  currentTurnIndex: number;
}

interface GameStateStore {
  gameState: GameState | null;
  playerName: string;
  gameId: string;
  selectedCard: Card | null;
  selectedMosseCard: Card | null;
  shakingCards: Set<string>;
  showBrowser: boolean;
  
  setGameState: (state: GameState) => void;
  setPlayerName: (name: string) => void;
  setGameId: (id: string) => void;
  setSelectedCard: (card: Card | null) => void;
  setSelectedMosseCard: (card: Card | null) => void;
  addShakingCard: (cardId: string) => void;
  removeShakingCard: (cardId: string) => void;
  setShowBrowser: (show: boolean) => void;
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
    selectedMosseCard: null,
    shakingCards: new Set(),
    showBrowser: false,
    
    setGameState: (gameState) => set({ gameState }),
    setPlayerName: (playerName) => set({ playerName }),
    setGameId: (gameId) => set({ gameId }),
    setSelectedCard: (selectedCard) => set({ selectedCard }),
    setSelectedMosseCard: (selectedMosseCard) => set({ selectedMosseCard }),
    addShakingCard: (cardId) => set((state) => {
      const newSet = new Set(state.shakingCards);
      newSet.add(cardId);
      return { shakingCards: newSet };
    }),
    removeShakingCard: (cardId) => set((state) => {
      const newSet = new Set(state.shakingCards);
      newSet.delete(cardId);
      return { shakingCards: newSet };
    }),
    setShowBrowser: (showBrowser) => set({ showBrowser }),
  };
});
