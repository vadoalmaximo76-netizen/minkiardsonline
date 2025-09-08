import React, { useState } from "react";
import { Button } from "./ui/button";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";

interface CardProps {
  card: {
    id: string;
    type: string;
    frontImage: string;
    backImage: string;
    owner: string;
    text?: string;
  };
  location: 'hand' | 'field' | 'graveyard';
  showBack?: boolean;
}

export const Card: React.FC<CardProps> = ({ card, location, showBack = false }) => {
  const [cardText, setCardText] = useState(card.text || "");
  const [showActions, setShowActions] = useState(false);
  const { setSelectedCard, playerName } = useGameState();

  const handleCardClick = () => {
    if (location === 'field' || location === 'graveyard') {
      setShowActions(!showActions);
    } else {
      setSelectedCard(card);
    }
  };

  const handlePlay = () => {
    socket.emit('play-card', { cardId: card.id, playerName });
  };

  const handleReturnToHand = () => {
    socket.emit('return-to-hand', { cardId: card.id, playerName });
  };

  const handleReturnToDeck = () => {
    socket.emit('return-to-deck', { cardId: card.id, playerName });
  };

  const handleMoveToGraveyard = () => {
    socket.emit('move-to-graveyard', { cardId: card.id, playerName });
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setCardText(newText);
    socket.emit('update-card-text', { cardId: card.id, text: newText });
  };

  const isOwner = card.owner === playerName;

  return (
    <div className="flex flex-col gap-2">
      {/* Card Image */}
      <div className="relative">
        <img
          src={showBack ? card.backImage : card.frontImage}
          alt="Card"
          className="w-20 h-28 rounded-lg cursor-pointer hover:scale-105 transition-transform shadow-lg"
          onClick={handleCardClick}
        />
        
        {location === 'field' && (
          <div className="absolute -top-2 left-0 bg-black/70 text-white px-2 py-1 rounded text-xs">
            {card.owner}
          </div>
        )}
      </div>

      {/* Card Text */}
      <textarea
        value={cardText}
        onChange={handleTextChange}
        placeholder="Add note..."
        className="w-20 h-10 text-xs p-1 rounded resize-none"
        disabled={!isOwner && location === 'hand'}
      />

      {/* Action Buttons */}
      {location === 'hand' && isOwner && (
        <Button
          onClick={handlePlay}
          className="bg-sky-blue hover:bg-sky-blue/80 text-white font-bold text-xs px-2 py-1"
          size="sm"
        >
          GIOCA
        </Button>
      )}

      {(location === 'field' || location === 'graveyard') && showActions && (
        <div className="flex flex-wrap gap-1">
          {isOwner && (
            <>
              <Button
                onClick={handleReturnToHand}
                className="bg-sky-blue hover:bg-sky-blue/80 text-white font-bold text-xs px-1 py-1"
                size="sm"
              >
                RIMETTI IN MANO
              </Button>
              <Button
                onClick={handleReturnToDeck}
                className="bg-sky-blue hover:bg-sky-blue/80 text-white font-bold text-xs px-1 py-1"
                size="sm"
              >
                RIMETTI NEL MAZZO
              </Button>
              {location === 'field' && (
                <Button
                  onClick={handleMoveToGraveyard}
                  className="bg-sky-blue hover:bg-sky-blue/80 text-white font-bold text-xs px-1 py-1"
                  size="sm"
                >
                  METTI NEL CIMITERO
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
