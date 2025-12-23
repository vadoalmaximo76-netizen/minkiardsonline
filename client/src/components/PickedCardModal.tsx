import React, { useEffect, useState } from "react";
import { useGameState } from "../lib/stores/useGameState";
import { X } from "lucide-react";

export const PickedCardModal: React.FC = () => {
  const { pickedCard, setPickedCard } = useGameState();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (pickedCard) {
      setShowModal(true);
      // Auto-close after 3 seconds
      const timer = setTimeout(() => {
        setShowModal(false);
        setPickedCard(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [pickedCard, setPickedCard]);

  if (!showModal || !pickedCard) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[100]">
      {/* Semi-transparent background */}
      <div className="absolute inset-0 bg-black/30" onClick={() => {
        setShowModal(false);
        setPickedCard(null);
      }} />
      
      {/* Card container */}
      <div className="relative bg-gradient-to-b from-gray-900 to-gray-800 rounded-lg p-8 shadow-2xl border-2 border-yellow-500 max-w-sm w-full mx-4">
        <button
          onClick={() => {
            setShowModal(false);
            setPickedCard(null);
          }}
          className="absolute top-2 right-2 text-white hover:text-yellow-500 transition-colors"
        >
          <X size={24} />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-yellow-500 mb-2">Carta Pescata!</h2>
          <p className="text-gray-300 text-sm">Solo tu puoi vederla</p>
        </div>

        {/* Large card image */}
        <div className="flex justify-center mb-6">
          <img
            src={pickedCard.frontImage}
            alt="Carta pescata"
            className="w-64 h-96 rounded-lg shadow-lg object-cover border-2 border-yellow-500"
          />
        </div>

        {/* Card info */}
        <div className="text-center">
          <p className="text-white font-bold mb-2">
            Tipo: <span className="text-yellow-500">{pickedCard.type.toUpperCase()}</span>
          </p>
          {pickedCard.text && (
            <p className="text-gray-300 text-sm">
              Note: {pickedCard.text}
            </p>
          )}
        </div>

        {/* Close hint */}
        <p className="text-center text-gray-400 text-xs mt-4">
          Si chiuderà automaticamente tra pochi secondi...
        </p>
      </div>
    </div>
  );
};
