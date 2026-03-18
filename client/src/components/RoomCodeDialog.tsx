import React, { useState } from "react";
import { Shuffle, Shield, Check, Clock, Lightbulb } from "lucide-react";

interface RoomCodeDialogProps {
  open: boolean;
  onSubmit: (roomCode: string, isDraftMode?: boolean, turnTimerSeconds?: number, helpEnabled?: boolean) => void;
}

type GameMode = 'classic' | 'draft';

const TIMER_OPTIONS = [
  { value: 15, label: '15s', desc: 'Veloce' },
  { value: 30, label: '30s', desc: 'Standard' },
  { value: 60, label: '60s', desc: 'Rilassato' },
  { value: 0, label: '∞', desc: 'Illimitato' },
];

export const RoomCodeDialog: React.FC<RoomCodeDialogProps> = ({ open, onSubmit }) => {
  const [roomCode, setRoomCode] = useState("");
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [turnTimer, setTurnTimer] = useState<number>(30);
  const [helpEnabled, setHelpEnabled] = useState(false);

  if (!open) return null;

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim()) {
      onSubmit(roomCode.trim().toUpperCase(), gameMode === 'draft', turnTimer, helpEnabled);
    }
  };

  const handleCreate = () => {
    const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    onSubmit(newRoomCode, gameMode === 'draft', turnTimer, helpEnabled);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-black/85 backdrop-blur-xl rounded-2xl p-6 max-w-md w-full border border-violet-500/30 shadow-[0_0_40px_rgba(124,58,237,0.25)] max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent mb-1">MINKIARDS</h2>
          <p className="text-violet-300/60 text-sm">Seleziona o crea una stanza di gioco</p>
        </div>

        {/* Modalità di gioco */}
        <div className="mb-5">
          <p className="text-cyan-400/70 text-xs font-semibold uppercase tracking-widest mb-3">Modalità di gioco</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setGameMode('classic')}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                gameMode === 'classic'
                  ? 'border-violet-500/60 bg-violet-900/30 text-white shadow-[0_0_15px_rgba(124,58,237,0.2)]'
                  : 'border-white/10 bg-white/5 text-white/60 hover:border-violet-500/30 hover:bg-violet-900/20'
              }`}
            >
              {gameMode === 'classic' && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center">
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
                  ? 'border-cyan-500/60 bg-cyan-900/30 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                  : 'border-white/10 bg-white/5 text-white/60 hover:border-cyan-500/30 hover:bg-cyan-900/20'
              }`}
            >
              {gameMode === 'draft' && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <Shuffle className="w-6 h-6" />
              <span className="font-bold text-sm">Draft</span>
              <span className="text-xs text-center opacity-70 leading-snug">Ogni giocatore usa il proprio mazzo personale</span>
            </button>
          </div>
          {gameMode === 'draft' && (
            <p className="text-cyan-400 text-xs mt-2 text-center">
              Assicurati di avere un mazzo completo salvato nella sezione Draft prima di giocare.
            </p>
          )}
        </div>

        {/* Timer configurabile */}
        <div className="mb-5">
          <p className="text-cyan-400/70 text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            Timer per turno
          </p>
          <div className="grid grid-cols-4 gap-2">
            {TIMER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTurnTimer(opt.value)}
                className={`flex flex-col items-center py-2 px-1 rounded-xl border-2 transition-all ${
                  turnTimer === opt.value
                    ? 'border-violet-500/60 bg-violet-900/30 text-white'
                    : 'border-white/10 bg-white/5 text-white/60 hover:border-violet-500/30 hover:bg-violet-900/20'
                }`}
              >
                <span className="font-bold text-sm">{opt.label}</span>
                <span className="text-xs opacity-70">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Aiuti */}
        <div className="mb-5">
          <button
            type="button"
            onClick={() => setHelpEnabled(v => !v)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
              helpEnabled
                ? 'border-violet-500/60 bg-violet-900/30 text-white'
                : 'border-white/10 bg-white/5 text-white/60 hover:border-violet-500/30 hover:bg-violet-900/20'
            }`}
          >
            <div className="flex items-center gap-3">
              <Lightbulb className={`w-5 h-5 ${helpEnabled ? 'text-violet-400' : ''}`} />
              <div className="text-left">
                <p className="font-bold text-sm">Aiuti (guida per principianti)</p>
                <p className="text-xs opacity-70">Suggerimenti AI durante la partita</p>
              </div>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${helpEnabled ? 'bg-violet-500' : 'bg-white/20'}`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${helpEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </button>
        </div>

        {/* Join room */}
        <form onSubmit={handleJoin} className="space-y-3">
          <div>
            <label htmlFor="roomCode" className="block text-violet-300/80 font-semibold text-sm mb-1.5">
              Codice Stanza
            </label>
            <input
              id="roomCode"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Inserisci il codice della stanza"
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-violet-500/20 text-violet-100 placeholder:text-violet-300/40 focus:outline-none focus:border-violet-400/60 transition-colors"
              maxLength={10}
            />
          </div>

          <div className="space-y-2">
            <button
              type="submit"
              disabled={!roomCode.trim()}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)]"
            >
              Entra nella Stanza
            </button>

            <div className="text-center text-violet-400/50 text-sm">oppure</div>

            <button
              type="button"
              onClick={handleCreate}
              className={`w-full py-3 font-bold rounded-xl transition-all text-white shadow-[0_0_15px_rgba(16,185,129,0.2)] ${
                gameMode === 'draft'
                  ? 'bg-gradient-to-r from-cyan-700 to-teal-700 hover:from-cyan-600 hover:to-teal-600'
                  : 'bg-gradient-to-r from-emerald-700 to-green-700 hover:from-emerald-600 hover:to-green-600'
              }`}
            >
              Crea Nuova Stanza{gameMode === 'draft' ? ' (Draft)' : ''}
            </button>
          </div>
        </form>

        <p className="mt-4 text-xs text-violet-400/40 text-center">
          Condividi il codice della stanza con i tuoi amici per giocare insieme
        </p>
      </div>
    </div>
  );
};
