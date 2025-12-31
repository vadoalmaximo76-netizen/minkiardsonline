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
import { AddCardsModal } from "./AddCardsModal";
import { PlayerOrderNotification } from "./PlayerOrderNotification";
import { NextTurnNotification } from "./NextTurnNotification";
import { LeaveGameNotification } from "./LeaveGameNotification";
import { SuperDice } from "./SuperDice";
import { TransferRequestDialog } from "./TransferRequestDialog";
import { DefenseDialog } from "./DefenseDialog";
import { CPUDamageDialog } from "./CPUDamageDialog";
import { DuelDamageDialog } from "./DuelDamageDialog";
import { HandModal } from "./HandModal";
import { MusicPlayer } from "./MusicPlayer";
import { VoiceChat } from "./VoiceChat";
import { PickedCardModal } from "./PickedCardModal";
import { SorosActivation } from "./SorosActivation";
import { useGameState } from "../lib/stores/useGameState";
import { useAudio } from "../lib/stores/useAudio";
import { socket } from "../lib/socket";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { MessageCircle, Calculator as CalcIcon, Volume2, VolumeX, Plus, Dice6, Skull, X, ExternalLink, Crown, Star, Hand, Music } from "lucide-react";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

export const GameBoard: React.FC = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [musicPlayerOpen, setMusicPlayerOpen] = useState(false);
  const [graveyardOpen, setGraveyardOpen] = useState(false);
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
  const [removePlayerDialogOpen, setRemovePlayerDialogOpen] = useState(false);
  const [playerEliminationNotification, setPlayerEliminationNotification] = useState<{
    visible: boolean;
    player: string;
  }>({ visible: false, player: '' });
  const [handModalOpen, setHandModalOpen] = useState(false);
  const [cardAnimationVisible, setCardAnimationVisible] = useState(false);
  const [cardAnimationName, setCardAnimationName] = useState<string>("");
  const [sorosActivationVisible, setSorosActivationVisible] = useState(false);
  const [sorosData, setSorosData] = useState<{ activator: string; cardImage: string } | null>(null);
  const { selectedCard, gameId, playerName, gameState, setGameId } = useGameState();
  const { playGameStart, playPlayerJoin, playChatMessage, playCardToGraveyard, playDiceRoll, playDamageSound, playBeeSound, playCharacterSound, playCardAnimationSound, initAudioContext, toggleMute, isMuted } = useAudio();


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
      
      // Join the new game room
      socket.emit('join-game', { gameId: newGameId, playerName });
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
      // Play damage sound when cards are attacked
      playDamageSound();
    };

    const handleCardToGraveyard = ({ cardName }: { cardName: string }) => {
      setCiaoCardName(cardName);
      setCiaoNotificationVisible(true);
      
      // Play lose sound when card goes to graveyard
      playCardToGraveyard();
      
      // Auto-hide after 3 seconds
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
    socket.on('card-played-face-down', handleCardPlayedFaceDown);
    socket.on('card-revealed', handleCardRevealed);
    socket.on('game-started', handleGameStarted);
    socket.on('next-turn', handleNextTurn);
    socket.on('player-left', handlePlayerLeft);
    socket.on('super-dice-opened', handleOpenSuperDice);
    socket.on('super-dice-rolled', handleSuperDiceRolled);
    socket.on('soros-activated', handleSorosActivation);

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
    };
  }, []);

  return (
    <div className="min-h-screen bg-royal-blue p-4 relative">
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
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2"
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
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 text-lg"
                >
                  {limit} personaggi
                </Button>
              ))}
              <Button
                onClick={() => handleCharacterLimitSelected('unlimited')}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 text-lg"
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
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 text-lg"
              >
                Sì, mi arrendo
              </Button>
              <Button
                onClick={() => {
                  setEliminationDialogOpen(false);
                  socket.emit('confirm-elimination', { gameId, playerName, confirmed: false });
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 text-lg"
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
              className="bg-yellow-700 hover:bg-yellow-800 text-white font-bold py-2 px-6"
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
                className="bg-red-600 hover:bg-red-700 text-white rounded-full p-1"
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
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 text-left px-4 flex items-center gap-2"
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
            <h1 className="text-2xl landscape:text-4xl md:text-4xl font-bold text-white" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>MINKIARDS</h1>
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
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs landscape:text-sm md:text-sm px-2 landscape:px-4 md:px-4 py-1 landscape:py-2 md:py-2"
                style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
              >
                REGOLAMENTO
              </Button>
              <Button
                onClick={() => setShowCpuControls(!showCpuControls)}
                className={`${showCpuControls ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-600 hover:bg-gray-700'} text-white font-bold text-xs landscape:text-sm md:text-sm px-2 landscape:px-4 md:px-4 py-1 landscape:py-2 md:py-2`}
                style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
              >
                GIOCA CONTRO CPU (BETA)
              </Button>
              <Button
                onClick={handleStartGame}
                className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs landscape:text-sm md:text-sm px-2 landscape:px-4 md:px-4 py-1 landscape:py-2 md:py-2"
                style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
              >
                COMINCIA
              </Button>
            </div>
            
            {/* Second row: INVITA AMICI, RANKIARD, NUOVA PARTITA and RICOMINCIA PARTITA */}
            <div className="flex gap-1 landscape:gap-2 md:gap-2 justify-center landscape:justify-end md:justify-end">
              <Button
                onClick={shareInviteLink}
                className="bg-sky-blue hover:bg-sky-blue/80 text-white font-bold text-xs landscape:text-sm md:text-sm px-2 landscape:px-4 md:px-4 py-1 landscape:py-2 md:py-2"
                style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
              >
                INVITA AMICI
              </Button>
              <Button
                onClick={() => setRankiardOpen(!rankiardOpen)}
                className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold text-xs landscape:text-sm md:text-sm px-2 landscape:px-4 md:px-4 py-1 landscape:py-2 md:py-2"
                style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
              >
                RANKIARD
              </Button>
              <Button
                onClick={handleNewGame}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs landscape:text-sm md:text-sm px-2 landscape:px-4 md:px-4 py-1 landscape:py-2 md:py-2"
                style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
              >
                NUOVA PARTITA
              </Button>
              <Button
                onClick={handleResetGame}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs landscape:text-sm md:text-sm px-2 landscape:px-4 md:px-4 py-1 landscape:py-2 md:py-2"
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
          className="fixed bottom-14 landscape:bottom-20 md:bottom-20 left-2 landscape:left-4 md:left-4 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-full p-2 landscape:p-3 md:p-3 z-60 shadow-lg hover:shadow-xl transition-all duration-200"
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
          className="fixed bottom-2 landscape:bottom-4 md:bottom-4 left-2 landscape:left-4 md:left-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-full p-2 landscape:p-3 md:p-3 z-60 shadow-lg hover:shadow-xl transition-all duration-200"
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
        <div className="fixed bottom-2 landscape:bottom-4 md:bottom-4 right-2 landscape:right-4 md:right-4 flex flex-col gap-1 landscape:gap-2 md:gap-2 z-50">
          <Button
            onClick={() => setHandModalOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-2 landscape:p-3 md:p-3 shadow-lg hover:shadow-xl transition-all duration-200"
            title="Carte in Mano"
          >
            <Hand size={16} className="landscape:w-6 landscape:h-6 md:w-6 md:h-6" />
          </Button>
          
          <Button
            onClick={() => {
              if (chatOpen) {
                handleCloseChat();
              } else {
                handleOpenChat();
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 landscape:p-3 md:p-3 shadow-lg hover:shadow-xl transition-all duration-200 relative"
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
            className="bg-green-600 hover:bg-green-700 text-white rounded-full p-2 landscape:p-3 md:p-3 shadow-lg hover:shadow-xl transition-all duration-200"
            title="Calculator"
          >
            <CalcIcon size={16} className="landscape:w-6 landscape:h-6 md:w-6 md:h-6" />
          </Button>
          
          <Button
            onClick={() => setDiceOpen(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white rounded-full p-2 landscape:p-3 md:p-3 shadow-lg hover:shadow-xl transition-all duration-200"
            title="Roll Dice"
          >
            <Dice6 size={16} className="landscape:w-6 landscape:h-6 md:w-6 md:h-6" />
          </Button>
          
          <Button
            onClick={() => setGraveyardOpen(true)}
            className="bg-gray-600 hover:bg-gray-700 text-white rounded-full p-2 landscape:p-3 md:p-3 shadow-lg hover:shadow-xl transition-all duration-200"
            title="Graveyard"
          >
            <Skull size={16} className="landscape:w-6 landscape:h-6 md:w-6 md:h-6" />
          </Button>
          
          {/* Voice Chat Controls */}
          <VoiceChat />
          
          <Button
            onClick={() => setInstructionsOpen(!instructionsOpen)}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-2 landscape:p-3 md:p-3 shadow-lg hover:shadow-xl transition-all duration-200"
            title="Istruzioni"
          >
            <span className="text-xs landscape:text-sm md:text-sm font-bold">!</span>
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
        <div className="mt-8 md:mt-16 mb-4 md:mb-8 flex flex-col sm:flex-row justify-center gap-2 md:gap-4 px-4">
          <Button
            onClick={() => setAddCardsModalOpen(true)}
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-xl px-4 md:px-6 py-2 md:py-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 md:gap-3"
          >
            <Plus size={16} className="md:w-6 md:h-6" />
            <span className="text-sm md:text-base">AGGIUNGI CARTE</span>
          </Button>
          <Button
            onClick={() => {
              socket.emit('toggle-scenario-cards', { 
                gameId, 
                active: !scenarioCardsActive 
              });
            }}
            className={`${scenarioCardsActive ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'} text-white font-bold rounded-xl px-4 md:px-6 py-2 md:py-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 md:gap-3`}
          >
            <span className="text-sm md:text-base text-black bg-white px-2 py-1 rounded">
              SCENARI {scenarioCardsActive ? 'ON' : 'OFF'}
            </span>
          </Button>
          <Button
            onClick={handleLeaveGame}
            className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl px-4 md:px-6 py-2 md:py-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 md:gap-3"
          >
            <X size={16} className="md:w-6 md:h-6" />
            <span className="text-sm md:text-base">LASCIA LA PARTITA</span>
          </Button>
          <Button
            onClick={() => setRemovePlayerDialogOpen(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl px-4 md:px-6 py-2 md:py-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 md:gap-3"
          >
            <Skull size={16} className="md:w-6 md:h-6" />
            <span className="text-sm md:text-base">ELIMINA CONCORRENTE</span>
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
                  className="bg-red-600 hover:bg-red-700 text-white rounded-full p-1"
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
                    onClick={() => window.open('https://drive.google.com/file/d/12bbZFsDw6AFFpqexTS-rHTMlkPhcRZgG/view', '_blank')}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={16} />
                    CLASSIFICA RANKIARD
                  </Button>
                  <Button
                    onClick={() => window.open('https://drive.google.com/file/d/1IEyFgz3stHj4W7k8VZrl8opIwkmP_7WC/view', '_blank')}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={16} />
                    ASSEGNAZIONE PUNTI RANKIARD
                  </Button>
                  <Button
                    onClick={() => window.open('https://drive.google.com/file/d/1KSPlXXs2lDg3-0MqlJvkgippLUBCnEbz/view', '_blank')}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 flex items-center justify-center gap-2"
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
                  className="bg-red-600 hover:bg-red-700 text-white rounded-full p-1"
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
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2"
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
                      className="bg-orange-600 hover:bg-orange-700 text-white py-2 px-4"
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
                    className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4"
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
        
        {/* CPU Damage Request Dialog */}
        <CPUDamageDialog />
        
        {/* Duel Auto-Attack Damage Dialog */}
        <DuelDamageDialog />
        
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
      </div>
    </div>
  );
};