import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { shallow } from "zustand/shallow";
import { socket } from "../socket";
import { preloadImages, getOptimizedUrl } from "../imagePreloader";

// Debounce game state updates for performance on slow connections
let gameStateUpdateTimeout: NodeJS.Timeout | null = null;
const GAME_STATE_DEBOUNCE_MS = 16; // ~60fps - minimal debounce for smooth updates
let lastEventCounter = -1; // Track last processed event to avoid duplicates

interface Card {
  id: string;
  type: string;
  frontImage: string;
  backImage: string;
  owner: string;
  text?: string;
  effect?: string; // Custom effect description for cards with special abilities
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
  // RIFUGIO system
  protectedByRifugio?: string; // ID of RIFUGIO protecting this character
  rifugioProtecting?: string; // ID of character this RIFUGIO protects
  // BARRIERA shield system
  isBarrieraShield?: boolean; // True if this is a BARRIERA shield card
  barrieraProtecting?: string; // ID of character this BARRIERA protects
  barrieraPTI?: number; // PTI for this BARRIERA shield
  // OSTAGGIO (Hostage) system
  isHostage?: boolean; // True if this character is held hostage
  hostagedBy?: string; // Player name who used OSTAGGIO
  hostageOstaggioCardId?: string; // ID of the OSTAGGIO card holding this character
  hostageOriginalOwner?: string; // Original owner of the hostage character
  hostageTurnsRemaining?: number; // Turns remaining before release
  isOstaggioCard?: boolean; // True if this MOSSE card is OSTAGGIO and is active on field
  ostaggioHoldingCardId?: string; // ID of the character card this OSTAGGIO is holding
  // Stats fields used in gameplay calculations
  stars?: number; // Number of stars (power level) of personaggi/mosse cards
  pti?: number; // Punti vita (hit points) for personaggi cards
  mosseDamageValue?: number; // Base damage value for mosse attacks
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
  handModalOpen: boolean;
  
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
  setHandModalOpen: (open: boolean) => void;
}

export const useGameState = create<GameStateStore>()(
  persist(
    (set, get) => {
      // Listen for game state updates - optimized for performance
      // Apply updates immediately (no delays for maximum responsiveness)
      socket.on('game-state-update', (newGameState: GameState) => {
        const newEventCounter = (newGameState as any).eventCounter ?? -1;
        
        // Skip if we've already processed this event (duplicate)
        if (newEventCounter !== -1 && newEventCounter === lastEventCounter) {
          console.log(`[STATE] Skipping duplicate update (eventCounter: ${newEventCounter})`);
          return;
        }
        
        console.log(`[STATE] Applying update - eventCounter: ${newEventCounter}, field cards: ${newGameState.field?.length}, graveyard: ${newGameState.graveyard?.length}`);
        lastEventCounter = newEventCounter;
        
        // Clear any pending debounced update
        if (gameStateUpdateTimeout) {
          clearTimeout(gameStateUpdateTimeout);
          gameStateUpdateTimeout = null;
        }
        
        // Apply immediately - no delays
        set({ gameState: newGameState });

        // Preload card images for the current player's hand and all field cards
        const currentPlayerName = get().playerName;
        try {
          const urlsToPreload: string[] = [];
          const playerData = currentPlayerName && (newGameState.players as any)?.[currentPlayerName];
          if (playerData?.hand) {
            for (const card of playerData.hand) {
              if (card.frontImage) urlsToPreload.push(getOptimizedUrl(card.frontImage, 'card'));
              if (card.backImage) urlsToPreload.push(getOptimizedUrl(card.backImage, 'card'));
            }
          }
          if (newGameState.field) {
            for (const card of newGameState.field) {
              if (card.frontImage) urlsToPreload.push(getOptimizedUrl(card.frontImage, 'card'));
            }
          }
          if (urlsToPreload.length > 0) preloadImages(urlsToPreload);
        } catch {}

        if (currentPlayerName && (newGameState as any).prSpentThisGame) {
          const serverSpent = (newGameState as any).prSpentThisGame[currentPlayerName] || 0;
          if (serverSpent > get().prSpentThisGame) {
            set({ prSpentThisGame: serverSpent });
          }
        }
      });

      // Listen for picked cards (private to player)
      socket.on('card-picked-private', (data: { card: Card; message: string }) => {
        set({ pickedCard: data.card });
      });

      // Listen for hand restoration on reconnect
      socket.on('restore-hand', (data: { playerName: string; hand: Card[] }) => {
        console.log(`Restoring hand for ${data.playerName}: ${data.hand.length} cards`);
        set((state) => {
          if (!state.gameState) return state;
          const newGameState = { ...state.gameState };
          if (newGameState.players[data.playerName]) {
            newGameState.players[data.playerName] = {
              ...newGameState.players[data.playerName],
              hand: data.hand
            };
          }
          return { gameState: newGameState };
        });
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
        handModalOpen: false,
        
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
        setHandModalOpen: (handModalOpen) => set({ handModalOpen }),
        
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
