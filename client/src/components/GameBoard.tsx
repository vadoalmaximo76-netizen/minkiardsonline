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
import { AddCardsModal } from "./AddCardsModal";
import { PlayerOrderNotification } from "./PlayerOrderNotification";
import { NextTurnNotification } from "./NextTurnNotification";
import { LeaveGameNotification } from "./LeaveGameNotification";
import { SuperDice } from "./SuperDice";
import { useGameState } from "../lib/stores/useGameState";
import { useAudio } from "../lib/stores/useAudio";
import { socket } from "../lib/socket";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { MessageCircle, Calculator as CalcIcon, Volume2, VolumeX, Plus, Dice6, Skull, X, ExternalLink } from "lucide-react";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

export const GameBoard: React.FC = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
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
  const { selectedCard, gameId, playerName, gameState } = useGameState();
  const { playGameStart, playPlayerJoin, playChatMessage, playCardToGraveyard, playDiceRoll, playDamageSound, playBeeSound, playCharacterSound, initAudioContext, toggleMute, isMuted } = useAudio();


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

    // Send instruction to server for AI processing
    socket.emit('game-instruction', {
      gameId,
      playerName,
      instruction: gameInstruction.trim()
    });

    setGameInstruction('');
    setInstructionsOpen(false);
    
    // Show confirmation
    alert(`Istruzione inviata: "${gameInstruction.trim()}"`);
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

  const handleStartGame = () => {
    socket.emit('start-game', { gameId, playerName });
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
    socket.on('card-played-face-down', handleCardPlayedFaceDown);
    socket.on('card-revealed', handleCardRevealed);
    socket.on('game-started', handleGameStarted);
    socket.on('next-turn', handleNextTurn);
    socket.on('player-left', handlePlayerLeft);
    socket.on('super-dice-opened', handleOpenSuperDice);
    socket.on('super-dice-rolled', handleSuperDiceRolled);

    const handleInstructionExecuted = ({ playerName: instructorName, instruction, result, timestamp }: { 
      playerName: string, instruction: string, result: string, timestamp: number 
    }) => {
      // Show notification to all players about the executed instruction
      alert(`🎮 ISTRUZIONE ESEGUITA:\n${result}`);
    };

    const handleInstructionSuccess = ({ message }: { message: string }) => {
      // Show success message to the instructor
      alert(`✅ ${message}`);
    };

    const handleInstructionError = ({ message }: { message: string }) => {
      // Show error message to the instructor
      alert(`❌ ${message}`);
    };

    socket.on('instruction-executed', handleInstructionExecuted);
    socket.on('instruction-success', handleInstructionSuccess);
    socket.on('instruction-error', handleInstructionError);

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
            
            {/* Second row: INVITA AMICI, RANKIARD and RICOMINCIA PARTITA */}
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

        {/* Game controls */}
        <div className="fixed bottom-2 landscape:bottom-4 md:bottom-4 right-2 landscape:right-4 md:right-4 flex flex-col gap-1 landscape:gap-2 md:gap-2 z-50">
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
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg px-4 md:px-6 py-2 md:py-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 md:gap-3"
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
            className={`${scenarioCardsActive ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'} text-white font-bold rounded-lg px-4 md:px-6 py-2 md:py-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 md:gap-3`}
          >
            <span className="text-sm md:text-base text-black bg-white px-2 py-1 rounded">
              SCENARI {scenarioCardsActive ? 'ON' : 'OFF'}
            </span>
          </Button>
          <Button
            onClick={handleLeaveGame}
            className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg px-4 md:px-6 py-2 md:py-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 md:gap-3"
          >
            <X size={16} className="md:w-6 md:h-6" />
            <span className="text-sm md:text-base">LASCIA LA PARTITA</span>
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
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">
                    Indica al sistema come modificare il gioco
                  </label>
                  <p className="text-gray-400 text-xs mb-3">
                    Esempi: "Inverti i turni di gioco", "Tutte le carte in campo vengono coperte", "Tutti prendono 3 carte MOSSE"
                  </p>
                  <Textarea
                    value={gameInstruction}
                    onChange={(e) => setGameInstruction(e.target.value)}
                    placeholder="Scrivi qui la tua istruzione..."
                    className="bg-gray-700 border-gray-600 text-white resize-none"
                    rows={4}
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleExecuteGameInstruction}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2"
                  >
                    ESEGUI ISTRUZIONE
                  </Button>
                  <Button
                    onClick={() => setInstructionsOpen(false)}
                    className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4"
                  >
                    Annulla
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};