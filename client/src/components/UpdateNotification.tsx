import React, { useState, useEffect } from 'react';
import { Download, X, Bell, RefreshCw } from 'lucide-react';
import { socket } from '../lib/socket';

interface UpdateNotificationProps {
  onUpdateApplied?: () => void;
}

interface CardUpdate {
  version: number;
  updatedAt?: string;
  note?: string;
  modifications: any[];
}

export function UpdateNotification({ onUpdateApplied }: UpdateNotificationProps) {
  const [updateAvailable, setUpdateAvailable] = useState<CardUpdate | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkForUpdate();

    const handleUpdateAvailable = (data: { version: number; note: string }) => {
      const currentVersion = parseInt(localStorage.getItem('minkiards_card_version') || '1');
      if (data.version > currentVersion) {
        fetchUpdate(data.version);
      }
    };

    socket.on('card-update-available', handleUpdateAvailable);

    const handleSwUpdated = () => {
      checkForUpdate();
    };
    window.addEventListener('swUpdated', handleSwUpdated);

    return () => {
      socket.off('card-update-available', handleUpdateAvailable);
      window.removeEventListener('swUpdated', handleSwUpdated);
    };
  }, []);

  const checkForUpdate = async () => {
    try {
      const res = await fetch('/api/card-version');
      if (res.ok) {
        const data = await res.json();
        const currentVersion = parseInt(localStorage.getItem('minkiards_card_version') || '1');
        
        if (data.version > currentVersion) {
          fetchUpdate(data.version);
        }
      }
    } catch (error) {
      console.log('[Update] Failed to check for updates');
    }
  };

  const fetchUpdate = async (version: number) => {
    try {
      const res = await fetch('/api/card-update');
      if (res.ok) {
        const data = await res.json();
        setUpdateAvailable(data);
        setDismissed(false);
      }
    } catch (error) {
      console.log('[Update] Failed to fetch update details');
    }
  };

  const applyUpdate = async () => {
    if (!updateAvailable) return;
    
    setIsDownloading(true);
    
    try {
      localStorage.setItem('minkiards_card_version', updateAvailable.version.toString());
      localStorage.setItem('minkiards_card_modifications', JSON.stringify(updateAvailable.modifications));
      localStorage.setItem('minkiards_update_date', new Date().toISOString());

      if ('caches' in window) {
        await caches.delete('minkiards-cards-v1');
      }

      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }

      setUpdateAvailable(null);
      onUpdateApplied?.();
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('[Update] Failed to apply update:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
      <div className="bg-gradient-to-br from-yellow-900/90 to-orange-900/90 backdrop-blur-sm rounded-xl p-4 shadow-2xl border border-yellow-500/30">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <Bell className="w-6 h-6 text-yellow-400" />
          </div>
          
          <div className="flex-1">
            <h3 className="font-bold text-white mb-1">
              Aggiornamento v{updateAvailable.version} disponibile!
            </h3>
            {updateAvailable.note && (
              <p className="text-sm text-yellow-200/80 mb-3">
                {updateAvailable.note}
              </p>
            )}
            
            <div className="flex gap-2">
              <button
                onClick={applyUpdate}
                disabled={isDownloading}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-yellow-800 rounded-lg text-sm font-medium transition-colors"
              >
                {isDownloading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Scaricamento...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Scarica ora
                  </>
                )}
              </button>
              
              <button
                onClick={() => setDismissed(true)}
                className="p-2 text-yellow-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
