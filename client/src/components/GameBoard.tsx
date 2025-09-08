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
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { MessageCircle, Calculator as CalcIcon } from "lucide-react";

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
  const { selectedCard, gameId, playerName } = useGameState();

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

  useEffect(() => {
    const handleGameReset = ({ message }: { message: string }) => {
      alert(message);
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
    };

    const handleScenarioCardsToggled = ({ active }: { active: boolean }) => {
      setScenarioCardsActive(active);
    };

    const handleCardAttacked = ({ targetCardId }: { targetCardId: string }) => {
      const { addShakingCard, removeShakingCard } = useGameState.getState();
      
      // Start shaking animation
      addShakingCard(targetCardId);
      
      // Stop shaking after 2 seconds
      setTimeout(() => {
        removeShakingCard(targetCardId);
      }, 2000);
    };

    const handleCardToGraveyard = ({ cardName }: { cardName: string }) => {
      setCiaoCardName(cardName);
      setCiaoNotificationVisible(true);
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        setCiaoNotificationVisible(false);
      }, 3000);
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
            {/* First row: DADO, CIMITERO, and REGOLAMENTO */}
            <div className="flex gap-2 justify-end">
              <Button
                onClick={() => {
                  setDiceOpen(true);
                  // Notify all players that the dice window is being opened
                  socket.emit('open-dice-window', { gameId, playerName });
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
              >
                DADO
              </Button>
              <Button
                onClick={() => setGraveyardOpen(!graveyardOpen)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
              >
                CIMITERO
              </Button>
              <Button
                onClick={() => window.open('https://minkiards.wixsite.com/minkiards/post/regolamento-ufficiale', '_blank')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                REGOLAMENTO
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

        {/* Calculator Button */}
        <Button
          onClick={() => setCalculatorOpen(!calculatorOpen)}
          className="fixed bottom-4 right-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full p-3 z-50 shadow-lg hover:shadow-xl transition-all duration-200"
          style={{ position: 'fixed' }}
        >
          <CalcIcon size={24} />
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
          className="fixed bottom-20 right-2 bg-sky-blue hover:bg-sky-blue/80 text-white font-bold rounded-full p-3 relative z-50 shadow-lg hover:shadow-xl transition-all duration-200"
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
            className="fixed bottom-16 right-2 w-80 h-96 z-40 animate-in slide-in-from-right-5 fade-in duration-300"
            style={{ position: 'fixed' }}
          >
            <Calculator onClose={() => setCalculatorOpen(false)} />
          </div>
        )}

        {/* Chat */}
        {chatOpen && (
          <div 
            className="fixed bottom-36 right-2 w-80 h-96 z-40 animate-in slide-in-from-right-5 fade-in duration-300"
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
