import React, { useState } from "react";

const FIELD_CARDS = [
  { id: "f1", name: "Pelux", pti: 180, stars: 3, owner: "CPU" },
  { id: "f2", name: "Rambo", pti: 140, stars: 2, owner: "CPU" },
  { id: "f3", name: "Luca", pti: 220, stars: 4, owner: "Fake" },
  { id: "f4", name: "Pino", pti: 90, stars: 1, owner: "Fake" },
  { id: "f5", name: "Marco", pti: 160, stars: 3, owner: "Fake" },
];

const HAND = [
  { id: "h1", name: "Soros", type: "personaggi" },
  { id: "h2", name: "Furia", type: "mosse" },
  { id: "h3", name: "Scudo", type: "bonus" },
  { id: "h4", name: "Blast", type: "mosse" },
  { id: "h5", name: "Max", type: "personaggi" },
];

const TYPE_COLOR: Record<string, string> = {
  personaggi: "#7c3aed",
  mosse: "#1d4ed8",
  bonus: "#065f46",
};

function FieldCard({ name, pti, stars, owner, isMe }: { name: string; pti: number; stars: number; owner: string; isMe: boolean }) {
  return (
    <div
      className="relative rounded-xl flex flex-col items-center justify-between shadow-xl transition-all active:scale-95 cursor-pointer"
      style={{
        width: 64,
        height: 88,
        background: isMe
          ? "linear-gradient(160deg, #1a1a3a, #0f0f1a)"
          : "linear-gradient(160deg, #1a0a0a, #0f0808)",
        border: `1.5px solid ${isMe ? "rgba(139,92,246,0.5)" : "rgba(239,68,68,0.4)"}`,
        boxShadow: isMe ? "0 4px 16px rgba(139,92,246,0.25)" : "0 4px 16px rgba(239,68,68,0.15)",
        padding: "6px 4px",
      }}
    >
      <div className="text-[9px] font-bold text-center leading-tight w-full text-white/90 truncate">{name}</div>
      <div className="my-1 w-8 h-8 rounded-full flex items-center justify-center font-black text-xs" style={{ background: isMe ? "rgba(139,92,246,0.2)" : "rgba(239,68,68,0.2)", color: isMe ? "#c4b5fd" : "#fca5a5" }}>
        {pti}
      </div>
      <div className="text-yellow-300 text-[9px]">{"★".repeat(Math.min(stars, 5))}</div>
      <div
        className="absolute -top-1.5 left-1 text-[8px] font-bold px-1 py-px rounded-full"
        style={{ background: isMe ? "rgba(139,92,246,0.8)" : "rgba(239,68,68,0.8)", color: "#fff" }}
      >
        {owner}
      </div>
    </div>
  );
}

function HandCardMini({ name, type }: { name: string; type: string }) {
  const col = TYPE_COLOR[type] ?? "#334155";
  return (
    <div
      className="rounded-lg flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform shadow-md"
      style={{
        width: 48,
        height: 68,
        background: `linear-gradient(160deg, ${col}33, ${col}11)`,
        border: `1.5px solid ${col}88`,
        boxShadow: `0 2px 8px ${col}44`,
      }}
    >
      <div className="text-[8px] font-bold text-center text-white/80 leading-tight px-0.5 truncate w-full text-center">{name}</div>
      <div className="mt-1 text-[7px] font-bold uppercase" style={{ color: `${col}ff`, opacity: 0.8 }}>{type.slice(0, 4)}</div>
    </div>
  );
}

export function MinimalHUD() {
  const [showHand, setShowHand] = useState(true);
  const myTurn = true;

  return (
    <div
      className="relative w-full min-h-screen flex flex-col overflow-hidden font-sans select-none"
      style={{
        background: "#04050f",
        color: "#f1f5f9",
      }}
    >
      <style>{`
        @keyframes subtle-pulse {
          0%,100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes badge-glow {
          0%,100% { box-shadow: 0 0 8px 2px rgba(139,92,246,0.4); }
          50% { box-shadow: 0 0 16px 5px rgba(139,92,246,0.7); }
        }
        .subtle-pulse { animation: subtle-pulse 2s ease-in-out infinite; }
        .badge-glow { animation: badge-glow 2s ease-in-out infinite; }
      `}</style>

      {/* ── FULL-SCREEN GAME FIELD (background gradient simulation) ── */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: "radial-gradient(ellipse at 30% 40%, #1a0a2e 0%, #0a0520 40%, #040310 100%)",
        }}
      />
      <div className="absolute inset-0 z-0 opacity-30" style={{ backgroundImage: "radial-gradient(ellipse at 70% 60%, rgba(124,58,237,0.3) 0%, transparent 50%), radial-gradient(ellipse at 20% 20%, rgba(59,130,246,0.2) 0%, transparent 40%)" }} />
      <div
        className="absolute inset-0 z-0"
        style={{ background: "linear-gradient(180deg, rgba(4,5,15,0.5) 0%, rgba(4,5,15,0.3) 40%, rgba(4,5,15,0.7) 100%)" }}
      />

      {/* ── GHOST HEADER (barely visible, fades in on scroll) ── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 pt-safe pt-2 pb-1.5 z-40"
        style={{ background: "linear-gradient(to bottom, rgba(4,5,15,0.85), transparent)" }}
      >
        <div className="flex items-center gap-1.5">
          <button className="text-white/25 text-sm">←</button>
          <span className="text-white/30 text-xs font-mono">room-2QE57O</span>
        </div>
        <div
          className="px-2 py-0.5 rounded-full text-xs font-bold badge-glow"
          style={{
            background: myTurn ? "rgba(139,92,246,0.25)" : "rgba(59,130,246,0.2)",
            border: `1px solid ${myTurn ? "rgba(139,92,246,0.5)" : "rgba(99,102,241,0.4)"}`,
            color: myTurn ? "#c4b5fd" : "#a5b4fc",
          }}
        >
          {myTurn ? "👑 TUO TURNO" : "⏳ CPU..."}
        </div>
        <button className="text-white/25">⋯</button>
      </div>

      {/* ── FIELD AREA (takes up most of screen) ── */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-center px-4">
        {/* Opponent row (top) */}
        <div className="w-full flex justify-center gap-2 mb-4 opacity-80">
          {FIELD_CARDS.filter((c) => c.owner === "CPU").map((c) => (
            <FieldCard key={c.id} name={c.name} pti={c.pti} stars={c.stars} owner={c.owner} isMe={false} />
          ))}
        </div>

        {/* Center divider + decks */}
        <div className="relative w-full flex items-center justify-center my-2">
          <div className="absolute left-0 right-0 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)" }} />
          <div className="flex gap-2 z-10">
            {[
              { l: "PER", c: "#7c3aed" },
              { l: "MOS", c: "#1d4ed8" },
              { l: "BON", c: "#065f46" },
              { l: "SPE", c: "#b45309" },
            ].map((d) => (
              <div
                key={d.l}
                className="w-8 h-11 rounded-lg flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                style={{ background: `${d.c}55`, border: `1px solid ${d.c}88`, boxShadow: `0 0 8px ${d.c}44` }}
              >
                <span className="text-white/80 text-[9px] font-black">{d.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* My cards row (bottom field) */}
        <div className="w-full flex justify-center gap-2 mt-4">
          {FIELD_CARDS.filter((c) => c.owner === "Fake").map((c) => (
            <FieldCard key={c.id} name={c.name} pti={c.pti} stars={c.stars} owner={c.owner} isMe={true} />
          ))}
        </div>
      </div>

      {/* ── FLOATING PLAYER BADGES ── */}
      <div className="absolute top-16 left-4 z-40">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", backdropFilter: "blur(8px)" }}>
          <div className="w-2 h-2 rounded-full bg-green-400 subtle-pulse" />
          <span className="text-xs font-bold text-white/80">CPU Alessio</span>
          <span className="text-[10px] text-red-400">💀1/3</span>
        </div>
      </div>
      <div className="absolute bottom-48 left-4 z-40">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)", backdropFilter: "blur(8px)" }}>
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs font-bold text-white">Fake</span>
          <span className="text-[10px] text-purple-400">💀0/3</span>
        </div>
      </div>

      {/* ── HAND (collapsible, peek from bottom) ── */}
      <div
        className="flex-shrink-0 z-40 transition-all duration-300"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
      >
        {/* Hand toggle */}
        <button
          onClick={() => setShowHand((s) => !s)}
          className="w-full flex items-center justify-center gap-1 py-1.5 text-white/40 text-xs font-bold"
          style={{ background: "linear-gradient(to top, rgba(4,5,15,0.7), transparent)" }}
        >
          <span>{showHand ? "▼" : "▲"}</span>
          <span>MANO ({HAND.length})</span>
        </button>

        {showHand && (
          <div
            className="px-3 pb-3 pt-1"
            style={{ background: "rgba(4,5,15,0.85)", backdropFilter: "blur(16px)", borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {HAND.map((c) => (
                <div key={c.id} className="flex-shrink-0">
                  <HandCardMini name={c.name} type={c.type} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom action bar */}
        <div
          className="px-4 py-2 flex gap-2"
          style={{ background: "rgba(4,5,15,0.95)", backdropFilter: "blur(20px)" }}
        >
          <button
            className="flex-1 py-2.5 rounded-xl font-black text-sm active:scale-95 transition-transform"
            style={{
              background: myTurn ? "linear-gradient(to right, #7c3aed, #4f46e5)" : "rgba(20,20,40,0.8)",
              border: myTurn ? "1px solid rgba(139,92,246,0.5)" : "1px solid rgba(255,255,255,0.08)",
              color: myTurn ? "#fff" : "rgba(255,255,255,0.25)",
              boxShadow: myTurn ? "0 0 16px rgba(124,58,237,0.35)" : "none",
            }}
          >
            ✋ Pesca carta
          </button>
          <button
            className="py-2.5 px-4 rounded-xl font-black text-xs text-white/50 active:scale-95 transition-transform"
            style={{ background: "rgba(20,20,40,0.8)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            ⏭ Fine turno
          </button>
          <button
            className="py-2.5 px-3 rounded-xl text-white/40 active:scale-95 transition-transform"
            style={{ background: "rgba(20,20,40,0.8)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            💬
          </button>
        </div>
      </div>
    </div>
  );
}
