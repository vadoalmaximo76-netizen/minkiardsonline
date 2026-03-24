import { useState } from "react";

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');

  @keyframes pulseOut {
    0%   { transform: scale(1);   opacity: 0.85; }
    70%  { transform: scale(1.75); opacity: 0; }
    100% { transform: scale(1.75); opacity: 0; }
  }
  @keyframes floatStar {
    0%,100% { transform: translateY(0) scale(1); opacity: var(--sop); }
    50%      { transform: translateY(-7px) scale(1.1); opacity: calc(var(--sop) * 1.5); }
  }
  @keyframes shimmer {
    0%   { background-position: -400% center; }
    100% { background-position:  400% center; }
  }
  @keyframes glowPulse {
    0%,100% { box-shadow: 0 0 18px var(--gc) , 0 0 36px var(--gc2); }
    50%      { box-shadow: 0 0 28px var(--gc) , 0 0 56px var(--gc2); }
  }
  @keyframes badgeSpin {
    to { transform: rotate(360deg); }
  }
  @keyframes nodePop {
    0%   { transform: scale(0.4) translateY(12px); opacity: 0; }
    65%  { transform: scale(1.08) translateY(-2px); }
    100% { transform: scale(1)   translateY(0); opacity: 1; }
  }
  @keyframes pathDraw {
    from { stroke-dashoffset: 1400; }
    to   { stroke-dashoffset: 0; }
  }
  @keyframes spinSlow {
    to { transform: rotate(360deg); }
  }
  @keyframes badgeBounce {
    0%,100% { transform: translateY(0); }
    50%      { transform: translateY(-2px); }
  }
  @keyframes currentGlow {
    0%,100% { filter: drop-shadow(0 0 8px #f59e0b) drop-shadow(0 0 16px #f59e0baa); }
    50%      { filter: drop-shadow(0 0 16px #f59e0b) drop-shadow(0 0 32px #f59e0bdd); }
  }

  .story-root {
    font-family: 'Nunito', 'Segoe UI', sans-serif;
    background: radial-gradient(ellipse at top, #110822 0%, #07030f 60%);
    min-height: 100vh;
    width: 100%;
    max-width: 390px;
    margin: 0 auto;
    overflow-x: hidden;
    color: white;
    position: relative;
  }
  .no-sb::-webkit-scrollbar { display: none; }
  .no-sb { -ms-overflow-style: none; scrollbar-width: none; }
`;

/* ─── Stars ─── */
const STARS = Array.from({ length: 55 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  r: Math.random() * 2.2 + 0.4,
  op: Math.random() * 0.4 + 0.08,
  dur: Math.random() * 4 + 2,
  del: Math.random() * 7,
}));

/* ─── Stage data ─── */
type Status = "done" | "active" | "open" | "locked";

interface Stage {
  id: number;
  order: number;
  gymName: string;
  bossName: string;
  difficulty: "easy" | "medium" | "hard";
  lives: number;
  reward: number;
  status: Status;
  /* Avatar seed → DiceBear generates a portrait */
  leaderSeed: string;
  badgeEmoji: string;
  badgeColor: string;
  specialty: string;
  cpuCount: number;
}

const STAGES: Stage[] = [
  {
    id: 1, order: 1, gymName: "Palestra della Zuppa",   bossName: "Ernesto",
    difficulty: "easy",   lives: 3, reward: 50,  status: "done",
    leaderSeed: "Ernesto",    badgeEmoji: "🍲", badgeColor: "#16a34a", specialty: "Personaggi",   cpuCount: 1,
  },
  {
    id: 2, order: 2, gymName: "Torre del Panino",       bossName: "Aree",
    difficulty: "easy",   lives: 3, reward: 75,  status: "done",
    leaderSeed: "Aree",       badgeEmoji: "🥪", badgeColor: "#0891b2", specialty: "Mosse",        cpuCount: 1,
  },
  {
    id: 3, order: 3, gymName: "Fortezza del Macchinone",bossName: "C.Mastrota",
    difficulty: "medium", lives: 3, reward: 100, status: "done",
    leaderSeed: "Mastrota",   badgeEmoji: "🚗", badgeColor: "#d97706", specialty: "Bonus",        cpuCount: 2,
  },
  {
    id: 4, order: 4, gymName: "Arena dei Boss",         bossName: "Gregorio",
    difficulty: "hard",   lives: 4, reward: 150, status: "active",
    leaderSeed: "Gregorio",   badgeEmoji: "⚔️", badgeColor: "#f59e0b", specialty: "Tutto",        cpuCount: 3,
  },
  {
    id: 5, order: 5, gymName: "Cripta del Barbone",     bossName: "Barbone",
    difficulty: "hard",   lives: 4, reward: 200, status: "open",
    leaderSeed: "Barbone",    badgeEmoji: "💀", badgeColor: "#7c3aed", specialty: "Personaggi",   cpuCount: 2,
  },
  {
    id: 6, order: 6, gymName: "Olimpo del Rabbino",     bossName: "Capo Rabbino",
    difficulty: "hard",   lives: 5, reward: 300, status: "locked",
    leaderSeed: "Rabbino",    badgeEmoji: "📜", badgeColor: "#b45309", specialty: "Bonus",        cpuCount: 3,
  },
  {
    id: 7, order: 7, gymName: "Vetta dell'Avvoltoio",   bossName: "Avvoltoio",
    difficulty: "hard",   lives: 5, reward: 400, status: "locked",
    leaderSeed: "Avvoltoio",  badgeEmoji: "🦅", badgeColor: "#374151", specialty: "Passivi",      cpuCount: 2,
  },
  {
    id: 8, order: 8, gymName: "Sancta Sanctorum",       bossName: "???",
    difficulty: "hard",   lives: 5, reward: 500, status: "locked",
    leaderSeed: "secret",     badgeEmoji: "👑", badgeColor: "#be185d", specialty: "???",          cpuCount: 4,
  },
];

const DIFF_LABEL: Record<string, { label: string; color: string; dot: string }> = {
  easy:   { label: "Facile",   color: "#4ade80", dot: "🟢" },
  medium: { label: "Medio",    color: "#facc15", dot: "🟡" },
  hard:   { label: "Difficile",color: "#f87171", dot: "🔴" },
};

/* ─── Path SVG ─── */
function PathSVG({ count, nodeH, topPad }: { count: number; nodeH: number; topPad: number }) {
  const W = 390;
  const cx = W / 2;
  const amp = 28;

  const pts = Array.from({ length: count }, (_, i) => ({
    x: cx + (i % 2 === 0 ? amp : -amp),
    y: topPad + i * nodeH + nodeH / 2,
  }));

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], n = pts[i];
    const my = (p.y + n.y) / 2;
    d += ` C ${p.x} ${my}, ${n.x} ${my}, ${n.x} ${n.y}`;
  }

  const totalH = topPad + count * nodeH;

  return (
    <svg width={W} height={totalH} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
      <defs>
        <linearGradient id="pg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#4ade80" stopOpacity="0.9" />
          <stop offset="40%"  stopColor="#f59e0b" stopOpacity="1" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.35" />
        </linearGradient>
        <filter id="gf2">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="b" />
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* background glow fill */}
      <path d={d} fill="none" stroke="rgba(245,158,11,0.06)" strokeWidth={28} strokeLinecap="round"/>
      {/* dashed trail */}
      <path
        d={d} fill="none" stroke="url(#pg2)" strokeWidth={3}
        strokeLinecap="round" strokeDasharray="12 9"
        filter="url(#gf2)"
        style={{ animation: "pathDraw 2s ease-out forwards", strokeDashoffset: 1400 }}
      />
    </svg>
  );
}

/* ─── Leader node ─── */
function LeaderNode({ stage }: { stage: Stage }) {
  const isActive = stage.status === "active";
  const isDone   = stage.status === "done";
  const isLocked = stage.status === "locked";

  const size = isActive ? 66 : 58;
  const badgeSize = isActive ? 26 : 22;

  const imgUrl = isLocked
    ? null
    : `https://api.dicebear.com/8.x/lorelei/svg?seed=${stage.leaderSeed}&backgroundColor=1a1a2e`;

  const borderColor = isDone
    ? "#4ade80"
    : isActive
    ? "#f59e0b"
    : stage.status === "open"
    ? "#7c3aed66"
    : "#1f2937";

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {/* outer pulse ring */}
      {isActive && (
        <div style={{
          position: "absolute", inset: -7, borderRadius: "50%",
          border: "2.5px solid #f59e0b99",
          animation: "pulseOut 1.9s ease-out infinite",
        }} />
      )}
      {/* spinning dashes */}
      {isActive && (
        <div style={{
          position: "absolute", inset: -10, borderRadius: "50%",
          border: "2px dashed #f59e0b55",
          animation: "spinSlow 6s linear infinite",
        }} />
      )}

      {/* Main circle */}
      <div
        style={{
          width: "100%", height: "100%", borderRadius: "50%",
          border: `${isActive ? 3 : 2}px solid ${borderColor}`,
          overflow: "hidden",
          background: isLocked
            ? "linear-gradient(135deg,#0d0d1a,#111)"
            : "linear-gradient(135deg,#1a1140,#0d0a22)",
          boxShadow: isActive
            ? "0 0 20px #f59e0baa, 0 0 40px #f59e0b44"
            : isDone
            ? "0 0 10px #4ade8044"
            : "0 4px 14px rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative",
          animation: isActive ? "currentGlow 2.4s ease-in-out infinite" : "none",
          opacity: isLocked ? 0.3 : 1,
        }}
      >
        {isLocked ? (
          <span style={{ fontSize: 22 }}>🔒</span>
        ) : imgUrl ? (
          <img
            src={imgUrl}
            alt={stage.bossName}
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
          />
        ) : (
          <span style={{ fontSize: 22 }}>{stage.bossName[0]}</span>
        )}
        {/* shine */}
        {isDone && (
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.18), transparent 60%)",
          }} />
        )}
      </div>

      {/* Done checkmark */}
      {isDone && (
        <div style={{
          position: "absolute", top: -4, right: -4,
          width: 20, height: 20, borderRadius: "50%",
          background: "linear-gradient(135deg,#16a34a,#15803d)",
          border: "2px solid #07030f",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, fontWeight: 900,
          boxShadow: "0 0 8px #22c55e99",
        }}>✓</div>
      )}

      {/* Badge circle */}
      {!isLocked && (
        <div
          style={{
            position: "absolute",
            bottom: -4, left: isActive ? -8 : -6,
            width: badgeSize, height: badgeSize,
            borderRadius: "50%",
            background: `radial-gradient(circle at 40% 35%, ${stage.badgeColor}ee, ${stage.badgeColor}88)`,
            border: `2px solid ${stage.badgeColor}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: badgeSize * 0.45,
            boxShadow: `0 0 8px ${stage.badgeColor}88`,
            animation: "badgeBounce 2s ease-in-out infinite",
          }}
        >
          {stage.badgeEmoji}
        </div>
      )}
    </div>
  );
}

/* ─── Info card ─── */
function StageCard({ stage, align }: { stage: Stage; align: "left" | "right" }) {
  const [pressed, setPressed] = useState(false);
  const isLocked = stage.status === "locked";
  const isActive = stage.status === "active";
  const isDone   = stage.status === "done";
  const diff = DIFF_LABEL[stage.difficulty];

  if (isLocked) {
    return (
      <div style={{
        flex: 1,
        background: "rgba(10,8,20,0.5)",
        border: "1px solid #1f2937",
        borderRadius: 14,
        padding: "10px 12px",
        opacity: 0.35,
        textAlign: align,
      }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: "#374151", letterSpacing: "0.05em" }}>
          STAGE {stage.order}
        </p>
        <p style={{ margin: "3px 0 0", fontSize: 9, color: "#1f2937", fontWeight: 700 }}>
          Sblocca gli stage precedenti
        </p>
      </div>
    );
  }

  return (
    <button
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        flex: 1,
        background: isActive
          ? "linear-gradient(135deg, rgba(120,53,15,0.8), rgba(180,83,9,0.6))"
          : isDone
          ? "rgba(22,101,52,0.18)"
          : "rgba(15,10,30,0.7)",
        border: isActive
          ? "1.5px solid #f59e0b88"
          : isDone
          ? "1px solid #4ade8033"
          : "1px solid #7c3aed33",
        borderRadius: 14,
        padding: "10px 12px",
        cursor: "pointer",
        textAlign: align,
        transform: pressed ? "scale(0.96)" : "scale(1)",
        transition: "transform 0.15s, box-shadow 0.2s",
        boxShadow: isActive ? "0 4px 18px #f59e0b44" : isDone ? "0 2px 8px #4ade8022" : "0 2px 8px rgba(0,0,0,0.3)",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* shimmer on active */}
      {isActive && (
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(105deg, transparent 25%, rgba(255,255,255,0.06) 50%, transparent 75%)",
          backgroundSize: "400% auto",
          animation: "shimmer 3s linear infinite",
        }} />
      )}

      {/* Title row */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: align === "right" ? "flex-start" : "flex-end", marginBottom: 2 }}>
        {isActive && align === "right" && (
          <span style={{
            fontSize: 8, fontWeight: 900, background: "#f59e0b", color: "#000",
            padding: "2px 5px", borderRadius: 99, animation: "badgeBounce 1.5s ease-in-out infinite",
          }}>●</span>
        )}
        <span style={{ fontSize: 11, fontWeight: 900, color: isActive ? "#fde68a" : isDone ? "#86efac" : "rgba(255,255,255,0.8)", letterSpacing: "0.05em" }}>
          {stage.gymName}
        </span>
        {isActive && align === "left" && (
          <span style={{
            fontSize: 8, fontWeight: 900, background: "#f59e0b", color: "#000",
            padding: "2px 5px", borderRadius: 99, animation: "badgeBounce 1.5s ease-in-out infinite",
          }}>●</span>
        )}
      </div>

      {/* Boss + specialty */}
      <p style={{ margin: 0, fontSize: 9.5, color: isActive ? "rgba(253,230,138,0.6)" : isDone ? "rgba(134,239,172,0.5)" : "rgba(255,255,255,0.35)", fontWeight: 700, textAlign: align }}>
        Boss: <span style={{ color: isActive ? "#fde68a" : isDone ? "#86efac" : "rgba(255,255,255,0.55)", fontWeight: 900 }}>{stage.bossName}</span>
      </p>

      {/* Stats row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 5, marginTop: 6,
        justifyContent: align === "right" ? "flex-start" : "flex-end",
        flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: diff.color }}>
          {diff.dot} {diff.label}
        </span>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700 }}>
          ❤️ {stage.lives}
        </span>
        {stage.cpuCount > 1 && (
          <span style={{ fontSize: 9, color: "#a855f7", fontWeight: 800, background: "rgba(168,85,247,0.15)", padding: "1px 5px", borderRadius: 99 }}>
            👥 {stage.cpuCount}
          </span>
        )}
        <span style={{ fontSize: 9, color: "#f59e0baa", fontWeight: 800 }}>
          +{stage.reward}⭐
        </span>
      </div>

      {/* Action */}
      {isActive && (
        <div style={{
          marginTop: 8,
          background: "linear-gradient(to right,#f59e0b,#f97316)",
          borderRadius: 10,
          padding: "6px 10px",
          fontSize: 10, fontWeight: 900, color: "#000",
          letterSpacing: "0.06em",
          display: "inline-block",
        }}>
          ⚔️ SFIDA!
        </div>
      )}
      {isDone && (
        <p style={{ margin: "5px 0 0", fontSize: 9, color: "#4ade8066", fontWeight: 800, textAlign: align }}>
          ✓ Rigioca
        </p>
      )}
      {stage.status === "open" && (
        <div style={{
          marginTop: 8,
          background: "rgba(124,58,237,0.3)",
          border: "1px solid #7c3aed55",
          borderRadius: 10,
          padding: "5px 10px",
          fontSize: 10, fontWeight: 900, color: "#c4b5fd",
          letterSpacing: "0.05em",
          display: "inline-block",
        }}>
          ⚔️ SFIDA!
        </div>
      )}
    </button>
  );
}

/* ─── Main ─── */
export function PercorsoTappe() {
  const nodeH  = 104;
  const topPad = 16;
  const totalH = topPad + STAGES.length * nodeH + 16;

  const done  = STAGES.filter(s => s.status === "done").length;
  const total = STAGES.length;
  const pct   = Math.round((done / total) * 100);

  return (
    <>
      <style>{STYLE}</style>
      <div className="story-root no-sb" style={{ height: "100vh", overflowY: "auto" }}>

        {/* Stars */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
          {STARS.map(s => (
            <div key={s.id} style={{
              position: "absolute",
              left: `${s.x}%`, top: `${s.y}%`,
              width: s.r, height: s.r, borderRadius: "50%", background: "white",
              ["--sop" as any]: s.op, opacity: s.op,
              animation: `floatStar ${s.dur}s ease-in-out ${s.del}s infinite`,
            }} />
          ))}
        </div>

        {/* ── Header ── */}
        <div style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "rgba(7,3,15,0.9)", backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(245,158,11,0.15)",
          padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <button style={{
            width: 34, height: 34, borderRadius: "50%",
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            color: "white", cursor: "pointer", fontSize: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>←</button>

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 9, color: "#f59e0b", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                ⚔️ STORY MODE
              </span>
              <span style={{
                fontSize: 8, fontWeight: 800,
                background: "rgba(245,158,11,0.2)", border: "1px solid #f59e0b44",
                color: "#fde68a", padding: "1px 6px", borderRadius: 99,
              }}>
                Stage {done + 1} / {total}
              </span>
            </div>
            {/* progress bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                flex: 1, height: 5, background: "#1a0f2e",
                borderRadius: 99, overflow: "hidden",
                border: "1px solid rgba(245,158,11,0.15)",
              }}>
                <div style={{
                  height: "100%", width: `${pct}%`, borderRadius: 99,
                  background: "linear-gradient(to right,#4ade80,#f59e0b)",
                  transition: "width 1.2s cubic-bezier(0.16,1,0.3,1)",
                }} />
              </div>
              <span style={{ fontSize: 9, color: "#f59e0b", fontWeight: 800, whiteSpace: "nowrap" }}>
                {done}/{total} ✓
              </span>
            </div>
          </div>

          <div style={{
            textAlign: "right",
            background: "rgba(245,158,11,0.1)", border: "1px solid #f59e0b33",
            borderRadius: 10, padding: "5px 10px",
          }}>
            <div style={{
              fontSize: 14, fontWeight: 900,
              background: "linear-gradient(90deg,#f59e0b,#fde68a,#f59e0b)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              animation: "shimmer 2s linear infinite",
            }}>1.240 ⭐</div>
            <div style={{ fontSize: 8, color: "#78350f", fontWeight: 700 }}>Rankiard</div>
          </div>
        </div>

        {/* ── Mazzo info strip ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 16px",
          background: "rgba(0,0,0,0.25)",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          position: "relative", zIndex: 2,
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#a78bfa" }}>
            🃏 28 carte nel mazzo Story Mode
          </span>
          <span style={{ width: 1, height: 12, background: "rgba(255,255,255,0.1)", display: "inline-block" }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: "#4ade80" }}>
            ⚡ Livello medio consigliato
          </span>
        </div>

        {/* ── Mappa percorso ── */}
        <div style={{ position: "relative", width: "100%", height: totalH, zIndex: 2 }}>
          <PathSVG count={STAGES.length} nodeH={nodeH} topPad={topPad} />

          {STAGES.map((stage, i) => {
            const side: "left" | "right" = i % 2 === 0 ? "right" : "left";
            const y = topPad + i * nodeH;

            return (
              <div
                key={stage.id}
                style={{
                  position: "absolute",
                  top: y, left: 0, right: 0,
                  height: nodeH,
                  display: "flex", alignItems: "center",
                  padding: "0 12px",
                  gap: 10,
                  animation: `nodePop 0.4s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.06}s both`,
                }}
              >
                {side === "left" ? (
                  <>
                    <StageCard stage={stage} align="right" />
                    <LeaderNode stage={stage} />
                    <div style={{ flex: 1 }} />
                  </>
                ) : (
                  <>
                    <div style={{ flex: 1 }} />
                    <LeaderNode stage={stage} />
                    <StageCard stage={stage} align="left" />
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Bottom CTA ── */}
        <div style={{ padding: "4px 16px 32px", position: "relative", zIndex: 2 }}>
          <button
            style={{
              width: "100%", padding: "14px",
              borderRadius: 16,
              background: "linear-gradient(135deg,#78350f,#b45309,#f59e0b)",
              border: "none", color: "white",
              fontSize: 14, fontWeight: 900, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              letterSpacing: "0.07em",
              boxShadow: "0 0 24px rgba(245,158,11,0.45), 0 8px 28px rgba(0,0,0,0.5)",
              ["--gc" as any]: "rgba(245,158,11,0.5)",
              ["--gc2" as any]: "rgba(245,158,11,0.2)",
              animation: "glowPulse 2s ease-in-out infinite",
            }}
          >
            ⚔️ CONTINUA L'AVVENTURA
          </button>
        </div>
      </div>
    </>
  );
}
