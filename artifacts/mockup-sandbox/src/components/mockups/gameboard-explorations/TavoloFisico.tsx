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

function FeltCard({ name, pti, stars, rotated = false, enemy = false }: { name: string; pti: number; stars: number; rotated?: boolean; enemy?: boolean }) {
  return (
    <div
      className="relative rounded-lg flex flex-col items-center justify-between shadow-2xl cursor-pointer active:scale-95 transition-transform"
      style={{
        width: 56,
        height: 80,
        background: "linear-gradient(160deg, #fffbf0, #f5e6c8)",
        border: `2px solid ${enemy ? "#b91c1c" : "#92400e"}`,
        boxShadow: `3px 4px 10px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.6)`,
        transform: rotated ? "rotate(6deg)" : "rotate(-3deg)",
        padding: "5px 4px",
      }}
    >
      {/* Card pattern background */}
      <div
        className="absolute inset-0 rounded-md opacity-10"
        style={{ backgroundImage: "repeating-linear-gradient(45deg, #92400e 0, #92400e 1px, transparent 0, transparent 50%)", backgroundSize: "8px 8px" }}
      />
      <div className="relative z-10 text-[9px] font-black text-amber-900 text-center leading-tight truncate w-full">{name}</div>
      <div className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center font-black text-xs bg-amber-800 text-amber-100 shadow-inner">
        {pti}
      </div>
      <div className="relative z-10 text-amber-700 text-[9px]">{"★".repeat(Math.min(stars, 5))}</div>
      {/* Worn corner */}
      <div className="absolute top-0 right-0 w-3 h-3 rounded-bl-lg" style={{ background: "rgba(146,64,14,0.15)" }} />
    </div>
  );
}

function DeckPile({ label, color }: { label: string; color: string }) {
  return (
    <div className="relative cursor-pointer active:scale-95 transition-transform" style={{ width: 42, height: 60 }}>
      {[3, 2, 1, 0].map((offset) => (
        <div
          key={offset}
          className="absolute rounded-md border"
          style={{
            width: 38,
            height: 56,
            top: offset * 1.5,
            left: offset * 1,
            background: `linear-gradient(160deg, ${color}dd, ${color}88)`,
            borderColor: `${color}ff`,
            boxShadow: "2px 2px 5px rgba(0,0,0,0.5)",
          }}
        />
      ))}
      <div
        className="absolute inset-0 rounded-md flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.15)" }}
      >
        <span className="text-white font-black text-[8px] text-center leading-tight px-0.5">{label}</span>
      </div>
    </div>
  );
}

export function TavoloFisico() {
  const myTurn = true;
  const [showGraveyard, setShowGraveyard] = useState(false);

  return (
    <div
      className="relative w-full min-h-screen flex flex-col overflow-hidden font-sans select-none"
      style={{ color: "#1c1a14" }}
    >
      <style>{`
        @keyframes candle-flicker {
          0%,100% { opacity: 0.7; transform: scaleY(1); }
          33% { opacity: 0.9; transform: scaleY(1.05); }
          66% { opacity: 0.75; transform: scaleY(0.97); }
        }
        .candle-flicker { animation: candle-flicker 1.2s ease-in-out infinite; }
        @keyframes wood-pulse {
          0%,100% { box-shadow: inset 0 0 40px rgba(0,0,0,0.5), 0 0 20px rgba(101,67,33,0.5); }
          50% { box-shadow: inset 0 0 30px rgba(0,0,0,0.4), 0 0 30px rgba(101,67,33,0.7); }
        }
        .table-glow { animation: wood-pulse 3s ease-in-out infinite; }
      `}</style>

      {/* Wood-paneled background */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, #2d1f0a 0%, #1a1208 40%, #251b0d 100%)",
        }}
      />
      {/* Wood grain texture */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: "repeating-linear-gradient(90deg, rgba(255,200,100,0.1) 0, rgba(255,200,100,0.1) 1px, transparent 0, transparent 40px), repeating-linear-gradient(180deg, rgba(100,60,20,0.2) 0, rgba(100,60,20,0.2) 1px, transparent 0, transparent 80px)",
        }}
      />

      {/* ── SCOREBOARD HEADER ── */}
      <div
        className="flex-shrink-0 px-4 pt-safe pt-3 pb-2 z-30"
        style={{
          background: "linear-gradient(180deg, rgba(20,12,4,0.95), rgba(20,12,4,0.7))",
          borderBottom: "2px solid rgba(139,90,43,0.5)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.6)",
        }}
      >
        <div className="flex items-center justify-between">
          <button className="text-amber-700 text-sm">←</button>
          <div
            className="flex items-center gap-3 px-4 py-1 rounded-xl"
            style={{ background: "rgba(101,67,33,0.3)", border: "1px solid rgba(139,90,43,0.4)" }}
          >
            <div className="text-center">
              <div className="text-amber-200 font-black text-xs">CPU Alessio</div>
              <div className="text-amber-600 text-[10px]">💀 1/3</div>
            </div>
            <div
              className="text-center px-3 py-1 rounded-lg"
              style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(139,90,43,0.5)" }}
            >
              <div
                className="font-black text-sm"
                style={{
                  color: myTurn ? "#fbbf24" : "#60a5fa",
                  textShadow: myTurn ? "0 0 8px rgba(251,191,36,0.8)" : "none",
                }}
              >
                {myTurn ? "TUO 🎲" : "CPU ⏳"}
              </div>
              <div className="text-amber-700 text-[10px]">turno</div>
            </div>
            <div className="text-center">
              <div className="text-amber-200 font-black text-xs">Fake</div>
              <div className="text-amber-600 text-[10px]">💀 0/3</div>
            </div>
          </div>
          <button className="text-amber-700">⋯</button>
        </div>
      </div>

      {/* ── FELT TABLE SURFACE ── */}
      <div className="flex-1 relative z-10 px-3 py-3 flex flex-col gap-2">

        {/* Opponent area */}
        <div
          className="rounded-2xl p-3 relative"
          style={{
            background: "linear-gradient(135deg, rgba(120,0,0,0.35), rgba(60,0,0,0.2))",
            border: "2px solid rgba(139,0,0,0.4)",
            boxShadow: "inset 0 0 16px rgba(0,0,0,0.4)",
          }}
        >
          <div className="text-[10px] font-black text-red-800/80 mb-2 uppercase tracking-widest">⚔ Avversario</div>
          <div className="flex gap-2 flex-wrap">
            {FIELD_CARDS_CPU.map((c, i) => (
              <FeltCard key={c.id} name={c.name} pti={c.pti} stars={c.stars} rotated={i % 2 === 0} enemy />
            ))}
          </div>
        </div>

        {/* Green felt main table */}
        <div
          className="flex-1 rounded-3xl relative overflow-hidden table-glow"
          style={{
            background: "linear-gradient(135deg, #1a4a2e 0%, #143d24 40%, #1c5233 100%)",
            border: "4px solid rgba(101,67,33,0.8)",
            boxShadow: "inset 0 0 40px rgba(0,0,0,0.5), 0 0 20px rgba(101,67,33,0.5)",
            minHeight: 140,
          }}
        >
          {/* Felt texture */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)",
              backgroundSize: "6px 6px",
            }}
          />

          {/* Table oval marking */}
          <div
            className="absolute inset-6 rounded-full opacity-20"
            style={{ border: "2px solid rgba(255,255,255,0.4)" }}
          />

          {/* Center decks */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-3">
            <DeckPile label="PERS" color="#7c3aed" />
            <DeckPile label="MOSSE" color="#1d4ed8" />
            <DeckPile label="BONUS" color="#b45309" />
            <DeckPile label="SPEC" color="#854d0e" />
          </div>

          {/* Cimitero badge */}
          <button
            onClick={() => setShowGraveyard((s) => !s)}
            className="absolute bottom-2 left-3 text-[10px] font-bold px-2 py-1 rounded-lg"
            style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(139,90,43,0.4)", color: "rgba(255,200,100,0.7)" }}
          >
            ☠️ Cimitero (3)
          </button>

          {/* Candle decoration */}
          <div className="absolute top-3 right-4 candle-flicker text-lg">🕯️</div>
        </div>

        {/* My area */}
        <div
          className="rounded-2xl p-3 relative"
          style={{
            background: myTurn
              ? "linear-gradient(135deg, rgba(101,67,33,0.5), rgba(60,40,15,0.35))"
              : "linear-gradient(135deg, rgba(60,40,15,0.3), rgba(40,25,8,0.2))",
            border: myTurn ? "2px solid rgba(251,191,36,0.5)" : "2px solid rgba(101,67,33,0.3)",
            boxShadow: myTurn ? "0 0 16px rgba(251,191,36,0.15)" : "none",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgba(251,191,36,0.8)" }}>🃏 Il tuo campo</div>
            {myTurn && (
              <div className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: "rgba(251,191,36,0.2)", border: "1px solid rgba(251,191,36,0.5)", color: "#fbbf24" }}>
                🎲 Tocca a te!
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {FIELD_CARDS_ME.map((c, i) => (
              <FeltCard key={c.id} name={c.name} pti={c.pti} stars={c.stars} rotated={i % 3 === 1} />
            ))}
          </div>
        </div>
      </div>

      {/* ── HAND AREA ── */}
      <div
        className="flex-shrink-0 z-30 px-4 pb-safe pb-3 pt-2"
        style={{ background: "linear-gradient(to top, rgba(15,8,2,0.95), rgba(15,8,2,0.7))", borderTop: "2px solid rgba(101,67,33,0.5)" }}
      >
        <div className="text-[10px] font-black text-amber-700/80 mb-2 uppercase tracking-widest">Mano (5 carte)</div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {["Soros", "Furia", "Scudo", "Blast", "Max"].map((name, i) => {
            const colors = ["#7c3aed", "#1d4ed8", "#065f46", "#1d4ed8", "#7c3aed"];
            return (
              <div
                key={name}
                className="flex-shrink-0 rounded-lg flex flex-col items-center justify-between cursor-pointer active:scale-95 transition-transform shadow-lg"
                style={{
                  width: 48,
                  height: 66,
                  background: "linear-gradient(160deg, #fffbf0, #f5e6c8)",
                  border: `2px solid ${colors[i]}88`,
                  boxShadow: `2px 3px 8px rgba(0,0,0,0.5), inset 0 1px rgba(255,255,255,0.5)`,
                  padding: "4px 3px",
                  transform: `rotate(${i % 2 === 0 ? -2 : 2}deg)`,
                }}
              >
                <div className="text-[8px] font-black text-amber-900 text-center truncate w-full">{name}</div>
                <div className="w-6 h-6 rounded-full border border-amber-800/50 bg-amber-800/10 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full" style={{ background: colors[i] }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 mt-2">
          <button
            className="flex-1 py-2.5 rounded-xl font-black text-sm transition-all active:scale-95"
            style={{
              background: myTurn ? "linear-gradient(to right, #92400e, #78350f)" : "rgba(40,25,8,0.8)",
              border: myTurn ? "2px solid rgba(251,191,36,0.5)" : "1px solid rgba(101,67,33,0.3)",
              color: myTurn ? "#fbbf24" : "rgba(251,191,36,0.25)",
              boxShadow: myTurn ? "0 0 16px rgba(251,191,36,0.2)" : "none",
            }}
          >
            🎴 Pesca carta
          </button>
          <button
            className="py-2.5 px-4 rounded-xl font-black text-xs active:scale-95 transition-all"
            style={{ background: "rgba(40,25,8,0.8)", border: "1px solid rgba(101,67,33,0.4)", color: "rgba(251,191,36,0.4)" }}
          >
            ⏭ Passa
          </button>
          <button
            className="py-2.5 px-3 rounded-xl active:scale-95 transition-all"
            style={{ background: "rgba(40,25,8,0.8)", border: "1px solid rgba(101,67,33,0.4)", color: "rgba(251,191,36,0.4)" }}
          >
            🎲
          </button>
        </div>
      </div>
    </div>
  );
}
