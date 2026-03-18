import React, { useState } from "react";

const MOCK_OPPONENT = {
  name: "CPU Alessio",
  deaths: 1,
  maxDeaths: 3,
  handCount: 4,
  cards: [
    { id: "c1", name: "Pelux", pti: 180, stars: 3, online: true },
    { id: "c2", name: "Rambo", pti: 140, stars: 2, online: true },
  ],
};

const MOCK_ME = {
  name: "Fake",
  deaths: 0,
  maxDeaths: 3,
  handCount: 5,
  cards: [
    { id: "m1", name: "Luca", pti: 220, stars: 4 },
    { id: "m2", name: "Pino", pti: 90, stars: 1 },
    { id: "m3", name: "Marco", pti: 160, stars: 3 },
  ],
};

const DECKS = [
  { name: "PERS.", color: "#7c3aed", back: "https://i.imgur.com/r1rfUAB.png" },
  { name: "MOSSE", color: "#1d4ed8", back: "https://i.imgur.com/6MUXCZO.png" },
  { name: "BONUS", color: "#065f46", back: "https://i.imgur.com/lEROr3r.png" },
  { name: "SPEC.", color: "#b45309", back: "https://i.imgur.com/ipVd57A.png" },
];

function CardMock({ name, pti, stars, small = false }: { name: string; pti: number; stars: number; small?: boolean }) {
  const size = small ? "w-12 h-16" : "w-16 h-22";
  return (
    <div
      className={`${size} rounded-lg border-2 border-orange-400/60 flex flex-col items-center justify-between p-1 shadow-lg`}
      style={{
        background: "linear-gradient(160deg, #1a0a00, #2d1500)",
        boxShadow: "0 0 12px rgba(251,146,60,0.35), inset 0 0 6px rgba(251,146,60,0.1)",
      }}
    >
      <div className="text-[8px] text-orange-300 font-bold text-center leading-tight truncate w-full text-center">{name}</div>
      <div className="text-orange-400 font-black text-xs">{pti}</div>
      <div className="text-yellow-300 text-[8px]">{"★".repeat(stars)}</div>
    </div>
  );
}

function DeckBtn({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="flex flex-col items-center gap-0.5 cursor-pointer active:scale-95 transition-transform"
    >
      <div
        className="w-9 h-12 rounded-md border-2 flex items-center justify-center shadow-lg"
        style={{
          background: `linear-gradient(160deg, ${color}99, ${color}44)`,
          borderColor: `${color}cc`,
          boxShadow: `0 0 10px ${color}66`,
        }}
      >
        <span className="text-white/80 text-[8px] font-black leading-none text-center px-0.5">{name}</span>
      </div>
    </div>
  );
}

export function Arena() {
  const [myTurn] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  return (
    <div
      className="relative w-full min-h-screen flex flex-col overflow-hidden font-sans select-none"
      style={{
        background: "radial-gradient(ellipse at 50% 20%, #1a0a00 0%, #0a0005 50%, #000008 100%)",
        color: "#f1f5f9",
      }}
    >
      <style>{`
        @keyframes arena-glow {
          0%,100% { box-shadow: 0 0 20px 6px rgba(251,146,60,0.5), 0 0 40px 15px rgba(251,146,60,0.2); }
          50% { box-shadow: 0 0 35px 14px rgba(251,146,60,0.8), 0 0 70px 25px rgba(251,146,60,0.35); }
        }
        @keyframes enemy-glow {
          0%,100% { box-shadow: 0 0 15px 4px rgba(239,68,68,0.4); }
          50% { box-shadow: 0 0 28px 10px rgba(239,68,68,0.65); }
        }
        @keyframes energy-pulse {
          0%,100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
        @keyframes fire-flicker {
          0%,100% { transform: scaleY(1) scaleX(1); }
          33% { transform: scaleY(1.08) scaleX(0.95); }
          66% { transform: scaleY(0.94) scaleX(1.04); }
        }
        .arena-my-glow { animation: arena-glow 2s ease-in-out infinite; }
        .arena-enemy-glow { animation: enemy-glow 2.5s ease-in-out infinite; }
        .energy-pulse { animation: energy-pulse 1.5s ease-in-out infinite; }
        .fire-flicker { animation: fire-flicker 0.6s ease-in-out infinite; }
      `}</style>

      {/* Background energy lines */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1/2" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.12) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 left-0 right-0 h-1/2" style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(251,146,60,0.12) 0%, transparent 70%)" }} />
        {/* Diagonal energy beams */}
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 energy-pulse"
            style={{
              left: `${10 + i * 20}%`,
              width: 1,
              background: `linear-gradient(to bottom, transparent 0%, rgba(251,146,60,0.${2 + i}) 40%, rgba(251,146,60,0.${2 + i}) 60%, transparent 100%)`,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>

      {/* ── HEADER ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-safe pt-3 pb-2 z-30" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center font-black text-sm shadow-lg" style={{ boxShadow: "0 0 10px rgba(239,68,68,0.5)" }}>M</div>
          <span className="font-black text-sm text-white">MINKIARDS</span>
          <span className="text-xs text-white/30 font-mono">room-2QE57O</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-orange-300 font-black">1,276 ⭐</span>
          <div className="w-6 h-6 rounded-full bg-orange-900/60 border border-orange-500/40 flex items-center justify-center text-orange-300">≡</div>
        </div>
      </div>

      {/* ── TURN BANNER ── */}
      <div
        className="flex-shrink-0 mx-4 mt-2 mb-2 py-1.5 rounded-xl text-center font-black text-sm z-30"
        style={{
          background: myTurn
            ? "linear-gradient(90deg, rgba(251,146,60,0.3), rgba(239,68,68,0.25), rgba(251,146,60,0.3))"
            : "linear-gradient(90deg, rgba(59,130,246,0.25), rgba(139,92,246,0.2), rgba(59,130,246,0.25))",
          border: myTurn ? "1px solid rgba(251,146,60,0.5)" : "1px solid rgba(99,102,241,0.4)",
          boxShadow: myTurn ? "0 0 20px rgba(251,146,60,0.2)" : "none",
          color: myTurn ? "#fed7aa" : "#c7d2fe",
          textShadow: myTurn ? "0 0 12px rgba(251,146,60,0.8)" : "none",
        }}
      >
        {myTurn ? "🔥 TOCCA A TE — Attacca!" : "⏳ Turno di CPU Alessio..."}
      </div>

      {/* ── OPPONENT ZONE ── */}
      <div className="flex-shrink-0 px-4 pb-2 z-20">
        <div
          className="rounded-2xl p-3 border"
          style={{
            background: "linear-gradient(135deg, rgba(127,0,0,0.35), rgba(80,0,30,0.25))",
            borderColor: "rgba(239,68,68,0.4)",
            boxShadow: "0 0 20px rgba(239,68,68,0.15)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-full border-2 border-red-500/70 flex items-center justify-center text-sm font-black bg-red-900/60 arena-enemy-glow"
              >
                🤖
              </div>
              <div>
                <div className="text-white font-black text-sm leading-none">{MOCK_OPPONENT.name}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  {[...Array(MOCK_OPPONENT.maxDeaths)].map((_, i) => (
                    <span key={i} style={{ fontSize: 10, opacity: i < MOCK_OPPONENT.deaths ? 1 : 0.25 }}>💀</span>
                  ))}
                  <span className="text-red-400 text-[10px] font-bold ml-1">{MOCK_OPPONENT.handCount} in mano</span>
                </div>
              </div>
            </div>
            <div
              className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5" }}
            >
              NEMICO
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {MOCK_OPPONENT.cards.map((c) => (
              <CardMock key={c.id} name={c.name} pti={c.pti} stars={c.stars} small />
            ))}
            <div className="w-12 h-16 rounded-lg border border-red-500/20 flex items-center justify-center text-red-500/40 text-xs font-bold" style={{ background: "rgba(239,68,68,0.05)" }}>
              +2
            </div>
          </div>
        </div>
      </div>

      {/* ── BATTLEFIELD CENTER ── */}
      <div
        className="flex-1 mx-4 rounded-2xl relative overflow-hidden z-10 flex flex-col"
        style={{
          background: "linear-gradient(180deg, rgba(40,0,0,0.6) 0%, rgba(10,0,0,0.8) 100%)",
          border: "2px solid rgba(251,146,60,0.25)",
          boxShadow: "inset 0 0 40px rgba(251,146,60,0.05)",
          minHeight: 160,
        }}
      >
        {/* Center divider line */}
        <div className="absolute left-4 right-4 top-1/2 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(251,146,60,0.5), rgba(239,68,68,0.5), transparent)" }} />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative flex items-center justify-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center font-black text-2xl fire-flicker"
              style={{ background: "radial-gradient(ellipse, rgba(251,146,60,0.2), transparent)", border: "1px solid rgba(251,146,60,0.3)" }}
            >
              ⚔️
            </div>
          </div>
        </div>

        {/* Decks in center */}
        <div className="absolute bottom-3 right-3 flex gap-1.5">
          {DECKS.map((d) => (
            <DeckBtn key={d.name} name={d.name} color={d.color} />
          ))}
        </div>

        {/* Field label */}
        <div className="absolute top-2 left-3 text-[10px] font-bold" style={{ color: "rgba(251,146,60,0.5)" }}>CAMPO DA GIOCO</div>
      </div>

      {/* ── MY ZONE ── */}
      <div className="flex-shrink-0 px-4 pt-2 z-20">
        <div
          className="rounded-2xl p-3 border"
          style={{
            background: "linear-gradient(135deg, rgba(30,20,0,0.6), rgba(60,30,0,0.4))",
            borderColor: "rgba(251,146,60,0.5)",
            boxShadow: "0 0 24px rgba(251,146,60,0.15)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-full border-2 border-orange-400/80 flex items-center justify-center text-sm font-black bg-orange-900/60 arena-my-glow"
              >
                F
              </div>
              <div>
                <div className="text-white font-black text-sm leading-none">{MOCK_ME.name} <span className="text-orange-300 text-xs">(Tu)</span></div>
                <div className="flex items-center gap-1 mt-0.5">
                  {[...Array(MOCK_ME.maxDeaths)].map((_, i) => (
                    <span key={i} style={{ fontSize: 10, opacity: i < MOCK_ME.deaths ? 1 : 0.25 }}>💀</span>
                  ))}
                  <span className="text-orange-400 text-[10px] font-bold ml-1">{MOCK_ME.handCount} in mano</span>
                </div>
              </div>
            </div>
            <div
              className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: "rgba(251,146,60,0.25)", border: "1px solid rgba(251,146,60,0.5)", color: "#fed7aa" }}
            >
              TU
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {MOCK_ME.cards.map((c) => (
              <CardMock key={c.id} name={c.name} pti={c.pti} stars={c.stars} small />
            ))}
          </div>
        </div>
      </div>

      {/* ── BOTTOM ACTION BAR ── */}
      <div
        className="flex-shrink-0 px-4 pt-2 pb-safe pb-4 z-30 mt-2"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)" }}
      >
        <div className="flex items-center gap-2">
          <button
            className="flex-1 py-3 rounded-xl font-black text-sm transition-all active:scale-95"
            style={{
              background: myTurn ? "linear-gradient(to right, #ea580c, #dc2626)" : "rgba(30,30,50,0.8)",
              border: myTurn ? "1px solid rgba(251,146,60,0.6)" : "1px solid rgba(255,255,255,0.1)",
              color: myTurn ? "#fff" : "rgba(255,255,255,0.3)",
              boxShadow: myTurn ? "0 0 20px rgba(234,88,12,0.4)" : "none",
            }}
          >
            ✋ Pesca carta
          </button>
          <button
            className="py-3 px-4 rounded-xl font-black text-sm transition-all active:scale-95"
            style={{
              background: "rgba(15,10,30,0.8)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            ⏭ Passa
          </button>
          <button
            className="py-3 px-3 rounded-xl transition-all active:scale-95"
            style={{
              background: "rgba(15,10,30,0.8)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            💬
          </button>
          <button
            className="py-3 px-3 rounded-xl transition-all active:scale-95"
            style={{
              background: "rgba(15,10,30,0.8)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            ⚙️
          </button>
        </div>
      </div>
    </div>
  );
}
