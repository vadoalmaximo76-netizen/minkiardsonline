import React, { useState } from 'react';
import { AddCardsModal } from './AddCardsModal';
import { AdminTooltipsPanel } from './AdminTooltipsPanel';
import { Button } from './ui/button';
import { Info } from 'lucide-react';

interface CardAdminPanelProps {
  onBack: () => void;
}

export function CardAdminPanel({ onBack }: CardAdminPanelProps) {
  const [showTooltipsPanel, setShowTooltipsPanel] = useState(false);
  const authToken = localStorage.getItem('authToken');

  return (
    <>
      <div className="fixed top-4 right-4 z-[60]">
        <Button
          onClick={() => setShowTooltipsPanel(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white"
          size="sm"
        >
          <Info size={16} className="mr-1" /> Tooltip Contestuali
        </Button>
      </div>
      <AddCardsModal 
        isOpen={true} 
        onClose={onBack} 
      />
      {showTooltipsPanel && (
        <AdminTooltipsPanel 
          onClose={() => setShowTooltipsPanel(false)} 
          authToken={authToken} 
        />
      )}
    </>
  );
}