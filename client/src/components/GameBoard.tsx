import React, { useState, useEffect } from "react";
import { Deck } from "./Deck";
import { PlayerHand } from "./PlayerHand";
import { GameField } from "./GameField";
import { Graveyard } from "./Graveyard";
import { Chat } from "./Chat";
import { Calculator } from "./Calculator";
import { CardModal } from "./CardModal";
import { DiceModal } from "./DiceModal";
import { FullScreenNotification } from "./FullScreenNotification";
import { PersonaggioNotification } from "./PersonaggioNotification";
import { AddCardsModal } from "./AddCardsModal";
import { PlayerOrderNotification } from "./PlayerOrderNotification";
import { NextTurnNotification } from "./NextTurnNotification";
import { LeaveGameNotification } from "./LeaveGameNotification";
import { useGameState } from "../lib/stores/useGameState";
import { useAudio } from "../lib/stores/useAudio";
import { socket } from "../lib/socket";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { MessageCircle, Calculator as CalcIcon, Volume2, VolumeX, Plus, Dice6, Skull, X } from "lucide-react";

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
  const { selectedCard, gameId, playerName } = useGameState();
  const { playGameStart, playPlayerJoin, playChatMessage, playCardToGraveyard, playDiceRoll, playDamageSound, playBeeSound, playCharacterSound, initAudioContext, toggleMute, isMuted } = useAudio();


  const shareInviteLink = () => {
    const link = `${window.location.origin}?game=${gameId}`;
    navigator.clipboard.writeText(link);
    alert("Invitation link copied to clipboard!");
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

    const handleChatMessage = () => {
      // Only increment unread count if chat is closed
      if (!chatOpen) {
        setUnreadMessages(prev => prev + 1);
      }
      // Play chat message sound
      playChatMessage();
    };

    const handleScenarioCardsToggled = ({ active }: { active: boolean }) => {
      setScenarioCardsActive(active);
    };

    const handleCardAttacked = ({ targetCardId }: { targetCardId: string }) => {
      const { addShakingCard, removeShakingCard } = useGameState.getState();
      
      // Start shaking animation
      addShakingCard(targetCardId);
      
      // Play damage sound effect
      playDamageSound();
      
      // Stop shaking after 2 seconds
      setTimeout(() => {
        removeShakingCard(targetCardId);
      }, 2000);
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
      
      {/* Game content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold text-white">MINKIARDS</h1>
            {gameId && gameId.startsWith('room-') && (
              <p className="text-white/80 text-sm mt-1">
                Stanza: {gameId.replace('room-', '')}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {/* First row: REGOLAMENTO and COMINCIA */}
            <div className="flex gap-2 justify-end">
              <Button
                onClick={() => window.open('https://minkiards.wixsite.com/minkiards/post/regolamento-ufficiale', '_blank')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                REGOLAMENTO
              </Button>
              <Button
                onClick={handleStartGame}
                className="bg-green-600 hover:bg-green-700 text-white font-bold"
              >
                COMINCIA
              </Button>
            </div>
            
            {/* Second row: INVITA AMICI and RICOMINCIA PARTITA */}
            <div className="flex gap-2 justify-end">
              <Button
                onClick={shareInviteLink}
                className="bg-sky-blue hover:bg-sky-blue/80 text-white font-bold"
              >
                INVITA AMICI
              </Button>
              <Button
                onClick={handleResetGame}
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                RICOMINCIA PARTITA
              </Button>
            </div>
          </div>
        </div>

        {/* Decks */}
        <div className="flex gap-4 mb-8 justify-center">
          <Deck
            name="PERSONAGGI"
            backImage="https://i.imgur.com/r1rfUAB.png"
            type="personaggi"
          />
          <Deck
            name="MOSSE"
            backImage="https://i.imgur.com/6MUXCZO.png"
            type="mosse"
          />
          <div className="flex flex-col items-center">
            <Deck
              name="BONUS"
              backImage="https://i.imgur.com/lEROr3r.png"
              type="bonus"
            />
            {/* ATTIVA SCENARI checkbox */}
            <div className="flex items-center space-x-2 mt-2">
              <Checkbox
                id="attiva-scenari"
                checked={scenarioCardsActive}
                onCheckedChange={(checked) => {
                  setScenarioCardsActive(checked as boolean);
                  socket.emit('toggle-scenario-cards', { 
                    gameId, 
                    active: checked as boolean 
                  });
                }}
              />
              <label
                htmlFor="attiva-scenari"
                className="text-sm font-medium text-white cursor-pointer select-none"
              >
                ATTIVA SCENARI
              </label>
            </div>
          </div>
          <Deck
            name="PERSONAGGI SPECIALI"
            backImage="https://i.imgur.com/ipVd57A.png"
            type="personaggi_speciali"
          />
        </div>

        {/* Player Hand */}
        <PlayerHand />

        {/* Game Field */}
        <GameField />

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
          className="fixed bottom-4 right-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-full p-3 z-60 shadow-lg hover:shadow-xl transition-all duration-200"
          style={{ position: 'fixed' }}
          title={isMuted ? "Enable sound" : "Disable sound"}
        >
          {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
        </Button>

        {/* Calculator Button */}
        <Button
          onClick={() => setCalculatorOpen(!calculatorOpen)}
          className="fixed bottom-20 right-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full p-3 z-60 shadow-lg hover:shadow-xl transition-all duration-200"
          style={{ position: 'fixed' }}
        >
          <CalcIcon size={24} />
        </Button>


        {/* DADO Button */}
        <Button
          onClick={() => {
            setDiceOpen(true);
            // Notify all players that the dice window is being opened
            socket.emit('open-dice-window', { gameId, playerName });
          }}
          className="fixed right-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-full p-3 z-60 shadow-lg hover:shadow-xl transition-all duration-200"
          style={{ position: 'fixed', bottom: '17rem' }}
        >
          <Dice6 size={24} />
        </Button>

        {/* CIMITERO Button */}
        <Button
          onClick={() => setGraveyardOpen(!graveyardOpen)}
          className="fixed bottom-52 right-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-full p-3 z-60 shadow-lg hover:shadow-xl transition-all duration-200"
          style={{ position: 'fixed' }}
        >
          <Skull size={24} />
        </Button>

        {/* Chat Button */}
        <Button
          onClick={() => {
            setChatOpen(!chatOpen);
            // Reset unread count when opening chat
            if (!chatOpen) {
              setUnreadMessages(0);
            }
          }}
          className="fixed bottom-36 right-2 bg-sky-blue hover:bg-sky-blue/80 text-white font-bold rounded-full p-3 relative z-60 shadow-lg hover:shadow-xl transition-all duration-200"
          style={{ position: 'fixed' }}
        >
          <MessageCircle size={24} />
          {/* Notification Badge */}
          {unreadMessages > 0 && !chatOpen && (
            <div className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center min-w-[24px] animate-pulse">
              {unreadMessages > 99 ? '99+' : unreadMessages}
            </div>
          )}
        </Button>


        {/* Calculator */}
        {calculatorOpen && (
          <div 
            className="fixed bottom-32 right-2 w-80 h-96 z-40 animate-in slide-in-from-right-5 fade-in duration-300"
            style={{ position: 'fixed' }}
          >
            <Calculator onClose={() => setCalculatorOpen(false)} />
          </div>
        )}

        {/* Chat */}
        {chatOpen && (
          <div 
            className="fixed bottom-52 right-2 w-80 h-96 z-40 animate-in slide-in-from-right-5 fade-in duration-300"
            style={{ position: 'fixed' }}
          >
            <Chat onClose={() => setChatOpen(false)} />
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


        {/* Add Cards and Leave Game Buttons - Bottom of page */}
        <div className="mt-16 mb-8 flex justify-center gap-4">
          <Button
            onClick={() => setAddCardsModalOpen(true)}
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg px-6 py-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-3"
          >
            <Plus size={24} />
            AGGIUNGI CARTE
          </Button>
          <Button
            onClick={handleLeaveGame}
            className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg px-6 py-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-3"
          >
            <X size={24} />
            LASCIA LA PARTITA
          </Button>
        </div>

        {/* Dice Modal */}
        <DiceModal 
          isOpen={diceOpen}
          onClose={() => setDiceOpen(false)}
          currentRoll={diceResult}
          playerWhoRolled={playerWhoRolled}
        />

        {/* Graveyard Milestone Notification */}
        <FullScreenNotification
          isVisible={notificationVisible}
          playerName={notificationPlayer}
          cardCount={notificationCardCount}
          title={notificationTitle}
          onClose={() => setNotificationVisible(false)}
        />
      </div>
    </div>
  );
};
