import React from 'react';
import { AddCardsModal } from './AddCardsModal';

interface CardAdminPanelProps {
  onBack: () => void;
}

// CardAdminPanel now directly opens AddCardsModal - identical to the "Aggiungi" button in-game
export function CardAdminPanel({ onBack }: CardAdminPanelProps) {
  return (
    <AddCardsModal 
      isOpen={true} 
      onClose={onBack} 
    />
  );
}
