import React, { useState, useEffect } from 'react';
import { socket } from '../lib/socket';
import { useGameState } from '../lib/stores/useGameState';
import { Button } from './ui/button';
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

  const timerColor = timeLeft > 8 ? 'text-green-400' : timeLeft > 4 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto bg-gray-900/95 border-2 border-yellow-500 rounded-xl p-5 max-w-sm w-full mx-4 shadow-2xl shadow-yellow-500/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-yellow-400" />
            <span className="font-bold text-yellow-400 text-sm uppercase tracking-wide">Intercettore Attacco</span>
          </div>
          <div className={`flex items-center gap-1 font-mono font-bold text-lg ${timerColor}`}>
            <Clock className="w-4 h-4" />
            {timeLeft}s
          </div>
        </div>

        <div className="bg-gray-800/60 rounded-lg p-3 mb-4 text-center">
          <p className="text-white text-sm">
            <span className="font-bold text-red-400">{data.attackerName}</span>
            {' '}sta attaccando{' '}
            <span className="font-bold text-blue-400">{data.targetOwnerName}</span>
          </p>
          <p className="text-gray-300 text-xs mt-1">
            Bersaglio: <span className="text-white font-semibold">{data.targetCardName}</span>
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Swords className="w-4 h-4 text-orange-400" />
            <span className="text-orange-400 font-bold text-lg">{data.damage} PTI</span>
            <span className="text-gray-400 text-xs">→ x2 se confermi</span>
          </div>
        </div>

        <div className="text-gray-400 text-xs text-center mb-3">
          Puoi intercettare questo attacco!
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={() => sendResponse('conferma')}
            disabled={isProcessing}
            className="bg-green-700 hover:bg-green-600 text-white text-xs py-2 px-1 flex flex-col items-center gap-1"
          >
            <Shield className="w-4 h-4" />
            <span>Conferma</span>
            <span className="text-green-300 text-xs">(x2 danno)</span>
          </Button>
          <Button
            onClick={() => sendResponse('ribalta')}
            disabled={isProcessing}
            className="bg-red-700 hover:bg-red-600 text-white text-xs py-2 px-1 flex flex-col items-center gap-1"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Ribalta</span>
            <span className="text-red-300 text-xs">(all'attacc.)</span>
          </Button>
          <Button
            onClick={() => sendResponse('ignora')}
            disabled={isProcessing}
            className="bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 px-1 flex flex-col items-center gap-1"
          >
            <X className="w-4 h-4" />
            <span>Ignora</span>
            <span className="text-gray-400 text-xs">(attacco norm.)</span>
          </Button>
        </div>

        <div className="mt-3 bg-gray-800/40 rounded p-2 text-center">
          <p className="text-gray-500 text-xs">
            Auto-ignora tra <span className={`font-bold ${timerColor}`}>{timeLeft}s</span>
          </p>
        </div>
      </div>
    </div>
  );
};
