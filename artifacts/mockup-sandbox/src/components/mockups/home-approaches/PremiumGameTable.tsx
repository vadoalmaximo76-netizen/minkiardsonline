import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";

const DECK_THEMES = [
  { name: "PERSONAGGI", icon: "⚔️", color: "#3b82f6", glow: "rgba(59,130,246,0.7)", border: "rgba(96,165,250,0.8)", bg: "linear-gradient(135deg,rgba(29,78,216,0.9),rgba(30,64,175,0.95))", count: 48 },
  { name: "MOSSE", icon: "🔥", color: "#ef4444", glow: "rgba(239,68,68,0.7)", border: "rgba(252,165,165,0.8)", bg: "linear-gradient(135deg,rgba(185,28,28,0.9),rgba(153,27,27,0.95))", count: 34 },
  { name: "BONUS", icon: "💎", color: "#10b981", glow: "rgba(16,185,129,0.7)", border: "rgba(110,231,183,0.8)", bg: "linear-gradient(135deg,rgba(6,95,70,0.9),rgba(4,120,87,0.95))", count: 22 },
  { name: "SPECIALI", icon: "✨", color: "#f59e0b", glow: "rgba(245,158,11,0.7)", border: "rgba(252,211,77,0.8)", bg: "linear-gradient(135deg,rgba(120,53,15,0.9),rgba(146,64,14,0.95))", count: 15 },
];

const FAKE_PLAYERS = [
  { name: "Marco", online: true, deaths: 1, limit: 3, active: true, position: { x: 50, y: 12 } },
  { name: "Sofia", online: true, deaths: 2, limit: 3, active: false, position: { x: 18, y: 20 } },
  { name: "Luca", online: false, deaths: 0, limit: 3, active: false, position: { x: 82, y: 20 } },
];

const FAKE_FIELD_CARDS = [
  { id: "c1", name: "GUERRIERO", color: "#3b82f6", owner: "Marco", x: 50, y: 72 },
  { id: "c2", name: "MAGIA", color: "#ef4444", owner: "Tu", x: 38, y: 72 },
  { id: "c3", name: "SCUDO", color: "#10b981", owner: "Tu", x: 62, y: 72 },
];

const BOTTOM_PLAYER = { name: "Tu", online: true, deaths: 0, limit: 3, active: false };

export function PremiumGameTable() {
  const [isMyTurn, setIsMyTurn] = useState(true);
  const [activeTab, setActiveTab] = useState<"table" | "field">("table");

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans w-full max-w-[420px] mx-auto overflow-hidden relative flex flex-col select-none" style={{ fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        @keyframes goldPulse {
          0%, 100% { box-shadow: 0 0 16px rgba(251,191,36,0.4), 0 0 32px rgba(251,191,36,0.15); }
          50% { box-shadow: 0 0 28px rgba(251,191,36,0.7), 0 0 56px rgba(251,191,36,0.3); }
        }
        @keyframes turnPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(250,204,21,0.5), 0 0 40px rgba(250,204,21,0.2); border-color: rgba(251,191,36,1); }
          50% { box-shadow: 0 0 36px rgba(250,204,21,0.8), 0 0 60px rgba(250,204,21,0.35); border-color: rgba(253,224,71,1); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .gold-border { animation: goldPulse 3s ease-in-out infinite; }
        .turn-badge-mine { animation: turnPulse 1.5s ease-in-out infinite; }
        .online-dot { animation: glowPulse 2s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-center gap-2 px-4 pt-4 pb-3 z-10">
        <h2 className="font-black text-xl tracking-widest"
          style={{
            background: "linear-gradient(135deg, #e879f9 0%, #c084fc 40%, #f59e0b 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "none",
            filter: "drop-shadow(0 0 12px rgba(168,85,247,0.4))",
          }}>
          TAVOLO DA GIOCO
        </h2>

        {/* Turn Indicator */}
        <button
          onClick={() => setIsMyTurn(!isMyTurn)}
          className="px-4 py-1.5 rounded-2xl text-xs font-black whitespace-nowrap border-2 transition-all duration-300"
          style={{
            background: isMyTurn
              ? "linear-gradient(135deg, rgba(245,158,11,0.4), rgba(251,191,36,0.25))"
              : "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(139,92,246,0.2))",
            borderColor: isMyTurn ? "rgba(251,191,36,0.9)" : "rgba(96,165,250,0.5)",
            color: isMyTurn ? "#fef3c7" : "#bfdbfe",
            boxShadow: isMyTurn
              ? "0 0 20px rgba(250,204,21,0.5), 0 0 40px rgba(250,204,21,0.2)"
              : "0 0 12px rgba(96,165,250,0.25)",
            ...(isMyTurn ? { animation: "turnPulse 1.5s ease-in-out infinite" } : {}),
          }}
        >
          {isMyTurn ? "👑 TOCCA A TE!" : "⏳ Turno di Marco"}
        </button>
        <p className="w-full text-center text-[10px] text-white/40">Clicca sul badge per cambiare turno</p>
      </div>

      {/* Table Area */}
      <div
        className="relative mx-4 rounded-2xl overflow-hidden flex-shrink-0"
        style={{
          height: "360px",
          backgroundImage: "url('https://i.ibb.co/Y4bv4xwz/sfondo-minkiards.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderColor: "rgba(251,191,36,0.55)",
          borderWidth: "3px",
          borderStyle: "solid",
          boxShadow: "0 0 0 1px rgba(251,191,36,0.15), 0 0 40px rgba(147,51,234,0.5), 0 0 80px rgba(251,191,36,0.15), 0 8px 32px rgba(0,0,0,0.6)",
          animation: "goldPulse 3s ease-in-out infinite",
        }}
      >
        {/* Dark overlay 25% */}
        <div className="absolute inset-0 bg-black rounded-xl" style={{ opacity: 0.25 }} />

        {/* Decorative golden corners */}
        {[
          { top: 0, left: 0 },
          { top: 0, right: 0 },
          { bottom: 0, left: 0 },
          { bottom: 0, right: 0 },
        ].map((pos, i) => (
          <div key={i} className="absolute z-10 pointer-events-none w-10 h-10" style={pos}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              {i === 0 && <><path d="M3 37 L3 7 Q3 3 7 3 L37 3" stroke="rgba(251,191,36,0.8)" strokeWidth="2" fill="none" strokeLinecap="round"/><circle cx="3" cy="3" r="2.5" fill="rgba(251,191,36,0.9)"/></>}
              {i === 1 && <><path d="M37 37 L37 7 Q37 3 33 3 L3 3" stroke="rgba(251,191,36,0.8)" strokeWidth="2" fill="none" strokeLinecap="round"/><circle cx="37" cy="3" r="2.5" fill="rgba(251,191,36,0.9)"/></>}
              {i === 2 && <><path d="M3 3 L3 33 Q3 37 7 37 L37 37" stroke="rgba(251,191,36,0.8)" strokeWidth="2" fill="none" strokeLinecap="round"/><circle cx="3" cy="37" r="2.5" fill="rgba(251,191,36,0.9)"/></>}
              {i === 3 && <><path d="M37 3 L37 33 Q37 37 33 37 L3 37" stroke="rgba(251,191,36,0.8)" strokeWidth="2" fill="none" strokeLinecap="round"/><circle cx="37" cy="37" r="2.5" fill="rgba(251,191,36,0.9)"/></>}
            </svg>
          </div>
        ))}

        {/* Other Players badges */}
        {FAKE_PLAYERS.map((player) => (
          <div
            key={player.name}
            className="absolute z-20"
            style={{
              left: `${player.position.x}%`,
              top: `${player.position.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <span
              className="text-white font-bold px-2.5 py-1.5 rounded-full text-[10px] shadow-lg whitespace-nowrap inline-flex items-center gap-1.5"
              style={{
                background: player.active
                  ? "linear-gradient(135deg, rgba(34,197,94,0.85), rgba(21,128,61,0.9))"
                  : "linear-gradient(135deg, rgba(30,27,75,0.9), rgba(49,46,129,0.85))",
                border: player.active ? "2px solid rgba(74,222,128,0.8)" : "1px solid rgba(255,255,255,0.15)",
                boxShadow: player.active ? "0 0 12px rgba(74,222,128,0.5)" : "0 2px 8px rgba(0,0,0,0.5)",
              }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0 online-dot"
                style={{ background: player.online ? "#4ade80" : "#ef4444" }}
              />
              {player.name}
              <span
                className="text-[8px] font-bold px-1 py-0.5 rounded"
                style={{
                  background: player.deaths >= player.limit ? "rgba(220,38,38,0.8)" : "rgba(0,0,0,0.3)",
                  color: player.deaths >= player.limit ? "#fee2e2" : "rgba(255,255,255,0.7)",
                }}
              >
                💀{player.deaths}/{player.limit}
              </span>
            </span>
          </div>
        ))}

        {/* Center Decks */}
        <div
          className="absolute z-10"
          style={{
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* Magical halo */}
          <div
            className="absolute -inset-6 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at center, rgba(139,92,246,0.3) 0%, rgba(251,191,36,0.08) 55%, transparent 75%)",
              filter: "blur(6px)",
            }}
          />
          <div
            className="relative grid grid-cols-4 gap-1.5 items-start justify-center rounded-2xl p-2"
            style={{
              background: "linear-gradient(135deg, rgba(15,10,40,0.8), rgba(30,15,60,0.7))",
              border: "1px solid rgba(139,92,246,0.35)",
              boxShadow: "0 0 24px rgba(139,92,246,0.2), inset 0 0 16px rgba(0,0,0,0.3)",
            }}
          >
            {DECK_THEMES.map((deck) => (
              <div key={deck.name} className="flex flex-col items-center gap-1 w-14">
                <span
                  className="font-black text-[7px] leading-tight text-center w-full truncate"
                  style={{ color: deck.color, textShadow: `0 0 6px ${deck.glow}` }}
                >
                  {deck.icon} {deck.name.substring(0, 5)}
                </span>
                <div className="relative">
                  <div
                    className="w-10 h-14 rounded-md flex items-center justify-center text-xs font-bold"
                    style={{
                      background: deck.bg,
                      border: `1.5px solid ${deck.border}`,
                      boxShadow: `0 0 8px ${deck.glow}`,
                      color: "white",
                    }}
                  >
                    🂠
                  </div>
                  <div
                    className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black border border-white/20"
                    style={{ background: deck.bg, boxShadow: `0 0 6px ${deck.glow}`, color: "white" }}
                  >
                    {deck.count}
                  </div>
                </div>
                <button
                  className="text-[7px] font-bold w-full rounded-full px-1 py-0.5 transition-all hover:brightness-125"
                  style={{
                    background: deck.bg,
                    border: `1px solid ${deck.border}`,
                    color: "white",
                    boxShadow: `0 0 6px ${deck.glow}`,
                  }}
                >
                  SCEGLI
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Cards on field (fake) */}
        {FAKE_FIELD_CARDS.filter(c => c.owner !== "Tu").map((card) => (
          <div
            key={card.id}
            className="absolute z-5"
            style={{
              left: `${card.x}%`,
              top: "35%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <div
              className="w-10 h-14 rounded-md flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, rgba(30,27,75,0.9), rgba(49,46,129,0.85))`,
                border: `1.5px solid ${card.color}`,
                boxShadow: `0 0 6px ${card.color}40`,
              }}
            >
              <span className="text-[8px] font-bold text-white text-center leading-tight px-0.5">{card.name}</span>
            </div>
          </div>
        ))}

        {/* Current player's cards at bottom */}
        <div className="absolute bottom-10 left-0 right-0 flex items-center justify-center gap-2 z-10">
          {FAKE_FIELD_CARDS.filter(c => c.owner === "Tu").map((card, i) => (
            <div key={card.id} className="flex items-center gap-1">
              {/* Left arrow */}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer"
                style={{
                  background: i > 0 ? "linear-gradient(135deg,rgba(99,102,241,0.8),rgba(79,70,229,0.8))" : "rgba(30,30,50,0.4)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  boxShadow: i > 0 ? "0 0 8px rgba(99,102,241,0.4)" : "none",
                  opacity: i === 0 ? 0.25 : 1,
                }}
              >
                <ChevronLeft size={12} />
              </div>
              <div
                className="w-10 h-14 rounded-md flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, rgba(30,27,75,0.9), rgba(49,46,129,0.85))`,
                  border: `1.5px solid ${card.color}`,
                  boxShadow: `0 0 6px ${card.color}40`,
                }}
              >
                <span className="text-[8px] font-bold text-white text-center leading-tight px-0.5">{card.name}</span>
              </div>
              {/* Effect button */}
              {i === 0 && (
                <div
                  className="absolute mt-16 text-[7px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5"
                  style={{
                    background: "linear-gradient(135deg,rgba(147,51,234,0.9),rgba(109,40,217,0.95))",
                    border: "1px solid rgba(168,85,247,0.5)",
                    boxShadow: "0 0 12px rgba(168,85,247,0.6)",
                    color: "white",
                  }}
                >
                  <Zap size={8} />
                  Attiva Effetto
                </div>
              )}
              {/* Right arrow */}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer"
                style={{
                  background: i < FAKE_FIELD_CARDS.filter(c => c.owner === "Tu").length - 1
                    ? "linear-gradient(135deg,rgba(99,102,241,0.8),rgba(79,70,229,0.8))"
                    : "rgba(30,30,50,0.4)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  boxShadow: i < FAKE_FIELD_CARDS.filter(c => c.owner === "Tu").length - 1 ? "0 0 8px rgba(99,102,241,0.4)" : "none",
                  opacity: i >= FAKE_FIELD_CARDS.filter(c => c.owner === "Tu").length - 1 ? 0.25 : 1,
                }}
              >
                <ChevronRight size={12} />
              </div>
            </div>
          ))}
        </div>

        {/* Current player badge at very bottom */}
        <div className="absolute bottom-2 left-0 right-0 flex justify-center z-20">
          <span
            className="text-white font-bold px-3 py-1 rounded-full text-[10px] shadow-lg inline-flex items-center gap-1.5"
            style={{
              background: isMyTurn
                ? "linear-gradient(135deg,rgba(34,197,94,0.85),rgba(21,128,61,0.9))"
                : "linear-gradient(135deg,rgba(161,98,7,0.85),rgba(120,53,15,0.9))",
              border: isMyTurn ? "2px solid rgba(74,222,128,0.8)" : "1px solid rgba(251,191,36,0.4)",
              boxShadow: isMyTurn ? "0 0 14px rgba(74,222,128,0.5)" : "0 0 10px rgba(251,191,36,0.3)",
            }}
          >
            Tu (giocatore corrente)
          </span>
        </div>
      </div>

      {/* CARTE IN CAMPO section */}
      <div className="mx-4 mt-4 pb-6">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="h-px flex-1" style={{ background: "linear-gradient(to right, transparent, rgba(168,85,247,0.5))" }} />
          <h3
            className="font-black text-sm tracking-widest"
            style={{
              background: "linear-gradient(135deg, #c084fc 0%, #e879f9 50%, #f59e0b 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 8px rgba(168,85,247,0.4))",
            }}
          >
            CARTE IN CAMPO
          </h3>
          <div className="h-px flex-1" style={{ background: "linear-gradient(to left, transparent, rgba(168,85,247,0.5))" }} />
        </div>

        <div
          className="rounded-xl p-3"
          style={{
            background: "linear-gradient(135deg, rgba(15,10,40,0.85), rgba(20,15,55,0.8))",
            border: "1px solid rgba(99,102,241,0.3)",
            boxShadow: "0 0 24px rgba(79,70,229,0.15), inset 0 0 16px rgba(0,0,0,0.3)",
          }}
        >
          {/* Current player row */}
          <div
            className="mb-3 rounded-xl p-2.5"
            style={{
              background: "linear-gradient(135deg, rgba(161,98,7,0.3), rgba(120,53,15,0.2))",
              border: "1px solid rgba(251,191,36,0.25)",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-sm flex items-center gap-2" style={{ color: "#fbbf24", textShadow: "0 0 8px rgba(251,191,36,0.4)" }}>
                Tu <span className="text-[10px] font-normal text-yellow-300/70">(giocatore corrente)</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-black/30 text-white/70">💀0/3</span>
              </h4>
              <span className="text-white/50 text-xs bg-black/20 px-2 py-0.5 rounded-full">2 carte</span>
            </div>
            <div className="flex gap-2">
              {FAKE_FIELD_CARDS.filter(c => c.owner === "Tu").map((card, i) => (
                <div key={card.id} className="flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-0.5">
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center border border-white/15"
                      style={{
                        background: i !== 0 ? "linear-gradient(135deg,rgba(99,102,241,0.7),rgba(79,70,229,0.7))" : "rgba(30,30,50,0.4)",
                        opacity: i === 0 ? 0.25 : 1,
                      }}
                    >
                      <ChevronLeft size={8} />
                    </div>
                    <div
                      className="w-8 h-11 rounded-md flex items-center justify-center"
                      style={{
                        background: "linear-gradient(135deg,rgba(30,27,75,0.9),rgba(49,46,129,0.85))",
                        border: `1.5px solid ${card.color}`,
                        boxShadow: `0 0 5px ${card.color}40`,
                      }}
                    >
                      <span className="text-[6px] font-bold text-white text-center leading-tight px-0.5">{card.name}</span>
                    </div>
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center border border-white/15"
                      style={{
                        background: i < 1 ? "linear-gradient(135deg,rgba(99,102,241,0.7),rgba(79,70,229,0.7))" : "rgba(30,30,50,0.4)",
                        opacity: i >= 1 ? 0.25 : 1,
                      }}
                    >
                      <ChevronRight size={8} />
                    </div>
                  </div>
                  {i === 0 && (
                    <div
                      className="text-[6px] font-bold px-1 py-0.5 rounded-full flex items-center gap-0.5"
                      style={{
                        background: "linear-gradient(135deg,rgba(147,51,234,0.9),rgba(109,40,217,0.95))",
                        border: "1px solid rgba(168,85,247,0.4)",
                        boxShadow: "0 0 8px rgba(168,85,247,0.5)",
                        color: "white",
                      }}
                    >
                      <Zap size={6} />
                      Attiva
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Other player rows */}
          {FAKE_PLAYERS.slice(0, 2).map((player) => (
            <div
              key={player.name}
              className="mb-2 last:mb-0 rounded-xl p-2.5"
              style={{
                background: "linear-gradient(135deg, rgba(30,27,75,0.4), rgba(17,24,39,0.3))",
                border: player.active ? "1px solid rgba(74,222,128,0.4)" : "1px solid rgba(99,102,241,0.15)",
                boxShadow: player.active ? "0 0 10px rgba(74,222,128,0.15)" : "none",
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="font-bold text-xs flex items-center gap-1.5" style={{
                  color: player.active ? "#4ade80" : "#e2e8f0",
                  textShadow: player.active ? "0 0 10px rgba(74,222,128,0.5)" : "1px 1px 2px rgba(0,0,0,0.8)"
                }}>
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0 online-dot"
                    style={{ background: player.online ? "#4ade80" : "#ef4444" }}
                  />
                  {player.name}
                  {player.active && <span>🟢</span>}
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-black/30 text-white/70">
                    💀{player.deaths}/{player.limit}
                  </span>
                </h4>
                <span className="text-white/40 text-[10px] bg-black/20 px-1.5 py-0.5 rounded-full">1 carta</span>
              </div>
              <div
                className="w-8 h-11 rounded-md flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg,rgba(30,27,75,0.9),rgba(49,46,129,0.85))",
                  border: "1.5px solid rgba(96,165,250,0.6)",
                  boxShadow: "0 0 5px rgba(59,130,246,0.3)",
                }}
              >
                <span className="text-[6px] font-bold text-white text-center">CARTA</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
