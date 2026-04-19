import React, { useState, useEffect } from 'react';
import { X, Download, Share } from 'lucide-react';

const DISMISSED_KEY = 'pwa_install_dismissed';

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  return (
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIOS, setShowIOS] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    if (isIOS()) {
      setShowIOS(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowAndroid(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setShowAndroid(false);
    setShowIOS(false);
    setDeferredPrompt(null);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem(DISMISSED_KEY, '1');
        setShowAndroid(false);
        setDeferredPrompt(null);
      }
    } catch (err) {
      console.error('[PWA] Install prompt error:', err);
    } finally {
      setInstalling(false);
    }
  };

  if (!showAndroid && !showIOS) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9998,
        width: 'min(92vw, 380px)',
        background: 'linear-gradient(135deg, rgba(26,10,40,0.97), rgba(15,5,30,0.97))',
        border: '1px solid rgba(192,132,252,0.4)',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding: '14px 16px',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
      role="region"
      aria-label="Installa l'app"
    >
      <img
        src="/icons/icon-192x192.png"
        alt="MINKIARDS"
        style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 2 }}>
          Installa MINKIARDS
        </div>

        {showAndroid && (
          <>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, lineHeight: 1.4 }}>
              Aggiungi l'app alla schermata Home per giocare più velocemente, anche senza aprire il browser.
            </div>
            <button
              onClick={handleInstall}
              disabled={installing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '7px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: installing ? 'not-allowed' : 'pointer',
                opacity: installing ? 0.7 : 1,
              }}
            >
              <Download size={13} />
              {installing ? 'Installazione…' : 'Installa'}
            </button>
          </>
        )}

        {showIOS && (
          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
              <span>Tocca</span>
              <Share size={13} style={{ color: '#60a5fa', flexShrink: 0 }} />
              <span style={{ color: '#60a5fa', fontWeight: 600 }}>Condividi</span>
            </div>
            <div>poi scegli <strong style={{ color: '#e2e8f0' }}>"Aggiungi a schermata Home"</strong></div>
          </div>
        )}
      </div>

      <button
        onClick={handleDismiss}
        style={{
          background: 'none',
          border: 'none',
          color: '#64748b',
          cursor: 'pointer',
          padding: 2,
          flexShrink: 0,
          lineHeight: 1,
        }}
        aria-label="Chiudi"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default PWAInstallBanner;
