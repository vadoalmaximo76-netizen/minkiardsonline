import React from 'react';
import { Lock, LogIn } from 'lucide-react';

interface GuestWallProps {
  onLogin: () => void;
  featureName?: string;
  inline?: boolean;
}

export function GuestWall({ onLogin, featureName, inline }: GuestWallProps) {
  const content = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: inline ? '32px 24px' : '0 24px',
        gap: 20,
        flex: inline ? undefined : 1,
        minHeight: inline ? undefined : '100%',
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'rgba(124,58,237,0.15)',
          border: '2px solid rgba(124,58,237,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Lock size={32} color="#a78bfa" />
      </div>

      <div style={{ textAlign: 'center', maxWidth: 300 }}>
        <h3
          style={{
            color: 'white',
            fontSize: 18,
            fontWeight: 800,
            margin: '0 0 8px',
          }}
        >
          Funzione Riservata
        </h3>
        <p style={{ color: 'rgba(148,163,184,0.8)', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
          Accedi con un account gratuito per usare{featureName ? ` ${featureName}` : ' questa funzione'}.
        </p>
      </div>

      <button
        onClick={onLogin}
        style={{
          background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
          border: 'none',
          borderRadius: 12,
          color: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 15,
          fontWeight: 700,
          padding: '12px 24px',
          boxShadow: '0 0 24px rgba(124,58,237,0.35)',
        }}
      >
        <LogIn size={18} />
        Accedi / Registrati
      </button>
    </div>
  );

  if (inline) {
    return content;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'linear-gradient(160deg, #0a0618, #080f1c)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {content}
    </div>
  );
}
