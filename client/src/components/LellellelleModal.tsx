import { useState, useEffect, useRef } from "react";

interface RevealCard {
  cardIndex: number;
  totalCards: number;
  cardName: string;
  cardImage: string | null;
  damage: number;
  isSaveCard: boolean;
  targetOwner: string;
  isLast: boolean;
  saved: boolean;
}

interface LellellelleState {
  visible: boolean;
  targetOwner: string;
  attackerName: string;
  totalCards: number;
  saved: boolean | null;
  revealedCards: RevealCard[];
  finished: boolean;
}

interface Props {
  state: LellellelleState;
  onClose: () => void;
}

export function LellellelleModal({ state, onClose }: Props) {
  const [animatingIdx, setAnimatingIdx] = useState<number>(-1);
  const prevCount = useRef(0);

  useEffect(() => {
    if (state.revealedCards.length > prevCount.current) {
      setAnimatingIdx(state.revealedCards.length - 1);
      prevCount.current = state.revealedCards.length;
      const t = setTimeout(() => setAnimatingIdx(-1), 600);
      return () => clearTimeout(t);
    }
  }, [state.revealedCards.length]);

  useEffect(() => {
    if (state.finished) {
      const t = setTimeout(onClose, 4000);
      return () => clearTimeout(t);
    }
  }, [state.finished, onClose]);

  if (!state.visible) return null;

  const { targetOwner, attackerName, totalCards, revealedCards, finished, saved } = state;
  const pendingCount = totalCards - revealedCards.length;

  return (
    <div
      data-modal="lellelelle"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(4px)"
      }}
    >
      <div style={{
        background: "linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 60%, #1a0a2e 100%)",
        border: "2px solid #9b59b6",
        borderRadius: 20,
        padding: "28px 32px",
        maxWidth: 540,
        width: "90vw",
        boxShadow: "0 0 60px rgba(155,89,182,0.5)",
        textAlign: "center"
      }}>
        {/* Title */}
        <div style={{
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: 3,
          color: "#f39c12",
          marginBottom: 6,
          textShadow: "0 0 20px #f39c12",
          fontFamily: "monospace"
        }}>
          🎴 LELLELLELELLE!
        </div>
        <div style={{ color: "#bbb", fontSize: 14, marginBottom: 20 }}>
          <span style={{ color: "#e74c3c", fontWeight: 700 }}>{attackerName}</span>
          {" "}costringe{" "}
          <span style={{ color: "#3498db", fontWeight: 700 }}>{targetOwner}</span>
          {" "}a pescare le proprie MOSSE…
        </div>

        {/* Cards grid */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "center",
          marginBottom: 20,
          minHeight: 120
        }}>
          {revealedCards.map((card, idx) => (
            <div
              key={idx}
              style={{
                width: 90,
                borderRadius: 12,
                overflow: "hidden",
                border: card.isSaveCard
                  ? "3px solid #2ecc71"
                  : "2px solid #7f8c8d",
                boxShadow: card.isSaveCard
                  ? "0 0 20px #2ecc71"
                  : "0 2px 8px rgba(0,0,0,0.5)",
                background: "#111",
                transform: idx === animatingIdx ? "scale(1.12)" : "scale(1)",
                transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s",
                animation: idx === animatingIdx ? "ll-flip 0.4s ease-out" : "none"
              }}
            >
              {card.cardImage ? (
                <img
                  src={card.cardImage}
                  alt={card.cardName}
                  style={{ width: "100%", display: "block", borderRadius: "10px 10px 0 0" }}
                />
              ) : (
                <div style={{
                  height: 70,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#2c2c2c",
                  color: "#aaa",
                  fontSize: 11,
                  padding: 4
                }}>
                  {card.cardName}
                </div>
              )}
              <div style={{
                padding: "4px 6px",
                fontSize: 11,
                fontWeight: 700,
                color: card.isSaveCard ? "#2ecc71" : "#e74c3c",
                background: "rgba(0,0,0,0.6)",
                lineHeight: 1.3
              }}>
                <div style={{ color: "#fff", fontSize: 10, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {card.cardName}
                </div>
                <div>{card.damage} PTI {card.isSaveCard ? "✅" : ""}</div>
              </div>
            </div>
          ))}

          {/* Pending card slots */}
          {!finished && Array.from({ length: pendingCount }).map((_, idx) => (
            <div key={`pending-${idx}`} style={{
              width: 90,
              height: 120,
              borderRadius: 12,
              border: "2px dashed #555",
              background: "rgba(255,255,255,0.04)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#555",
              fontSize: 24
            }}>
              ?
            </div>
          ))}
        </div>

        {/* Result banner */}
        {finished && saved !== null && (
          <div style={{
            padding: "12px 20px",
            borderRadius: 12,
            background: saved
              ? "linear-gradient(90deg, rgba(39,174,96,0.25), rgba(46,204,113,0.15))"
              : "linear-gradient(90deg, rgba(231,76,60,0.25), rgba(192,57,43,0.15))",
            border: `2px solid ${saved ? "#2ecc71" : "#e74c3c"}`,
            color: saved ? "#2ecc71" : "#e74c3c",
            fontWeight: 900,
            fontSize: 18,
            letterSpacing: 1,
            textShadow: saved ? "0 0 12px #2ecc71" : "0 0 12px #e74c3c"
          }}>
            {saved
              ? `🛡️ ${targetOwner} è SALVO!`
              : `💀 ${targetOwner} scende a 5 PTI e 1 stella!`}
          </div>
        )}

        {/* Status message while drawing */}
        {!finished && (
          <div style={{
            color: "#f39c12",
            fontSize: 13,
            marginTop: 4,
            animation: "ll-pulse 1s ease-in-out infinite"
          }}>
            Pescando carte…
          </div>
        )}

        {/* Dismiss */}
        {finished && (
          <button
            data-modal-cancel
            onClick={onClose}
            style={{
              marginTop: 16,
              padding: "8px 24px",
              borderRadius: 20,
              border: "1px solid #555",
              background: "rgba(255,255,255,0.08)",
              color: "#ccc",
              cursor: "pointer",
              fontSize: 13
            }}
          >
            Chiudi
          </button>
        )}
      </div>

      <style>{`
        @keyframes ll-flip {
          0%   { transform: rotateY(90deg) scale(1.1); opacity: 0.3; }
          60%  { transform: rotateY(-10deg) scale(1.15); opacity: 1; }
          100% { transform: rotateY(0deg) scale(1); opacity: 1; }
        }
        @keyframes ll-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

export type { LellellelleState, RevealCard };
