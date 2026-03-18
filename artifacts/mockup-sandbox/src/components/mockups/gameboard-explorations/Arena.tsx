import React, { useState } from "react";

const FIELD_CARDS_CPU = [
  { id: "c1", name: "Pelux", pti: 180, stars: 3 },
  { id: "c2", name: "Rambo", pti: 140, stars: 2 },
];

const FIELD_CARDS_ME = [
  { id: "m1", name: "Luca", pti: 220, stars: 4 },
  { id: "m2", name: "Pino", pti: 90, stars: 1 },
  { id: "m3", name: "Marco", pti: 160, stars: 3 },
];

const HAND_CARDS = [
  { id: "h1", name: "Soros", type: "personaggi" },
  { id: "h2", name: "Furia", type: "mosse" },
  { id: "h3", name: "Scudo", type: "bonus" },
  { id: "h4", name: "Blast", type: "mosse" },
  { id: "h5", name: "Max", type: "personaggi" },
];

function ArenaCard({ name, pti, stars, enemy = false, large = false }: { name: string; pti: number; stars: number; enemy?: boolean; large?: boolean }) {
  const neon = enemy ? "#f87171" : "#fb923c";
  const neonDim = enemy ? "#7f1d1d" : "#431407";
  const w = large ? 68 : 56;
  const h = large ? 96 : 78;
  return (
    <div
      className="relative rounded-xl flex flex-col items-center justify-between cursor-pointer active:scale-95 transition-transform shadow-xl"
      style={{
        width: w,
        height: h,
        background: `linear-gradient(160deg, ${neonDim}, #050005)`,
        border: `2px solid ${neon}88`,
        boxShadow: `0 0 14px ${neon}55, inset 0 0 8px ${neon}11`,
        padding: large ? "7px 5px" : "5px 4px",
      }}
    >
      {/* Top brackets */}
      <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 rounded-tl-sm" style={{ borderColor: neon }} />
      <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 rounded-tr-sm" style={{ borderColor: neon }} />
      {/* Bottom brackets */}
      <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 rounded-bl-sm" style={{ borderColor: neon }} />
      <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 rounded-br-sm" style={{ borderColor: neon }} />

      <div className="text-[9px] font-black text-center leading-tight truncate w-full z-10 mt-1" style={{ color: neon, textShadow: `0 0 6px ${neon}` }}>{name}</div>
      <div
        className="rounded-full flex items-center justify-center font-black z-10"
        style={{
          width: large ? 38 : 28,
          height: large ? 38 : 28,
          background: `${neon}22`,
          border: `1.5px solid ${neon}88`,
          color: neon,
          fontSize: large ? 13 : 11,
          boxShadow: `0 0 10px ${neon}66`,
          textShadow: `0 0 6px ${neon}`,
        }}
      >
        {pti}
      </div>
      <div className="text-yellow-300 z-10 mb-1" style={{ fontSize: large ? 10 : 9, textShadow: "0 0 6px rgba(253,224,71,0.7)" }}>{"★".repeat(Math.min(stars, 5))}</div>
    </div>
  );
}

function HandCard({ name, type }: { name: string; type: string }) {
  const typeColors: Record<string, string> = {
    personaggi: "#fb923c",
    mosse: "#60a5fa",
    bonus: "#34d399",
  };
  const col = typeColors[type] ?? "#fb923c";
  return (
    <div
      className="flex-shrink-0 rounded-xl flex flex-col items-center justify-between cursor-pointer active:scale-95 transition-transform shadow-lg"
      style={{
        width: 50,
        height: 70,
        background: `linear-gradient(160deg, ${col}15, #050005)`,
        border: `1.5px solid ${col}66`,
        boxShadow: `0 0 10px ${col}44`,
        padding: "5px 3px",
      }}
    >
      <div className="text-[8px] font-black text-center leading-tight truncate w-full" style={{ color: col }}>{name}</div>
      <div
        className="rounded-full flex items-center justify-center"
        style={{ width: 22, height: 22, background: `${col}22`, border: `1px solid ${col}66` }}
      >
        <div className="w-2 h-2 rounded-full" style={{ background: col, boxShadow: `0 0 5px ${col}` }} />
      </div>
      <div className="text-[7px] font-bold uppercase" style={{ color: `${col}88` }}>{type.slice(0, 4)}</div>
    </div>
  );
}

export function Arena() {
  const [myTurn] = useState(true);

  return (
    <div
      className="relative w-full min-h-screen flex flex-col overflow-hidden font-sans select-none"
      style={{ background: "radial-gradient(ellipse at 50% 20%, #1a0300 0%, #0a0005 55%, #020008 100%)", color: "#f1f5f9" }}
    >
      <style>{`
        @keyframes arena-my-glow {
          0%,100% { box-shadow: 0 0 20px 6px rgba(251,146,60,0.5), 0 0 40px 15px rgba(251,146,60,0.2); }
          50% { box-shadow: 0 0 35px 14px rgba(251,146,60,0.8), 0 0 70px 25px rgba(251,146,60,0.35); }
        }
        @keyframes arena-enemy-glow {
          0%,100% { box-shadow: 0 0 15px 4px rgba(239,68,68,0.4); }
          50% { box-shadow: 0 0 28px 10px rgba(239,68,68,0.65); }
        }
        @keyframes energy-line {
          0%,100% { opacity: 0.15; }
          50% { opacity: 0.45; }
        }
        @keyframes vs-pulse {
          0%,100% { transform: translate(-50%,-50%) scale(1); box-shadow: 0 0 20px rgba(251,146,60,0.4), 0 0 40px rgba(239,68,68,0.2); }
          50% { transform: translate(-50%,-50%) scale(1.07); box-shadow: 0 0 35px rgba(251,146,60,0.7), 0 0 60px rgba(239,68,68,0.4); }
        }
        .arena-my-glow { animation: arena-my-glow 2s ease-in-out infinite; }
        .arena-enemy-glow { animation: arena-enemy-glow 2.5s ease-in-out infinite; }
        .energy-line { animation: energy-line 1.5s ease-in-out infinite; }
        .vs-pulse { animation: vs-pulse 1.8s ease-in-out infinite; }
      `}</style>

      {/* Background energy rays */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2/5" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.1) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 left-0 right-0 h-2/5" style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(251,146,60,0.1) 0%, transparent 70%)" }} />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="absolute top-0 bottom-0 energy-line" style={{ left: `${8 + i * 17}%`, width: 1, background: `linear-gradient(to bottom, transparent 0%, rgba(251,146,60,0.4) 40%, rgba(251,146,60,0.4) 60%, transparent 100%)`, animationDelay: `${i * 0.25}s` }} />
        ))}
      </div>

      {/* ── HEADER ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-safe pt-3 pb-2 z-30" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(251,146,60,0.15)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center font-black text-sm" style={{ boxShadow: "0 0 10px rgba(239,68,68,0.5)" }}>M</div>
          <span className="font-black text-sm text-white">MINKIARDS</span>
          <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>room-2QE57O</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black" style={{ color: "#fb923c" }}>1,276 ⭐</span>
          <button className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(251,146,60,0.15)", border: "1px solid rgba(251,146,60,0.3)", color: "#fb923c" }}>≡</button>
        </div>
      </div>

      {/* ── TURN BANNER ── */}
      <div
        className="flex-shrink-0 mx-4 mt-2 py-1.5 rounded-xl text-center font-black text-sm z-30"
        style={{
          background: myTurn
            ? "linear-gradient(90deg, rgba(251,146,60,0.3), rgba(239,68,68,0.25), rgba(251,146,60,0.3))"
            : "linear-gradient(90deg, rgba(99,102,241,0.25), rgba(139,92,246,0.2))",
          border: myTurn ? "1px solid rgba(251,146,60,0.5)" : "1px solid rgba(99,102,241,0.4)",
          boxShadow: myTurn ? "0 0 20px rgba(251,146,60,0.2)" : "none",
          color: myTurn ? "#fed7aa" : "#c7d2fe",
          textShadow: myTurn ? "0 0 12px rgba(251,146,60,0.8)" : "none",
        }}
      >
        {myTurn ? "🔥 TOCCA A TE — Attacca!" : "⏳ Turno di CPU Alessio..."}
      </div>

      {/* ── OPPONENT ZONE ── */}
      <div className="flex-shrink-0 px-4 pt-2 pb-1 z-20">
        <div className="rounded-2xl p-3 border" style={{ background: "linear-gradient(135deg, rgba(100,0,0,0.35), rgba(60,0,20,0.2))", borderColor: "rgba(239,68,68,0.35)", boxShadow: "0 0 20px rgba(239,68,68,0.1)" }}>
          {/* Opponent header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full border-2 border-red-500/70 flex items-center justify-center text-sm font-black bg-red-900/60 arena-enemy-glow">🤖</div>
              <div>
                <div className="text-white font-black text-sm leading-none">CPU Alessio</div>
                <div className="flex items-center gap-1 mt-0.5">
                  {[...Array(3)].map((_, i) => <span key={i} style={{ fontSize: 9, opacity: i < 1 ? 1 : 0.25 }}>💀</span>)}
                  <span className="text-red-400 text-[10px] font-bold ml-1">4 in mano</span>
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5" }}>NEMICO</span>
          </div>
          {/* Opponent's large field cards */}
          <div className="flex gap-2 flex-wrap justify-center">
            {FIELD_CARDS_CPU.map((c) => (
              <ArenaCard key={c.id} name={c.name} pti={c.pti} stars={c.stars} enemy large />
            ))}
            <div className="rounded-xl flex items-center justify-center" style={{ width: 68, height: 96, background: "rgba(239,68,68,0.05)", border: "2px dashed rgba(239,68,68,0.2)" }}>
              <span className="text-red-500/30 text-2xl">+</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CENTRAL BATTLE AREA ── */}
      <div className="flex-shrink-0 px-4 py-1 z-10 relative flex items-center justify-center" style={{ minHeight: 60 }}>
        {/* Horizontal divider */}
        <div className="absolute left-4 right-4 h-px top-1/2" style={{ background: "linear-gradient(to right, transparent, rgba(251,146,60,0.5), rgba(239,68,68,0.5), transparent)" }} />
        {/* VS badge */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center font-black text-base z-10 vs-pulse"
          style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.25), rgba(251,146,60,0.2))", border: "2px solid rgba(251,146,60,0.5)", color: "#fb923c", textShadow: "0 0 12px rgba(251,146,60,0.8)", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
        >
          ⚔️
        </div>
        {/* Deck piles (left-aligned in center row) */}
        <div className="flex gap-1.5 ml-auto">
          {[{ l: "PER", c: "#7c3aed" }, { l: "MOS", c: "#1d4ed8" }, { l: "BON", c: "#065f46" }, { l: "SPC", c: "#b45309" }].map((d) => (
            <div key={d.l} className="rounded-lg flex items-center justify-center cursor-pointer active:scale-95 transition-transform" style={{ width: 34, height: 46, background: `${d.c}44`, border: `1px solid ${d.c}88`, boxShadow: `0 0 8px ${d.c}44` }}>
              <span className="text-white/70 text-[7px] font-black text-center">{d.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── MY ZONE ── */}
      <div className="flex-shrink-0 px-4 pt-1 pb-1 z-20">
        <div className="rounded-2xl p-3 border" style={{ background: "linear-gradient(135deg, rgba(30,15,0,0.6), rgba(60,25,0,0.4))", borderColor: "rgba(251,146,60,0.5)", boxShadow: "0 0 24px rgba(251,146,60,0.15)" }}>
          {/* My header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full border-2 border-orange-400/80 flex items-center justify-center text-sm font-black bg-orange-900/60 arena-my-glow">F</div>
              <div>
                <div className="text-white font-black text-sm leading-none">Fake <span className="text-orange-300 text-xs">(Tu)</span></div>
                <div className="flex items-center gap-1 mt-0.5">
                  {[...Array(3)].map((_, i) => <span key={i} style={{ fontSize: 9, opacity: 0.25 }}>💀</span>)}
                  <span className="text-orange-400 text-[10px] font-bold ml-1">5 in mano</span>
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(251,146,60,0.25)", border: "1px solid rgba(251,146,60,0.5)", color: "#fed7aa" }}>TU</span>
          </div>
          {/* My large field cards */}
          <div className="flex gap-2 flex-wrap justify-center">
            {FIELD_CARDS_ME.map((c) => (
              <ArenaCard key={c.id} name={c.name} pti={c.pti} stars={c.stars} large />
            ))}
          </div>
        </div>
      </div>

      {/* ── HAND ── */}
      <div className="flex-shrink-0 px-4 pt-1 pb-1 z-20">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-black text-orange-400/70 uppercase tracking-wider">Mano ({HAND_CARDS.length})</span>
          <span className="text-[9px] text-orange-400/40 font-bold">Tocca per giocare</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {HAND_CARDS.map((c) => (
            <HandCard key={c.id} name={c.name} type={c.type} />
          ))}
        </div>
      </div>

      {/* ── BOTTOM ACTION BAR ── */}
      <div className="flex-shrink-0 px-4 pb-safe pb-3 pt-2 z-30 mt-1" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)" }}>
        <div className="flex items-center gap-2">
          <button
            className="flex-1 py-2.5 rounded-xl font-black text-sm transition-all active:scale-95"
            style={{
              background: myTurn ? "linear-gradient(to right, #ea580c, #dc2626)" : "rgba(20,10,30,0.8)",
              border: myTurn ? "1px solid rgba(251,146,60,0.6)" : "1px solid rgba(255,255,255,0.08)",
              color: myTurn ? "#fff" : "rgba(255,255,255,0.2)",
              boxShadow: myTurn ? "0 0 20px rgba(234,88,12,0.4)" : "none",
            }}
          >
            ✋ Pesca carta
          </button>
          <button className="py-2.5 px-4 rounded-xl font-black text-xs text-white/40 active:scale-95 transition-transform" style={{ background: "rgba(15,8,25,0.8)", border: "1px solid rgba(255,255,255,0.08)" }}>
            ⏭ Passa
          </button>
          <button className="py-2.5 px-3 rounded-xl text-white/35 active:scale-95 transition-transform" style={{ background: "rgba(15,8,25,0.8)", border: "1px solid rgba(255,255,255,0.08)" }}>💬</button>
          <button className="py-2.5 px-3 rounded-xl text-white/35 active:scale-95 transition-transform" style={{ background: "rgba(15,8,25,0.8)", border: "1px solid rgba(255,255,255,0.08)" }}>⚙️</button>
        </div>
      </div>
    </div>
  );
}
