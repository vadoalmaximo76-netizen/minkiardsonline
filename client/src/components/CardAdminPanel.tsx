import React, { useState } from 'react';
import { AddCardsModal } from './AddCardsModal';
import { AdminTooltipsPanel } from './AdminTooltipsPanel';
import { OcrReviewPanel } from './OcrReviewPanel';
import { Button } from './ui/button';
import { Info, Eye } from 'lucide-react';

interface CardAdminPanelProps {
  onBack: () => void;
}

export function CardAdminPanel({ onBack }: CardAdminPanelProps) {
  const [showTooltipsPanel, setShowTooltipsPanel] = useState(false);
  const [showOcrPanel, setShowOcrPanel] = useState(false);
  const authToken = localStorage.getItem('authToken');

  return (
    <>
      <div className="fixed top-4 right-4 z-[60] flex gap-2">
        <Button
          onClick={() => setShowOcrPanel(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
          size="sm"
        >
          <Eye size={16} className="mr-1" /> OCR BONUS
        </Button>
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
      {showOcrPanel && (
        <OcrReviewPanel
          onClose={() => setShowOcrPanel(false)}
        />
      )}
    </>
  );
}