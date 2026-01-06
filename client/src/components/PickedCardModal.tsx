import React, { useEffect, useState } from "react";
import { useGameState } from "../lib/stores/useGameState";
import { useAudio } from "../lib/stores/useAudio";
import { X, Sparkles } from "lucide-react";

export const PickedCardModal: React.FC = () => {
  const { pickedCard, setPickedCard } = useGameState();
  const { playCardDraw } = useAudio();
  const [showModal, setShowModal] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);

  useEffect(() => {
    if (pickedCard) {
      setIsRevealing(true);
      setShowModal(true);
      playCardDraw();
      
      setTimeout(() => setIsRevealing(false), 800);
      
      const timer = setTimeout(() => {
        setShowModal(false);
        setPickedCard(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [pickedCard, setPickedCard, playCardDraw]);

  if (!showModal || !pickedCard) return null;

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'personaggi': return 'from-blue-500 to-blue-700';
      case 'mosse': return 'from-red-500 to-red-700';
      case 'bonus': return 'from-gray-400 to-gray-600';
      case 'personaggi_speciali': return 'from-yellow-500 to-yellow-700';
      default: return 'from-purple-500 to-purple-700';
    }
  };

  const getTypeBorder = (type: string) => {
    switch (type) {
      case 'personaggi': return 'border-blue-400';
      case 'mosse': return 'border-red-400';
      case 'bonus': return 'border-gray-400';
      case 'personaggi_speciali': return 'border-yellow-400';
      default: return 'border-purple-400';
    }
  };

  const getTypeGlow = (type: string) => {
    switch (type) {
      case 'personaggi': return 'shadow-[0_0_60px_rgba(59,130,246,0.5)]';
      case 'mosse': return 'shadow-[0_0_60px_rgba(239,68,68,0.5)]';
      case 'bonus': return 'shadow-[0_0_60px_rgba(161,161,170,0.4)]';
      case 'personaggi_speciali': return 'shadow-[0_0_60px_rgba(234,179,8,0.5)]';
      default: return 'shadow-[0_0_60px_rgba(147,51,234,0.5)]';
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[100]">
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
        onClick={() => {
          setShowModal(false);
          setPickedCard(null);
        }} 
      />
      
      <div className={`relative flex flex-col items-center gap-6 ${isRevealing ? 'animate-card-reveal' : ''}`}>
        <button
          onClick={() => {
            setShowModal(false);
            setPickedCard(null);
          }}
          className="absolute -top-2 -right-2 z-10 bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-full transition-colors shadow-lg"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 text-white">
          <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
          <span className="text-lg font-bold tracking-wide">CARTA PESCATA</span>
          <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
        </div>

        <div className={`relative ${isRevealing ? 'card-flip-reveal' : ''}`}>
          <img
            src={pickedCard.frontImage}
            alt="Carta pescata"
            className={`w-56 h-auto rounded-2xl border-4 ${getTypeBorder(pickedCard.type)} ${getTypeGlow(pickedCard.type)} object-cover transition-all duration-300`}
          />
          
          <div className={`absolute -inset-1 bg-gradient-to-r ${getTypeColor(pickedCard.type)} rounded-2xl opacity-30 blur-xl -z-10`} />
        </div>

        <div className={`px-4 py-2 rounded-full bg-gradient-to-r ${getTypeColor(pickedCard.type)} text-white font-bold text-sm uppercase tracking-wider shadow-lg`}>
          {pickedCard.type.replace('_', ' ')}
        </div>

        <p className="text-slate-400 text-xs">
          Tocca ovunque per chiudere
        </p>
      </div>
    </div>
  );
};
