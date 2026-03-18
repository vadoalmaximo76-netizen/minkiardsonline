import React, { useState, useEffect } from 'react';
import { socket } from '../lib/socket';
import { useGameState } from '../lib/stores/useGameState';
import { Shield, Swords, RotateCcw, X, Clock } from 'lucide-react';

interface InterceptorData {
  attackId: string;
  interceptorPlayer: string;
  attackerName: string;
  targetOwnerName: string;
  damage: number;
  targetCardName: string;
}

export const AttackInterceptorPanel: React.FC = () => {
  const [data, setData] = useState<InterceptorData | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const [isProcessing, setIsProcessing] = useState(false);
  const { playerName } = useGameState();

  useEffect(() => {
    const handler = (payload: InterceptorData) => {
      if (payload.interceptorPlayer !== playerName) return;
      setData(payload);
      setTimeLeft(15);
      setIsProcessing(false);
    };
    socket.on('show-attack-interceptor-panel', handler);
    return () => { socket.off('show-attack-interceptor-panel', handler); };
  }, [playerName]);

  useEffect(() => {
    if (!data) return;
    if (timeLeft <= 0) {
      sendResponse('ignora');
      return;
    }
    const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [data, timeLeft]);

  const sendResponse = (choice: 'conferma' | 'ribalta' | 'ignora') => {
    if (!data || isProcessing) return;
    setIsProcessing(true);
    socket.emit('interceptor-response', {
      attackId: data.attackId,
      choice,
      playerName
    });
    setData(null);
  };

  if (!data) return null;

  const timerColor = timeLeft > 8 ? 'text-emerald-400' : timeLeft > 4 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto bg-black/85 backdrop-blur-xl border border-violet-500/40 rounded-2xl p-5 max-w-sm w-full mx-4 shadow-[0_0_40px_rgba(124,58,237,0.35)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            <span className="font-bold text-cyan-400 text-sm uppercase tracking-wide">Intercettore Attacco</span>
          </div>
          <div className={`flex items-center gap-1 font-mono font-bold text-lg ${timerColor}`}>
            <Clock className="w-4 h-4" />
            {timeLeft}s
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4 text-center">
          <p className="text-violet-100 text-sm">
            <span className="font-bold text-red-400">{data.attackerName}</span>
            {' '}sta attaccando{' '}
            <span className="font-bold text-cyan-400">{data.targetOwnerName}</span>
          </p>
          <p className="text-violet-300/60 text-xs mt-1">
            Bersaglio: <span className="text-white font-semibold">{data.targetCardName}</span>
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Swords className="w-4 h-4 text-orange-400" />
            <span className="text-orange-400 font-bold text-lg">{data.damage} PTI</span>
            <span className="text-violet-400/50 text-xs">→ x2 se confermi</span>
          </div>
        </div>

        <div className="text-violet-400/60 text-xs text-center mb-3">
          Puoi intercettare questo attacco!
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => sendResponse('conferma')}
            disabled={isProcessing}
            className="flex flex-col items-center gap-1 py-2 px-1 bg-gradient-to-b from-emerald-700 to-green-800 hover:from-emerald-600 hover:to-green-700 disabled:opacity-40 text-white text-xs rounded-xl transition-all border border-emerald-500/30"
          >
            <Shield className="w-4 h-4" />
            <span>Conferma</span>
            <span className="text-emerald-300 text-[10px]">(x2 danno)</span>
          </button>
          <button
            onClick={() => sendResponse('ribalta')}
            disabled={isProcessing}
            className="flex flex-col items-center gap-1 py-2 px-1 bg-gradient-to-b from-red-700 to-rose-800 hover:from-red-600 hover:to-rose-700 disabled:opacity-40 text-white text-xs rounded-xl transition-all border border-red-500/30"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Ribalta</span>
            <span className="text-red-300 text-[10px]">(all'attacc.)</span>
          </button>
          <button
            onClick={() => sendResponse('ignora')}
            disabled={isProcessing}
            className="flex flex-col items-center gap-1 py-2 px-1 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white text-xs rounded-xl transition-all border border-white/10"
          >
            <X className="w-4 h-4" />
            <span>Ignora</span>
            <span className="text-violet-400/50 text-[10px]">(attacco norm.)</span>
          </button>
        </div>

        <div className="mt-3 bg-white/5 rounded-xl p-2 text-center border border-white/5">
          <p className="text-violet-400/50 text-xs">
            Auto-ignora tra <span className={`font-bold ${timerColor}`}>{timeLeft}s</span>
          </p>
        </div>
      </div>
    </div>
  );
};
