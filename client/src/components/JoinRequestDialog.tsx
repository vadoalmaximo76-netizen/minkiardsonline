import React, { useState, useEffect } from 'react';
import { UserPlus, X, Check } from 'lucide-react';
import { socket } from '../lib/socket';

interface JoinRequest {
  gameId: string;
  requesterName: string;
  requesterSocketId: string;
  requesterUserId?: number;
  requesterAvatarId?: string;
}

interface JoinRequestDialogProps {
  isCreator: boolean;
  gameId: string;
}

export function JoinRequestDialog({ isCreator, gameId }: JoinRequestDialogProps) {
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);

  useEffect(() => {
    if (!isCreator) return;

    const handleJoinRequest = (data: JoinRequest) => {
      if (data.gameId === gameId) {
        setPendingRequests(prev => {
          const exists = prev.some(r => r.requesterSocketId === data.requesterSocketId);
          if (exists) return prev;
          return [...prev, data];
        });
      }
    };

    socket.on('join-request-received', handleJoinRequest);

    return () => {
      socket.off('join-request-received', handleJoinRequest);
    };
  }, [isCreator, gameId]);

  const handleApprove = (request: JoinRequest) => {
    socket.emit('approve-join-request', {
      gameId: request.gameId,
      requesterSocketId: request.requesterSocketId,
      requesterName: request.requesterName,
      requesterUserId: request.requesterUserId,
      requesterAvatarId: request.requesterAvatarId
    });
    setPendingRequests(prev => prev.filter(r => r.requesterSocketId !== request.requesterSocketId));
  };

  const handleDeny = (request: JoinRequest) => {
    socket.emit('deny-join-request', {
      gameId: request.gameId,
      requesterSocketId: request.requesterSocketId,
      requesterName: request.requesterName
    });
    setPendingRequests(prev => prev.filter(r => r.requesterSocketId !== request.requesterSocketId));
  };

  if (!isCreator || pendingRequests.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 z-50 space-y-3">
      {pendingRequests.map((request) => (
        <div
          key={request.requesterSocketId}
          className="bg-gradient-to-r from-amber-900/90 to-orange-900/90 backdrop-blur-sm rounded-2xl p-4 border border-amber-500/30 shadow-2xl animate-slide-in-right max-w-sm"
        >
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <UserPlus className="w-6 h-6 text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-lg">Richiesta di accesso</h3>
              <p className="text-amber-200/80 text-sm">
                <span className="font-bold text-white">{request.requesterName}</span> vuole unirsi alla partita
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleApprove(request)}
                  className="flex items-center gap-1 px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded-xl font-medium transition-colors text-sm"
                >
                  <Check className="w-4 h-4" />
                  Accetta
                </button>
                <button
                  onClick={() => handleDeny(request)}
                  className="flex items-center gap-1 px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white rounded-xl font-medium transition-colors text-sm"
                >
                  <X className="w-4 h-4" />
                  Rifiuta
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
