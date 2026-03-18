import React, { useEffect, useRef, useState } from "react";

const FIELD_CARDS_CPU = [
  { id: "c1", name: "PELUX-X", pti: 180, stars: 3, type: "RED" },
  { id: "c2", name: "RAMBO-7", pti: 140, stars: 2, type: "RED" },
];
const FIELD_CARDS_ME = [
  { id: "m1", name: "LUCA-EX", pti: 220, stars: 4, type: "CYAN" },
  { id: "m2", name: "PINO-Z", pti: 90, stars: 1, type: "CYAN" },
  { id: "m3", name: "MARCO-X", pti: 160, stars: 3, type: "CYAN" },
];

const HAND_CARDS = [
  { id: "h1", name: "SOROS-Ω", col: "#22d3ee" },
  { id: "h2", name: "FURIA-7", col: "#818cf8" },
  { id: "h3", name: "SCUDO-X", col: "#34d399" },
  { id: "h4", name: "BLAST-∞", col: "#818cf8" },
  { id: "h5", name: "MAX-∆", col: "#22d3ee" },
];

function CyberCard({ name, pti, stars, type }: { name: string; pti: number; stars: number; type: string }) {
  const isCyan = type === "CYAN";
  const neon = isCyan ? "#22d3ee" : "#f87171";
  const neonDim = isCyan ? "#164e63" : "#7f1d1d";

  return (
    <div
      className="relative rounded-lg flex flex-col items-center justify-between cursor-pointer active:scale-95 transition-transform"
      style={{
        width: 58,
        height: 82,
        background: `linear-gradient(160deg, #020817, ${neonDim}33)`,
        border: `1.5px solid ${neon}99`,
        boxShadow: `0 0 12px ${neon}66, inset 0 0 6px ${neon}22`,
        padding: "5px 4px",
      }}
    >
      {/* Corner brackets */}
      <div className="absolute top-0.5 left-0.5 w-2 h-2 border-t border-l" style={{ borderColor: neon }} />
      <div className="absolute top-0.5 right-0.5 w-2 h-2 border-t border-r" style={{ borderColor: neon }} />
      <div className="absolute bottom-0.5 left-0.5 w-2 h-2 border-b border-l" style={{ borderColor: neon }} />
      <div className="absolute bottom-0.5 right-0.5 w-2 h-2 border-b border-r" style={{ borderColor: neon }} />

      {/* Scan line effect */}
      <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none opacity-20">
        <div style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.3) 3px, rgba(0,0,0,0.3) 4px)", width: "100%", height: "100%" }} />
      </div>

      <div className="text-[8px] font-black text-center leading-tight truncate w-full z-10" style={{ color: neon, textShadow: `0 0 6px ${neon}` }}>{name}</div>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs z-10"
        style={{ background: `${neon}22`, border: `1px solid ${neon}88`, color: neon, boxShadow: `0 0 8px ${neon}66`, textShadow: `0 0 6px ${neon}` }}
      >
        {pti}
      </div>
      <div className="text-yellow-300 text-[8px] z-10" style={{ textShadow: "0 0 6px rgba(253,224,71,0.8)" }}>{"★".repeat(Math.min(stars, 5))}</div>
      <div className="text-[7px] font-black z-10" style={{ color: `${neon}99` }}>{type}</div>
    </div>
  );
}

export function NeonCyber() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tick, setTick] = useState(0);
  const myTurn = true;

  // Animate grid
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 50);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const offset = (tick * 1.5) % 40;
    ctx.strokeStyle = "rgba(34,211,238,0.08)";
    ctx.lineWidth = 0.5;

    for (let x = -offset; x < canvas.width + 40; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = -offset; y < canvas.height + 40; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Perspective vanishing effect
    ctx.strokeStyle = "rgba(34,211,238,0.04)";
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(Math.cos((i / 8) * Math.PI * 2) * canvas.width + cx, Math.sin((i / 8) * Math.PI * 2) * canvas.height + cy);
      ctx.stroke();
    }
  }, [tick]);

  return (
    <div
      className="relative w-full min-h-screen flex flex-col overflow-hidden font-mono select-none"
      style={{ background: "#010614", color: "#e0f2fe" }}
    >
      <style>{`
        @keyframes neon-text-pulse {
          0%,100% { text-shadow: 0 0 8px rgba(34,211,238,0.8), 0 0 20px rgba(34,211,238,0.4); }
          50% { text-shadow: 0 0 16px rgba(34,211,238,1), 0 0 40px rgba(34,211,238,0.7); }
        }
        @keyframes neon-border-pulse {
          0%,100% { box-shadow: 0 0 10px rgba(34,211,238,0.3), inset 0 0 6px rgba(34,211,238,0.1); }
          50% { box-shadow: 0 0 25px rgba(34,211,238,0.6), inset 0 0 12px rgba(34,211,238,0.25); }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes magenta-pulse {
          0%,100% { box-shadow: 0 0 10px rgba(236,72,153,0.4), inset 0 0 6px rgba(236,72,153,0.1); }
          50% { box-shadow: 0 0 22px rgba(236,72,153,0.7), inset 0 0 12px rgba(236,72,153,0.25); }
        }
        .neon-text { animation: neon-text-pulse 2s ease-in-out infinite; }
        .neon-border { animation: neon-border-pulse 2s ease-in-out infinite; }
        .magenta-border { animation: magenta-pulse 2.5s ease-in-out infinite; }
      `}</style>

      {/* Animated grid canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />

      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none z-1 overflow-hidden opacity-10">
        <div className="absolute left-0 right-0 h-20 bg-gradient-to-b from-transparent via-cyan-400/30 to-transparent" style={{ animation: "scanline 4s linear infinite" }} />
      </div>

      {/* ── CYBER HEADER ── */}
      <div
        className="flex-shrink-0 px-4 pt-safe pt-3 pb-2 z-30"
        style={{ background: "rgba(1,6,20,0.9)", borderBottom: "1px solid rgba(34,211,238,0.25)", boxShadow: "0 1px 0 rgba(34,211,238,0.1), 0 0 20px rgba(1,6,20,0.9)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded flex items-center justify-center font-black text-sm"
              style={{ background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.5)", color: "#22d3ee", textShadow: "0 0 8px rgba(34,211,238,0.8)" }}
            >
              M
            </div>
            <div>
              <span className="font-black text-sm neon-text" style={{ color: "#22d3ee" }}>MINKIARDS_SYS</span>
              <span className="text-xs text-cyan-700 ml-2 font-mono">v2.4.1</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold" style={{ color: myTurn ? "#22d3ee" : "#a78bfa" }}>
              {myTurn ? "▶ YOUR_TURN" : "WAIT..."}
            </span>
            <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.3)", color: "#22d3ee" }}>≡</div>
          </div>
        </div>
      </div>

      {/* ── PLAYER STATS BAR ── */}
      <div className="flex-shrink-0 px-4 py-2 z-20 flex gap-3">
        <div
          className="flex-1 px-3 py-1.5 rounded-lg magenta-border"
          style={{ background: "rgba(236,72,153,0.08)", border: "1px solid rgba(236,72,153,0.3)" }}
        >
          <div className="text-[9px] font-bold text-pink-400 uppercase tracking-wider">CPU ALESSIO</div>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex gap-0.5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-3 h-3 rounded-sm" style={{ background: i < 1 ? "#f87171" : "rgba(248,113,113,0.2)", border: "1px solid rgba(248,113,113,0.4)", boxShadow: i < 1 ? "0 0 6px rgba(248,113,113,0.8)" : "none" }} />
              ))}
            </div>
            <span className="text-[9px] text-pink-400">1/3 MORTI</span>
            <span className="text-[9px] text-pink-300 ml-auto">4 MANO</span>
          </div>
        </div>

        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm neon-border self-center"
          style={{ background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.4)", color: "#22d3ee" }}
        >
          VS
        </div>

        <div
          className="flex-1 px-3 py-1.5 rounded-lg neon-border"
          style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.3)" }}
        >
          <div className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider">FAKE</div>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex gap-0.5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-3 h-3 rounded-sm" style={{ background: "rgba(34,211,238,0.2)", border: "1px solid rgba(34,211,238,0.4)" }} />
              ))}
            </div>
            <span className="text-[9px] text-cyan-400">0/3 MORTI</span>
            <span className="text-[9px] text-cyan-300 ml-auto">5 MANO</span>
          </div>
        </div>
      </div>

      {/* ── BATTLE FIELD ── */}
      <div className="flex-1 relative z-10 px-4 flex flex-col gap-3">

        {/* Enemy field */}
        <div
          className="rounded-xl p-3"
          style={{ background: "rgba(127,29,29,0.12)", border: "1px solid rgba(248,113,113,0.2)" }}
        >
          <div className="text-[9px] font-bold text-red-400 mb-2 tracking-widest">/// ENEMY FIELD</div>
          <div className="flex gap-2 flex-wrap">
            {FIELD_CARDS_CPU.map((c) => (
              <CyberCard key={c.id} name={c.name} pti={c.pti} stars={c.stars} type={c.type} />
            ))}
          </div>
        </div>

        {/* Center — decks + vs display */}
        <div className="relative flex items-center justify-center gap-3">
          <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(34,211,238,0.3))" }} />
          {[
            { l: "PRS", c: "#7c3aed" },
            { l: "MSS", c: "#1d4ed8" },
            { l: "BNS", c: "#065f46" },
            { l: "SPC", c: "#92400e" },
          ].map((d) => (
            <div
              key={d.l}
              className="w-8 h-12 rounded-md flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
              style={{ background: `${d.c}33`, border: `1px solid ${d.c}88`, boxShadow: `0 0 8px ${d.c}55` }}
            >
              <span className="text-white/70 text-[8px] font-black">{d.l}</span>
            </div>
          ))}
          <div className="flex-1 h-px" style={{ background: "linear-gradient(to left, transparent, rgba(34,211,238,0.3))" }} />
        </div>

        {/* My field */}
        <div
          className="rounded-xl p-3 neon-border"
          style={{ background: "rgba(8,35,50,0.5)", border: "1px solid rgba(34,211,238,0.25)" }}
        >
          <div className="text-[9px] font-bold text-cyan-400 mb-2 tracking-widest">/// MY FIELD</div>
          <div className="flex gap-2 flex-wrap">
            {FIELD_CARDS_ME.map((c) => (
              <CyberCard key={c.id} name={c.name} pti={c.pti} stars={c.stars} type={c.type} />
            ))}
          </div>
        </div>
      </div>

      {/* ── HAND + ACTIONS ── */}
      <div
        className="flex-shrink-0 z-30 px-4 pt-2 pb-safe pb-3"
        style={{ background: "rgba(1,6,20,0.95)", borderTop: "1px solid rgba(34,211,238,0.2)", backdropFilter: "blur(20px)" }}
      >
        <div className="text-[9px] font-bold text-cyan-600 mb-1.5 tracking-widest">/// MANO ({HAND_CARDS.length})</div>
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
          {HAND_CARDS.map((c) => (
            <div
              key={c.id}
              className="flex-shrink-0 rounded-lg flex flex-col items-center justify-between cursor-pointer active:scale-95 transition-transform"
              style={{
                width: 50,
                height: 70,
                background: `linear-gradient(160deg, ${c.col}11, #010614)`,
                border: `1.5px solid ${c.col}66`,
                boxShadow: `0 0 10px ${c.col}44`,
                padding: "5px 3px",
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: c.col, boxShadow: `0 0 6px ${c.col}` }} />
              <div className="text-[8px] font-black text-center leading-tight" style={{ color: c.col, textShadow: `0 0 6px ${c.col}` }}>{c.name}</div>
              <div className="text-[7px] font-bold" style={{ color: `${c.col}88` }}>PLAY</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            className="flex-1 py-2.5 rounded-lg font-black text-sm transition-all active:scale-95"
            style={{
              background: myTurn ? "rgba(34,211,238,0.15)" : "rgba(10,20,40,0.8)",
              border: myTurn ? "1px solid rgba(34,211,238,0.5)" : "1px solid rgba(34,211,238,0.1)",
              color: myTurn ? "#22d3ee" : "rgba(34,211,238,0.2)",
              boxShadow: myTurn ? "0 0 16px rgba(34,211,238,0.25)" : "none",
              textShadow: myTurn ? "0 0 8px rgba(34,211,238,0.8)" : "none",
            }}
          >
            ⬡ PESCA
          </button>
          <button
            className="py-2.5 px-4 rounded-lg font-black text-xs text-cyan-700 active:scale-95 transition-all"
            style={{ background: "rgba(10,20,40,0.8)", border: "1px solid rgba(34,211,238,0.1)" }}
          >
            ⏭ SKIP
          </button>
          <button
            className="py-2.5 px-3 rounded-lg text-cyan-700 active:scale-95 transition-all"
            style={{ background: "rgba(10,20,40,0.8)", border: "1px solid rgba(34,211,238,0.1)" }}
          >
            ⬡
          </button>
          <button
            className="py-2.5 px-3 rounded-lg text-cyan-700 active:scale-95 transition-all"
            style={{ background: "rgba(10,20,40,0.8)", border: "1px solid rgba(34,211,238,0.1)" }}
          >
            ⚙
          </button>
        </div>
      </div>
    </div>
  );
}
