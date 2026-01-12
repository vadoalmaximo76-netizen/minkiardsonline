import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { socket } from '../lib/socket';

interface ConnectionState {
  connected: boolean;
  reconnecting?: boolean;
  reconnected?: boolean;
  attempt?: number;
  failed?: boolean;
  error?: string;
}

export const ConnectionStatus: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>({ connected: socket.connected });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleStatus = (event: CustomEvent<ConnectionState>) => {
      setConnectionState(event.detail);
      
      if (!event.detail.connected) {
        setIsVisible(true);
      } else if (event.detail.connected && !event.detail.reconnected) {
        setTimeout(() => setIsVisible(false), 2000);
      } else if (event.detail.reconnected) {
        setTimeout(() => setIsVisible(false), 3000);
      }
    };

    window.addEventListener('socket-status', handleStatus as EventListener);
    
    return () => {
      window.removeEventListener('socket-status', handleStatus as EventListener);
    };
  }, []);

  const handleReconnect = () => {
    socket.connect();
  };

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-[9999] p-3 transition-all duration-300 ${
        connectionState.connected 
          ? 'bg-green-600/95' 
          : connectionState.reconnecting 
            ? 'bg-amber-600/95' 
            : 'bg-red-600/95'
      }`}
    >
      <div className="flex items-center justify-center gap-3 text-white">
        {connectionState.connected ? (
          <>
            <Wifi className="w-5 h-5" />
            <span className="font-medium">Connesso!</span>
          </>
        ) : connectionState.reconnecting ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="font-medium">
              Riconnessione in corso... (tentativo {connectionState.attempt}/10)
            </span>
          </>
        ) : connectionState.failed ? (
          <>
            <WifiOff className="w-5 h-5" />
            <span className="font-medium">Connessione persa</span>
            <button
              onClick={handleReconnect}
              className="ml-3 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              Riprova
            </button>
          </>
        ) : (
          <>
            <WifiOff className="w-5 h-5" />
            <span className="font-medium">
              {connectionState.error ? `Errore: ${connectionState.error}` : 'Disconnesso'}
            </span>
            <button
              onClick={handleReconnect}
              className="ml-3 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              Riconnetti
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ConnectionStatus;
