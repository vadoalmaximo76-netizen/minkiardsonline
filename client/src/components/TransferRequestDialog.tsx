import React, { useState, useEffect } from "react";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

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
      // Only show if this player is the recipient
      if (request.toPlayer === playerName) {
        setCurrentRequest(request);
        setIsOpen(true);
      }
    };

    const handleTransferError = ({ message }: { message: string }) => {
      console.error('Transfer error:', message);
      // Close dialog on error
      setIsOpen(false);
      setCurrentRequest(null);
    };

    const handleTransferAccepted = ({ message }: { message: string }) => {
      console.log('Transfer accepted:', message);
    };

    const handleTransferDeclined = ({ message }: { message: string }) => {
      console.log('Transfer declined:', message);
    };

    const handleTransferRequestSent = ({ message }: { message: string }) => {
      console.log('Transfer request sent:', message);
    };

    socket.on('transfer-request', handleTransferRequest);
    socket.on('transfer-error', handleTransferError);
    socket.on('transfer-accepted', handleTransferAccepted);
    socket.on('transfer-declined', handleTransferDeclined);
    socket.on('transfer-request-sent', handleTransferRequestSent);

    return () => {
      socket.off('transfer-request', handleTransferRequest);
      socket.off('transfer-error', handleTransferError);
      socket.off('transfer-accepted', handleTransferAccepted);
      socket.off('transfer-declined', handleTransferDeclined);
      socket.off('transfer-request-sent', handleTransferRequestSent);
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

  const handleClose = () => {
    // If user closes without choosing, treat as decline
    if (currentRequest) {
      socket.emit('decline-transfer', { requestId: currentRequest.id });
    }
    setIsOpen(false);
    setCurrentRequest(null);
  };

  if (!currentRequest) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-bold text-center">
            🔄 Richiesta di Trasferimento
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-base">
            <div className="space-y-2">
              <p className="font-semibold text-white">
                {currentRequest.fromPlayer}
              </p>
              <p>vuole trasferire una carta a te</p>
              <p className="text-sm text-gray-300">
                Vuoi accettare questo trasferimento?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex gap-2 justify-center">
          <AlertDialogCancel 
            onClick={handleDecline}
            className="bg-red-600 hover:bg-red-700 text-white border-red-600"
          >
            ❌ Rifiuta
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleAccept}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            ✅ Accetta
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};