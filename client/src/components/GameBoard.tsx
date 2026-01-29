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
import { HandModal } from "./HandModal";
import { MusicPlayer } from "./MusicPlayer";
import { VoiceChat } from "./VoiceChat";
import { PickedCardModal } from "./PickedCardModal";
import { SorosActivation } from "./SorosActivation";
import { CharacterEffects } from "./CharacterEffects";
import { TutorialOverlay } from "./TutorialOverlay";
import { AdBanner, InterstitialAd } from "./AdBanner";
import { ConnectionStatus } from "./ConnectionStatus";
import { LastPlayedCards } from "./LastPlayedCards";
import { MissionsPanel } from "./MissionsPanel";
import { AchievementsPanel } from "./AchievementsPanel";
import { RankiardLeaderboard } from "./RankiardLeaderboard";
import { ProfilePanel } from "./ProfilePanel";
import { useGameState } from "../lib/stores/useGameState";
import { useAudio } from "../lib/stores/useAudio";
import { socket } from "../lib/socket";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { MessageCircle, Calculator as CalcIcon, Volume2, VolumeX, Plus, Dice6, Skull, X, ExternalLink, Crown, Star, Hand, Music, Shuffle, User, LogOut, Target, Trophy } from "lucide-react";
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
}

export const GameBoard: React.FC<GameBoardProps> = ({ authenticatedUser, onLogout, authToken }) => {
  const [chatOpen, setChatOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [musicPlayerOpen, setMusicPlayerOpen] = useState(false);
  const [graveyardOpen, setGraveyardOpen] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
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
  const [handModalOpen, setHandModalOpen] = useState(false);
  const [cardAnimationVisible, setCardAnimationVisible] = useState(false);
  const [cardAnimationName, setCardAnimationName] = useState<string>("");
  const [customAnimationVisible, setCustomAnimationVisible] = useState(false);
  const [customAnimationData, setCustomAnimationData] = useState<{ cardName: string; animationDescription: string } | null>(null);
  const [sorosActivationVisible, setSorosActivationVisible] = useState(false);
  const [sorosData, setSorosData] = useState<{ activator: string; cardImage: string } | null>(null);
  const [attackEffectVisible, setAttackEffectVisible] = useState(false);
  const [attackedCharacterName, setAttackedCharacterName] = useState<string>("");
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
  const [lastPlayedCards, setLastPlayedCards] = useState<Array<{
    id: string;
    frontImage: string;
    name?: string;
    playerName: string;
    timestamp: number;
    cardType: string;
  }>>([]);
    const { selectedCard, gameId, playerName, gameState, setGameId, setUserRankiardPoints, resetPRSpent } = useGameState();
  const { playGameStart, playPlayerJoin, playChatMessage, playCardToGraveyard, playDiceRoll, playDamageSound, playBeeSound, playCharacterSound, playCardAnimationSound, initAudioContext, toggleMute, isMuted, playAttackSound, playDeathSound, playCardPickup, playCardPlay, playTurnChange, playBonusActivated } = useAudio();


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
        playDeathSound();
      }
      
      setTimeout(() => {
        setCiaoNotificationVisible(false);
      }, 3000);
    };

    const handlePersonaggioEnters = ({ cardName, message, cardImage }: { cardName: string, message: string, cardImage: string }) => {
      console.log('Personaggio enters:', { cardName, message, cardImage });
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
      setCustomAnimationData({ cardName, animationDescription });
      setCustomAnimationVisible(true);
      // Auto-hide after 4 seconds
      setTimeout(() => {
        setCustomAnimationVisible(false);
        setCustomAnimationData(null);
      }, 4000);
    };

    const handleCardPlayed = ({ cardId, cardType, frontImage, cardName, playerName }: { 
      cardId: string, 
      cardType: string, 
      frontImage: string, 
      cardName?: string,
      playerName: string 
    }) => {
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
      console.log(`Card played face down: ${message}`);
      // Optional: Show a notification that a card was played face down
    };

    const handleCardRevealed = ({ cardId, cardName, playerName, cardImage, message }: { cardId: string, cardName: string, playerName: string, cardImage: string, message: string }) => {
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
      playTurnChange();
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
      setPlayerEliminationNotification({
        visible: true,
        player: eliminatedPlayer
      });
      
      // Hide notification after 3 seconds
      setTimeout(() => {
        setPlayerEliminationNotification({ visible: false, player: '' });
      }, 3000);
    };

    const handleGameVictory = ({ winner }: { winner: string }) => {
      setVictoryPlayer(winner);
      setVictoryDialogOpen(true);
      setTimeout(() => setShowInterstitialAd(true), 3000);
    };

    const handleFusionError = ({ message }: { message: string }) => {
      alert(`❌ ${message}`);
    };

    const handleVoodooError = ({ message }: { message: string }) => {
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
      socket.off('show-target-selection', handleShowTargetSelection);
      socket.off('parasitic-target-select', handleParasiticTargetSelect);
      socket.off('parasitic-attached', handleParasiticAttached);
      socket.off('saibaim-explosion', handleSaibaImExplosion);
      socket.off('cimice-effect', handleCimiceEffect);
      socket.off('hostage-applied', handleHostageApplied);
      socket.off('hostage-updated', handleHostageUpdated);
      socket.off('hostage-released', handleHostageReleased);
      socket.off('hostage-died', handleHostageDied);
      socket.off('card-audio-play', handleCardAudioPlay);
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
      
      {/* Background image */}
      <div 
        className="fixed inset-0 bg-cover bg-center opacity-50"
        style={{
          backgroundImage: 'url(https://files.123freevectors.com/wp-content/original/113342-royal-blue-blurred-background-vector.jpg)'
        }}
      />

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
              onClick={() => setVictoryDialogOpen(false)}
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
        {/* Header */}
        <div className="flex flex-col landscape:flex-row md:flex-row justify-between items-center mb-4 md:mb-6 gap-4">
          <div className="text-center landscape:text-left md:text-left">
            <div className="flex items-center gap-2 landscape:gap-4 md:gap-4">
              <h1 className="text-2xl landscape:text-4xl md:text-4xl font-bold text-white" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>MINKIARDS</h1>
              {authenticatedUser && (
                <div className="flex items-center gap-1 bg-purple-900/70 px-2 py-1 rounded-lg cursor-pointer hover:bg-purple-800/70 transition-colors" onClick={() => setProfileOpen(true)} title="Apri Profilo">
                  <User size={14} className="text-blue-400" />
                  <span className="text-white/80 text-xs" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                    {authenticatedUser.username}
                  </span>
                  <span className="text-yellow-400 text-xs font-bold" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                    {authenticatedUser.puntiRankiard || 0} PR
                  </span>
                  {onLogout && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onLogout(); }}
                      className="ml-1 text-red-400 hover:text-red-300 transition-colors"
                      title="Esci"
                    >
                      <LogOut size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
            {gameId && gameId.startsWith('room-') && (
              <p className="text-white/80 text-xs landscape:text-sm md:text-sm mt-1" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                Stanza: {gameId.replace('room-', '')}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {/* First row: REGOLAMENTO, CPU BETA and COMINCIA */}
            <div className="flex gap-1 landscape:gap-2 md:gap-2 justify-center landscape:justify-end md:justify-end">
              <Button
                onClick={() => window.open('https://minkiards.wixsite.com/minkiards/post/regolamento-ufficiale', '_blank')}
                className="btn-neon-blue text-white font-bold text-xs landscape:text-sm md:text-sm px-2 landscape:px-4 md:px-4 py-1 landscape:py-2 md:py-2"
                style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
              >
                REGOLAMENTO
              </Button>
              <Button
                onClick={() => setShowCpuControls(!showCpuControls)}
                className={`${showCpuControls ? 'btn-neon-purple' : 'btn-neon-gray'} text-white font-bold text-xs landscape:text-sm md:text-sm px-2 landscape:px-4 md:px-4 py-1 landscape:py-2 md:py-2`}
                style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
              >
                GIOCA CONTRO CPU (BETA)
              </Button>
              <Button
                onClick={handleStartGame}
                className="btn-neon-green text-white font-bold text-xs landscape:text-sm md:text-sm px-2 landscape:px-4 md:px-4 py-1 landscape:py-2 md:py-2"
                style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
              >
                COMINCIA
              </Button>
            </div>
            
            {/* Second row: INVITA AMICI, MISSIONI, TROFEI, RANKIARD, NUOVA PARTITA and RICOMINCIA PARTITA */}
            <div className="flex gap-1 landscape:gap-2 md:gap-2 justify-center landscape:justify-end md:justify-end flex-wrap">
              <Button
                onClick={() => authenticatedUser ? setProfileOpen(true) : shareInviteLink()}
                className="btn-neon-blue text-white font-bold text-xs landscape:text-sm md:text-sm px-2 landscape:px-4 md:px-4 py-1 landscape:py-2 md:py-2"
                style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
              >
                INVITA AMICI
              </Button>
              {authenticatedUser && (
                <>
                  <Button
                    onClick={() => setMissionsOpen(true)}
                    className="btn-neon-cyan text-white font-bold text-xs landscape:text-sm md:text-sm px-2 landscape:px-4 md:px-4 py-1 landscape:py-2 md:py-2"
                    style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
                  >
                    <Target size={14} className="mr-1" />
                    MISSIONI
                  </Button>
                  <Button
                    onClick={() => setAchievementsOpen(true)}
                    className="btn-neon-purple text-white font-bold text-xs landscape:text-sm md:text-sm px-2 landscape:px-4 md:px-4 py-1 landscape:py-2 md:py-2"
                    style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
                  >
                    <Trophy size={14} className="mr-1" />
                    TROFEI
                  </Button>
                </>
              )}
              <Button
                onClick={() => setRankiardOpen(!rankiardOpen)}
                className="btn-neon-yellow text-white font-bold text-xs landscape:text-sm md:text-sm px-2 landscape:px-4 md:px-4 py-1 landscape:py-2 md:py-2"
                style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
              >
                RANKIARD
              </Button>
              <Button
                onClick={handleNewGame}
                className="btn-neon-purple text-white font-bold text-xs landscape:text-sm md:text-sm px-2 landscape:px-4 md:px-4 py-1 landscape:py-2 md:py-2"
                style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
              >
                NUOVA PARTITA
              </Button>
              <Button
                onClick={handleResetGame}
                className="btn-neon-red text-white font-bold text-xs landscape:text-sm md:text-sm px-2 landscape:px-4 md:px-4 py-1 landscape:py-2 md:py-2"
                style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
              >
                RICOMINCIA PARTITA
              </Button>
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

        {/* Music Player Button */}
        <Button
          onClick={() => setMusicPlayerOpen(!musicPlayerOpen)}
          className="fixed bottom-36 landscape:bottom-44 md:bottom-44 left-2 landscape:left-4 md:left-4 btn-neon-pink text-white font-bold rounded-full p-2 landscape:p-3 md:p-3 z-60 shadow-lg hover:shadow-xl transition-all duration-200"
          style={{ position: 'fixed' }}
          title="Music Player"
        >
          <Music size={16} className="landscape:w-6 landscape:h-6 md:w-6 md:h-6" />
        </Button>

        {/* Sound Toggle Button */}
        <Button
          onClick={() => {
            initAudioContext();
            toggleMute();
          }}
          className="fixed bottom-24 landscape:bottom-32 md:bottom-32 left-2 landscape:left-4 md:left-4 btn-neon-purple text-white font-bold rounded-full p-2 landscape:p-3 md:p-3 z-60 shadow-lg hover:shadow-xl transition-all duration-200"
          style={{ position: 'fixed' }}
          title={isMuted ? "Enable sound" : "Disable sound"}
        >
          {isMuted ? <VolumeX size={16} className="landscape:w-6 landscape:h-6 md:w-6 md:h-6" /> : <Volume2 size={16} className="landscape:w-6 landscape:h-6 md:w-6 md:h-6" />}
        </Button>
        
        {/* Music Player Component */}
        <MusicPlayer 
          isOpen={musicPlayerOpen}
          onClose={() => setMusicPlayerOpen(false)}
        />

        {/* Game controls */}
        <div data-tutorial="tools" className="fixed bottom-2 landscape:bottom-4 md:bottom-4 right-2 landscape:right-4 md:right-4 flex flex-col gap-1 landscape:gap-2 md:gap-2 z-50">
          <Button
            data-tutorial="hand"
            onClick={() => setHandModalOpen(true)}
            className="btn-neon-purple text-white rounded-full p-2 landscape:p-3 md:p-3 shadow-lg hover:shadow-xl transition-all duration-200 relative"
            title="Carte in Mano"
          >
            <Hand size={16} className="landscape:w-6 landscape:h-6 md:w-6 md:h-6" />
            {gameState?.players?.[playerName]?.hand?.length ? (
              <span className="absolute -top-1 landscape:-top-2 md:-top-2 -right-1 landscape:-right-2 md:-right-2 bg-cyan-500 text-white rounded-full text-xs w-4 h-4 landscape:w-6 landscape:h-6 md:w-6 md:h-6 flex items-center justify-center font-bold">
                {gameState.players[playerName].hand.length}
              </span>
            ) : null}
          </Button>
          
          <Button
            onClick={() => {
              if (chatOpen) {
                handleCloseChat();
              } else {
                handleOpenChat();
              }
            }}
            className="btn-neon-blue text-white rounded-full p-2 landscape:p-3 md:p-3 shadow-lg hover:shadow-xl transition-all duration-200 relative"
            title="Chat"
          >
            <MessageCircle size={16} className="landscape:w-6 landscape:h-6 md:w-6 md:h-6" />
            {unreadMessages > 0 && (
              <span className="absolute -top-1 landscape:-top-2 md:-top-2 -right-1 landscape:-right-2 md:-right-2 bg-red-500 text-white rounded-full text-xs w-4 h-4 landscape:w-6 landscape:h-6 md:w-6 md:h-6 flex items-center justify-center font-bold">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          </Button>
          
          <Button
            onClick={() => setCalculatorOpen(!calculatorOpen)}
            className="btn-neon-green text-white rounded-full p-2 landscape:p-3 md:p-3 shadow-lg hover:shadow-xl transition-all duration-200"
            title="Calculator"
          >
            <CalcIcon size={16} className="landscape:w-6 landscape:h-6 md:w-6 md:h-6" />
          </Button>
          
          <Button
            onClick={() => setDiceOpen(true)}
            className="btn-neon-orange text-white rounded-full p-2 landscape:p-3 md:p-3 shadow-lg hover:shadow-xl transition-all duration-200"
            title="Roll Dice"
          >
            <Dice6 size={16} className="landscape:w-6 landscape:h-6 md:w-6 md:h-6" />
          </Button>
          
          <Button
            onClick={() => setGraveyardOpen(true)}
            className="btn-neon-gray text-white rounded-full p-2 landscape:p-3 md:p-3 shadow-lg hover:shadow-xl transition-all duration-200"
            title="Graveyard"
          >
            <Skull size={16} className="landscape:w-6 landscape:h-6 md:w-6 md:h-6" />
          </Button>
          
          {/* Voice Chat Controls */}
          <VoiceChat />
          
          <Button
            onClick={() => {
              const deckTypes = ['personaggi', 'mosse', 'bonus', 'personaggi_speciali'];
              deckTypes.forEach(deckType => {
                socket.emit('shuffle-deck', { deckType });
              });
            }}
            className="btn-neon-blue text-white rounded-full p-2 landscape:p-3 md:p-3 shadow-lg hover:shadow-xl transition-all duration-200"
            title="Mischia tutti i mazzi"
          >
            <Shuffle size={16} className="landscape:w-6 landscape:h-6 md:w-6 md:h-6" />
          </Button>
          
          </div>

        {/* Calculator */}
        {calculatorOpen && (
          <div 
            className="fixed bottom-16 landscape:bottom-20 md:bottom-52 right-1 landscape:right-4 md:right-4 w-[calc(100vw-1rem)] max-w-64 landscape:w-72 md:w-80 z-40 animate-in slide-in-from-right-5 fade-in duration-300"
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
      </div>
    </div>
  );
};