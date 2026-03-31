import React, { useState, useMemo } from 'react';

interface CardInfo {
  id: string;
  name: string;
  frontImage: string;
  deckKey: string;
}

interface KainokenOverlayProps {
  opponents: string[];
  allCards: CardInfo[];
  onConfirm: (assignments: { [opponentName: string]: string }) => void;
  onCancel: () => void;
}

const DECK_COLORS: Record<string, string> = {
  bonus: '#f39c12',
  mosse: '#3498db',
  personaggi: '#e74c3c',
  personaggi_speciali: '#9b59b6',
};

const DECK_LABELS: Record<string, string> = {
  bonus: 'BONUS',
  mosse: 'MOSSE',
  personaggi: 'PERSONAGGI',
  personaggi_speciali: 'SPEC',
};

export default function KainokenOverlay({
  opponents,
  allCards,
  onConfirm,
  onCancel,
}: KainokenOverlayProps) {
  const [activeOpponent, setActiveOpponent] = useState<string>(opponents[0] || '');
  const [assignments, setAssignments] = useState<{ [opponentName: string]: string }>({});

  const isComplete = useMemo(() => {
    return opponents.length > 0 && opponents.every(opp => !!assignments[opp]);
  }, [assignments, opponents]);

  const groupedCards = useMemo(() => {
    const groups: Record<string, CardInfo[]> = {};
    for (const card of allCards) {
      if (!groups[card.deckKey]) groups[card.deckKey] = [];
      groups[card.deckKey].push(card);
    }
    return groups;
  }, [allCards]);

  const usedCardIds = useMemo(() => {
    const used = new Set<string>();
    for (const [opp, cardId] of Object.entries(assignments)) {
      if (opp !== activeOpponent && cardId) used.add(cardId);
    }
    return used;
  }, [assignments, activeOpponent]);

  const selectedForActive = assignments[activeOpponent] || '';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.92)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #0d0820 0%, #1a103a 100%)',
          border: '2px solid #e91e8c',
          borderRadius: '16px',
          padding: '20px',
          width: '100%',
          maxWidth: '700px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 0 50px rgba(233,30,140,0.4)',
          color: '#fff',
        }}
      >
        {/* Title */}
        <h2
          style={{
            textAlign: 'center',
            fontSize: '22px',
            fontWeight: 900,
            color: '#ff6ec7',
            marginBottom: '4px',
            letterSpacing: '3px',
            textShadow: '0 0 20px rgba(233,30,140,0.6)',
            flexShrink: 0,
          }}
        >
          🎴 KAINOKEN
        </h2>
        <p style={{ textAlign: 'center', color: '#c89ad0', fontSize: '12px', marginBottom: '14px', flexShrink: 0 }}>
          Scegli 1 carta da dare a ogni avversario (sostituisce una carta dello stesso tipo nella sua mano)
        </p>

        {/* Opponent tabs */}
        {opponents.length > 1 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexShrink: 0 }}>
            {opponents.map(opp => {
              const hasSelection = !!assignments[opp];
              const isActive = opp === activeOpponent;
              return (
                <button
                  key={opp}
                  onClick={() => setActiveOpponent(opp)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: isActive ? '2px solid #e91e8c' : '1px solid rgba(255,255,255,0.15)',
                    background: isActive ? 'rgba(233,30,140,0.2)' : 'rgba(255,255,255,0.05)',
                    color: isActive ? '#ff6ec7' : '#a080c0',
                    fontSize: '13px',
                    fontWeight: isActive ? 'bold' : 'normal',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  {hasSelection ? '✅' : '○'} {opp}
                </button>
              );
            })}
          </div>
        )}

        {/* Current opponent label (single opponent) */}
        {opponents.length === 1 && (
          <div style={{ textAlign: 'center', color: '#f0d0ff', fontWeight: 'bold', fontSize: '14px', marginBottom: '12px', flexShrink: 0 }}>
            Avversario: <span style={{ color: '#ff6ec7' }}>{activeOpponent}</span>
          </div>
        )}

        {/* Selected card preview */}
        {selectedForActive && (() => {
          const sel = allCards.find(c => c.id === selectedForActive);
          return sel ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(233,30,140,0.15)',
                border: '1px solid #e91e8c88',
                borderRadius: '10px',
                padding: '8px 12px',
                marginBottom: '12px',
                flexShrink: 0,
              }}
            >
              {sel.frontImage && (
                <img
                  src={sel.frontImage}
                  alt={sel.name}
                  style={{ width: '36px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e91e8c' }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div>
                <div style={{ fontSize: '11px', color: '#c89ad0' }}>Carta selezionata per {activeOpponent}:</div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{sel.name || sel.id}</div>
                <div style={{ fontSize: '11px', color: DECK_COLORS[sel.deckKey] || '#aaa' }}>
                  {DECK_LABELS[sel.deckKey] || sel.deckKey}
                </div>
              </div>
              <button
                onClick={() => setAssignments(prev => { const n = { ...prev }; delete n[activeOpponent]; return n; })}
                style={{
                  marginLeft: 'auto',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid #555',
                  borderRadius: '6px',
                  color: '#ccc',
                  fontSize: '11px',
                  padding: '4px 10px',
                  cursor: 'pointer',
                }}
              >
                Cambia
              </button>
            </div>
          ) : null;
        })()}

        {/* Card grid by deck type */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {Object.entries(groupedCards).map(([deckKey, cards]) => (
            <div key={deckKey} style={{ marginBottom: '16px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: DECK_COLORS[deckKey] || '#aaa',
                  letterSpacing: '1px',
                  borderBottom: `1px solid ${DECK_COLORS[deckKey] || '#aaa'}44`,
                  paddingBottom: '4px',
                  marginBottom: '8px',
                }}
              >
                ▪ {DECK_LABELS[deckKey] || deckKey}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
                  gap: '6px',
                }}
              >
                {cards.map(card => {
                  const isSelected = selectedForActive === card.id;
                  const isUsed = usedCardIds.has(card.id);
                  return (
                    <div
                      key={card.id}
                      onClick={() => {
                        if (!isUsed) {
                          setAssignments(prev => ({ ...prev, [activeOpponent]: card.id }));
                        }
                      }}
                      title={card.name || card.id}
                      style={{
                        cursor: isUsed ? 'not-allowed' : 'pointer',
                        opacity: isUsed ? 0.35 : 1,
                        borderRadius: '6px',
                        border: isSelected
                          ? '2px solid #e91e8c'
                          : `1px solid ${DECK_COLORS[deckKey] || '#555'}44`,
                        boxShadow: isSelected ? '0 0 10px rgba(233,30,140,0.6)' : 'none',
                        background: isSelected ? 'rgba(233,30,140,0.15)' : 'rgba(255,255,255,0.04)',
                        overflow: 'hidden',
                        position: 'relative',
                        transition: 'box-shadow 0.15s, border-color 0.15s',
                      }}
                    >
                      {card.frontImage ? (
                        <img
                          src={card.frontImage}
                          alt={card.name}
                          draggable={false}
                          style={{
                            width: '100%',
                            aspectRatio: '2/3',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                          onError={e => {
                            const img = e.currentTarget as HTMLImageElement;
                            img.style.display = 'none';
                            const fallback = img.nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        style={{
                          display: card.frontImage ? 'none' : 'flex',
                          width: '100%',
                          aspectRatio: '2/3',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '22px',
                          background: 'rgba(255,255,255,0.05)',
                        }}
                      >
                        🎴
                      </div>
                      {isSelected && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '3px',
                            right: '3px',
                            background: '#e91e8c',
                            borderRadius: '50%',
                            width: '16px',
                            height: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                          }}
                        >
                          ✓
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: '9px',
                          color: '#ccc',
                          textAlign: 'center',
                          padding: '2px 3px',
                          background: 'rgba(0,0,0,0.7)',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {card.name || card.id}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {allCards.length === 0 && (
            <div style={{ textAlign: 'center', color: '#777', fontSize: '13px', padding: '20px' }}>
              Nessuna carta disponibile nei mazzi.
            </div>
          )}
        </div>

        {/* Progress summary */}
        <div style={{ flexShrink: 0, marginTop: '10px', marginBottom: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {opponents.map(opp => {
            const sel = allCards.find(c => c.id === assignments[opp]);
            return (
              <div
                key={opp}
                style={{
                  fontSize: '11px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: assignments[opp] ? 'rgba(46,204,113,0.2)' : 'rgba(255,255,255,0.07)',
                  border: `1px solid ${assignments[opp] ? '#2ecc71' : '#444'}`,
                  color: assignments[opp] ? '#2ecc71' : '#888',
                }}
              >
                {opp}: {sel ? (sel.name || sel.id) : '—'}
              </div>
            );
          })}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexShrink: 0 }}>
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
