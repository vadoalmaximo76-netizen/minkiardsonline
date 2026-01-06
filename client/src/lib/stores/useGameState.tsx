import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { socket } from "../socket";

interface Card {
  id: string;
  type: string;
  frontImage: string;
  backImage: string;
  owner: string;
  text?: string;
  eliminatedBy?: string;
  faceDown?: boolean; // True if the card is face-down
  section?: string; // Section for graveyard categorization (e.g., 'CARTE CANCELLATE')
  // Fusion system
  fusedWith?: string[]; // Array of card IDs that are fused with this card
  isFused?: boolean; // True if this card is part of a fusion
  fusionLeader?: string; // ID of the card that leads the fusion group
  // Parasitic card system
  attachedTo?: string; // ID of the card this parasitic card is attached to
  attachedBy?: string[]; // IDs of parasitic cards attached to this card
  canReattach?: boolean; // False if the card detached and cannot reattach
  name?: string; // Card name for custom cards
}

interface Player {
  name: string;
  hand: Card[];
  avatar?: string; // Player's chosen avatar ID
}

interface PendingDefense {
  attackId: string;
  attacker: string;
  defender: string;
  damage: number;
  cardId: string;
  deckType: string;
  createdAt: string; // Date as string for JSON serialization
}

interface VoodooLink {
  card1Id: string;
  card2Id: string;
  activatedBy: string;
  bonusCardId: string;
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
  pendingDefense?: PendingDefense; // Current pending defense request
  voodooLinks?: VoodooLink[]; // BAMBOLA VOODOO active links
}

interface GameStateStore {
  gameState: GameState | null;
  playerName: string;
  gameId: string;
  selectedCard: Card | null;
  selectedMosseCard: Card | null;
  shakingCards: Set<string>;
  showBrowser: boolean;
  isReconnecting: boolean;
  sessionId: string;
  pickedCard: Card | null;
  userRankiardPoints: number;
  prSpentThisGame: number;
  
  setGameState: (state: GameState) => void;
  setPlayerName: (name: string) => void;
  setGameId: (id: string) => void;
  setSelectedCard: (card: Card | null) => void;
  setSelectedMosseCard: (card: Card | null) => void;
  addShakingCard: (cardId: string) => void;
  removeShakingCard: (cardId: string) => void;
  setShowBrowser: (show: boolean) => void;
  setIsReconnecting: (reconnecting: boolean) => void;
  generateSessionId: () => void;
  hasActiveSession: () => boolean;
  clearSession: () => void;
  restoreSession: () => Promise<boolean>;
  setPickedCard: (card: Card | null) => void;
  setUserRankiardPoints: (points: number) => void;
  addPRSpent: (amount: number) => void;
  resetPRSpent: () => void;
}

export const useGameState = create<GameStateStore>()(
  persist(
    (set, get) => {
      // Listen for game state updates
      socket.on('game-state-update', (gameState: GameState) => {
        set({ gameState });
      });

      // Listen for picked cards (private to player)
      socket.on('card-picked-private', (data: { card: Card; message: string }) => {
        set({ pickedCard: data.card });
      });

      return {
        gameState: null,
        playerName: "",
        gameId: "",
        selectedCard: null,
        selectedMosseCard: null,
        shakingCards: new Set(),
        showBrowser: false,
        isReconnecting: false,
        sessionId: "",
        pickedCard: null,
        userRankiardPoints: 0,
        prSpentThisGame: 0,
        
        setGameState: (gameState) => set({ gameState }),
        setPlayerName: (playerName) => set({ playerName }),
        setGameId: (gameId) => set({ gameId }),
        setSelectedCard: (selectedCard) => set({ selectedCard }),
        setSelectedMosseCard: (selectedMosseCard) => set({ selectedMosseCard }),
        setUserRankiardPoints: (userRankiardPoints) => set({ userRankiardPoints }),
        addPRSpent: (amount) => set((state) => ({ prSpentThisGame: state.prSpentThisGame + amount })),
        resetPRSpent: () => set({ prSpentThisGame: 0 }),
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
        setIsReconnecting: (isReconnecting) => set({ isReconnecting }),
        setPickedCard: (pickedCard) => set({ pickedCard }),
        
        generateSessionId: () => {
          const sessionId = 'session-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
          set({ sessionId });
        },
        
        hasActiveSession: () => {
          const state = get();
          return !!(state.playerName && state.gameId && state.sessionId);
        },
        
        clearSession: () => {
          set({ 
            gameState: null,
            playerName: "",
            gameId: "",
            sessionId: "",
            selectedCard: null,
            selectedMosseCard: null,
            shakingCards: new Set(),
            isReconnecting: false
          });
        },
        
        restoreSession: async (): Promise<boolean> => {
          const state = get();
          if (!state.hasActiveSession()) {
            console.log('No active session found');
            return false;
          }
          
          console.log(`Attempting to restore session for player ${state.playerName} in game ${state.gameId}`);
          
          try {
            set({ isReconnecting: true });
            
            // Try to rejoin the game with existing session
            return new Promise((resolve) => {
              const timeout = setTimeout(() => {
                console.log('Session restore timeout - clearing session');
                // Clear failed session to prevent repeated attempts
                get().clearSession();
                set({ isReconnecting: false });
                resolve(false);
              }, 5000); // Reduced to 5 second timeout
              
              // Listen for successful reconnection
              const handleReconnect = (gameState: GameState) => {
                clearTimeout(timeout);
                set({ isReconnecting: false, gameState });
                socket.off('game-state-update', handleReconnect);
                socket.off('join-game-error', handleError);
                console.log('Session restored successfully');
                resolve(true);
              };
              
              const handleError = (error: any) => {
                clearTimeout(timeout);
                set({ isReconnecting: false });
                socket.off('game-state-update', handleReconnect);
                socket.off('join-game-error', handleError);
                console.log('Session restore failed:', error);
                // Clear failed session to prevent repeated attempts
                get().clearSession();
                resolve(false);
              };
              
              socket.on('game-state-update', handleReconnect);
              socket.on('join-game-error', handleError);
              
              // Attempt to rejoin
              console.log(`Emitting rejoin-game for ${state.playerName} to ${state.gameId}`);
              socket.emit('rejoin-game', { 
                gameId: state.gameId, 
                playerName: state.playerName,
                sessionId: state.sessionId
              });
            });
          } catch (error) {
            console.error('Error restoring session:', error);
            // Clear failed session to prevent repeated attempts
            get().clearSession();
            set({ isReconnecting: false });
            return false;
          }
        }
      };
    },
    {
      name: 'minkiards-game',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        playerName: state.playerName,
        gameId: state.gameId,
        sessionId: state.sessionId,
      }),
    }
  )
);
