import React, { useState } from "react";
import { Button } from "./ui/button";
import { Shuffle, Shield, Check } from "lucide-react";

interface RoomCodeDialogProps {
  open: boolean;
  onSubmit: (roomCode: string, isDraftMode?: boolean) => void;
}

type GameMode = 'classic' | 'draft';

export const RoomCodeDialog: React.FC<RoomCodeDialogProps> = ({ open, onSubmit }) => {
  const [roomCode, setRoomCode] = useState("");
  const [gameMode, setGameMode] = useState<GameMode>('classic');

  if (!open) return null;

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim()) {
      onSubmit(roomCode.trim().toUpperCase(), gameMode === 'draft');
    }
  };

  const handleCreate = () => {
    const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    onSubmit(newRoomCode, gameMode === 'draft');
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-white/10">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">MINKIARDS</h2>
          <p className="text-gray-400 text-sm">Seleziona o crea una stanza di gioco</p>
        </div>

        {/* Modalità di gioco */}
        <div className="mb-5">
          <p className="text-white/70 text-sm font-semibold mb-3">Modalità di gioco</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setGameMode('classic')}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                gameMode === 'classic'
                  ? 'border-blue-500 bg-blue-900/30 text-white'
                  : 'border-white/10 bg-white/5 text-white/60 hover:border-white/30 hover:bg-white/10'
              }`}
            >
              {gameMode === 'classic' && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <Shield className="w-6 h-6" />
              <span className="font-bold text-sm">Classica</span>
              <span className="text-xs text-center opacity-70 leading-snug">3 mazzi condivisi al centro del tavolo</span>
            </button>

            <button
              type="button"
              onClick={() => setGameMode('draft')}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                gameMode === 'draft'
                  ? 'border-teal-500 bg-teal-900/30 text-white'
                  : 'border-white/10 bg-white/5 text-white/60 hover:border-white/30 hover:bg-white/10'
              }`}
            >
              {gameMode === 'draft' && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <Shuffle className="w-6 h-6" />
              <span className="font-bold text-sm">Draft</span>
              <span className="text-xs text-center opacity-70 leading-snug">Ogni giocatore usa il proprio mazzo personale</span>
            </button>
          </div>
          {gameMode === 'draft' && (
            <p className="text-teal-400 text-xs mt-2 text-center">
              Assicurati di avere un mazzo completo salvato nella sezione Draft prima di giocare.
            </p>
          )}
        </div>

        {/* Join room */}
        <form onSubmit={handleJoin} className="space-y-3">
          <div>
            <label htmlFor="roomCode" className="block text-white/80 font-semibold text-sm mb-1.5">
              Codice Stanza
            </label>
            <input
              id="roomCode"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Inserisci il codice della stanza"
              className="w-full px-4 py-3 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-blue"
              maxLength={10}
            />
          </div>

          <div className="space-y-2">
            <Button
              type="submit"
              disabled={!roomCode.trim()}
              className="w-full bg-sky-blue hover:bg-sky-blue/80 text-white font-bold py-3"
            >
              Entra nella Stanza
            </Button>

            <div className="text-center text-gray-500 text-sm">oppure</div>

            <Button
              type="button"
              onClick={handleCreate}
              className={`w-full text-white font-bold py-3 ${
                gameMode === 'draft'
                  ? 'bg-teal-600 hover:bg-teal-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              Crea Nuova Stanza{gameMode === 'draft' ? ' (Draft)' : ''}
            </Button>
          </div>
        </form>

        <p className="mt-4 text-xs text-gray-500 text-center">
          Condividi il codice della stanza con i tuoi amici per giocare insieme
        </p>
      </div>
    </div>
  );
};
