import React, { useState, useEffect } from "react";
import { Deck } from "./Deck";
import { PlayerHand } from "./PlayerHand";
import { GameField } from "./GameField";
import { Graveyard } from "./Graveyard";
import { Chat } from "./Chat";
import { CardModal } from "./CardModal";
import { DiceModal } from "./DiceModal";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";
import { Button } from "./ui/button";
import { MessageCircle } from "lucide-react";

export const GameBoard: React.FC = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const [graveyardOpen, setGraveyardOpen] = useState(false);
  const [diceOpen, setDiceOpen] = useState(false);
  const [diceResult, setDiceResult] = useState<number | undefined>();
  const [playerWhoRolled, setPlayerWhoRolled] = useState<string | undefined>();
  const { selectedCard, gameId, playerName } = useGameState();

  const shareInviteLink = () => {
    const link = `${window.location.origin}?game=${gameId}`;
    navigator.clipboard.writeText(link);
    alert("Invitation link copied to clipboard!");
  };

  const handleResetGame = () => {
    if (confirm("Sei sicuro di voler ricominciare la partita? Tutte le carte verranno rimesse nei mazzi.")) {
      socket.emit('reset-game', { gameId });
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

    socket.on('game-reset', handleGameReset);
    socket.on('card-shown', handleCardShown);
    socket.on('card-show-confirmed', handleCardShowConfirmed);
    socket.on('dice-rolled', handleDiceRoll);
    socket.on('dice-window-opened', handleDiceWindowOpen);

    return () => {
      socket.off('game-reset', handleGameReset);
      socket.off('card-shown', handleCardShown);
      socket.off('card-show-confirmed', handleCardShowConfirmed);
      socket.off('dice-rolled', handleDiceRoll);
      socket.off('dice-window-opened', handleDiceWindowOpen);
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
            {/* First row: DADO and CIMITERO */}
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
          <Deck
            name="BONUS"
            backImage="https://i.imgur.com/lEROr3r.png"
            type="bonus"
          />
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

        {/* Chat Button */}
        <Button
          onClick={() => setChatOpen(!chatOpen)}
          className="fixed bottom-4 right-4 bg-sky-blue hover:bg-sky-blue/80 text-white font-bold rounded-full p-3"
        >
          <MessageCircle size={24} />
        </Button>

        {/* Chat */}
        {chatOpen && (
          <div className="fixed bottom-16 right-4 w-80 h-96">
            <Chat onClose={() => setChatOpen(false)} />
          </div>
        )}

        {/* Card Modal */}
        {selectedCard && <CardModal />}

        {/* Dice Modal */}
        <DiceModal 
          isOpen={diceOpen}
          onClose={() => setDiceOpen(false)}
          currentRoll={diceResult}
          playerWhoRolled={playerWhoRolled}
        />
      </div>
    </div>
  );
};
