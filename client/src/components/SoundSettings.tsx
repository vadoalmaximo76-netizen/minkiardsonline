import React from "react";
import { useAudio } from "../lib/stores/useAudio";
import { X, Volume2, VolumeX, Swords, Shield, Skull, Sparkles, Dice6, MessageCircle, Bell, Music } from "lucide-react";
import { Button } from "./ui/button";

interface SoundSettingsProps {
  onClose: () => void;
}

export const SoundSettings: React.FC<SoundSettingsProps> = ({ onClose }) => {
  const { soundSettings, setSoundSettings, isMuted, toggleMute } = useAudio();
  
  const categories = [
    { key: 'myTurn' as const, label: 'Il mio turno', icon: Bell, color: 'text-yellow-400' },
    { key: 'turnChange' as const, label: 'Cambio turno', icon: Music, color: 'text-orange-400' },
    { key: 'attack' as const, label: 'Attacchi', icon: Swords, color: 'text-red-400' },
    { key: 'defense' as const, label: 'Difese', icon: Shield, color: 'text-blue-400' },
    { key: 'death' as const, label: 'Morte personaggio', icon: Skull, color: 'text-purple-400' },
    { key: 'cardPlay' as const, label: 'Carte giocate', icon: Sparkles, color: 'text-green-400' },
    { key: 'bonus' as const, label: 'Bonus/Stelle/PTI', icon: Sparkles, color: 'text-cyan-400' },
    { key: 'dice' as const, label: 'Dado', icon: Dice6, color: 'text-amber-400' },
    { key: 'chat' as const, label: 'Messaggi chat', icon: MessageCircle, color: 'text-pink-400' },
  ];

  return (
    <div className="bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 rounded-xl border border-gray-600 shadow-2xl h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <Volume2 size={16} className="text-cyan-400" />
          Impostazioni Audio
        </h3>
        <Button onClick={onClose} variant="ghost" size="sm" className="text-gray-400 hover:text-white p-1">
          <X size={16} />
        </Button>
      </div>
      
      <div className="p-3 border-b border-gray-700">
        <button
          onClick={toggleMute}
          className={`w-full flex items-center justify-between p-2 rounded-lg transition-all ${
            isMuted ? 'bg-red-900/40 border border-red-700' : 'bg-green-900/40 border border-green-700'
          }`}
        >
          <span className="text-white font-semibold text-sm flex items-center gap-2">
            {isMuted ? <VolumeX size={18} className="text-red-400" /> : <Volume2 size={18} className="text-green-400" />}
            {isMuted ? 'Audio Disattivato' : 'Audio Attivo'}
          </span>
          <div className={`w-10 h-5 rounded-full relative transition-all ${isMuted ? 'bg-red-700' : 'bg-green-600'}`}>
            <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${isMuted ? 'left-0.5' : 'left-5'}`} />
          </div>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {categories.map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setSoundSettings({ [key]: !soundSettings[key] })}
            disabled={isMuted}
            className={`w-full flex items-center justify-between p-2 rounded-lg transition-all ${
              isMuted ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-700/50'
            } ${soundSettings[key] && !isMuted ? 'bg-gray-700/30' : ''}`}
          >
            <span className="flex items-center gap-2 text-sm">
              <Icon size={14} className={color} />
              <span className="text-gray-200">{label}</span>
            </span>
            <div className={`w-8 h-4 rounded-full relative transition-all ${
              soundSettings[key] && !isMuted ? 'bg-cyan-600' : 'bg-gray-600'
            }`}>
              <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all ${
                soundSettings[key] ? 'left-4' : 'left-0.5'
              }`} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
