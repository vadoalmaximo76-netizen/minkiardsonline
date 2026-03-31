import React, { useState, useMemo } from 'react';

interface CardInfo {
  id: string;
  name: string;
  frontImage: string;
}

interface KainokenOverlayProps {
  opponents: string[];
  deckContents: {
    bonus: CardInfo[];
    mosse: CardInfo[];
    personaggi: CardInfo[];
  };
  opponentHasType: { [opponentName: string]: { [deckKey: string]: boolean } };
  onConfirm: (assignments: { [deckKey: string]: { [opponentName: string]: string } }) => void;
  onCancel: () => void;
}

const DECK_LABELS: { key: 'bonus' | 'mosse' | 'personaggi'; label: string; color: string }[] = [
  { key: 'personaggi', label: 'PERSONAGGI', color: '#e74c3c' },
  { key: 'mosse',      label: 'MOSSE',      color: '#3498db' },
  { key: 'bonus',      label: 'BONUS',      color: '#f39c12' },
];

export default function KainokenOverlay({
  opponents,
  deckContents,
  opponentHasType,
  onConfirm,
  onCancel,
}: KainokenOverlayProps) {
  const [assignments, setAssignments] = useState<{ [deckKey: string]: { [opponentName: string]: string } }>({
    personaggi: {},
    mosse: {},
    bonus: {},
  });

  const getUsedCards = (deckKey: string, excludeOpponent?: string): Set<string> => {
    const used = new Set<string>();
    const deckAssign = assignments[deckKey] || {};
    for (const [opp, cardId] of Object.entries(deckAssign)) {
      if (opp !== excludeOpponent && cardId) used.add(cardId);
    }
    return used;
  };

  const setAssignment = (deckKey: string, opponentName: string, cardId: string) => {
    setAssignments(prev => ({
      ...prev,
      [deckKey]: { ...prev[deckKey], [opponentName]: cardId },
    }));
  };

  const isComplete = useMemo(() => {
    for (const { key } of DECK_LABELS) {
      const cards = deckContents[key];
      if (!cards || cards.length === 0) continue;
      for (const opp of opponents) {
        if (!opponentHasType[opp]?.[key]) continue;
        if (!assignments[key]?.[opp]) return false;
      }
    }
    return true;
  }, [assignments, opponents, deckContents, opponentHasType]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.88)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #0d0820 0%, #1a103a 100%)',
          border: '2px solid #e91e8c',
          borderRadius: '16px',
          padding: '20px',
          maxWidth: '620px',
          width: '100%',
          boxShadow: '0 0 50px rgba(233,30,140,0.4)',
          color: '#fff',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <h2
          style={{
            textAlign: 'center',
            fontSize: '22px',
            fontWeight: 900,
            color: '#ff6ec7',
            marginBottom: '4px',
            letterSpacing: '3px',
            textShadow: '0 0 20px rgba(233,30,140,0.6)',
          }}
        >
          🎴 KAINOKEN
        </h2>
        <p style={{ textAlign: 'center', color: '#c89ad0', fontSize: '12px', marginBottom: '18px' }}>
          Scegli quale carta del mazzo dare a ogni avversario (sostituisce una carta dello stesso tipo dalla sua mano)
        </p>

        {DECK_LABELS.map(({ key, label, color }) => {
          const cards = deckContents[key] || [];
          const relevantOpponents = opponents.filter(opp => opponentHasType[opp]?.[key]);
          if (cards.length === 0 || relevantOpponents.length === 0) return null;

          return (
            <div key={key} style={{ marginBottom: '18px' }}>
              <div
                style={{
                  fontWeight: 'bold',
                  fontSize: '13px',
                  color,
                  borderBottom: `1px solid ${color}55`,
                  paddingBottom: '6px',
                  marginBottom: '10px',
                  letterSpacing: '1px',
                }}
              >
                ▪ {label}
              </div>

              {relevantOpponents.map(opp => {
                const usedCards = getUsedCards(key, opp);
                const selectedCard = assignments[key]?.[opp] || '';
                const selectedInfo = cards.find(c => c.id === selectedCard);

                return (
                  <div
                    key={opp}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '10px',
                      padding: '8px 12px',
                      marginBottom: '8px',
                      border: `1px solid ${selectedCard ? color + '88' : 'rgba(255,255,255,0.1)'}`,
                    }}
                  >
                    {selectedInfo?.frontImage ? (
                      <img
                        src={selectedInfo.frontImage}
                        alt={selectedInfo.name}
                        style={{
                          width: '36px',
                          height: '50px',
                          objectFit: 'cover',
                          borderRadius: '5px',
                          border: `1px solid ${color}`,
                          flexShrink: 0,
                        }}
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '36px',
                          height: '50px',
                          background: 'rgba(255,255,255,0.08)',
                          borderRadius: '5px',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '18px',
                        }}
                      >
                        🎴
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: '#a080c0', marginBottom: '4px' }}>
                        → <span style={{ color: '#f0d0ff', fontWeight: 'bold' }}>{opp}</span>
                      </div>
                      <select
                        value={selectedCard}
                        onChange={e => setAssignment(key, opp, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          border: `1px solid ${color}66`,
                          background: '#0d0820',
                          color: '#f0e0ff',
                          fontSize: '12px',
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        <option value="">-- Scegli carta --</option>
                        {cards.map(c => {
                          const isUsed = usedCards.has(c.id);
                          return (
                            <option key={c.id} value={c.id} disabled={isUsed} style={{ color: isUsed ? '#666' : '#f0e0ff' }}>
                              {c.name || c.id}{isUsed ? ' (già assegnata)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        <div style={{ display: 'flex', gap: '12px', marginTop: '8px', justifyContent: 'center' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: '1px solid #555',
              background: 'rgba(255,255,255,0.07)',
              color: '#ccc',
              fontSize: '14px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Annulla
          </button>
          <button
            onClick={() => { if (isComplete) onConfirm(assignments); }}
            disabled={!isComplete}
            style={{
              padding: '10px 28px',
              borderRadius: '8px',
              border: 'none',
              background: isComplete
                ? 'linear-gradient(135deg, #e91e8c, #9c1260)'
                : '#444',
              color: '#fff',
              fontSize: '14px',
              cursor: isComplete ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
              boxShadow: isComplete ? '0 0 14px rgba(233,30,140,0.5)' : 'none',
            }}
          >
            Conferma KAINOKEN!
          </button>
        </div>
      </div>
    </div>
  );
}
