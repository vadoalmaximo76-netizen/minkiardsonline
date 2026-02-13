import React, { useState, useEffect } from "react";
import { Deck } from "./Deck";
import { PlayerHand } from "./PlayerHand";
import { OtherPlayersHands } from "./OtherPlayersHands";
import { CPUControls } from "./CPUControls";
import { RoundTable } from "./RoundTable";
import { Graveyard } from "./Graveyard";
import { Chat } from "./Chat";
import { ChatNotification } from "./ChatNotification";
import { Calculator } from "./Calculator";
import { CardModal } from "./CardModal";
import { DiceModal } from "./DiceModal";
import { FullScreenNotification } from "./FullScreenNotification";
import { PersonaggioNotification } from "./PersonaggioNotification";
import { EvolutionAnimation } from "./EvolutionAnimation";
import { CardAnimation } from "./CardAnimation";
import { CustomAnimationOverlay } from "./CustomAnimationOverlay";
import { AddCardsModal } from "./AddCardsModal";
import { PlayerOrderNotification } from "./PlayerOrderNotification";
import { NextTurnNotification } from "./NextTurnNotification";
import { LeaveGameNotification } from "./LeaveGameNotification";
import { SuperDice } from "./SuperDice";
import { TransferRequestDialog } from "./TransferRequestDialog";
import { DefenseDialog } from "./DefenseDialog";
import { ClashBattle } from "./ClashBattle";
import { CPUDamageDialog } from "./CPUDamageDialog";
import { DuelDamageDialog } from "./DuelDamageDialog";
import { RecursiveDamagePanel } from "./RecursiveDamagePanel";
import AuctionOverlay from "./AuctionOverlay";
import { HandModal } from "./HandModal";
import { Dice3D } from "./Dice3D";
import { CardShatter3D } from "./CardShatter3D";
import { AttackSlash3D } from "./AttackSlash3D";
import { MusicPlayer } from "./MusicPlayer";
import { VoiceChat } from "./VoiceChat";
import { YouTubeVideoModal } from "./YouTubeVideoModal";
import { PickedCardModal } from "./PickedCardModal";
import { SorosActivation } from "./SorosActivation";
import { CharacterEffects } from "./CharacterEffects";
import { TutorialOverlay } from "./TutorialOverlay";
import { AdBanner, InterstitialAd } from "./AdBanner";
import { ConnectionStatus } from "./ConnectionStatus";
import { SoundSettings } from "./SoundSettings";
import { LastPlayedCards } from "./LastPlayedCards";
import { GameLog } from "./GameLog";
import { MissionsPanel } from "./MissionsPanel";
import { AchievementsPanel } from "./AchievementsPanel";
import { RankiardLeaderboard } from "./RankiardLeaderboard";
import { ProfilePanel } from "./ProfilePanel";
import { EmojiReactions } from "./EmojiReactions";
import { JoinRequestDialog } from "./JoinRequestDialog";
import { useGameState } from "../lib/stores/useGameState";
import { useAudio } from "../lib/stores/useAudio";
import { socket } from "../lib/socket";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { MessageCircle, Calculator as CalcIcon, Volume2, VolumeX, Plus, Dice6, Skull, X, ExternalLink, Crown, Star, Hand, Music, Shuffle, User, LogOut, Target, Trophy, SkipForward, ScrollText, Settings, MoreVertical, BookOpen, UserPlus, RotateCcw, PlusCircle, ChevronDown } from "lucide-react";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

interface AuthUser {
  id: number;
  username: string;
  email: string | null;
  avatar: string | null;
  puntiRankiard?: number;
}

interface GameBoardProps {
  authenticatedUser?: AuthUser | null;
  onLogout?: () => void;
  authToken?: string | null;
  isTrainingMode?: boolean;
  onBack?: () => void;
  onLeaveGame?: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ authenticatedUser, onLogout, authToken, onBack, onLeaveGame }) => {
  const [chatOpen, setChatOpen] = useState(false);
  const [soundSettingsOpen, setSoundSettingsOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [musicPlayerOpen, setMusicPlayerOpen] = useState(false);
  const [graveyardOpen, setGraveyardOpen] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [gameLogOpen, setGameLogOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [diceOpen, setDiceOpen] = useState(false);
  const [diceResult, setDiceResult] = useState<number | undefined>();
  const [playerWhoRolled, setPlayerWhoRolled] = useState<string | undefined>();
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [notificationPlayer, setNotificationPlayer] = useState<string>("");
  const [notificationCardCount, setNotificationCardCount] = useState<number>(0);
  const [notificationTitle, setNotificationTitle] = useState<string>("");
  const [unreadMessages, setUnreadMessages] = useState<number>(0);
  const [scenarioCardsActive, setScenarioCardsActive] = useState<boolean>(false);
  const [showRotationWarning, setShowRotationWarning] = useState(true);
  const [ciaoNotificationVisible, setCiaoNotificationVisible] = useState(false);
  const [ciaoCardName, setCiaoCardName] = useState<string>("");
  const [personaggioNotificationVisible, setPersonaggioNotificationVisible] = useState(false);
  const [personaggioCardName, setPersonaggioCardName] = useState<string>("");
  const [personaggioMessage, setPersonaggioMessage] = useState<string>("");
  const [personaggioCardImage, setPersonaggioCardImage] = useState<string>("");
  const [addCardsModalOpen, setAddCardsModalOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem("minkiards-tutorial-completed") !== "true";
  });
  const [playerOrderVisible, setPlayerOrderVisible] = useState(false);
  const [playerOrder, setPlayerOrder] = useState<string[]>([]);
  const [nextTurnVisible, setNextTurnVisible] = useState(false);
  const [nextTurnPlayer, setNextTurnPlayer] = useState<string>("");
  const [leaveGameVisible, setLeaveGameVisible] = useState(false);
  const [leavingPlayer, setLeavingPlayer] = useState<string>("");
  const [superDiceOpen, setSuperDiceOpen] = useState(false);
  const [showCpuControls, setShowCpuControls] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [chatNotifications, setChatNotifications] = useState<Array<{
    id: string;
    message: string;
    playerName: string;
  }>>([]);
  const [rankiardOpen, setRankiardOpen] = useState(false);
  const [rankiardPoints, setRankiardPoints] = useState<string>(() => {
    return localStorage.getItem('rankiard-points') || '';
  });
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [gameInstruction, setGameInstruction] = useState('');
  const [conversationMode, setConversationMode] = useState(false);
  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [conversationHistory, setConversationHistory] = useState<Array<{
    type: 'user' | 'assistant';
    message: string;
    timestamp: number;
  }>>([]);
  const [characterLimitDialogOpen, setCharacterLimitDialogOpen] = useState(false);
  const [eliminationDialogOpen, setEliminationDialogOpen] = useState(false);
  const [victoryDialogOpen, setVictoryDialogOpen] = useState(false);
  const [victoryPlayer, setVictoryPlayer] = useState<string>('');
  const [showInterstitialAd, setShowInterstitialAd] = useState(false);
  const [removePlayerDialogOpen, setRemovePlayerDialogOpen] = useState(false);
  const [playerEliminationNotification, setPlayerEliminationNotification] = useState<{
    visible: boolean;
    player: string;
  }>({ visible: false, player: '' });
  const { handModalOpen, setHandModalOpen } = useGameState();
  const [specialMoveOverlay, setSpecialMoveOverlay] = useState<{
    visible: boolean;
    moveName: string;
    damage: number;
    attackerName: string;
    category: string | null;
  }>({ visible: false, moveName: '', damage: 0, attackerName: '', category: null });
  const [evolutionAnim, setEvolutionAnim] = useState<{
    visible: boolean;
    key: number;
    type: 'evolution' | 'transformation' | 'taroccata';
    oldName: string;
    newName: string;
    oldImage: string;
    newImage: string;
    playerName: string;
    pti?: number;
    stars?: number;
  }>({ visible: false, key: 0, type: 'evolution', oldName: '', newName: '', oldImage: '', newImage: '', playerName: '' });
  const [cardAnimationVisible, setCardAnimationVisible] = useState(false);
  const [cardAnimationName, setCardAnimationName] = useState<string>("");
  const [customAnimationVisible, setCustomAnimationVisible] = useState(false);
  const [customAnimationData, setCustomAnimationData] = useState<{ cardName: string; animationDescription: string } | null>(null);
  const [sorosActivationVisible, setSorosActivationVisible] = useState(false);
  const [sorosData, setSorosData] = useState<{ activator: string; cardImage: string } | null>(null);
  const [attackEffectVisible, setAttackEffectVisible] = useState(false);
  const [attackedCharacterName, setAttackedCharacterName] = useState<string>("");
  const [attackSlash3D, setAttackSlash3D] = useState<{ visible: boolean; attackerName: string; targetName: string; damage: number }>({ visible: false, attackerName: '', targetName: '', damage: 0 });
  const [cardShatter3D, setCardShatter3D] = useState<{ visible: boolean; cardImage: string; cardName: string }>({ visible: false, cardImage: '', cardName: '' });
  const [attackEffectKey, setAttackEffectKey] = useState(0);
  const [deathEffectVisible, setDeathEffectVisible] = useState(false);
  const [deadCharacterName, setDeadCharacterName] = useState<string>("");
  const [deathEffectKey, setDeathEffectKey] = useState(0);
  const [choosingNotification, setChoosingNotification] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const [graveyardSelectionModal, setGraveyardSelectionModal] = useState<{
    visible: boolean;
    reason: string;
    cards: any[];
    message: string;
  }>({ visible: false, reason: '', cards: [], message: '' });
  const [ptiInputPanel, setPtiInputPanel] = useState<{
    visible: boolean;
    cardId: string;
    cardName: string;
    effectDescription: string;
  }>({ visible: false, cardId: '', cardName: '', effectDescription: '' });
  const [ptiInputValue, setPtiInputValue] = useState<string>('');
  const [ptiDistributionPanel, setPtiDistributionPanel] = useState<{
    visible: boolean;
    cardId: string;
    cardName: string;
    cardImage: string;
    totalBudget: number;
    ptiPerStar: number;
  }>({ visible: false, cardId: '', cardName: '', cardImage: '', totalBudget: 1000, ptiPerStar: 100 });
  const [distributionPti, setDistributionPti] = useState<number>(1000);
  const [distributionStars, setDistributionStars] = useState<number>(0);
  const [deckSelectionPanel, setDeckSelectionPanel] = useState<{
    visible: boolean;
    cardId: string;
    cardName: string;
    effectDescription: string;
    excludeSpeciali?: boolean;
  }>({ visible: false, cardId: '', cardName: '', effectDescription: '', excludeSpeciali: false });
  const [deckCardPickerPanel, setDeckCardPickerPanel] = useState<{
    visible: boolean;
    cardId: string;
    deckType: string;
    deckDisplayName: string;
    cards: Array<{ id: string; name: string; frontImage: string; type: string; pti?: number; stars?: number }>;
  }>({ visible: false, cardId: '', deckType: '', deckDisplayName: '', cards: [] });
  const [swapSelectionPanel, setSwapSelectionPanel] = useState<{
    visible: boolean;
    cardId: string;
    cardName: string;
    otherPlayers: string[];
    effectDescription: string;
  }>({ visible: false, cardId: '', cardName: '', otherPlayers: [], effectDescription: '' });
  const [diceControlPanel, setDiceControlPanel] = useState<{
    visible: boolean;
    rollingPlayer: string;
    controllingPlayer: string;
    controllingCardName: string;
    pendingId?: string;
    targetCharName?: string;
  }>({ visible: false, rollingPlayer: '', controllingPlayer: '', controllingCardName: '' });
  const [targetSelectionModal, setTargetSelectionModal] = useState<{
    visible: boolean;
    effectType: 'damage' | 'heal';
    value: number;
    maxTargets: number;
    targets: Array<{ id: string; frontImage: string; owner: string; text?: string; name?: string }>;
    message: string;
  }>({ visible: false, effectType: 'damage', value: 0, maxTargets: 1, targets: [], message: '' });
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [parasiticTargetSelect, setParasiticTargetSelect] = useState<{
    visible: boolean;
    parasiticCardId: string;
    parasiticType: 'PARASSITA' | 'SAIBAIM' | null;
    targets: Array<{ id: string; frontImage: string; owner: string; text?: string }>;
  }>({ visible: false, parasiticCardId: '', parasiticType: null, targets: [] });
  const [saibaImExplosionVisible, setSaibaImExplosionVisible] = useState(false);
  const [cimiceEffectData, setCimiceEffectData] = useState<{
    visible: boolean;
    type: 'attack' | 'death';
    damagePerCard: number;
    affectedCards: Array<{ id: string; name: string; owner: string; oldPTI: number; newPTI: number }>;
    message: string;
  } | null>(null);
  const [clashBattleData, setClashBattleData] = useState<{
    visible: boolean;
    clashId: string;
    attacker: string;
    defender: string;
    damageValue: number;
    duration: number;
  } | null>(null);
  
  // YouTube Video Modal
  const [youtubeVideoData, setYoutubeVideoData] = useState<{
    visible: boolean;
    youtubeUrl: string;
    cardName: string;
    playerName: string;
    cardType?: string;
  } | null>(null);
  
  // DICE SYSTEM - Character selection modal (choose which characters to involve)
  const [diceCharacterSelectModal, setDiceCharacterSelectModal] = useState<{
    visible: boolean;
    diceEffectId: string;
    cardName: string;
    correctEffect: string;
    wrongEffect: string;
    availableCharacters: Array<{ id: string; name: string; owner: string; frontImage: string }>;
    selectedCharacterIds: string[];
  }>({ visible: false, diceEffectId: '', cardName: '', correctEffect: '', wrongEffect: '', availableCharacters: [], selectedCharacterIds: [] });
  
  // DICE SYSTEM - Selection modal for dice effect cards (number selection)
  const [diceSelectionModal, setDiceSelectionModal] = useState<{
    visible: boolean;
    diceEffectId: string;
    cardName: string;
    correctEffect: string;
    wrongEffect: string;
    involvedCharacters: Array<{ id: string; name: string; owner: string; frontImage: string }>;
    myCharacterIds: string[];
  }>({ visible: false, diceEffectId: '', cardName: '', correctEffect: '', wrongEffect: '', involvedCharacters: [], myCharacterIds: [] });
  const [diceChoices, setDiceChoices] = useState<Record<string, string>>({});
  const [diceRollResult, setDiceRollResult] = useState<{
    visible: boolean;
    result: number;
    winners: Array<{ name: string; effect: string }>;
    losers: Array<{ name: string; effect: string }>;
  } | null>(null);
  // AUTO DICE: Result modal for automatic dice rolls
  const [autoDiceResult, setAutoDiceResult] = useState<{
    visible: boolean;
    cardName: string;
    diceResult: number;
    effect: string;
    affectedCharacters: Array<{ charId: string; charName: string; effect: string }>;
    isAnimating: boolean;
    animationPhase: 'rolling' | 'result' | 'effects';
  }>({ visible: false, cardName: '', diceResult: 0, effect: '', affectedCharacters: [], isAnimating: false, animationPhase: 'rolling' });
  // FOLATA DI VENTO: Wind dice roll animation visible to all players
  const [windDiceRoll, setWindDiceRoll] = useState<{ visible: boolean; value: number; playerName: string }>({ visible: false, value: 0, playerName: '' });
  // EVOLUTION DICE ROLL: Dice-based evolution variant animation
  const [evolutionDiceRoll, setEvolutionDiceRoll] = useState<{ visible: boolean; characterName: string; playerName: string; diceResult: number; evolutionTarget: string | null; animationPhase: 'rolling' | 'result' }>({ visible: false, characterName: '', playerName: '', diceResult: 0, evolutionTarget: null, animationPhase: 'rolling' });
  // CUSTOM TARGET SELECTION: Modal for choosing targets for custom effects with [BERSAGLIO: scelta]
  const [customTargetModal, setCustomTargetModal] = useState<{
    visible: boolean;
    selectionId: string;
    cardId: string;
    cardName: string;
    owner: string;
    availableTargets: Array<{ id: string; name: string; owner: string; frontImage: string; pti: number | null; stars: number | null }>;
    maxSelections?: number;
    title?: string;
    subtitle?: string;
  }>({ visible: false, selectionId: '', cardId: '', cardName: '', owner: '', availableTargets: [] });
  const [customSelectedTargets, setCustomSelectedTargets] = useState<string[]>([]);
  // AUTO DICE SETUP: Modal for configuring automatic dice before rolling
  const [autoDiceSetupModal, setAutoDiceSetupModal] = useState<{
    visible: boolean;
    autoDiceId: string;
    cardName: string;
    defaultEffects: Record<number, string>;
    availableCharacters: Array<{ id: string; name: string; owner: string; frontImage: string; pti: number | null; stars: number | null }>;
    initiatorPlayer: string;
  }>({ visible: false, autoDiceId: '', cardName: '', defaultEffects: {}, availableCharacters: [], initiatorPlayer: '' });
  const [autoDiceSelectedChars, setAutoDiceSelectedChars] = useState<string[]>([]);
  const [autoDiceCustomEffects, setAutoDiceCustomEffects] = useState<Record<number, string>>({});
  // REVEAL: Modal showing revealed opponent cards
  const [revealedCards, setRevealedCards] = useState<{
    visible: boolean;
    revealedBy: string;
    hands: Record<string, Array<{id: string; name: string; frontImage: string; type: string; pti: number | null; stars: number | null}>>;
  }>({ visible: false, revealedBy: '', hands: {} });
  // AUCTION SYSTEM
  const [auctionData, setAuctionData] = useState<any>(null);
  const [auctionBidUpdate, setAuctionBidUpdate] = useState<any>(null);
  const [auctionCountdownUpdate, setAuctionCountdownUpdate] = useState<any>(null);
  const [auctionResult, setAuctionResult] = useState<any>(null);
  const [auctionDeckPicker, setAuctionDeckPicker] = useState<{
    visible: boolean;
    cards: Array<{ id: string; name: string; frontImage: string; type: string; pti?: number; stars?: number }>;
    initiator: string;
  }>({ visible: false, cards: [], initiator: '' });
  const [lastPlayedCards, setLastPlayedCards] = useState<Array<{
    id: string;
    frontImage: string;
    name?: string;
    playerName: string;
    timestamp: number;
    cardType: string;
  }>>([]);
    const { selectedCard, gameId, playerName, gameState, setGameId, setUserRankiardPoints, addPRSpent, prSpentThisGame, resetPRSpent, clearSession } = useGameState();
  const { playGameStart, playPlayerJoin, playChatMessage, playCardToGraveyard, playDiceRoll, playDamageSound, playBeeSound, playCharacterSound, playCardAnimationSound, initAudioContext, toggleMute, isMuted, playAttackSound, playDeathSound, playCardPickup, playCardPlay, playTurnChange, playBonusActivated, playMyTurn, playDeckShuffle, playEffectActivate, playHostageApplied, playHostageReleased, playPersonaggioEnter, playCardReveal, playErrorSound, playPlayerEliminated, playSorosActivation, playFusionSound, playCardPlayedToField, playVictory, playDefeat } = useAudio();


  const shareInviteLink = () => {
    const link = `${window.location.origin}?game=${gameId}`;
    navigator.clipboard.writeText(link);
    alert("Invitation link copied to clipboard!");
  };

  const handleOpenChat = () => {
    setChatOpen(true);
    setUnreadMessages(0); // Reset unread count when opening chat
  };

  const handleCloseChat = () => {
    setChatOpen(false);
  };

  const handleRankiardPointsChange = (value: string) => {
    setRankiardPoints(value);
    localStorage.setItem('rankiard-points', value);
  };

  const handleExecuteGameInstruction = () => {
    if (!gameInstruction.trim()) {
      alert("Inserisci un'istruzione per modificare il gioco");
      return;
    }

    // Add user message to conversation history
    const userMessage = {
      type: 'user' as const,
      message: gameInstruction.trim(),
      timestamp: Date.now()
    };
    setConversationHistory(prev => [...prev, userMessage]);

    // Send instruction to server for AI processing
    socket.emit('game-instruction', {
      gameId,
      playerName,
      instruction: gameInstruction.trim()
    });

    setGameInstruction('');
  };

  const removeChatNotification = (notificationId: string) => {
    setChatNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const handleResetGame = () => {
    if (confirm("Sei sicuro di voler ricominciare la partita? Tutte le carte verranno rimesse nei mazzi.")) {
      socket.emit('reset-game', { gameId });
      // Reset scenario cards state when game is reset
      setScenarioCardsActive(false);
      // Clear last played cards history
      setLastPlayedCards([]);
    }
  };

  const handleNewGame = () => {
    if (confirm("Sei sicuro di voler creare una nuova partita? Entrerai in una nuova stanza di gioco.")) {
      // Generate a new room code (6 characters uppercase)
      const newGameId = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Update game ID in state
      setGameId(newGameId);
      
      // Update URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('game', newGameId);
      window.history.pushState({}, '', newUrl);
      
      // Clear last played cards history for new game
      setLastPlayedCards([]);
      
      // Join the new game room
      socket.emit('join-game', { gameId: newGameId, playerName, userId: authenticatedUser?.id });
    }
  };

  const handleStartGame = () => {
    // Show character limit selection dialog first
    setCharacterLimitDialogOpen(true);
  };

  const handleCharacterLimitSelected = (limit: string) => {
    setCharacterLimitDialogOpen(false);
    socket.emit('start-game', { gameId, playerName, characterLimit: limit });
  };

  const handleLeaveGame = () => {
    if (confirm("Sei sicuro di voler lasciare la partita? Diventerai uno spettatore.")) {
      socket.emit('leave-game', { gameId, playerName });
      clearSession(); // Clear session data when leaving game
      onLeaveGame?.(); // Notify parent to reset session state
    }
  };

  // Sync scenarioCardsActive with game state
  useEffect(() => {
    if (gameState?.scenarioCardsActive !== undefined) {
      setScenarioCardsActive(gameState.scenarioCardsActive);
    }
  }, [gameState?.scenarioCardsActive]);

  // Sync user's Rankiard points to the store when authenticated user changes
  useEffect(() => {
    if (authenticatedUser?.puntiRankiard !== undefined) {
      setUserRankiardPoints(authenticatedUser.puntiRankiard);
    }
  }, [authenticatedUser?.puntiRankiard, setUserRankiardPoints]);

  // Reset PR spent when starting a new game
  useEffect(() => {
    if (gameId) {
      resetPRSpent();
    }
  }, [gameId, resetPRSpent]);

  // Initialize audio context and play game start sound on mount
  useEffect(() => {
    initAudioContext();
    // Play game start sound after a brief delay
    setTimeout(() => {
      playGameStart();
    }, 500);
  }, []);

  useEffect(() => {
    const handleGameReset = ({ message }: { message: string }) => {
      alert(message);
    };

    const handlePlayerJoined = ({ playerName: newPlayer }: { playerName: string }) => {
      // Play sound when a new player joins
      playPlayerJoin();
    };

    const handleCardShown = ({ cardImage, fromPlayer, message }: { cardImage: string, fromPlayer: string, message: string }) => {
      // Create a modal-like notification to show the card
      const modal = document.createElement('div');
      modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
      
      modal.innerHTML = `
        <div style="background: #1f2937; padding: 24px; border-radius: 8px; text-align: center; max-width: 400px;">
          <h3 style="color: white; margin-bottom: 16px; font-weight: bold;">${message}</h3>
          <img src="${cardImage}" alt="Shown card" style="width: 160px; height: 224px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); margin-bottom: 16px;">
          <button style="background: #3b82f6; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;" onclick="this.closest('div').parentElement.remove()">Chiudi</button>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Auto-remove after 10 seconds
      setTimeout(() => {
        if (modal.parentElement) {
          modal.remove();
        }
      }, 10000);
    };

    const handleCardShowConfirmed = ({ message }: { message: string }) => {
      alert(message);
    };

    const handleDiceRoll = ({ result, playerName }: { result: number, playerName: string }) => {
      setDiceResult(result);
      setPlayerWhoRolled(playerName);
      setDiceOpen(true);
      
      // Play dice roll sound when anyone rolls the dice
      playDiceRoll();
    };

    const handleDiceWindowOpen = ({ playerName: opener }: { playerName: string }) => {
      setDiceResult(undefined);
      setPlayerWhoRolled(undefined);
      setDiceOpen(true);
    };

    const handleGraveyardMilestone = ({ playerName: achievingPlayer, cardCount, title }: { playerName: string, cardCount: number, title: string }) => {
      setNotificationPlayer(achievingPlayer);
      setNotificationCardCount(cardCount);
      setNotificationTitle(title);
      setNotificationVisible(true);
    };

    const handleChatMessage = (message: { id: string; playerName: string; message: string; timestamp: number }) => {
      // Always persist messages to localStorage so they're available when chat opens
      if (gameId) {
        try {
          const storedMessages = localStorage.getItem(`chat_messages_${gameId}`);
          const existingMessages = storedMessages ? JSON.parse(storedMessages) : [];
          // Avoid duplicates
          if (!existingMessages.some((m: any) => m.id === message.id)) {
            const newMessages = [...existingMessages, message];
            localStorage.setItem(`chat_messages_${gameId}`, JSON.stringify(newMessages));
          }
        } catch (error) {
          console.error('Error persisting chat message:', error);
        }
      }
      
      if (!chatOpen && message.playerName !== playerName) {
        // Increment unread count
        setUnreadMessages(prev => prev + 1);
        
        // Show notification popup
        setChatNotifications(prev => [...prev, {
          id: message.id,
          message: message.message,
          playerName: message.playerName
        }]);
      }
      // Play chat message sound
      playChatMessage();
    };

    const handleScenarioCardsToggled = ({ active }: { active: boolean }) => {
      setScenarioCardsActive(active);
    };

    const handleCardAttacked = ({ targetCardName, fromPlayer, toPlayer }: { targetCardName: string, fromPlayer: string, toPlayer: string }) => {
      console.log(`${fromPlayer} attacked ${toPlayer}'s ${targetCardName}`);
      setAttackedCharacterName(targetCardName);
      setAttackEffectVisible(false);
      setTimeout(() => {
        setAttackEffectKey(prev => prev + 1);
        setAttackEffectVisible(true);
      }, 10);
      setAttackSlash3D({ visible: true, attackerName: fromPlayer, targetName: targetCardName, damage: 0 });
      playAttackSound();
      playDamageSound();
    };

    const handleCardToGraveyard = ({ cardName, cardType }: { cardName: string, cardType?: string }) => {
      setCiaoCardName(cardName);
      setCiaoNotificationVisible(true);
      playCardToGraveyard();
      
      if (cardType === 'personaggi' || cardType === 'personaggi_speciali') {
        setDeadCharacterName(cardName);
        setDeathEffectVisible(false);
        setTimeout(() => {
          setDeathEffectKey(prev => prev + 1);
          setDeathEffectVisible(true);
        }, 10);
        setCardShatter3D({ visible: true, cardImage: '', cardName });
        playDeathSound();
      }
      
      setTimeout(() => {
        setCiaoNotificationVisible(false);
      }, 3000);
    };

    const handlePersonaggioEnters = ({ cardName, message, cardImage }: { cardName: string, message: string, cardImage: string }) => {
      console.log('Personaggio enters:', { cardName, message, cardImage });
      playPersonaggioEnter();
      setPersonaggioCardName(cardName);
      setPersonaggioMessage(message);
      setPersonaggioCardImage(cardImage);
      setPersonaggioNotificationVisible(true);
      
      // Auto-hide after 4 seconds
      setTimeout(() => {
        setPersonaggioNotificationVisible(false);
      }, 4000);
    };

    const handleCardsAdded = ({ playerName, deckLabel, count }: { playerName: string, deckLabel: string, count: number }) => {
      alert(`${playerName} ha aggiunto ${count} carte al mazzo ${deckLabel}!`);
    };

    const handleBeeSound = ({ cardName, playerName }: { cardName: string, playerName: string }) => {
      console.log(`Playing bee sound for ${cardName} played by ${playerName}`);
      playBeeSound();
    };

    const handleCharacterSound = ({ cardName, playerName, soundType }: { cardName: string, playerName: string, soundType: string }) => {
      console.log(`Playing ${soundType} sound for ${cardName} played by ${playerName}`);
      playCharacterSound(soundType);
    };

    const handleCardAnimationTrigger = ({ cardName, playerName, cardId }: { cardName: string, playerName: string, cardId: string }) => {
      console.log(`🎬 Card animation triggered for ${cardName} played by ${playerName}`);
      setCardAnimationName(cardName);
      setCardAnimationVisible(true);
      playCardAnimationSound(cardName);
    };
    
    const handleCustomAnimationTrigger = ({ cardId, cardName, playerName, animationDescription }: { 
      cardId: string, 
      cardName: string, 
      playerName: string, 
      animationDescription: string 
    }) => {
      console.log(`🎬 Custom animation triggered for ${cardName}: ${animationDescription}`);
      playEffectActivate();
      setCustomAnimationData({ cardName, animationDescription });
      setCustomAnimationVisible(true);
      // Auto-hide after 4 seconds
      setTimeout(() => {
        setCustomAnimationVisible(false);
        setCustomAnimationData(null);
      }, 4000);
    };

    const handleSpecialMoveOverlay = (data: { moveName: string; damage: number; attackerName: string; playerName: string; category: string | null }) => {
      console.log(`💥 Special move overlay: ${data.attackerName} uses ${data.moveName} for ${data.damage} damage`);
      setSpecialMoveOverlay({
        visible: true,
        moveName: data.moveName,
        damage: data.damage,
        attackerName: data.attackerName,
        category: data.category
      });
      setTimeout(() => {
        setSpecialMoveOverlay(prev => ({ ...prev, visible: false }));
      }, 4000);
    };

    const handleEvolutionAnimation = (data: {
      type: 'evolution' | 'transformation' | 'taroccata';
      oldName: string;
      newName: string;
      oldImage: string;
      newImage: string;
      playerName: string;
      pti?: number;
      stars?: number;
      timestamp?: number;
    }) => {
      console.log(`🌟 Evolution animation: ${data.oldName} → ${data.newName} (${data.type})`);
      setEvolutionAnim({
        visible: true,
        key: Date.now(),
        type: data.type,
        oldName: data.oldName,
        newName: data.newName,
        oldImage: data.oldImage,
        newImage: data.newImage,
        playerName: data.playerName,
        pti: data.pti,
        stars: data.stars
      });
    };

    const handleCardPlayed = ({ cardId, cardType, frontImage, cardName, playerName }: { 
      cardId: string, 
      cardType: string, 
      frontImage: string, 
      cardName?: string,
      playerName: string 
    }) => {
      playCardPlayedToField();
      setLastPlayedCards(prev => {
        const newCard = {
          id: cardId,
          frontImage,
          name: cardName,
          playerName,
          timestamp: Date.now(),
          cardType
        };
        const updated = [...prev, newCard];
        return updated.slice(-10);
      });
    };

    const handleCardPlayedFaceDown = ({ cardId, playerName, message }: { cardId: string, playerName: string, message: string }) => {
      playCardPlayedToField();
      console.log(`Card played face down: ${message}`);
      // Optional: Show a notification that a card was played face down
    };

    const handleCardRevealed = ({ cardId, cardName, playerName, cardImage, message }: { cardId: string, cardName: string, playerName: string, cardImage: string, message: string }) => {
      playCardReveal();
      console.log(`Card revealed: ${message}`);
      // Optional: Show a notification that a card was revealed
    };

    const handleGameStarted = ({ playerOrder }: { playerOrder: string[] }) => {
      setPlayerOrder(playerOrder);
      setPlayerOrderVisible(true);
    };

    const handleNextTurn = ({ nextPlayer }: { nextPlayer: string }) => {
      setNextTurnPlayer(nextPlayer);
      setNextTurnVisible(true);
      if (nextPlayer === playerName) {
        playMyTurn();
      } else {
        playTurnChange();
      }
    };

    const handlePlayerLeft = ({ playerName }: { playerName: string }) => {
      setLeavingPlayer(playerName);
      setLeaveGameVisible(true);
    };

    const handleOpenSuperDice = ({ playerName: dicePlayerName }: { playerName: string }) => {
      console.log(`Super dice opened by ${dicePlayerName}`);
      setSuperDiceOpen(true);
    };

    const handleSuperDiceRolled = ({ playerName: rollerName, rolledCard }: { playerName: string, rolledCard: any }) => {
      console.log(`Super dice rolled by ${rollerName}:`, rolledCard);
      // The dice will remain visible until closed
    };

    const handleSorosActivation = ({ activator, cardImage }: { activator: string; cardImage: string }) => {
      playSorosActivation();
      setSorosData({ activator, cardImage });
      setSorosActivationVisible(true);
      
      // Pause music during SOROS cinematic
      if (musicPlayerOpen) {
        const musicToggleBtn = document.querySelector('[data-music-control="play"]');
        if (musicToggleBtn) {
          (musicToggleBtn as HTMLButtonElement).click();
        }
      }
    };

    socket.on('game-reset', handleGameReset);
    socket.on('card-shown', handleCardShown);
    socket.on('card-show-confirmed', handleCardShowConfirmed);
    socket.on('dice-rolled', handleDiceRoll);
    socket.on('dice-window-opened', handleDiceWindowOpen);
    
    const handleWindDiceRoll = (data: { value: number; playerName: string; gameId: string }) => {
      console.log('🎲 FOLATA DI VENTO dice roll:', data);
      setWindDiceRoll({ visible: true, value: data.value, playerName: data.playerName });
      setTimeout(() => setWindDiceRoll({ visible: false, value: 0, playerName: '' }), 4000);
    };
    socket.on('dice-roll', handleWindDiceRoll);
    
    const handleEvolutionDiceRoll = (data: { playerName: string; characterName: string; diceResult: number; evolutionTarget: string | null; evolutionTargetId: string | null }) => {
      console.log('🎲 EVOLUTION DICE ROLL:', data);
      setEvolutionDiceRoll({ visible: true, characterName: data.characterName, playerName: data.playerName, diceResult: data.diceResult, evolutionTarget: data.evolutionTarget, animationPhase: 'rolling' });
      setTimeout(() => {
        setEvolutionDiceRoll(prev => ({ ...prev, animationPhase: 'result' }));
      }, 1500);
      setTimeout(() => {
        setEvolutionDiceRoll({ visible: false, characterName: '', playerName: '', diceResult: 0, evolutionTarget: null, animationPhase: 'rolling' });
      }, 5500);
    };
    socket.on('evolution-dice-roll', handleEvolutionDiceRoll);
    
    socket.on('graveyard-milestone', handleGraveyardMilestone);
    socket.on('chat-message', handleChatMessage);
    socket.on('scenario-cards-toggled', handleScenarioCardsToggled);
    socket.on('card-attacked', handleCardAttacked);
    socket.on('card-to-graveyard', handleCardToGraveyard);
    socket.on('player-joined', handlePlayerJoined);
    socket.on('personaggio-enters', handlePersonaggioEnters);
    socket.on('cards-added', handleCardsAdded);
    socket.on('bee-sound', handleBeeSound);
    socket.on('character-sound', handleCharacterSound);
    socket.on('card-animation-trigger', handleCardAnimationTrigger);
    socket.on('custom-animation-trigger', handleCustomAnimationTrigger);
    socket.on('special-move-overlay', handleSpecialMoveOverlay);
    socket.on('evolution-animation', handleEvolutionAnimation);
    socket.on('card-played', handleCardPlayed);
    socket.on('card-played-face-down', handleCardPlayedFaceDown);
    socket.on('card-revealed', handleCardRevealed);
    socket.on('game-started', handleGameStarted);
    socket.on('next-turn', handleNextTurn);
    socket.on('player-left', handlePlayerLeft);
    socket.on('super-dice-opened', handleOpenSuperDice);
    socket.on('super-dice-rolled', handleSuperDiceRolled);
    socket.on('soros-activated', handleSorosActivation);

    // MOSSE ATTACK ERROR: Handle attack errors (e.g., one MOSSE per turn limit)
    const handleAttackError = ({ message }: { message: string }) => {
      playErrorSound();
      console.log(`❌ Attack error: ${message}`);
      setChoosingNotification({ visible: true, message: `❌ ${message}` });
      setTimeout(() => {
        setChoosingNotification({ visible: false, message: '' });
      }, 4000);
    };
    socket.on('attack-error', handleAttackError);
    socket.on('attack-blocked', handleAttackError);

    // CLASH BATTLE: Start battle when equal damage values
    const handleClashBattleStart = ({ clashId, attacker, defender, damageValue, duration }: {
      clashId: string;
      attacker: string;
      defender: string;
      damageValue: number;
      duration: number;
    }) => {
      console.log(`⚡ CLASH BATTLE started: ${attacker} vs ${defender} with ${damageValue} PTI`);
      setClashBattleData({
        visible: true,
        clashId,
        attacker,
        defender,
        damageValue,
        duration
      });
    };
    socket.on('clash-battle-start', handleClashBattleStart);

    // CLASH BATTLE: End battle
    const handleClashBattleEnd = ({ clashId, winner, isTie }: {
      clashId: string;
      winner: string | null;
      isTie: boolean;
    }) => {
      console.log(`⚡ CLASH BATTLE ended: winner=${winner}, tie=${isTie}`);
      setTimeout(() => {
        setClashBattleData(null);
      }, 2000); // Keep visible briefly to show result
    };
    socket.on('clash-battle-end', handleClashBattleEnd);

    // Handler for player choosing a card notification
    const handlePlayerChoosingNotification = ({ playerName: chooserName, deckName, message }: { 
      playerName: string, deckName: string, message: string 
    }) => {
      setChoosingNotification({ visible: true, message });
      // Auto-hide after 3 seconds
      setTimeout(() => {
        setChoosingNotification({ visible: false, message: '' });
      }, 3000);
    };
    socket.on('player-choosing-notification', handlePlayerChoosingNotification);

    // GRAVEYARD SELECTION: Handle interactive graveyard card selection
    const handleShowGraveyardSelection = (data: { reason: string; cards: any[]; message: string }) => {
      console.log('👼 Show graveyard selection:', data);
      setGraveyardSelectionModal({
        visible: true,
        reason: data.reason,
        cards: data.cards,
        message: data.message
      });
    };
    socket.on('show-graveyard-selection', handleShowGraveyardSelection);

    // PTI INPUT PANEL: Handle custom card effect that requires PTI input
    const handleShowPtiInputPanel = (data: { cardId: string; cardName: string; playerName: string; effectDescription: string }) => {
      console.log('📋 Show PTI input panel:', data);
      if (data.playerName === playerName) {
        setPtiInputPanel({
          visible: true,
          cardId: data.cardId,
          cardName: data.cardName,
          effectDescription: data.effectDescription
        });
        setPtiInputValue('');
      }
    };
    socket.on('show-pti-input-panel', handleShowPtiInputPanel);

    // PTI DISTRIBUTION PANEL: Handle Giovanni Muciaccia-style PTI/stelle distribution
    const handleShowPtiDistribution = (data: { cardId: string; cardName: string; cardImage: string; playerName: string; totalBudget: number; ptiPerStar: number }) => {
      console.log('🎭 Show PTI distribution panel:', data);
      if (data.playerName === playerName) {
        setPtiDistributionPanel({
          visible: true,
          cardId: data.cardId,
          cardName: data.cardName,
          cardImage: data.cardImage || '',
          totalBudget: data.totalBudget || 1000,
          ptiPerStar: data.ptiPerStar || 100
        });
        setDistributionPti(data.totalBudget || 1000);
        setDistributionStars(0);
      }
    };
    socket.on('show-pti-distribution-panel', handleShowPtiDistribution);

    // DECK SELECTION PANEL: Handle custom card effect that requires deck selection
    const handleShowDeckSelection = (data: { cardId: string; cardName: string; playerName: string; effectDescription: string; excludeSpeciali?: boolean }) => {
      console.log('📋 Show deck selection panel:', data);
      if (data.playerName === playerName) {
        setDeckSelectionPanel({
          visible: true,
          cardId: data.cardId,
          cardName: data.cardName,
          effectDescription: data.effectDescription,
          excludeSpeciali: data.excludeSpeciali ?? false
        });
      }
    };
    socket.on('show-deck-selection', handleShowDeckSelection);

    const handleShowDeckCardPicker = (data: { cardId: string; deckType: string; deckDisplayName: string; cards: Array<{ id: string; name: string; frontImage: string; type: string; pti?: number; stars?: number }>; playerName: string }) => {
      console.log('📋 Show deck card picker:', data.deckDisplayName, data.cards.length, 'cards');
      if (data.playerName === playerName) {
        setDeckSelectionPanel({ visible: false, cardId: '', cardName: '', effectDescription: '', excludeSpeciali: false });
        setDeckCardPickerPanel({
          visible: true,
          cardId: data.cardId,
          deckType: data.deckType,
          deckDisplayName: data.deckDisplayName,
          cards: data.cards
        });
      }
    };
    socket.on('show-deck-card-picker', handleShowDeckCardPicker);

    // AUCTION SYSTEM LISTENERS
    const handleAuctionSelectCharacter = (data: { playerName: string; gameId: string }) => {
      if (data.playerName === playerName) {
        socket.emit('get-deck-contents', { deckType: 'personaggi' });
        const onDeckContents = (deckData: { deckType: string; cards: any[] }) => {
          if (deckData.deckType === 'personaggi') {
            setAuctionDeckPicker({
              visible: true,
              cards: deckData.cards.filter(c => c.type === 'personaggi'),
              initiator: data.playerName
            });
            socket.off('deck-contents', onDeckContents);
          }
        };
        socket.on('deck-contents', onDeckContents);
      }
    };
    socket.on('auction-select-character', handleAuctionSelectCharacter);

    const handleAuctionStarted = (data: any) => {
      setAuctionData(data);
      setAuctionBidUpdate(null);
      setAuctionCountdownUpdate(null);
      setAuctionResult(null);
      setAuctionDeckPicker({ visible: false, cards: [], initiator: '' });
    };
    socket.on('auction-started', handleAuctionStarted);

    const handleAuctionBidUpdate = (data: any) => {
      setAuctionBidUpdate({ ...data, _ts: Date.now() });
    };
    socket.on('auction-bid-update', handleAuctionBidUpdate);

    const handleAuctionCountdown = (data: any) => {
      setAuctionCountdownUpdate({ ...data, _ts: Date.now() });
    };
    socket.on('auction-countdown', handleAuctionCountdown);

    const handleAuctionEnded = (data: any) => {
      setAuctionResult(data);
      if (data.winner === playerName && data.bid > 0) {
        addPRSpent(data.bid);
      }
    };
    socket.on('auction-ended', handleAuctionEnded);

    // SWAP SELECTION: Handle baratto/swap panel for selecting player to swap with
    const handleShowSwapSelection = (data: { cardId: string; cardName: string; playerName: string; otherPlayers: string[]; effectDescription: string }) => {
      console.log('🔄 Show swap selection:', data);
      if (data.playerName === playerName) {
        setSwapSelectionPanel({
          visible: true,
          cardId: data.cardId,
          cardName: data.cardName,
          otherPlayers: data.otherPlayers,
          effectDescription: data.effectDescription
        });
      }
    };
    socket.on('show-swap-selection', handleShowSwapSelection);

    // DICE CONTROL: Handle dice control panel for choosing dice result
    const handleShowDiceControlPanel = (data: { rollingPlayer: string; controllingPlayer: string; controllingCardId: string; controllingCardName: string; pendingId?: string; targetCharName?: string }) => {
      console.log('🎲 Show dice control panel:', data);
      if (data.controllingPlayer === playerName) {
        setDiceControlPanel({
          visible: true,
          rollingPlayer: data.rollingPlayer,
          controllingPlayer: data.controllingPlayer,
          controllingCardName: data.controllingCardName,
          pendingId: data.pendingId,
          targetCharName: data.targetCharName
        });
      }
    };
    socket.on('show-dice-control-panel', handleShowDiceControlPanel);

    // TARGET SELECTION: Handle interactive target selection for custom effects
    const handleShowTargetSelection = (data: { 
      effectType: 'damage' | 'heal'; 
      value: number; 
      maxTargets: number;
      targets: Array<{ id: string; frontImage: string; owner: string; text?: string; name?: string }>;
      message: string;
    }) => {
      console.log('🎯 Show target selection:', data);
      setSelectedTargetIds([]);
      setTargetSelectionModal({
        visible: true,
        effectType: data.effectType,
        value: data.value,
        maxTargets: data.maxTargets || 1,
        targets: data.targets,
        message: data.message
      });
    };
    socket.on('show-target-selection', handleShowTargetSelection);

    // DICE SYSTEM: Handle dice selection modal
    // DICE SYSTEM: Handle character selection for dice effect (step 1 - choose which characters)
    const handleShowDiceCharacterSelect = (data: {
      diceEffectId: string;
      cardName: string;
      correctEffect: string;
      wrongEffect: string;
      availableCharacters: Array<{ id: string; name: string; owner: string; frontImage: string }>;
      initiatorPlayer: string;
    }) => {
      console.log('🎲 Show dice character selection:', data);
      // Only show to the player who initiated the dice effect
      if (data.initiatorPlayer === playerName) {
        setDiceCharacterSelectModal({
          visible: true,
          diceEffectId: data.diceEffectId,
          cardName: data.cardName,
          correctEffect: data.correctEffect,
          wrongEffect: data.wrongEffect,
          availableCharacters: data.availableCharacters,
          selectedCharacterIds: data.availableCharacters.map(c => c.id) // All selected by default
        });
      }
    };
    socket.on('show-dice-character-select', handleShowDiceCharacterSelect);

    // DICE SYSTEM: Handle number selection (step 2 - choose numbers)
    const handleShowDiceSelection = (data: {
      diceEffectId: string;
      cardName: string;
      correctEffect: string;
      wrongEffect: string;
      involvedCharacters: Array<{ id: string; name: string; owner: string; frontImage: string }>;
    }) => {
      console.log('🎲 Show dice selection:', data);
      const myCharacterIds = data.involvedCharacters
        .filter(c => c.owner === playerName)
        .map(c => c.id);
      
      if (myCharacterIds.length > 0) {
        setDiceChoices({});
        setDiceSelectionModal({
          visible: true,
          diceEffectId: data.diceEffectId,
          cardName: data.cardName,
          correctEffect: data.correctEffect,
          wrongEffect: data.wrongEffect,
          involvedCharacters: data.involvedCharacters,
          myCharacterIds
        });
      }
    };
    socket.on('show-dice-selection', handleShowDiceSelection);

    // DICE SYSTEM: Handle dice roll result
    const handleDiceRollResult = (data: {
      result: number;
      winners: Array<{ name: string; effect: string }>;
      losers: Array<{ name: string; effect: string }>;
    }) => {
      console.log('🎲 Dice roll result:', data);
      setDiceRollResult({
        visible: true,
        result: data.result,
        winners: data.winners,
        losers: data.losers
      });
      // Auto-hide after 6 seconds
      setTimeout(() => {
        setDiceRollResult(null);
      }, 6000);
    };
    socket.on('dice-roll-result', handleDiceRollResult);

    // AUTO DICE: Handle automatic dice roll result
    const handleAutoDiceResult = (data: {
      cardName: string;
      diceResult: number;
      effect: string;
      affectedCharacters: Array<{ charId: string; charName: string; effect: string }>;
    }) => {
      console.log('🎲 Auto dice result:', data);
      
      // Start animation sequence
      setAutoDiceResult({
        visible: true,
        cardName: data.cardName,
        diceResult: data.diceResult,
        effect: data.effect,
        affectedCharacters: data.affectedCharacters,
        isAnimating: true,
        animationPhase: 'rolling'
      });
      
      // Play dice sound
      playDiceRoll();
      
      // Phase 1: Rolling animation (1.5s)
      setTimeout(() => {
        setAutoDiceResult(prev => ({ ...prev, animationPhase: 'result' }));
      }, 1500);
      
      // Phase 2: Show result (after 1.5s)
      setTimeout(() => {
        setAutoDiceResult(prev => ({ ...prev, animationPhase: 'effects' }));
      }, 3000);
      
      // Phase 3: Hide after showing effects (8s total)
      setTimeout(() => {
        setAutoDiceResult(prev => ({ ...prev, visible: false, isAnimating: false }));
      }, 8000);
    };
    socket.on('auto-dice-result', handleAutoDiceResult);

    // CUSTOM TARGET SELECTION: Handler for showing custom target selection modal for [BERSAGLIO: scelta]
    const handleShowCustomTargetSelection = (data: {
      selectionId: string;
      cardId: string;
      cardName: string;
      owner: string;
      availableTargets: Array<{ id: string; name: string; owner: string; frontImage: string; pti: number | null; stars: number | null }>;
      maxSelections?: number;
      title?: string;
      subtitle?: string;
    }) => {
      console.log('🎯 Show custom target selection:', data);
      if (data.owner === playerName) {
        setCustomSelectedTargets([]);
        setCustomTargetModal({
          visible: true,
          selectionId: data.selectionId,
          cardId: data.cardId,
          cardName: data.cardName,
          owner: data.owner,
          availableTargets: data.availableTargets,
          maxSelections: data.maxSelections,
          title: data.title,
          subtitle: data.subtitle
        });
      }
    };
    socket.on('show-custom-target-selection', handleShowCustomTargetSelection);

    // REVEAL: Handler for showing revealed cards
    const handleCardsRevealed = (data: { revealedBy: string; hands: Record<string, Array<{id: string; name: string; frontImage: string; type: string; pti: number | null; stars: number | null}>> }) => {
      console.log('👁️ Cards revealed:', data);
      if (data.revealedBy === playerName) {
        setRevealedCards({
          visible: true,
          revealedBy: data.revealedBy,
          hands: data.hands
        });
      }
    };
    socket.on('cards-revealed', handleCardsRevealed);

    // AUTO DICE SETUP: Handler for automatic dice configuration
    const handleShowAutoDiceSetup = (data: {
      autoDiceId: string;
      cardName: string;
      defaultEffects: Record<number, string>;
      availableCharacters: Array<{ id: string; name: string; owner: string; frontImage: string; pti: number | null; stars: number | null }>;
      initiatorPlayer: string;
      preSelected?: boolean;
    }) => {
      console.log('🎲 Show auto dice setup:', data);
      // Only show to the initiator player
      if (data.initiatorPlayer === playerName) {
        // If preSelected flag is true, auto-select all available characters
        if (data.preSelected) {
          setAutoDiceSelectedChars(data.availableCharacters.map(c => c.id));
        } else {
          setAutoDiceSelectedChars([]);
        }
        setAutoDiceCustomEffects({ ...data.defaultEffects });
        setAutoDiceSetupModal({
          visible: true,
          autoDiceId: data.autoDiceId,
          cardName: data.cardName,
          defaultEffects: data.defaultEffects,
          availableCharacters: data.availableCharacters,
          initiatorPlayer: data.initiatorPlayer
        });
      }
    };
    socket.on('show-auto-dice-setup', handleShowAutoDiceSetup);

    // PARASITIC CARDS: Handler for target selection
    const handleParasiticTargetSelect = ({ parasiticCardId, parasiticType, ownerPlayer, targets }: {
      parasiticCardId: string;
      parasiticType: 'PARASSITA' | 'SAIBAIM';
      ownerPlayer: string;
      targets: Array<{ id: string; frontImage: string; owner: string; text?: string }>;
    }) => {
      // Only show to the player who owns the parasitic card
      if (ownerPlayer === playerName) {
        setParasiticTargetSelect({
          visible: true,
          parasiticCardId,
          parasiticType,
          targets
        });
      }
    };
    socket.on('parasitic-target-select', handleParasiticTargetSelect);

    // PARASITIC CARDS: Handler for attachment notification
    const handleParasiticAttached = ({ parasiticCardId, parasiticType, targetCardId, targetName, ownerPlayer, targetPlayer }: {
      parasiticCardId: string;
      parasiticType: 'PARASSITA' | 'SAIBAIM';
      targetCardId: string;
      targetName: string;
      ownerPlayer: string;
      targetPlayer: string;
    }) => {
      // Only close target selection for the owner player who made the selection
      if (ownerPlayer === playerName) {
        setParasiticTargetSelect({ visible: false, parasiticCardId: '', parasiticType: null, targets: [] });
      }
      playEffectActivate();
      
      // Show attachment notification to all players
      setPersonaggioNotificationVisible(true);
      setPersonaggioCardName(parasiticType);
      setPersonaggioMessage(`${parasiticType} di ${ownerPlayer} si è agganciato a ${targetName} di ${targetPlayer}!`);
      setPersonaggioCardImage(parasiticType === 'PARASSITA' 
        ? 'https://i.postimg.cc/j5X32dn7/parassita.png'
        : 'https://i.postimg.cc/RFs123nX/saibaim.png');
      
      setTimeout(() => {
        setPersonaggioNotificationVisible(false);
      }, 4000);
    };
    socket.on('parasitic-attached', handleParasiticAttached);

    // SAIBAIM explosion effect
    const handleSaibaImExplosion = ({ saibaim, target, targetOwner }: {
      saibaim: string;
      target: string;
      targetOwner: string;
    }) => {
      setSaibaImExplosionVisible(true);
      playCardAnimationSound('BOMBA'); // Use explosion sound
      setTimeout(() => {
        setSaibaImExplosionVisible(false);
      }, 2000);
    };
    socket.on('saibaim-explosion', handleSaibaImExplosion);

    // OSTAGGIO (HOSTAGE) event handlers
    const handleHostageApplied = ({ ostaggioCardId, targetCardId, targetName, captorPlayer, originalOwner, turnsRemaining, damageDealt }: {
      ostaggioCardId: string;
      targetCardId: string;
      targetName: string;
      captorPlayer: string;
      originalOwner: string;
      turnsRemaining: number;
      damageDealt: number;
    }) => {
      console.log(`⛓️ OSTAGGIO applied: ${targetName} captured by ${captorPlayer}`);
      playHostageApplied();
      setPersonaggioNotificationVisible(true);
      setPersonaggioCardName('OSTAGGIO');
      setPersonaggioMessage(`⛓️ ${captorPlayer} prende ${targetName} in OSTAGGIO per ${turnsRemaining} turni! (${damageDealt} danni inflitti)`);
      setPersonaggioCardImage('');
      
      setTimeout(() => {
        setPersonaggioNotificationVisible(false);
      }, 4000);
    };
    socket.on('hostage-applied', handleHostageApplied);

    const handleHostageUpdated = ({ targetCardId, turnsRemaining, captorPlayer }: {
      targetCardId: string;
      turnsRemaining: number;
      captorPlayer: string;
    }) => {
      console.log(`⛓️ OSTAGGIO update: ${turnsRemaining} turns remaining`);
    };
    socket.on('hostage-updated', handleHostageUpdated);

    const handleHostageReleased = ({ targetCardId, targetName, originalOwner, captorPlayer }: {
      targetCardId: string;
      targetName: string;
      originalOwner: string;
      captorPlayer: string;
    }) => {
      console.log(`⛓️🔓 OSTAGGIO released: ${targetName} freed`);
      playHostageReleased();
      setPersonaggioNotificationVisible(true);
      setPersonaggioCardName('OSTAGGIO TERMINATO');
      setPersonaggioMessage(`⛓️🔓 ${targetName} è stato liberato dall'OSTAGGIO e torna a ${originalOwner}!`);
      setPersonaggioCardImage('');
      
      setTimeout(() => {
        setPersonaggioNotificationVisible(false);
      }, 4000);
    };
    socket.on('hostage-released', handleHostageReleased);

    const handleHostageDied = ({ targetCardId, targetName, captorPlayer, originalOwner }: {
      targetCardId: string;
      targetName: string;
      captorPlayer: string;
      originalOwner: string;
    }) => {
      console.log(`⛓️💀 OSTAGGIO death: ${targetName} died`);
      playDeathSound();
      setPersonaggioNotificationVisible(true);
      setPersonaggioCardName('OSTAGGIO - MORTE');
      setPersonaggioMessage(`⛓️💀 ${targetName} aveva meno di 300 PTI ed è morto sotto OSTAGGIO!`);
      setPersonaggioCardImage('');
      
      setTimeout(() => {
        setPersonaggioNotificationVisible(false);
      }, 4000);
    };
    socket.on('hostage-died', handleHostageDied);

    // CARD AUDIO: Play audio when a card with audioUrl is placed on field
    const handleCardAudioPlay = ({ cardId, playerName: audioPlayerName, audioUrl, cardName }: {
      cardId: string;
      playerName: string;
      audioUrl: string;
      cardName: string;
    }) => {
      console.log(`🔊 Card audio triggered: ${cardName} by ${audioPlayerName}, URL: ${audioUrl}`);
      
      if (audioUrl) {
        try {
          let playableUrl = audioUrl;
          
          // Convert Google Drive view/share links to direct download links
          const driveMatch = audioUrl.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
          if (driveMatch) {
            const fileId = driveMatch[1];
            playableUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
            console.log(`🔊 Converted Google Drive URL to: ${playableUrl}`);
          }
          
          // Also handle Dropbox links (change dl=0 to dl=1)
          if (audioUrl.includes('dropbox.com') && audioUrl.includes('dl=0')) {
            playableUrl = audioUrl.replace('dl=0', 'dl=1');
            console.log(`🔊 Converted Dropbox URL to: ${playableUrl}`);
          }
          
          const audio = new Audio(playableUrl);
          audio.volume = 0.7;
          audio.play().catch(err => {
            console.error('Error playing card audio:', err);
          });
        } catch (err) {
          console.error('Error creating card audio:', err);
        }
      }
    };
    socket.on('card-audio-play', handleCardAudioPlay);

    // YOUTUBE VIDEO: Show YouTube video when a card with youtubeUrl is played
    const handleShowYoutubeVideo = ({ cardId, playerName: videoPlayerName, youtubeUrl, cardName, cardType }: {
      cardId: string;
      playerName: string;
      youtubeUrl: string;
      cardName: string;
      cardType?: string;
    }) => {
      console.log(`📺 YouTube video requested for card ${cardName}: ${youtubeUrl}`);
      setYoutubeVideoData({
        visible: true,
        youtubeUrl,
        cardName,
        playerName: videoPlayerName,
        cardType
      });
    };
    socket.on('show-youtube-video', handleShowYoutubeVideo);

    // CIMICE effect (attack or death)
    const handleCimiceEffect = (data: {
      type: 'attack' | 'death';
      cimiceCardId: string;
      damagePerCard: number;
      affectedCards: Array<{ id: string; name: string; owner: string; oldPTI: number; newPTI: number }>;
      message: string;
    }) => {
      console.log('🪲 CIMICE effect received:', data);
      setCimiceEffectData({ visible: true, ...data });
      playBeeSound(); // Use bee sound for bug effect
      setTimeout(() => {
        setCimiceEffectData(null);
      }, 4000);
    };
    socket.on('cimice-effect', handleCimiceEffect);

    const handleInstructionExecuted = ({ playerName: instructorName, instruction, result, timestamp }: { 
      playerName: string, instruction: string, result: string, timestamp: number 
    }) => {
      // Show notification to all players about the executed instruction
      alert(`🎮 ISTRUZIONE ESEGUITA:\n${result}`);
      
      // Clear conversation mode since instruction was successful
      setConversationMode(false);
      setAssistantQuestion('');
      setConversationHistory([]);
    };

    const handleInstructionSuccess = ({ message }: { message: string }) => {
      // Add success message to conversation
      const successMessage = {
        type: 'assistant' as const,
        message: `✅ ${message}`,
        timestamp: Date.now()
      };
      setConversationHistory(prev => [...prev, successMessage]);
      
      // Clear conversation mode after success
      setTimeout(() => {
        setConversationMode(false);
        setAssistantQuestion('');
        setConversationHistory([]);
        setInstructionsOpen(false);
      }, 2000);
    };

    const handleInstructionError = ({ message }: { message: string }) => {
      // Show error message to the instructor
      alert(`❌ ${message}`);
    };

    const handleInstructionQuestion = ({ playerName: instructorName, instruction, question, timestamp }: { 
      playerName: string, instruction: string, question: string, timestamp: number 
    }) => {
      // Add assistant question to conversation history
      const assistantMessage = {
        type: 'assistant' as const,
        message: question,
        timestamp
      };
      setConversationHistory(prev => [...prev, assistantMessage]);
      setConversationMode(true);
      setAssistantQuestion(question);
      
      // Keep the instructions panel open for response
      setInstructionsOpen(true);
    };

    const handleInstructionDialogue = ({ playerName: instructorName, instruction, question, timestamp }: { 
      playerName: string, instruction: string, question: string, timestamp: number 
    }) => {
      // Show to all players that there's a conversation happening
      if (instructorName !== playerName) {
        alert(`💬 ${instructorName} sta dialogando con l'assistente:\n"${instruction}"\n\nAssistente: ${question}`);
      }
    };

    const handleEliminationCheck = ({ playerName: targetPlayer }: { playerName: string }) => {
      if (targetPlayer === playerName) {
        setEliminationDialogOpen(true);
      }
    };

    const handlePlayerEliminated = ({ playerName: eliminatedPlayer }: { playerName: string }) => {
      playPlayerEliminated();
      setPlayerEliminationNotification({
        visible: true,
        player: eliminatedPlayer
      });
      
      // If the current player was eliminated, clear their session
      if (eliminatedPlayer === playerName) {
        clearSession();
        onLeaveGame?.();
      }
      
      // Hide notification after 3 seconds
      setTimeout(() => {
        setPlayerEliminationNotification({ visible: false, player: '' });
      }, 3000);
    };

    const handleGameVictory = ({ winner }: { winner: string }) => {
      if (winner === playerName) {
        playVictory();
      } else {
        playDefeat();
      }
      setVictoryPlayer(winner);
      setVictoryDialogOpen(true);
      setTimeout(() => setShowInterstitialAd(true), 3000);
      // Note: clearSession and onLeaveGame are called when user closes victory dialog
    };

    const handleFusionError = ({ message }: { message: string }) => {
      playErrorSound();
      alert(`❌ ${message}`);
    };

    const handleVoodooError = ({ message }: { message: string }) => {
      playErrorSound();
      alert(`❌ ${message}`);
    };

    socket.on('instruction-executed', handleInstructionExecuted);
    socket.on('instruction-success', handleInstructionSuccess);
    socket.on('instruction-error', handleInstructionError);
    socket.on('instruction-question', handleInstructionQuestion);
    socket.on('instruction-dialogue', handleInstructionDialogue);
    socket.on('elimination-check', handleEliminationCheck);
    socket.on('player-eliminated', handlePlayerEliminated);
    socket.on('game-victory', handleGameVictory);
    socket.on('fusion-error', handleFusionError);
    socket.on('voodoo:error', handleVoodooError);

    return () => {
      socket.off('game-reset', handleGameReset);
      socket.off('card-shown', handleCardShown);
      socket.off('card-show-confirmed', handleCardShowConfirmed);
      socket.off('dice-rolled', handleDiceRoll);
      socket.off('dice-roll', handleWindDiceRoll);
      socket.off('evolution-dice-roll', handleEvolutionDiceRoll);
      socket.off('dice-window-opened', handleDiceWindowOpen);
      socket.off('graveyard-milestone', handleGraveyardMilestone);
      socket.off('chat-message', handleChatMessage);
      socket.off('scenario-cards-toggled', handleScenarioCardsToggled);
      socket.off('card-attacked', handleCardAttacked);
      socket.off('card-to-graveyard', handleCardToGraveyard);
      socket.off('player-joined', handlePlayerJoined);
      socket.off('personaggio-enters', handlePersonaggioEnters);
      socket.off('cards-added', handleCardsAdded);
      socket.off('bee-sound', handleBeeSound);
      socket.off('character-sound', handleCharacterSound);
      socket.off('special-move-overlay', handleSpecialMoveOverlay);
      socket.off('evolution-animation', handleEvolutionAnimation);
      socket.off('card-played', handleCardPlayed);
      socket.off('card-played-face-down', handleCardPlayedFaceDown);
      socket.off('card-revealed', handleCardRevealed);
      socket.off('game-started', handleGameStarted);
      socket.off('next-turn', handleNextTurn);
      socket.off('player-left', handlePlayerLeft);
      socket.off('super-dice-opened', handleOpenSuperDice);
      socket.off('super-dice-rolled', handleSuperDiceRolled);
      socket.off('instruction-executed', handleInstructionExecuted);
      socket.off('instruction-success', handleInstructionSuccess);
      socket.off('instruction-error', handleInstructionError);
      socket.off('instruction-question', handleInstructionQuestion);
      socket.off('instruction-dialogue', handleInstructionDialogue);
      socket.off('elimination-check', handleEliminationCheck);
      socket.off('player-eliminated', handlePlayerEliminated);
      socket.off('game-victory', handleGameVictory);
      socket.off('fusion-error', handleFusionError);
      socket.off('voodoo:error', handleVoodooError);
      socket.off('player-choosing-notification', handlePlayerChoosingNotification);
      socket.off('show-graveyard-selection', handleShowGraveyardSelection);
      socket.off('show-pti-input-panel', handleShowPtiInputPanel);
      socket.off('show-pti-distribution-panel', handleShowPtiDistribution);
      socket.off('show-deck-selection', handleShowDeckSelection);
      socket.off('show-deck-card-picker', handleShowDeckCardPicker);
      socket.off('auction-select-character', handleAuctionSelectCharacter);
      socket.off('auction-started', handleAuctionStarted);
      socket.off('auction-bid-update', handleAuctionBidUpdate);
      socket.off('auction-countdown', handleAuctionCountdown);
      socket.off('auction-ended', handleAuctionEnded);
      socket.off('show-swap-selection', handleShowSwapSelection);
      socket.off('show-dice-control-panel', handleShowDiceControlPanel);
      socket.off('show-target-selection', handleShowTargetSelection);
      socket.off('show-custom-target-selection', handleShowCustomTargetSelection);
      socket.off('cards-revealed', handleCardsRevealed);
      socket.off('show-auto-dice-setup', handleShowAutoDiceSetup);
      socket.off('show-dice-character-select', handleShowDiceCharacterSelect);
      socket.off('show-dice-selection', handleShowDiceSelection);
      socket.off('dice-roll-result', handleDiceRollResult);
      socket.off('auto-dice-result', handleAutoDiceResult);
      socket.off('parasitic-target-select', handleParasiticTargetSelect);
      socket.off('parasitic-attached', handleParasiticAttached);
      socket.off('saibaim-explosion', handleSaibaImExplosion);
      socket.off('cimice-effect', handleCimiceEffect);
      socket.off('hostage-applied', handleHostageApplied);
      socket.off('hostage-updated', handleHostageUpdated);
      socket.off('hostage-released', handleHostageReleased);
      socket.off('hostage-died', handleHostageDied);
      socket.off('card-audio-play', handleCardAudioPlay);
      socket.off('show-youtube-video', handleShowYoutubeVideo);
      socket.off('clash-battle-start', handleClashBattleStart);
      socket.off('clash-battle-end', handleClashBattleEnd);
      socket.off('attack-error', handleAttackError);
      socket.off('attack-blocked', handleAttackError);
    };
  }, []);

  return (
    <div className="min-h-screen bg-arena-deep text-slate-100 p-4 relative">
      {/* Connection Status Banner */}
      <ConnectionStatus />
      
      {/* Last Played Cards History */}
      <LastPlayedCards cards={lastPlayedCards} maxCards={5} />
      
      {/* Missions Panel */}
      <MissionsPanel 
        isOpen={missionsOpen}
        onClose={() => setMissionsOpen(false)}
        authToken={authToken || null}
        onPointsUpdated={(newTotal) => {
          setUserRankiardPoints(newTotal);
        }}
      />
      
      {/* Achievements Panel */}
      <AchievementsPanel
        isOpen={achievementsOpen}
        onClose={() => setAchievementsOpen(false)}
        authToken={authToken || null}
        onPointsUpdated={(newTotal) => {
          setUserRankiardPoints(newTotal);
        }}
      />
      
      {/* Rankiard Leaderboard */}
      <RankiardLeaderboard
        isOpen={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
      />
      
      {/* Profile Panel */}
      <ProfilePanel
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        authToken={authToken || null}
        gameId={gameId || undefined}
      />
      
      {/* Join Request Dialog for room creator */}
      <JoinRequestDialog
        isCreator={gameState?.turnOrder?.[0] === playerName}
        gameId={gameId || ''}
      />
      
      {/* Animated gradient background */}
      <div className="fixed inset-0 game-bg-gradient" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[500px] h-[500px] rounded-full opacity-[0.07] blur-[100px] animate-bg-float-1" style={{ background: 'radial-gradient(circle, #9333ea, transparent 70%)', top: '10%', left: '20%' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full opacity-[0.05] blur-[80px] animate-bg-float-2" style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)', bottom: '20%', right: '15%' }} />
        <div className="absolute w-[300px] h-[300px] rounded-full opacity-[0.04] blur-[60px] animate-bg-float-3" style={{ background: 'radial-gradient(circle, #06b6d4, transparent 70%)', top: '50%', left: '60%' }} />
      </div>

      {/* Back to Home button */}
      {onBack && (
        <button
          onClick={onBack}
          className="fixed top-4 left-4 z-40 px-3 py-1.5 rounded-xl text-white/80 hover:text-white text-sm font-medium transition-all duration-200 flex items-center gap-1.5 border border-white/10 hover:border-white/20 hover:bg-white/5"
          style={{ background: 'rgba(10, 8, 30, 0.6)', backdropFilter: 'blur(12px)' }}
        >
          ← Indietro
        </button>
      )}

      {/* Portrait mode message - only show on mobile portrait if not dismissed */}
      {showRotationWarning && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 portrait:flex landscape:hidden sm:hidden">
          <div className="relative text-center text-white bg-gray-800 rounded-lg p-6 max-w-sm mx-4">
            {/* Close button */}
            <Button
              onClick={() => setShowRotationWarning(false)}
              className="absolute top-2 right-2 bg-transparent hover:bg-gray-700 text-white p-1 h-8 w-8 rounded-full"
              size="sm"
            >
              <X size={16} />
            </Button>
            
            <div className="text-6xl mb-4">📱</div>
            <h2 className="text-xl font-bold mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>Ruota il dispositivo</h2>
            <p className="text-sm opacity-80 mb-4" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>Per la migliore esperienza di gioco, ruota il tuo smartphone in modalità orizzontale</p>
            
            {/* Optional continue button */}
            <Button
              onClick={() => setShowRotationWarning(false)}
              className="btn-neon-blue text-white text-sm px-4 py-2"
              style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
            >
              Continua comunque
            </Button>
          </div>
        </div>
      )}
      
      {/* Character Limit Selection Dialog */}
      {characterLimitDialogOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-center mb-6 text-gray-800">
              Da quanti personaggi è questa partita?
            </h2>
            <div className="space-y-3">
              {['1', '2', '3', '5'].map((limit) => (
                <Button
                  key={limit}
                  onClick={() => handleCharacterLimitSelected(limit)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 text-lg border-2 border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                >
                  {limit} personaggi
                </Button>
              ))}
              <Button
                onClick={() => handleCharacterLimitSelected('unlimited')}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 text-lg border-2 border-gray-400 shadow-[0_0_15px_rgba(75,85,99,0.4)]"
              >
                NON SPECIFICARE
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Elimination Confirmation Dialog */}
      {eliminationDialogOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-center mb-6 text-gray-800">
              È morto il tuo ultimo personaggio, confermi di aver perso la partita?
            </h2>
            <div className="space-y-3">
              <Button
                onClick={() => {
                  setEliminationDialogOpen(false);
                  socket.emit('confirm-elimination', { gameId, playerName, confirmed: true });
                }}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 text-lg border-2 border-red-400 shadow-[0_0_15px_rgba(220,38,38,0.4)]"
              >
                Sì, mi arrendo
              </Button>
              <Button
                onClick={() => {
                  setEliminationDialogOpen(false);
                  socket.emit('confirm-elimination', { gameId, playerName, confirmed: false });
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 text-lg border-2 border-green-400 shadow-[0_0_15px_rgba(22,163,74,0.4)]"
              >
                No, continuo a giocare
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Victory Dialog */}
      {victoryDialogOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg p-8 w-full max-w-md mx-4 text-center border-4 border-yellow-300">
            <div className="mb-4">
              <Crown className="w-16 h-16 mx-auto text-yellow-800 mb-2" />
              <div className="flex justify-center space-x-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-6 h-6 text-yellow-800 fill-current" />
                ))}
              </div>
            </div>
            <h2 className="text-2xl font-bold text-yellow-900 mb-2">
              {victoryPlayer}
            </h2>
            <h3 className="text-xl font-bold text-yellow-900 mb-6">
              VINCE LA PARTITA!
            </h3>
            <Button
              onClick={() => {
                setVictoryDialogOpen(false);
                // Clear session when user acknowledges victory
                clearSession();
                onLeaveGame?.();
              }}
              className="btn-neon-yellow text-white font-bold py-2 px-6"
            >
              Chiudi
            </Button>
          </div>
        </div>
      )}

      {/* Player Elimination Notification */}
      {playerEliminationNotification.visible && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          <div className="flex items-center space-x-2">
            <Skull className="w-5 h-5" />
            <span className="font-bold">
              {playerEliminationNotification.player} è stato eliminato dalla partita!
            </span>
          </div>
        </div>
      )}

      {/* PARASITIC CARD: Target Selection Dialog */}
      {parasiticTargetSelect.visible && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-green-900 to-green-700 rounded-lg p-6 w-full max-w-2xl mx-4 border-4 border-green-400 shadow-[0_0_30px_rgba(34,197,94,0.5)]">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                🦠 {parasiticTargetSelect.parasiticType === 'PARASSITA' ? 'PARASSITA' : 'SAIBAIM'}
              </h2>
              <p className="text-green-100" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                {parasiticTargetSelect.parasiticType === 'PARASSITA' 
                  ? 'Scegli il personaggio nemico a cui agganciarti per drenare i suoi PTI!' 
                  : 'Scegli il personaggio nemico a cui agganciarti per esplodere insieme dopo 3 turni!'}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-80 overflow-y-auto">
              {parasiticTargetSelect.targets.map((target) => (
                <button
                  key={target.id}
                  onClick={() => {
                    socket.emit('parasitic-attach-target', {
                      gameId,
                      parasiticCardId: parasiticTargetSelect.parasiticCardId,
                      targetCardId: target.id,
                      playerName
                    });
                  }}
                  className="bg-gray-800/80 hover:bg-green-600 transition-all duration-200 rounded-lg p-3 border-2 border-green-400 hover:border-green-300 hover:shadow-[0_0_20px_rgba(34,197,94,0.6)]"
                >
                  {target.frontImage ? (
                    <img 
                      src={target.frontImage} 
                      alt="Target" 
                      className="w-full h-32 object-cover rounded mb-2"
                    />
                  ) : (
                    <div className="w-full h-32 bg-gray-700 rounded mb-2 flex items-center justify-center">
                      <span className="text-white text-xs">Carta</span>
                    </div>
                  )}
                  <p className="text-white text-sm font-bold" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                    {target.owner}
                  </p>
                  {target.text && (
                    <p className="text-green-200 text-xs" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                      {target.text}
                    </p>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-4 text-center">
              <p className="text-green-200 text-xs" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                {parasiticTargetSelect.parasiticType === 'PARASSITA' 
                  ? '⚠️ Il PARASSITA non può essere attaccato mentre è agganciato' 
                  : '⚠️ Il SAIBAIM esploderà dopo 3 turni eliminando entrambi i personaggi'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* GRAVEYARD SELECTION MODAL - Interactive card selection from graveyard */}
      {graveyardSelectionModal.visible && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-purple-900 to-purple-700 rounded-lg p-6 w-full max-w-3xl mx-4 border-4 border-purple-400 shadow-[0_0_30px_rgba(147,51,234,0.5)]">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                👼 SCEGLI CARTA DAL CIMITERO
              </h2>
              <p className="text-purple-100" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                {graveyardSelectionModal.message || 'Seleziona una carta da riportare in mano'}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
              {graveyardSelectionModal.cards.map((card: any) => (
                <button
                  key={card.id}
                  onClick={() => {
                    socket.emit('resurrect-select', {
                      cardId: card.id,
                      playerName
                    });
                    setGraveyardSelectionModal({ visible: false, reason: '', cards: [], message: '' });
                  }}
                  className="bg-gray-800/80 hover:bg-purple-600 transition-all duration-200 rounded-lg p-3 border-2 border-purple-400 hover:border-purple-300 hover:shadow-[0_0_20px_rgba(147,51,234,0.6)]"
                >
                  {card.frontImage ? (
                    <img 
                      src={card.frontImage} 
                      alt="Graveyard Card" 
                      className="w-full h-32 object-cover rounded mb-2"
                    />
                  ) : (
                    <div className="w-full h-32 bg-gray-700 rounded mb-2 flex items-center justify-center">
                      <span className="text-white text-xs">Carta</span>
                    </div>
                  )}
                  <p className="text-white text-sm font-bold truncate" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                    {card.name || card.id}
                  </p>
                </button>
              ))}
            </div>
            <div className="mt-4 text-center">
              <button
                onClick={() => setGraveyardSelectionModal({ visible: false, reason: '', cards: [], message: '' })}
                className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PTI INPUT PANEL - For effects that require user to input PTI amount */}
      {ptiInputPanel.visible && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-blue-900 to-blue-700 rounded-lg p-6 w-full max-w-md mx-4 border-4 border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.5)]">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                📋 {ptiInputPanel.cardName}
              </h2>
              <p className="text-blue-100 text-sm" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                {ptiInputPanel.effectDescription.length > 150 
                  ? ptiInputPanel.effectDescription.substring(0, 150) + '...' 
                  : ptiInputPanel.effectDescription}
              </p>
            </div>
            <div className="mb-4">
              <label className="text-white text-sm font-bold mb-2 block">Inserisci quantità PTI:</label>
              <Input
                type="number"
                value={ptiInputValue}
                onChange={(e) => setPtiInputValue(e.target.value)}
                placeholder="Es: 500"
                className="bg-gray-800 text-white border-blue-400"
                min="0"
              />
            </div>
            <div className="flex gap-4 justify-center">
              <Button
                onClick={() => {
                  const ptiValue = parseInt(ptiInputValue) || 0;
                  socket.emit('pti-input-confirm', {
                    cardId: ptiInputPanel.cardId,
                    ptiValue,
                    playerName
                  });
                  setPtiInputPanel({ visible: false, cardId: '', cardName: '', effectDescription: '' });
                }}
                className="bg-green-600 hover:bg-green-500 text-white px-6 py-2"
              >
                Conferma
              </Button>
              <Button
                onClick={() => setPtiInputPanel({ visible: false, cardId: '', cardName: '', effectDescription: '' })}
                className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2"
              >
                Annulla
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PTI DISTRIBUTION PANEL - Giovanni Muciaccia style PTI/stelle allocation */}
      {ptiDistributionPanel.visible && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-purple-900 to-indigo-700 rounded-lg p-6 w-full max-w-md mx-4 border-4 border-purple-400 shadow-[0_0_30px_rgba(147,51,234,0.5)]">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                🎭 {ptiDistributionPanel.cardName}
              </h2>
              <p className="text-purple-100 text-sm" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                Distribuisci {ptiDistributionPanel.totalBudget} punti tra PTI e Stelle. Ogni stella costa {ptiDistributionPanel.ptiPerStar} PTI.
              </p>
            </div>
            {ptiDistributionPanel.cardImage && (
              <div className="flex justify-center mb-4">
                <img src={ptiDistributionPanel.cardImage} alt={ptiDistributionPanel.cardName} className="w-24 h-32 object-cover rounded border-2 border-purple-300" />
              </div>
            )}
            <div className="bg-black/30 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-white font-bold text-lg">PTI: {distributionPti}</span>
                <span className="text-yellow-300 font-bold text-lg">Stelle: {distributionStars} {'⭐'.repeat(distributionStars)}</span>
              </div>
              <div className="mb-3">
                <label className="text-purple-200 text-xs block mb-1">Stelle (ogni stella = {ptiDistributionPanel.ptiPerStar} PTI)</label>
                <input
                  type="range"
                  min="0"
                  max={Math.floor(ptiDistributionPanel.totalBudget / ptiDistributionPanel.ptiPerStar)}
                  value={distributionStars}
                  onChange={(e) => {
                    const stars = parseInt(e.target.value);
                    setDistributionStars(stars);
                    setDistributionPti(ptiDistributionPanel.totalBudget - (stars * ptiDistributionPanel.ptiPerStar));
                  }}
                  className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-purple-300 text-xs mt-1">
                  <span>0 stelle</span>
                  <span>{Math.floor(ptiDistributionPanel.totalBudget / ptiDistributionPanel.ptiPerStar)} stelle</span>
                </div>
              </div>
              <div className="text-center text-purple-200 text-sm">
                Budget usato: {distributionPti + (distributionStars * ptiDistributionPanel.ptiPerStar)}/{ptiDistributionPanel.totalBudget}
              </div>
            </div>
            <div className="flex gap-4 justify-center">
              <Button
                onClick={() => {
                  socket.emit('pti-distribution-confirm', {
                    cardId: ptiDistributionPanel.cardId,
                    ptiValue: distributionPti,
                    starsValue: distributionStars,
                    playerName
                  });
                  setPtiDistributionPanel({ visible: false, cardId: '', cardName: '', cardImage: '', totalBudget: 1000, ptiPerStar: 100 });
                }}
                className="bg-green-600 hover:bg-green-500 text-white px-6 py-2"
              >
                Conferma
              </Button>
              <Button
                onClick={() => setPtiDistributionPanel({ visible: false, cardId: '', cardName: '', cardImage: '', totalBudget: 1000, ptiPerStar: 100 })}
                className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2"
              >
                Annulla
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DECK SELECTION PANEL - For effects that require user to select from decks */}
      {deckSelectionPanel.visible && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-amber-900 to-amber-700 rounded-lg p-6 w-full max-w-md mx-4 border-4 border-amber-400 shadow-[0_0_30px_rgba(217,119,6,0.5)]">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                🎴 {deckSelectionPanel.cardName}
              </h2>
              <p className="text-amber-100 text-sm" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                {deckSelectionPanel.effectDescription.length > 150 
                  ? deckSelectionPanel.effectDescription.substring(0, 150) + '...' 
                  : deckSelectionPanel.effectDescription}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Button
                onClick={() => {
                  socket.emit('deck-selection-confirm', {
                    cardId: deckSelectionPanel.cardId,
                    deckType: 'personaggi',
                    playerName
                  });
                  setDeckSelectionPanel({ visible: false, cardId: '', cardName: '', effectDescription: '', excludeSpeciali: false });
                }}
                className="bg-red-600 hover:bg-red-500 text-white py-4"
              >
                PERSONAGGI
              </Button>
              <Button
                onClick={() => {
                  socket.emit('deck-selection-confirm', {
                    cardId: deckSelectionPanel.cardId,
                    deckType: 'mosse',
                    playerName
                  });
                  setDeckSelectionPanel({ visible: false, cardId: '', cardName: '', effectDescription: '', excludeSpeciali: false });
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white py-4"
              >
                MOSSE
              </Button>
              <Button
                onClick={() => {
                  socket.emit('deck-selection-confirm', {
                    cardId: deckSelectionPanel.cardId,
                    deckType: 'bonus',
                    playerName
                  });
                  setDeckSelectionPanel({ visible: false, cardId: '', cardName: '', effectDescription: '', excludeSpeciali: false });
                }}
                className="bg-green-600 hover:bg-green-500 text-white py-4"
              >
                BONUS
              </Button>
              {!deckSelectionPanel.excludeSpeciali && (
                <Button
                  onClick={() => {
                    socket.emit('deck-selection-confirm', {
                      cardId: deckSelectionPanel.cardId,
                      deckType: 'personaggi_speciali',
                      playerName
                    });
                    setDeckSelectionPanel({ visible: false, cardId: '', cardName: '', effectDescription: '', excludeSpeciali: false });
                  }}
                  className="bg-purple-600 hover:bg-purple-500 text-white py-4"
                >
                  SPECIALI
                </Button>
              )}
            </div>
            <div className="text-center">
              <Button
                onClick={() => setDeckSelectionPanel({ visible: false, cardId: '', cardName: '', effectDescription: '', excludeSpeciali: false })}
                className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2"
              >
                Annulla
              </Button>
            </div>
          </div>
        </div>
      )}

      {deckCardPickerPanel.visible && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-amber-900 to-amber-700 rounded-lg p-4 w-full max-w-4xl mx-4 border-4 border-amber-400 shadow-[0_0_30px_rgba(217,119,6,0.5)] max-h-[85vh] flex flex-col">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-white mb-1" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                🎴 Scegli una carta dal mazzo {deckCardPickerPanel.deckDisplayName}
              </h2>
              <p className="text-amber-200 text-sm">{deckCardPickerPanel.cards.length} carte disponibili</p>
            </div>
            <div className="overflow-y-auto flex-1 mb-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {deckCardPickerPanel.cards.map((card) => (
                  <div
                    key={card.id}
                    onClick={() => {
                      socket.emit('deck-card-pick-confirm', {
                        selectedCardId: card.id,
                        deckType: deckCardPickerPanel.deckType,
                        cardId: deckCardPickerPanel.cardId,
                        playerName
                      });
                      setDeckCardPickerPanel({ visible: false, cardId: '', deckType: '', deckDisplayName: '', cards: [] });
                    }}
                    className="cursor-pointer rounded-lg border-2 border-amber-600 hover:border-yellow-300 hover:shadow-[0_0_15px_rgba(253,224,71,0.5)] transition-all duration-200 bg-black/30 p-1 flex flex-col items-center"
                  >
                    {card.frontImage ? (
                      <img
                        src={card.frontImage}
                        alt={card.name}
                        className="w-full h-auto rounded object-contain max-h-32"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-24 bg-gray-700 rounded flex items-center justify-center text-white text-xs">
                        {card.name}
                      </div>
                    )}
                    <p className="text-white text-[10px] mt-1 text-center truncate w-full" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                      {card.name}
                    </p>
                    {(card.pti != null || card.stars != null) && (
                      <p className="text-amber-300 text-[9px] text-center">
                        {card.pti != null ? `PTI: ${card.pti}` : ''}{card.pti != null && card.stars != null ? ' | ' : ''}{card.stars != null ? `⭐${card.stars}` : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-center">
              <Button
                onClick={() => setDeckCardPickerPanel({ visible: false, cardId: '', deckType: '', deckDisplayName: '', cards: [] })}
                className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2"
              >
                Annulla
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SWAP SELECTION PANEL - Baratto effect player selection */}
      {swapSelectionPanel.visible && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-cyan-900 to-cyan-700 rounded-lg p-6 w-full max-w-md mx-4 border-4 border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.5)]">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                🔄 {swapSelectionPanel.cardName}
              </h2>
              <p className="text-cyan-100 text-sm mb-4" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                {swapSelectionPanel.effectDescription.length > 150 
                  ? swapSelectionPanel.effectDescription.substring(0, 150) + '...' 
                  : swapSelectionPanel.effectDescription}
              </p>
              <p className="text-cyan-200 font-bold">Scegli con chi scambiare:</p>
            </div>
            <div className="space-y-3 mb-4">
              {swapSelectionPanel.otherPlayers.map((otherPlayer: string) => (
                <Button
                  key={otherPlayer}
                  onClick={() => {
                    socket.emit('swap-confirm', {
                      cardId: swapSelectionPanel.cardId,
                      targetPlayer: otherPlayer,
                      playerName
                    });
                    setSwapSelectionPanel({ visible: false, cardId: '', cardName: '', otherPlayers: [], effectDescription: '' });
                  }}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-4 text-lg font-bold"
                >
                  🎮 {otherPlayer}
                </Button>
              ))}
            </div>
            <div className="text-center">
              <Button
                onClick={() => setSwapSelectionPanel({ visible: false, cardId: '', cardName: '', otherPlayers: [], effectDescription: '' })}
                className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2"
              >
                Annulla
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DICE CONTROL PANEL - Choose dice result */}
      {diceControlPanel.visible && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-yellow-900 to-orange-700 rounded-lg p-6 w-full max-w-md mx-4 border-4 border-yellow-400 shadow-[0_0_30px_rgba(234,179,8,0.5)]">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                🎲 CONTROLLO DEL DADO
              </h2>
              <p className="text-yellow-100 text-sm mb-2" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                <span className="font-bold">{diceControlPanel.rollingPlayer}</span> sta per lanciare il dado!
              </p>
              <p className="text-yellow-100 text-sm mb-2" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                La tua carta <span className="font-bold">{diceControlPanel.controllingCardName}</span> ti permette di scegliere il risultato!
              </p>
              {diceControlPanel.targetCharName && (
                <p className="text-orange-200 text-sm mb-2" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                  Bersaglio: <span className="font-bold">{diceControlPanel.targetCharName}</span>
                </p>
              )}
              <p className="text-yellow-200 font-bold">Scegli il numero del dado:</p>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <Button
                  key={num}
                  onClick={() => {
                    socket.emit('dice-control-select', {
                      gameId,
                      selectedNumber: num,
                      controllingPlayer: diceControlPanel.controllingPlayer,
                      rollingPlayer: diceControlPanel.rollingPlayer,
                      pendingId: diceControlPanel.pendingId
                    });
                    setDiceControlPanel({ visible: false, rollingPlayer: '', controllingPlayer: '', controllingCardName: '' });
                  }}
                  className="bg-yellow-600 hover:bg-yellow-500 text-white py-6 text-3xl font-bold"
                >
                  {num}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TARGET SELECTION MODAL - Interactive target selection for custom effects */}
      {targetSelectionModal.visible && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className={`bg-gradient-to-br ${targetSelectionModal.effectType === 'damage' ? 'from-red-900 to-red-700 border-red-400' : 'from-green-900 to-green-700 border-green-400'} rounded-lg p-6 w-full max-w-3xl mx-4 border-4 shadow-[0_0_30px_rgba(220,38,38,0.5)]`}>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                🎯 SCEGLI BERSAGLI ({selectedTargetIds.length}/{targetSelectionModal.maxTargets})
              </h2>
              <p className="text-white/90" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                {targetSelectionModal.message || `Seleziona fino a ${targetSelectionModal.maxTargets} personaggi`}
              </p>
              <p className="text-lg font-bold mt-2" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                {targetSelectionModal.effectType === 'damage' 
                  ? `⚔️ Danno: ${targetSelectionModal.value} PTI` 
                  : `💚 Cura: ${targetSelectionModal.value} PTI`}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
              {targetSelectionModal.targets.map((card) => {
                const isSelected = selectedTargetIds.includes(card.id);
                return (
                  <button
                    key={card.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedTargetIds(prev => prev.filter(id => id !== card.id));
                      } else if (selectedTargetIds.length < targetSelectionModal.maxTargets) {
                        setSelectedTargetIds(prev => [...prev, card.id]);
                      }
                    }}
                    className={`transition-all duration-200 rounded-lg p-3 border-2 ${
                      isSelected 
                        ? (targetSelectionModal.effectType === 'damage' 
                            ? 'bg-red-600 border-red-300 shadow-[0_0_20px_rgba(220,38,38,0.8)]' 
                            : 'bg-green-600 border-green-300 shadow-[0_0_20px_rgba(34,197,94,0.8)]')
                        : 'bg-gray-800/80 hover:bg-gray-700 border-gray-500 hover:border-gray-400'
                    }`}
                  >
                    {card.frontImage ? (
                      <img 
                        src={card.frontImage} 
                        alt="Target Card" 
                        className="w-full h-32 object-cover rounded mb-2"
                      />
                    ) : (
                      <div className="w-full h-32 bg-gray-700 rounded mb-2 flex items-center justify-center">
                        <span className="text-white text-xs">Carta</span>
                      </div>
                    )}
                    <p className="text-white text-sm font-bold truncate" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                      {card.name || card.id}
                    </p>
                    <p className="text-xs text-gray-300">{card.owner}</p>
                    {isSelected && (
                      <div className="mt-1 text-xl">✓</div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-center gap-4">
              <button
                onClick={() => {
                  setTargetSelectionModal({ visible: false, effectType: 'damage', value: 0, maxTargets: 1, targets: [], message: '' });
                  setSelectedTargetIds([]);
                }}
                className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  if (selectedTargetIds.length > 0) {
                    socket.emit('target-select', {
                      targetCardIds: selectedTargetIds,
                      playerName
                    });
                    setTargetSelectionModal({ visible: false, effectType: 'damage', value: 0, maxTargets: 1, targets: [], message: '' });
                    setSelectedTargetIds([]);
                  }
                }}
                disabled={selectedTargetIds.length === 0}
                className={`px-4 py-2 rounded font-bold ${
                  selectedTargetIds.length > 0
                    ? (targetSelectionModal.effectType === 'damage' 
                        ? 'bg-red-600 hover:bg-red-500 text-white' 
                        : 'bg-green-600 hover:bg-green-500 text-white')
                    : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                }`}
              >
                {targetSelectionModal.effectType === 'damage' ? '⚔️ Attacca' : '💚 Cura'} ({selectedTargetIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DICE CHARACTER SELECTION MODAL - Step 1: Choose which characters to involve */}
      {diceCharacterSelectModal.visible && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-purple-900 to-purple-700 rounded-lg p-6 w-full max-w-2xl mx-4 border-4 border-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.5)]">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                🎯 SELEZIONA PERSONAGGI - {diceCharacterSelectModal.cardName}
              </h2>
              <div className="text-purple-100 text-sm space-y-1">
                <p>✅ Se indovina: <span className="text-green-300 font-bold">{diceCharacterSelectModal.correctEffect}</span></p>
                <p>❌ Se sbaglia: <span className="text-red-300 font-bold">{diceCharacterSelectModal.wrongEffect}</span></p>
              </div>
            </div>
            
            <p className="text-white text-center mb-4">Seleziona quali personaggi coinvolgere nel lancio del dado:</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
              {diceCharacterSelectModal.availableCharacters.map(char => {
                const isSelected = diceCharacterSelectModal.selectedCharacterIds.includes(char.id);
                return (
                  <div
                    key={char.id}
                    onClick={() => {
                      setDiceCharacterSelectModal(prev => ({
                        ...prev,
                        selectedCharacterIds: isSelected
                          ? prev.selectedCharacterIds.filter(id => id !== char.id)
                          : [...prev.selectedCharacterIds, char.id]
                      }));
                    }}
                    className={`bg-gray-800/80 rounded-lg p-3 border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.6)]'
                        : 'border-gray-600 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      {char.frontImage && (
                        <img src={char.frontImage} alt={char.name} className="w-16 h-20 object-cover rounded" />
                      )}
                      <span className="text-white font-bold text-sm text-center">{char.name}</span>
                      <span className={`text-xs ${char.owner === playerName ? 'text-green-400' : 'text-red-400'}`}>
                        {char.owner === playerName ? '(Tuo)' : `(${char.owner})`}
                      </span>
                      {isSelected && (
                        <span className="text-purple-300 text-xl">✓</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 flex justify-center gap-4">
              <button
                onClick={() => {
                  if (diceCharacterSelectModal.selectedCharacterIds.length > 0) {
                    socket.emit('dice-characters-confirmed', {
                      diceEffectId: diceCharacterSelectModal.diceEffectId,
                      selectedCharacterIds: diceCharacterSelectModal.selectedCharacterIds,
                      playerName
                    });
                    setDiceCharacterSelectModal({ visible: false, diceEffectId: '', cardName: '', correctEffect: '', wrongEffect: '', availableCharacters: [], selectedCharacterIds: [] });
                  }
                }}
                disabled={diceCharacterSelectModal.selectedCharacterIds.length === 0}
                className={`px-6 py-3 rounded-lg font-bold text-lg transition-all ${
                  diceCharacterSelectModal.selectedCharacterIds.length > 0
                    ? 'bg-purple-500 hover:bg-purple-400 text-white shadow-[0_0_20px_rgba(168,85,247,0.6)]'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                🎲 Conferma Personaggi ({diceCharacterSelectModal.selectedCharacterIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DICE SELECTION MODAL - Step 2: Choose number before dice roll */}
      {diceSelectionModal.visible && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-amber-900 to-amber-700 rounded-lg p-6 w-full max-w-2xl mx-4 border-4 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.5)]">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                🎲 LANCIO DEL DADO - {diceSelectionModal.cardName}
              </h2>
              <div className="text-amber-100 text-sm space-y-1">
                <p>✅ Se indovini: <span className="text-green-300 font-bold">{diceSelectionModal.correctEffect}</span></p>
                <p>❌ Se sbagli: <span className="text-red-300 font-bold">{diceSelectionModal.wrongEffect}</span></p>
              </div>
            </div>
            
            <p className="text-white text-center mb-4">Scegli un numero per ogni tuo personaggio coinvolto:</p>
            
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {diceSelectionModal.myCharacterIds.map(charId => {
                const char = diceSelectionModal.involvedCharacters.find(c => c.id === charId);
                if (!char) return null;
                return (
                  <div key={charId} className="bg-gray-800/80 rounded-lg p-4 border border-amber-500/50">
                    <div className="flex items-center gap-3 mb-3">
                      {char.frontImage && (
                        <img src={char.frontImage} alt={char.name} className="w-12 h-16 object-cover rounded" />
                      )}
                      <span className="text-white font-bold">{char.name}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {['1', '2', '3', '4', '5', '6', 'Pari', 'Dispari'].map(choice => (
                        <button
                          key={choice}
                          onClick={() => setDiceChoices(prev => ({ ...prev, [charId]: choice }))}
                          className={`p-2 rounded font-bold transition-all ${
                            diceChoices[charId] === choice
                              ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(251,191,36,0.8)]'
                              : 'bg-gray-700 text-white hover:bg-gray-600'
                          }`}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 flex justify-center gap-4">
              <button
                onClick={() => {
                  const allChosen = diceSelectionModal.myCharacterIds.every(id => diceChoices[id]);
                  if (allChosen) {
                    socket.emit('dice-choice-submit', {
                      diceEffectId: diceSelectionModal.diceEffectId,
                      choices: diceChoices,
                      playerName
                    });
                    setDiceSelectionModal({ visible: false, diceEffectId: '', cardName: '', correctEffect: '', wrongEffect: '', involvedCharacters: [], myCharacterIds: [] });
                  }
                }}
                disabled={!diceSelectionModal.myCharacterIds.every(id => diceChoices[id])}
                className={`px-6 py-3 rounded-lg font-bold text-lg transition-all ${
                  diceSelectionModal.myCharacterIds.every(id => diceChoices[id])
                    ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_20px_rgba(251,191,36,0.6)]'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                🎲 Conferma Scelte
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DICE ROLL RESULT - Animated result display */}
      {diceRollResult?.visible && (
        <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative bg-gradient-to-br from-amber-900 to-amber-600 rounded-xl p-8 border-4 border-amber-300 shadow-[0_0_50px_rgba(251,191,36,0.8)] animate-bounce-once">
            <div className="text-center">
              <div className="text-8xl mb-4 animate-spin-slow">🎲</div>
              <h2 className="text-4xl font-bold text-white mb-2" style={{textShadow: '3px 3px 6px rgba(0,0,0,0.8)'}}>
                RISULTATO: {diceRollResult.result}
              </h2>
              <p className="text-amber-200 text-lg">
                {diceRollResult.result % 2 === 0 ? 'PARI' : 'DISPARI'}
              </p>
              
              {diceRollResult.winners.length > 0 && (
                <div className="mt-4 bg-green-600/30 border border-green-400 rounded-lg p-3">
                  <p className="text-green-300 font-bold mb-2">✅ HANNO INDOVINATO:</p>
                  {diceRollResult.winners.map((w, i) => (
                    <p key={i} className="text-white">{w.name} → {w.effect}</p>
                  ))}
                </div>
              )}
              
              {diceRollResult.losers.length > 0 && (
                <div className="mt-4 bg-red-600/30 border border-red-400 rounded-lg p-3">
                  <p className="text-red-300 font-bold mb-2">❌ HANNO SBAGLIATO:</p>
                  {diceRollResult.losers.map((l, i) => (
                    <p key={i} className="text-white">{l.name} → {l.effect}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AUTO DICE RESULT - Animated automatic dice roll display */}
      {windDiceRoll.visible && (
        <div className="fixed inset-0 z-[9998] pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80" />
          <div className="relative bg-gradient-to-br from-cyan-900 via-blue-800 to-teal-700 rounded-2xl p-8 border-4 border-cyan-400 shadow-[0_0_80px_rgba(0,200,255,0.6)] max-w-md w-full mx-4">
            <div className="text-center">
              <h3 className="text-xl font-bold text-cyan-200 mb-2">FOLATA DI VENTO</h3>
              <p className="text-gray-300 text-sm mb-4">{windDiceRoll.playerName} tira il dado!</p>
              <div className="text-8xl mb-4 animate-bounce">🎲</div>
              <h2 className="text-7xl font-bold text-white mb-4 animate-pulse" style={{textShadow: '4px 4px 8px rgba(0,0,0,0.8)'}}>
                {windDiceRoll.value}
              </h2>
              <div className={`text-2xl font-bold ${windDiceRoll.value % 2 === 0 ? 'text-green-400' : 'text-orange-400'}`}>
                {windDiceRoll.value % 2 === 0 ? 'PARI - Danno al prossimo giocatore!' : 'DISPARI - Danno al giocatore precedente!'}
              </div>
            </div>
          </div>
        </div>
      )}

      {evolutionDiceRoll.visible && (
        <div className="fixed inset-0 z-[9998] pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 bg-black/85" style={{ animation: 'evo-dice-backdrop 0.4s ease-out' }} />
          <div className="relative flex flex-col items-center gap-4" style={{ animation: 'evo-dice-panel-enter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            <h3 className="text-2xl font-black text-yellow-200 tracking-widest" style={{ textShadow: '0 0 30px rgba(255,215,0,0.6)' }}>
              DADO EVOLUZIONE
            </h3>
            <p className="text-gray-300 text-sm">{evolutionDiceRoll.playerName} lancia il dado per <span className="text-yellow-300 font-bold">{evolutionDiceRoll.characterName}</span></p>
            
            <div className="my-4">
              <Dice3D 
                isRolling={evolutionDiceRoll.animationPhase === 'rolling'} 
                result={evolutionDiceRoll.animationPhase === 'result' ? evolutionDiceRoll.diceResult : null} 
                size={120} 
              />
            </div>
            
            {evolutionDiceRoll.animationPhase === 'result' && (
              <div style={{ animation: 'evo-dice-result-reveal 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                {evolutionDiceRoll.evolutionTarget ? (
                  <div className="text-center">
                    <div className="text-5xl font-black text-white mb-2" style={{ textShadow: '0 0 40px rgba(255,215,0,0.8)' }}>
                      {evolutionDiceRoll.diceResult}
                    </div>
                    <div className="text-xl font-bold text-green-400" style={{ textShadow: '0 0 20px rgba(74,222,128,0.6)', animation: 'evo-dice-glow 1.5s ease-in-out infinite' }}>
                      🌟 Si evolve in: {evolutionDiceRoll.evolutionTarget}!
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-5xl font-black text-white mb-2" style={{ textShadow: '0 0 40px rgba(239,68,68,0.8)' }}>
                      {evolutionDiceRoll.diceResult}
                    </div>
                    <div className="text-xl font-bold text-red-400">
                      ❌ Nessuna evoluzione per questo numero!
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <style>{`
            @keyframes evo-dice-backdrop { from { opacity: 0; } to { opacity: 1; } }
            @keyframes evo-dice-panel-enter { from { opacity: 0; transform: scale(0.5) translateY(40px); } to { opacity: 1; transform: scale(1) translateY(0); } }
            @keyframes evo-dice-result-reveal { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: scale(1); } }
            @keyframes evo-dice-glow { 0%, 100% { text-shadow: 0 0 20px rgba(74,222,128,0.6); } 50% { text-shadow: 0 0 40px rgba(74,222,128,1), 0 0 80px rgba(74,222,128,0.4); } }
          `}</style>
        </div>
      )}

      {autoDiceResult.visible && (
        <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80" />
          <div className="relative bg-gradient-to-br from-purple-900 via-indigo-800 to-purple-700 rounded-2xl p-8 border-4 border-purple-400 shadow-[0_0_80px_rgba(168,85,247,0.8)] max-w-lg w-full mx-4">
            <div className="text-center">
              {/* Card name header */}
              <h3 className="text-xl font-bold text-purple-200 mb-4">
                {autoDiceResult.cardName}
              </h3>
              
              {/* Rolling animation phase */}
              {autoDiceResult.animationPhase === 'rolling' && (
                <div className="animate-pulse">
                  <div className="text-8xl mb-4 animate-spin">🎲</div>
                  <p className="text-2xl text-purple-300 font-bold">Lancio del dado...</p>
                </div>
              )}
              
              {/* Result phase */}
              {(autoDiceResult.animationPhase === 'result' || autoDiceResult.animationPhase === 'effects') && (
                <>
                  <div className="text-8xl mb-4 animate-bounce">🎲</div>
                  <h2 className="text-6xl font-bold text-white mb-4 animate-pulse" style={{textShadow: '4px 4px 8px rgba(0,0,0,0.8)'}}>
                    {autoDiceResult.diceResult}
                  </h2>
                  <div className="bg-purple-800/50 border border-purple-400/50 rounded-lg p-4 mb-4">
                    <p className="text-xl text-white font-semibold">
                      {autoDiceResult.effect}
                    </p>
                  </div>
                </>
              )}
              
              {/* Effects phase - show affected characters */}
              {autoDiceResult.animationPhase === 'effects' && autoDiceResult.affectedCharacters.length > 0 && (
                <div className="mt-4 bg-indigo-900/50 border border-indigo-400/50 rounded-lg p-4 animate-fade-in">
                  <p className="text-indigo-300 font-bold mb-3">⚡ PERSONAGGI COLPITI:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {autoDiceResult.affectedCharacters.map((char, i) => (
                      <div key={i} className="bg-indigo-800/50 rounded p-2 text-center">
                        <p className="text-white font-medium text-sm">{char.charName}</p>
                        <p className="text-indigo-300 text-xs">{char.effect}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM TARGET SELECTION MODAL - Choose targets for custom effects with [BERSAGLIO: scelta] */}
      {customTargetModal.visible && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80">
          <div className="bg-gradient-to-br from-cyan-900 via-teal-800 to-cyan-700 rounded-2xl p-6 border-4 border-cyan-400 shadow-[0_0_60px_rgba(34,211,238,0.6)] max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                {customTargetModal.title || '🎯 SCEGLI I BERSAGLI'}
              </h2>
              <p className="text-cyan-200">{customTargetModal.subtitle || <>Effetto di <span className="font-bold text-white">{customTargetModal.cardName}</span></>}</p>
              <p className="text-cyan-300 text-sm mt-1">
                {customTargetModal.maxSelections === 1 ? 'Clicca su un personaggio' : 'Clicca sui personaggi da selezionare'}
              </p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {customTargetModal.availableTargets.map(target => {
                const isSelected = customSelectedTargets.includes(target.id);
                return (
                  <div
                    key={target.id}
                    onClick={() => {
                      if (isSelected) {
                        setCustomSelectedTargets(prev => prev.filter(id => id !== target.id));
                      } else if (customTargetModal.maxSelections === 1) {
                        setCustomSelectedTargets([target.id]);
                      } else {
                        setCustomSelectedTargets(prev => [...prev, target.id]);
                      }
                    }}
                    className={`cursor-pointer rounded-lg p-2 border-2 transition-all transform hover:scale-105 relative ${
                      isSelected 
                        ? 'border-cyan-300 bg-cyan-600/50 shadow-[0_0_20px_rgba(34,211,238,0.6)]' 
                        : 'border-gray-600 bg-gray-800/50 hover:border-cyan-500'
                    }`}
                  >
                    <img 
                      src={target.frontImage} 
                      alt={target.name}
                      className="w-full h-24 object-contain rounded mb-1"
                    />
                    <p className="text-white text-xs font-medium text-center truncate">{target.name}</p>
                    <p className="text-cyan-300 text-xs text-center">
                      {target.pti !== null ? `${target.pti} PTI` : ''} 
                      {target.stars !== null ? ` ★${target.stars}` : ''}
                    </p>
                    <p className="text-gray-400 text-xs text-center">{target.owner}</p>
                    {isSelected && (
                      <div className="absolute top-1 right-1 text-lg">✅</div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setCustomTargetModal({ visible: false, selectionId: '', cardId: '', cardName: '', owner: '', availableTargets: [] });
                  setCustomSelectedTargets([]);
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-all"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  if (customSelectedTargets.length > 0) {
                    socket.emit('target-selection-confirm', {
                      selectionId: customTargetModal.selectionId,
                      selectedTargetIds: customSelectedTargets,
                      playerName
                    });
                    setCustomTargetModal({ visible: false, selectionId: '', cardId: '', cardName: '', owner: '', availableTargets: [] });
                    setCustomSelectedTargets([]);
                  }
                }}
                disabled={customSelectedTargets.length === 0}
                className={`px-6 py-3 rounded-lg font-bold text-lg transition-all ${
                  customSelectedTargets.length > 0
                    ? 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(34,211,238,0.6)]'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                🎯 Conferma ({customSelectedTargets.length} selezionati)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVEAL MODAL - Show revealed opponent cards */}
      {revealedCards.visible && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80" onClick={() => setRevealedCards({ visible: false, revealedBy: '', hands: {} })}>
          <div className="bg-gradient-to-br from-indigo-900 via-purple-800 to-blue-900 rounded-2xl p-4 sm:p-6 border-4 border-cyan-400 shadow-[0_0_60px_rgba(34,211,238,0.6)] max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl sm:text-2xl font-black text-cyan-400 text-center mb-4" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
              👁️ CARTE RIVELATE
            </h2>
            {Object.entries(revealedCards.hands).map(([pName, cards]) => (
              <div key={pName} className="mb-4">
                <h3 className="text-lg font-bold text-amber-400 mb-2">🃏 Mano di {pName} ({cards.length} carte)</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {cards.map(card => (
                    <div key={card.id} className="bg-black/40 rounded-lg p-2 border border-cyan-500/30 text-center">
                      {card.frontImage && (
                        <img src={card.frontImage} alt={card.name} className="w-full h-24 sm:h-32 object-contain rounded mb-1" />
                      )}
                      <p className="text-xs sm:text-sm text-white font-bold truncate">{card.name}</p>
                      <p className="text-xs text-cyan-300">{card.type}</p>
                      {card.pti !== null && <p className="text-xs text-amber-400">PTI: {card.pti}</p>}
                      {card.stars !== null && <p className="text-xs text-yellow-300">{'⭐'.repeat(card.stars)}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="text-center mt-4">
              <button
                onClick={() => setRevealedCards({ visible: false, revealedBy: '', hands: {} })}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg shadow-[0_0_20px_rgba(34,211,238,0.6)] transition-all"
              >
                ✓ Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTO DICE SETUP MODAL - Configure automatic dice before rolling */}
      {autoDiceSetupModal.visible && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80">
          <div className="bg-gradient-to-br from-purple-900 via-indigo-800 to-purple-700 rounded-2xl p-6 border-4 border-purple-400 shadow-[0_0_60px_rgba(168,85,247,0.6)] max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                🎲 DADO AUTOMATICO
              </h2>
              <p className="text-purple-200">Carta: <span className="font-bold text-white">{autoDiceSetupModal.cardName}</span></p>
              <p className="text-purple-300 text-sm mt-1">Seleziona i personaggi coinvolti e personalizza le conseguenze</p>
            </div>
            
            {/* Character Selection */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-white mb-2">📍 Personaggi Coinvolti</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {autoDiceSetupModal.availableCharacters.map(char => {
                  const isSelected = autoDiceSelectedChars.includes(char.id);
                  return (
                    <div
                      key={char.id}
                      onClick={() => {
                        if (isSelected) {
                          setAutoDiceSelectedChars(prev => prev.filter(id => id !== char.id));
                        } else {
                          setAutoDiceSelectedChars(prev => [...prev, char.id]);
                        }
                      }}
                      className={`cursor-pointer rounded-lg p-2 border-2 transition-all transform hover:scale-105 relative ${
                        isSelected 
                          ? 'border-purple-300 bg-purple-600/50 shadow-[0_0_20px_rgba(168,85,247,0.6)]' 
                          : 'border-gray-600 bg-gray-800/50 hover:border-purple-500'
                      }`}
                    >
                      <img 
                        src={char.frontImage} 
                        alt={char.name}
                        className="w-full h-20 object-contain rounded mb-1"
                      />
                      <p className="text-white text-xs font-medium text-center truncate">{char.name}</p>
                      <p className="text-purple-300 text-xs text-center">
                        {char.pti !== null ? `${char.pti} PTI` : ''} 
                        {char.stars !== null ? ` ★${char.stars}` : ''}
                      </p>
                      <p className="text-gray-400 text-xs text-center">{char.owner}</p>
                      {isSelected && (
                        <div className="absolute top-1 right-1 text-lg">✅</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Effects Configuration */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-white mb-2">🎯 Conseguenze per Numero</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <div key={num} className="flex items-center gap-2 bg-black/30 rounded-lg p-2">
                    <div className="w-10 h-10 flex items-center justify-center bg-purple-600 rounded-lg text-white font-bold text-xl">
                      {num}
                    </div>
                    <input
                      type="text"
                      value={autoDiceCustomEffects[num] || ''}
                      onChange={(e) => setAutoDiceCustomEffects(prev => ({ ...prev, [num]: e.target.value }))}
                      placeholder={`Effetto per ${num}...`}
                      className="flex-1 bg-gray-700/50 text-white px-3 py-2 rounded-lg border border-purple-500/50 focus:border-purple-400 focus:outline-none text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setAutoDiceSetupModal({ visible: false, autoDiceId: '', cardName: '', defaultEffects: {}, availableCharacters: [], initiatorPlayer: '' });
                  setAutoDiceSelectedChars([]);
                  setAutoDiceCustomEffects({});
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-all"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  if (autoDiceSelectedChars.length > 0) {
                    socket.emit('auto-dice-confirm', {
                      autoDiceId: autoDiceSetupModal.autoDiceId,
                      selectedCharacterIds: autoDiceSelectedChars,
                      customEffects: autoDiceCustomEffects,
                      playerName
                    });
                    setAutoDiceSetupModal({ visible: false, autoDiceId: '', cardName: '', defaultEffects: {}, availableCharacters: [], initiatorPlayer: '' });
                    setAutoDiceSelectedChars([]);
                    setAutoDiceCustomEffects({});
                  }
                }}
                disabled={autoDiceSelectedChars.length === 0}
                className={`px-6 py-3 rounded-lg font-bold text-lg transition-all ${
                  autoDiceSelectedChars.length > 0
                    ? 'bg-purple-500 hover:bg-purple-400 text-white shadow-[0_0_20px_rgba(168,85,247,0.6)]'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                🎲 LANCIA IL DADO ({autoDiceSelectedChars.length} personaggi)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAIBAIM Explosion Effect */}
      {saibaImExplosionVisible && (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
          <div className="absolute inset-0 bg-orange-500 animate-pulse opacity-50" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-8xl animate-bounce">💥</div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <h1 className="text-4xl font-bold text-white animate-pulse" style={{textShadow: '4px 4px 8px rgba(0,0,0,0.8)'}}>
              SAIBAIM È ESPLOSO!
            </h1>
          </div>
        </div>
      )}

      {/* CIMICE Effect - Green Splash Explosion with Disclaimer */}
      {cimiceEffectData?.visible && (
        <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
          {/* Green pulsing background */}
          <div className="absolute inset-0 bg-green-500 animate-pulse opacity-40" />
          
          {/* Green splash particles - using CSS classes for deterministic animations */}
          <div className="absolute inset-0">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className={`absolute rounded-full bg-green-400 cimice-particle-${(i % 10) + 1}`}
                style={{
                  width: `${30 + (i * 3) % 30}px`,
                  height: `${30 + (i * 3) % 30}px`,
                  left: `${(i * 17) % 100}%`,
                  top: `${(i * 23) % 100}%`,
                  opacity: 0.5 + (i % 5) * 0.1,
                  animation: `cimice-splash ${0.5 + (i % 5) * 0.1}s ease-out forwards`,
                  animationDelay: `${(i % 6) * 0.05}s`,
                  boxShadow: '0 0 20px rgba(34, 197, 94, 0.8), 0 0 40px rgba(34, 197, 94, 0.5)'
                }}
              />
            ))}
          </div>
          
          {/* Flying bug emoji */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-8xl animate-bounce" style={{ animationDuration: '0.5s' }}>
              🪲
            </div>
          </div>
          
          {/* Disclaimer panel */}
          <div className="absolute inset-x-0 top-1/4 flex justify-center">
            <div className="bg-black/90 border-4 border-green-500 rounded-xl p-6 mx-4 max-w-2xl text-center shadow-2xl" style={{ boxShadow: '0 0 40px rgba(34, 197, 94, 0.6)' }}>
              <h2 className="text-3xl font-bold text-green-400 mb-3" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                {cimiceEffectData.type === 'attack' ? '🪲 CIMICE ATTACCATA!' : '🪲💀 CIMICE È MORTA!'}
              </h2>
              <p className="text-xl text-white mb-4" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                {cimiceEffectData.type === 'attack' 
                  ? 'Tutti gli altri personaggi in campo perdono 50 PTI!' 
                  : 'Tutti i personaggi in campo perdono 500 PTI!'}
              </p>
              <div className="text-lg text-green-300 font-bold">
                Danni inflitti: -{cimiceEffectData.damagePerCard} PTI a {cimiceEffectData.affectedCards.length} personaggi
              </div>
              {cimiceEffectData.affectedCards.length > 0 && (
                <div className="mt-3 text-sm text-green-200/80">
                  {cimiceEffectData.affectedCards.map((card, i) => (
                    <span key={card.id}>
                      {card.name} ({card.oldPTI}→{card.newPTI})
                      {i < cimiceEffectData.affectedCards.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Remove Player Dialog */}
      {removePlayerDialogOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 border-2 border-orange-500">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">
                Elimina concorrente
              </h2>
              <Button
                onClick={() => setRemovePlayerDialogOpen(false)}
                className="btn-neon-red text-white rounded-full p-1"
              >
                <X size={16} />
              </Button>
            </div>
            <p className="text-white/80 mb-4 text-sm">
              Seleziona il giocatore da eliminare dal tavolo. Diventerà spettatore e le sue carte torneranno nei mazzi.
            </p>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {gameState?.players && Object.values(gameState.players)
                .filter((p: any) => p.name !== playerName)
                .map((player: any) => (
                  <Button
                    key={player.name}
                    onClick={() => {
                      if (confirm(`Sei sicuro di voler eliminare ${player.name} dalla partita?`)) {
                        socket.emit('remove-player', { 
                          gameId, 
                          playerToRemove: player.name,
                          removedBy: playerName 
                        });
                        setRemovePlayerDialogOpen(false);
                      }
                    }}
                    className="w-full btn-neon-orange text-white font-bold py-3 text-left px-4 flex items-center gap-2"
                  >
                    <Skull size={16} />
                    {player.name}
                  </Button>
                ))}
              {gameState?.players && Object.values(gameState.players).filter((p: any) => p.name !== playerName).length === 0 && (
                <p className="text-white/60 text-center py-4">
                  Nessun giocatore disponibile per l'eliminazione
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Game content */}
      <div className="relative z-10">
        {/* Header - Compact glassmorphism bar */}
        <div className="flex items-center justify-between mb-3 gap-2 px-1">
          {/* Left: Logo + Room */}
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-lg landscape:text-2xl md:text-2xl font-black text-white tracking-tight whitespace-nowrap" style={{textShadow: '0 2px 8px rgba(0,0,0,0.6)'}}>MINKIARDS</h1>
            {gameId && gameId.startsWith('room-') && (
              <span className="text-white/50 text-[10px] landscape:text-xs md:text-xs bg-white/5 px-2 py-0.5 rounded-full border border-white/10 whitespace-nowrap">
                {gameId.replace('room-', '')}
              </span>
            )}
          </div>

          {/* Center: Primary actions */}
          <div className="flex items-center gap-1.5 landscape:gap-2 md:gap-2">
            <Button
              onClick={handleStartGame}
              className="bg-emerald-500/90 hover:bg-emerald-400 text-white font-bold text-[11px] landscape:text-sm md:text-sm px-3 landscape:px-5 md:px-5 py-1.5 landscape:py-2 md:py-2 rounded-xl shadow-lg shadow-emerald-500/25 border border-emerald-400/30 transition-all duration-200"
            >
              COMINCIA
            </Button>
            <Button
              onClick={() => setShowCpuControls(!showCpuControls)}
              className={`${showCpuControls ? 'bg-purple-500/90 border-purple-400/30 shadow-purple-500/25' : 'bg-white/10 border-white/10 shadow-none'} text-white font-bold text-[11px] landscape:text-sm md:text-sm px-3 landscape:px-4 md:px-4 py-1.5 landscape:py-2 md:py-2 rounded-xl shadow-lg border transition-all duration-200 hover:bg-purple-500/70`}
            >
              CPU
            </Button>
          </div>

          {/* Right: User info + Menu */}
          <div className="flex items-center gap-1.5">
            {authenticatedUser && (
              <div
                className="flex items-center gap-1.5 bg-white/5 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-all duration-200"
                onClick={() => setProfileOpen(true)}
                title="Apri Profilo"
              >
                <User size={13} className="text-blue-400 flex-shrink-0" />
                <span className="text-white/80 text-[11px] landscape:text-xs md:text-xs truncate max-w-[60px] landscape:max-w-[100px] md:max-w-[100px]">
                  {authenticatedUser.username}
                </span>
                <span className="text-yellow-400 text-[11px] landscape:text-xs md:text-xs font-bold whitespace-nowrap">
                  {authenticatedUser.puntiRankiard || 0}
                </span>
                {onLogout && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onLogout(); }}
                    className="text-red-400/60 hover:text-red-400 transition-colors ml-0.5"
                    title="Esci"
                  >
                    <LogOut size={12} />
                  </button>
                )}
              </div>
            )}

            {/* Dropdown menu for secondary actions */}
            <div className="relative">
              <button
                onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
                className="p-2 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/15 transition-all duration-200 text-white/70 hover:text-white"
              >
                <MoreVertical size={18} />
              </button>

              {headerMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setHeaderMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-white/15"
                    style={{ background: 'rgba(15, 10, 40, 0.92)', backdropFilter: 'blur(20px)' }}
                  >
                    <div className="py-1.5">
                      <button onClick={() => { window.open('https://minkiards.wixsite.com/minkiards/post/regolamento-ufficiale', '_blank'); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                        <BookOpen size={16} className="text-blue-400 flex-shrink-0" />
                        Regolamento
                      </button>
                      <button onClick={() => { authenticatedUser ? setProfileOpen(true) : shareInviteLink(); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                        <UserPlus size={16} className="text-cyan-400 flex-shrink-0" />
                        Invita Amici
                      </button>
                      {authenticatedUser && (
                        <>
                          <button onClick={() => { setMissionsOpen(true); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                            <Target size={16} className="text-emerald-400 flex-shrink-0" />
                            Missioni
                          </button>
                          <button onClick={() => { setAchievementsOpen(true); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                            <Trophy size={16} className="text-yellow-400 flex-shrink-0" />
                            Trofei
                          </button>
                        </>
                      )}
                      <button onClick={() => { setRankiardOpen(!rankiardOpen); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                        <Star size={16} className="text-amber-400 flex-shrink-0" />
                        Rankiard
                      </button>
                      <div className="my-1 border-t border-white/10" />
                      <button onClick={() => { handleNewGame(); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                        <PlusCircle size={16} className="text-purple-400 flex-shrink-0" />
                        Nuova Partita
                      </button>
                      <button onClick={() => { handleResetGame(); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition-colors">
                        <RotateCcw size={16} className="flex-shrink-0" />
                        Ricomincia Partita
                      </button>
                      <div className="my-1 border-t border-white/10" />
                      <button onClick={() => { initAudioContext(); toggleMute(); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                        {isMuted ? <VolumeX size={16} className="text-violet-400 flex-shrink-0" /> : <Volume2 size={16} className="text-violet-400 flex-shrink-0" />}
                        {isMuted ? 'Attiva Audio' : 'Disattiva Audio'}
                      </button>
                      <button onClick={() => { setSoundSettingsOpen(!soundSettingsOpen); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                        <Settings size={16} className="text-cyan-400 flex-shrink-0" />
                        Impostazioni Audio
                      </button>
                      <button onClick={() => { setMusicPlayerOpen(!musicPlayerOpen); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                        <Music size={16} className="text-pink-400 flex-shrink-0" />
                        Musica
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Player Hand */}
        <PlayerHand />

        {/* CPU Controls - conditional */}
        {showCpuControls && <CPUControls />}

        {/* Other Players' Hands */}
        <OtherPlayersHands />

        {/* Round Table - replaces the old decks and game field */}
        <RoundTable />

        {/* Graveyard Modal */}
        {graveyardOpen && (
          <Graveyard onClose={() => setGraveyardOpen(false)} />
        )}

        {/* Right-side Game Tools */}
        <div
          data-tutorial="tools"
          className="fixed bottom-3 landscape:bottom-4 md:bottom-4 right-2 landscape:right-3 md:right-4 z-30 transition-all duration-300"
          style={{
            opacity: (chatOpen || calculatorOpen || gameLogOpen || soundSettingsOpen || musicPlayerOpen) ? 0 : 1,
            pointerEvents: (chatOpen || calculatorOpen || gameLogOpen || soundSettingsOpen || musicPlayerOpen) ? 'none' : 'auto',
          }}
        >
          <div
            className="flex items-center gap-1 px-1.5 py-1 rounded-2xl border border-white/15 shadow-2xl shadow-black/50"
            style={{ background: 'rgba(10, 8, 30, 0.8)', backdropFilter: 'blur(16px)' }}
          >
            <button
              data-tutorial="hand"
              onClick={() => setHandModalOpen(true)}
              className="relative p-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 hover:text-purple-200 transition-all duration-200"
              title="Carte in Mano"
            >
              <Hand size={16} />
              {gameState?.players?.[playerName]?.hand?.length ? (
                <span className="absolute -top-1 -right-1 bg-cyan-500 text-white rounded-full text-[9px] w-4 h-4 flex items-center justify-center font-bold">
                  {gameState.players[playerName].hand.length}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => socket.emit('force-end-turn', { gameId })}
              className="p-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 hover:text-cyan-200 transition-all duration-200"
              title="Fine Turno"
            >
              <SkipForward size={16} />
            </button>

            <div className="w-px h-5 bg-white/10" />

            <button
              onClick={() => { if (chatOpen) { handleCloseChat(); } else { handleOpenChat(); } }}
              className="relative p-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 hover:text-blue-200 transition-all duration-200"
              title="Chat"
            >
              <MessageCircle size={16} />
              {unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-[9px] w-4 h-4 flex items-center justify-center font-bold">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </button>

            <button
              onClick={() => setGameLogOpen(!gameLogOpen)}
              className="p-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 hover:text-purple-200 transition-all duration-200"
              title="Game Log"
            >
              <ScrollText size={16} />
            </button>

            <div className="w-px h-5 bg-white/10" />

            <button
              onClick={() => setDiceOpen(true)}
              className="p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 hover:text-amber-200 transition-all duration-200"
              title="Dado"
            >
              <Dice6 size={16} />
            </button>

            <button
              onClick={() => setCalculatorOpen(!calculatorOpen)}
              className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 hover:text-emerald-200 transition-all duration-200"
              title="Calcolatrice"
            >
              <CalcIcon size={16} />
            </button>

            <button
              onClick={() => setGraveyardOpen(true)}
              className="p-2 rounded-xl bg-gray-500/20 hover:bg-gray-500/40 text-gray-300 hover:text-gray-200 transition-all duration-200"
              title="Cimitero"
            >
              <Skull size={16} />
            </button>

            <button
              onClick={() => {
                playDeckShuffle();
                const deckTypes = ['personaggi', 'mosse', 'bonus', 'personaggi_speciali'];
                deckTypes.forEach(deckType => {
                  socket.emit('shuffle-deck', { deckType });
                });
              }}
              className="p-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 hover:text-blue-200 transition-all duration-200"
              title="Mischia Mazzi"
            >
              <Shuffle size={16} />
            </button>

            <VoiceChat />
          </div>
        </div>

        {/* Sound Settings Panel */}
        <div id="sound-settings-container">
          {soundSettingsOpen && (
            <div 
              className="fixed bottom-4 right-2 landscape:right-4 md:right-4 w-[calc(100vw-2rem)] max-w-80 h-80 landscape:h-96 md:h-[28rem] z-50 fade-in duration-300"
              style={{ position: 'fixed' }}
            >
              <SoundSettings onClose={() => setSoundSettingsOpen(false)} />
            </div>
          )}
        </div>

        <MusicPlayer 
          isOpen={musicPlayerOpen}
          onClose={() => setMusicPlayerOpen(false)}
        />

        {/* Calculator */}
        {calculatorOpen && (
          <div 
            className="fixed bottom-4 right-2 landscape:right-4 md:right-4 w-[calc(100vw-2rem)] max-w-80 z-40 animate-in slide-in-from-bottom-5 fade-in duration-300"
            style={{ position: 'fixed' }}
          >
            <Calculator onClose={() => setCalculatorOpen(false)} />
          </div>
        )}

        {/* Chat */}
        {chatOpen && (
          <div 
            className="fixed bottom-16 landscape:bottom-20 md:bottom-52 right-1 landscape:right-4 md:right-4 w-[calc(100vw-1rem)] max-w-64 landscape:w-72 md:w-80 h-72 landscape:h-80 md:h-96 z-40 animate-in slide-in-from-right-5 fade-in duration-300"
            style={{ position: 'fixed' }}
          >
            <Chat onClose={handleCloseChat} />
          </div>
        )}

        {gameLogOpen && (
          <div 
            className="fixed bottom-16 landscape:bottom-20 md:bottom-52 right-1 landscape:right-4 md:right-4 w-[calc(100vw-1rem)] max-w-80 landscape:w-96 md:w-[28rem] h-80 landscape:h-96 md:h-[28rem] z-40 animate-in slide-in-from-right-5 fade-in duration-300"
            style={{ position: 'fixed' }}
          >
            <GameLog onClose={() => setGameLogOpen(false)} />
          </div>
        )}

        {/* Card Modal */}
        {selectedCard && <CardModal />}

        {/* Hand Modal */}
        {handModalOpen && (
          <HandModal onClose={() => setHandModalOpen(false)} />
        )}

        {/* Ciao Ciao Notification */}
        {ciaoNotificationVisible && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-8 text-center border-2 border-yellow-400 shadow-2xl">
              <div className="text-6xl mb-4 animate-wave">👋</div>
              <h2 className="text-white font-bold text-3xl mb-2">Ciao ciao</h2>
              <p className="text-yellow-400 font-semibold text-xl">{ciaoCardName}</p>
            </div>
          </div>
        )}

        {/* Evolution/Transformation Animation */}
        <EvolutionAnimation
          key={evolutionAnim.key}
          isVisible={evolutionAnim.visible}
          type={evolutionAnim.type}
          oldName={evolutionAnim.oldName}
          newName={evolutionAnim.newName}
          oldImage={evolutionAnim.oldImage}
          newImage={evolutionAnim.newImage}
          playerName={evolutionAnim.playerName}
          pti={evolutionAnim.pti}
          stars={evolutionAnim.stars}
          onComplete={() => setEvolutionAnim(prev => ({ ...prev, visible: false }))}
        />

        {/* PERSONAGGI Enter Notification */}
        <PersonaggioNotification
          isVisible={personaggioNotificationVisible}
          cardName={personaggioCardName}
          message={personaggioMessage}
          cardImage={personaggioCardImage || ""}
        />

        {/* Card Animation */}
        <CardAnimation
          isVisible={cardAnimationVisible}
          cardName={cardAnimationName}
          onComplete={() => setCardAnimationVisible(false)}
        />
        
        {/* AUCTION DECK PICKER - for selecting character to auction */}
        {auctionDeckPicker.visible && (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center p-2 sm:p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
            <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-4 sm:p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg sm:text-2xl font-black text-amber-400 text-center mb-2 sm:mb-4">🔨 SCEGLI UN PERSONAGGIO PER L'ASTA</h2>
              <p className="text-amber-200/60 text-center text-xs sm:text-sm mb-2 sm:mb-4">Seleziona il personaggio da mettere all'asta</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3">
                {auctionDeckPicker.cards.filter(c => c.type === 'personaggi' || c.type === 'personaggi_speciali').map(card => (
                  <div
                    key={card.id}
                    onClick={() => {
                      socket.emit('auction-select-card', { cardId: card.id, playerName });
                      setAuctionDeckPicker({ visible: false, cards: [], initiator: '' });
                    }}
                    className="cursor-pointer rounded-lg border-2 border-transparent hover:border-amber-400 active:border-amber-400 active:scale-95 transition-all hover:scale-105 p-1 bg-black/30"
                  >
                    <img src={card.frontImage} alt={card.name || 'Card'} className="w-full h-28 object-contain rounded" />
                    {card.name && <p className="text-white text-[10px] text-center mt-1 truncate">{card.name}</p>}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setAuctionDeckPicker({ visible: false, cards: [], initiator: '' })}
                className="mt-3 sm:mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 sm:py-2 rounded-lg min-h-[48px]"
              >
                ANNULLA
              </button>
            </div>
          </div>
        )}

        {/* AUCTION OVERLAY */}
        {auctionData && (
          <AuctionOverlay
            auctionData={auctionData}
            currentPlayerName={playerName}
            onPlaceBid={(amount) => socket.emit('auction-place-bid', { bidAmount: amount, playerName })}
            onClose={() => { setAuctionData(null); setAuctionResult(null); }}
            bidUpdates={auctionBidUpdate}
            countdownUpdate={auctionCountdownUpdate}
            auctionResult={auctionResult}
          />
        )}

        {/* Custom Animation Overlay */}
        {customAnimationVisible && customAnimationData && (
          <CustomAnimationOverlay
            isVisible={customAnimationVisible}
            cardName={customAnimationData.cardName}
            animationDescription={customAnimationData.animationDescription}
            onComplete={() => {
              setCustomAnimationVisible(false);
              setCustomAnimationData(null);
            }}
          />
        )}

        {specialMoveOverlay.visible && (
          <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
            style={{ animation: 'fadeIn 0.3s ease-out' }}
          >
            <div className="absolute inset-0 bg-black/70" style={{ animation: 'fadeIn 0.2s ease-out' }} />
            <div className="relative flex flex-col items-center gap-4" style={{ animation: 'specialMoveEntry 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
              {specialMoveOverlay.category && (
                <div className="text-yellow-400 text-lg font-bold uppercase tracking-widest" style={{ textShadow: '0 0 20px rgba(234, 179, 8, 0.8)' }}>
                  {specialMoveOverlay.category}
                </div>
              )}
              <div className="text-white text-2xl font-bold tracking-wide" style={{ textShadow: '0 0 15px rgba(255, 255, 255, 0.5)' }}>
                {specialMoveOverlay.attackerName}
              </div>
              <div 
                className="text-transparent bg-clip-text font-black uppercase tracking-wider text-center px-8"
                style={{ 
                  fontSize: 'clamp(2.5rem, 8vw, 5rem)',
                  backgroundImage: 'linear-gradient(135deg, #ff6b35, #ff0844, #fffc00, #ff6b35)',
                  backgroundSize: '300% 300%',
                  animation: 'specialMoveGlow 1.5s ease-in-out infinite',
                  WebkitTextStroke: '1px rgba(255, 100, 0, 0.3)',
                  filter: 'drop-shadow(0 0 30px rgba(255, 68, 0, 0.8)) drop-shadow(0 0 60px rgba(255, 0, 68, 0.4))',
                  lineHeight: 1.1
                }}
              >
                {specialMoveOverlay.moveName}
              </div>
              <div 
                className="text-red-100 font-black text-center"
                style={{ 
                  fontSize: 'clamp(1.8rem, 5vw, 3.5rem)',
                  textShadow: '0 0 30px rgba(255, 0, 0, 0.9), 0 0 60px rgba(255, 0, 0, 0.5)',
                  animation: 'specialMoveDamage 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both'
                }}
              >
                {specialMoveOverlay.damage} PTI
              </div>
            </div>
          </div>
        )}

        <CharacterEffects
          key={`attack-${attackEffectKey}`}
          isVisible={attackEffectVisible}
          effectType="attack"
          characterName={attackedCharacterName}
          onComplete={() => setAttackEffectVisible(false)}
        />

        <CharacterEffects
          key={`death-${deathEffectKey}`}
          isVisible={deathEffectVisible}
          effectType="death"
          characterName={deadCharacterName}
          onComplete={() => setDeathEffectVisible(false)}
        />

        {attackSlash3D.visible && (
          <AttackSlash3D
            isVisible={attackSlash3D.visible}
            attackerName={attackSlash3D.attackerName}
            targetName={attackSlash3D.targetName}
            damage={attackSlash3D.damage}
            onComplete={() => setAttackSlash3D({ visible: false, attackerName: '', targetName: '', damage: 0 })}
          />
        )}

        {cardShatter3D.visible && (
          <CardShatter3D
            isVisible={cardShatter3D.visible}
            cardImage={cardShatter3D.cardImage || undefined}
            cardName={cardShatter3D.cardName}
            onComplete={() => setCardShatter3D({ visible: false, cardImage: '', cardName: '' })}
          />
        )}

        {/* Player Order Notification */}
        <PlayerOrderNotification
          isVisible={playerOrderVisible}
          playerOrder={playerOrder}
          onClose={() => setPlayerOrderVisible(false)}
        />

        {/* Next Turn Notification */}
        <NextTurnNotification
          isVisible={nextTurnVisible}
          nextPlayer={nextTurnPlayer}
          onClose={() => setNextTurnVisible(false)}
          isMyTurn={nextTurnPlayer === playerName}
        />

        {/* Leave Game Notification */}
        <LeaveGameNotification
          isVisible={leaveGameVisible}
          playerName={leavingPlayer}
          onClose={() => setLeaveGameVisible(false)}
        />

        {/* Add Cards Modal */}
        <AddCardsModal
          isOpen={addCardsModalOpen}
          onClose={() => setAddCardsModalOpen(false)}
        />

        {/* Super Dice Modal */}
        <SuperDice
          isOpen={superDiceOpen}
          onClose={() => setSuperDiceOpen(false)}
          gameId={gameId || ''}
          playerName={playerName || ''}
        />


        {/* Add Cards, Scenari and Leave Game Buttons - Bottom of page */}
        <div className="mt-4 sm:mt-8 md:mt-16 mb-2 sm:mb-4 md:mb-8 grid grid-cols-2 sm:flex sm:flex-row justify-center gap-1.5 sm:gap-2 md:gap-4 px-2 sm:px-4">
          {/* Only show AGGIUNGI button for registered users (not guests) */}
          {authenticatedUser && authenticatedUser.id > 0 && (
            <Button
              onClick={() => setAddCardsModalOpen(true)}
              className="btn-neon-yellow text-white font-bold rounded-lg sm:rounded-xl px-2 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-1 sm:gap-2 md:gap-3"
            >
              <Plus size={14} className="sm:w-4 sm:h-4 md:w-6 md:h-6" />
              <span className="text-[10px] sm:text-sm md:text-base">AGGIUNGI</span>
            </Button>
          )}
          <Button
            onClick={() => {
              socket.emit('toggle-scenario-cards', { 
                gameId, 
                active: !scenarioCardsActive 
              });
            }}
            className={`${scenarioCardsActive ? 'btn-neon-green' : 'btn-neon-gray'} text-white font-bold rounded-lg sm:rounded-xl px-2 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-1 sm:gap-2 md:gap-3`}
          >
            <span className="text-[10px] sm:text-sm md:text-base text-black bg-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
              SCENARI {scenarioCardsActive ? 'ON' : 'OFF'}
            </span>
          </Button>
          <Button
            onClick={handleLeaveGame}
            className="btn-neon-red text-white font-bold rounded-lg sm:rounded-xl px-2 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-1 sm:gap-2 md:gap-3"
          >
            <X size={14} className="sm:w-4 sm:h-4 md:w-6 md:h-6" />
            <span className="text-[10px] sm:text-sm md:text-base">LASCIA</span>
          </Button>
          <Button
            onClick={() => setRemovePlayerDialogOpen(true)}
            className="btn-neon-orange text-white font-bold rounded-lg sm:rounded-xl px-2 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-1 sm:gap-2 md:gap-3"
          >
            <Skull size={14} className="sm:w-4 sm:h-4 md:w-6 md:h-6" />
            <span className="text-[10px] sm:text-sm md:text-base">ELIMINA</span>
          </Button>
        </div>

        {/* Dice Modal */}
        <DiceModal 
          isOpen={diceOpen}
          onClose={() => setDiceOpen(false)}
          currentRoll={diceResult}
          playerWhoRolled={playerWhoRolled}
        />

        {/* Chat Notifications */}
        {chatNotifications.map((notification) => (
          <ChatNotification
            key={notification.id}
            message={notification.message}
            playerName={notification.playerName}
            onClose={() => removeChatNotification(notification.id)}
            onOpenChat={handleOpenChat}
          />
        ))}

        {/* Player Choosing Card Notification */}
        {choosingNotification.visible && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
            <div className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
              <span className="text-2xl">🎴</span>
              <span className="font-semibold">{choosingNotification.message}</span>
            </div>
          </div>
        )}

        {/* Graveyard Milestone Notification */}
        <FullScreenNotification
          isVisible={notificationVisible}
          playerName={notificationPlayer}
          cardCount={notificationCardCount}
          title={notificationTitle}
          onClose={() => setNotificationVisible(false)}
        />

        {/* Rankiard Modal */}
        {rankiardOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-gray-600">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">RANKIARD</h2>
                <Button
                  onClick={() => setRankiardOpen(false)}
                  className="btn-neon-red text-white rounded-full p-1"
                >
                  <X size={16} />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">
                    Punti Rankiard residui
                  </label>
                  <Textarea
                    value={rankiardPoints}
                    onChange={(e) => handleRankiardPointsChange(e.target.value)}
                    placeholder="Inserisci i tuoi punti Rankiard..."
                    className="bg-gray-700 border-gray-600 text-white resize-none"
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    onClick={() => setLeaderboardOpen(true)}
                    className="btn-neon-blue text-white font-bold py-2 px-4 flex items-center justify-center gap-2"
                  >
                    <Trophy size={16} />
                    CLASSIFICA RANKIARD
                  </Button>
                  <Button
                    onClick={() => window.open('https://drive.google.com/file/d/1IEyFgz3stHj4W7k8VZrl8opIwkmP_7WC/view', '_blank')}
                    className="btn-neon-green text-white font-bold py-2 px-4 flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={16} />
                    ASSEGNAZIONE PUNTI RANKIARD
                  </Button>
                  <Button
                    onClick={() => window.open('https://drive.google.com/file/d/1KSPlXXs2lDg3-0MqlJvkgippLUBCnEbz/view', '_blank')}
                    className="btn-neon-purple text-white font-bold py-2 px-4 flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={16} />
                    BANCA POTERI
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Instructions Modal */}
        {instructionsOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-gray-600">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">ISTRUZIONI</h2>
                <Button
                  onClick={() => setInstructionsOpen(false)}
                  className="btn-neon-red text-white rounded-full p-1"
                >
                  <X size={16} />
                </Button>
              </div>
              
              <div className="space-y-4">
                {/* Conversation History */}
                {conversationHistory.length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-3 max-h-48 overflow-y-auto">
                    <h3 className="text-white text-sm font-medium mb-2">💬 Conversazione</h3>
                    <div className="space-y-2">
                      {conversationHistory.map((message, index) => (
                        <div key={index} className={`text-sm ${message.type === 'user' ? 'text-blue-300' : 'text-green-300'}`}>
                          <span className="font-medium">
                            {message.type === 'user' ? '👤 Tu: ' : '🤖 Assistente: '}
                          </span>
                          <span className="whitespace-pre-wrap">{message.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-white text-sm font-medium mb-2 block">
                    {conversationMode 
                      ? "💬 Rispondi all'assistente" 
                      : "Indica al sistema come modificare il gioco"}
                  </label>
                  
                  {/* Current Assistant Question */}
                  {conversationMode && assistantQuestion && (
                    <div className="bg-green-900 border border-green-600 rounded-lg p-3 mb-3">
                      <div className="text-green-300 text-sm font-medium mb-1">🤖 Assistente chiede:</div>
                      <div className="text-green-100 text-sm whitespace-pre-wrap">{assistantQuestion}</div>
                    </div>
                  )}
                  
                  {!conversationMode && (
                    <p className="text-gray-400 text-xs mb-3">
                      Esempi: "Inverti i turni di gioco", "Tutte le carte in campo vengono coperte", "Tutti prendono 3 carte MOSSE"
                    </p>
                  )}
                  
                  <Textarea
                    value={gameInstruction}
                    onChange={(e) => setGameInstruction(e.target.value)}
                    placeholder={conversationMode 
                      ? "Scrivi qui la tua risposta..." 
                      : "Scrivi qui la tua istruzione..."}
                    className="bg-gray-700 border-gray-600 text-white resize-none"
                    rows={4}
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleExecuteGameInstruction}
                    className="flex-1 btn-neon-green text-white font-bold py-2"
                  >
                    {conversationMode ? "💬 RISPONDI" : "🎮 ESEGUI ISTRUZIONE"}
                  </Button>
                  
                  {conversationMode && (
                    <Button
                      onClick={() => {
                        setConversationMode(false);
                        setAssistantQuestion('');
                        setConversationHistory([]);
                        setGameInstruction('');
                      }}
                      className="btn-neon-orange text-white py-2 px-4"
                    >
                      🔄 Ricomincia
                    </Button>
                  )}
                  
                  <Button
                    onClick={() => {
                      setInstructionsOpen(false);
                      setConversationMode(false);
                      setAssistantQuestion('');
                      setGameInstruction('');
                    }}
                    className="btn-neon-gray text-white py-2 px-4"
                  >
                    ❌ Chiudi
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Defense System Dialog */}
        <DefenseDialog />
        
        {/* Clash Battle - Equal damage tap battle */}
        {clashBattleData?.visible && (
          <ClashBattle
            clashId={clashBattleData.clashId}
            attacker={clashBattleData.attacker}
            defender={clashBattleData.defender}
            damageValue={clashBattleData.damageValue}
            duration={clashBattleData.duration}
          />
        )}
        
        {/* YouTube Video Modal */}
        {youtubeVideoData?.visible && (
          <YouTubeVideoModal
            youtubeUrl={youtubeVideoData.youtubeUrl}
            cardName={youtubeVideoData.cardName}
            playerName={youtubeVideoData.playerName}
            cardType={youtubeVideoData.cardType}
            onClose={() => setYoutubeVideoData(null)}
          />
        )}
        
        {/* CPU Damage Request Dialog */}
        <CPUDamageDialog />
        
        {/* Duel Auto-Attack Damage Dialog */}
        <DuelDamageDialog />
        
        {/* Recursive Damage Panel for SEMPAFAAGARA and PARTITA DI TENNIS */}
        <RecursiveDamagePanel />
        
        {/* Transfer Request Dialog */}
        <TransferRequestDialog />
        
        {/* Picked Card Modal - shown when player picks a card */}
        <PickedCardModal />
        
        {/* SOROS Activation Cinematic Effect */}
        {sorosActivationVisible && sorosData && (
          <SorosActivation
            activator={sorosData.activator}
            cardImage={sorosData.cardImage}
            onComplete={() => {
              setSorosActivationVisible(false);
              setSorosData(null);
              // Restart music after cinematic
              if (musicPlayerOpen) {
                setTimeout(() => {
                  const musicToggleBtn = document.querySelector('[data-music-control="play"]');
                  if (musicToggleBtn) {
                    (musicToggleBtn as HTMLButtonElement).click();
                  }
                }, 500);
              }
            }}
          />
        )}

        {/* Tutorial Overlay for new players */}
        {showTutorial && (
          <TutorialOverlay
            onComplete={() => setShowTutorial(false)}
            onSkip={() => setShowTutorial(false)}
          />
        )}

        {/* Interstitial Ad - shown between games */}
        <InterstitialAd
          show={showInterstitialAd}
          onClose={() => setShowInterstitialAd(false)}
        />

        {/* Emoji Reactions for quick communication */}
        {gameId && playerName && (
          <EmojiReactions gameId={gameId} playerName={playerName} />
        )}
      </div>
    </div>
  );
};