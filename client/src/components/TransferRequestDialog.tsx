import React, { useState, useEffect } from "react";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";
import { ArrowLeftRight, Check, X } from "lucide-react";

interface TransferRequest {
  id: string;
  cardId: string;
  fromPlayer: string;
  toPlayer: string;
  message: string;
}

export const TransferRequestDialog: React.FC = () => {
  const [currentRequest, setCurrentRequest] = useState<TransferRequest | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { playerName } = useGameState();

  useEffect(() => {
    const handleTransferRequest = (request: TransferRequest) => {
      if (request.toPlayer === playerName) {
        setCurrentRequest(request);
        setIsOpen(true);
      }
    };

    const handleTransferError = ({ message }: { message: string }) => {
      console.error('Transfer error:', message);
      setIsOpen(false);
      setCurrentRequest(null);
    };

    socket.on('transfer-request', handleTransferRequest);
    socket.on('transfer-error', handleTransferError);
    socket.on('transfer-accepted', ({ message }: any) => console.log('Transfer accepted:', message));
    socket.on('transfer-declined', ({ message }: any) => console.log('Transfer declined:', message));
    socket.on('transfer-request-sent', ({ message }: any) => console.log('Transfer request sent:', message));

    return () => {
      socket.off('transfer-request', handleTransferRequest);
      socket.off('transfer-error', handleTransferError);
      socket.off('transfer-accepted');
      socket.off('transfer-declined');
      socket.off('transfer-request-sent');
    };
  }, [playerName]);

  const handleAccept = () => {
    if (currentRequest) {
      socket.emit('accept-transfer', { requestId: currentRequest.id });
      setIsOpen(false);
      setCurrentRequest(null);
    }
  };

  const handleDecline = () => {
    if (currentRequest) {
      socket.emit('decline-transfer', { requestId: currentRequest.id });
      setIsOpen(false);
      setCurrentRequest(null);
    }
  };

  if (!isOpen || !currentRequest) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black/85 backdrop-blur-xl border border-violet-500/30 rounded-2xl shadow-[0_0_40px_rgba(124,58,237,0.3)] w-full max-w-sm p-6">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-violet-400" />
          </div>
          <h2 className="text-lg font-black bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
            Richiesta di Trasferimento
          </h2>
        </div>

        {/* Content */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-5 text-center space-y-2">
          <p className="font-semibold text-white text-lg">
            {currentRequest.fromPlayer}
          </p>
          <p className="text-violet-300/70">vuole trasferire una carta a te</p>
          <p className="text-sm text-violet-400/60">
            Vuoi accettare questo trasferimento?
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleDecline}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-red-800 to-rose-900 hover:from-red-700 hover:to-rose-800 text-white font-bold rounded-xl transition-all border border-red-500/20"
          >
            <X className="w-4 h-4" />
            Rifiuta
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-700 to-green-700 hover:from-emerald-600 hover:to-green-600 text-white font-bold rounded-xl transition-all"
          >
            <Check className="w-4 h-4" />
            Accetta
          </button>
        </div>
      </div>
    </div>
  );
};
