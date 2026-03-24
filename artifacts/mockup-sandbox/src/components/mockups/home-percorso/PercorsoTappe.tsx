import { useState } from "react";

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');

  @keyframes pulseOut {
    0%   { transform: scale(1);   opacity: 0.9; }
    70%  { transform: scale(1.7); opacity: 0; }
    100% { transform: scale(1.7); opacity: 0; }
  }
  @keyframes floatStar {
    0%,100% { transform: translateY(0) scale(1); opacity: var(--sop); }
    50%      { transform: translateY(-7px) scale(1.1); opacity: calc(var(--sop) * 1.6); }
  }
  @keyframes glowPulse {
    0%,100% { opacity: 0.7; }
    50%      { opacity: 1; }
  }
  @keyframes shimmer {
    0%   { background-position: -300% center; }
    100% { background-position:  300% center; }
  }
  @keyframes badgeBounce {
    0%,100% { transform: translateY(0px); }
    50%      { transform: translateY(-2px); }
  }
  @keyframes nodePop {
    0%   { transform: scale(0.5); opacity: 0; }
    60%  { transform: scale(1.1); }
    100% { transform: scale(1);   opacity: 1; }
  }
  @keyframes pathGrow {
    from { stroke-dashoffset: 1200; }
    to   { stroke-dashoffset: 0; }
  }
  @keyframes spinSlow {
    to { transform: rotate(360deg); }
  }

  .percorso-wrap {
    font-family: 'Nunito', 'Segoe UI', sans-serif;
    background: #090514;
    min-height: 100vh;
    width: 100%;
    max-width: 390px;
    margin: 0 auto;
    overflow-x: hidden;
    position: relative;
    color: white;
  }
  .no-sb::-webkit-scrollbar { display: none; }
  .no-sb { -ms-overflow-style: none; scrollbar-width: none; }
`;

/* ─── Stars ─── */
const STARS = Array.from({ length: 70 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  r: Math.random() * 2 + 0.5,
  op: Math.random() * 0.45 + 0.1,
  dur: Math.random() * 4 + 2.5,
  del: Math.random() * 6,
}));

/* ─── Tappe data ─── */
type Status = "done" | "active" | "open" | "locked";
interface Tappa {
  id: string;
  label: string;
  sub: string;
  icon: string;
  status: Status;
  gFrom: string;
  gTo: string;
  glow: string;
  badge?: string;
}

const TAPPE: Tappa[] = [
  { id: "play",       label: "GIOCA",          sub: "Entra in partita",    icon: "🎮", status: "done",   gFrom: "#14532d", gTo: "#166534", glow: "#4ade80", badge: "1.240 ⭐" },
  { id: "training",   label: "ALLENAMENTO",    sub: "Affina le mosse",     icon: "🏋️", status: "done",   gFrom: "#1e3a5f", gTo: "#1d4ed8", glow: "#60a5fa" },
  { id: "stanze",     label: "STANZE",         sub: "Crea o unisciti",     icon: "🚪", status: "done",   gFrom: "#164e63", gTo: "#0e7490", glow: "#06b6d4" },
  { id: "tornei",     label: "TORNEI",         sub: "Sfida il mondo",      icon: "🏆", status: "done",   gFrom: "#7c2d12", gTo: "#9a3412", glow: "#f97316" },
  { id: "gym",        label: "STORY MODE",     sub: "Affronta i Boss",     icon: "⚔️", status: "active", gFrom: "#78350f", gTo: "#b45309", glow: "#f59e0b", badge: "Stage 3 / 8" },
  { id: "fanta",      label: "FANTAMINKIARDS", sub: "Draft leggendario",   icon: "🌌", status: "open",   gFrom: "#2e1065", gTo: "#4c1d95", glow: "#a855f7", badge: "NUOVO" },
  { id: "classifica", label: "CLASSIFICA",    sub: "Scala la vetta",      icon: "📊", status: "open",   gFrom: "#1a3a2e", gTo: "#14532d", glow: "#22c55e", badge: "#18" },
  { id: "profilo",    label: "PROFILO",        sub: "Il tuo account",      icon: "👤", status: "open",   gFrom: "#1e3a5f", gTo: "#1e4d8c", glow: "#3b82f6", badge: "42 vinte" },
];

/* ─── Path SVG ─── */
function CenterPath() {
  const nodeH = 96; // px per tappa row
  const topPad = 20;
  const totalH = TAPPE.length * nodeH + topPad;

  // Build an S-curve zigzag path through alternating x offsets
  const W = 390;
  const cx = W / 2;
  const amp = 22; // horizontal wiggle

  const pts = TAPPE.map((_, i) => ({
    x: cx + (i % 2 === 0 ? amp : -amp),
    y: topPad + i * nodeH + nodeH / 2,
  }));

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], n = pts[i];
    const my = (p.y + n.y) / 2;
    d += ` C ${p.x} ${my}, ${n.x} ${my}, ${n.x} ${n.y}`;
  }

  return (
    <svg
      width={W}
      height={totalH}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
    >
      <defs>
        <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#4ade80" stopOpacity="0.9" />
          <stop offset="50%"  stopColor="#f59e0b" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0.4" />
        </linearGradient>
        <filter id="gf">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* glow shadow */}
      <path d={d} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={24} strokeLinecap="round"/>
      {/* dash trail */}
      <path
        d={d} fill="none" stroke="url(#pg)" strokeWidth={3.5}
        strokeLinecap="round" strokeDasharray="14 8"
        filter="url(#gf)"
        style={{ animation: "pathGrow 1.8s ease-out forwards", strokeDashoffset: 1200 }}
      />
    </svg>
  );
}

/* ─── Node circle ─── */
function Node({ t }: { t: Tappa }) {
  const size = t.status === "active" ? 58 : 50;
  const locked = t.status === "locked";

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0, animation: "nodePop 0.45s cubic-bezier(0.34,1.56,0.64,1) both" }}>
      {/* pulse ring */}
      {t.status === "active" && (
        <div style={{
          position: "absolute", inset: -6, borderRadius: "50%",
          border: `2px solid ${t.glow}`,
          animation: "pulseOut 1.8s ease-out infinite",
        }} />
      )}
      {/* rotating dashes */}
      {t.status === "active" && (
        <div style={{
          position: "absolute", inset: -8, borderRadius: "50%",
          border: `2px dashed ${t.glow}66`,
          animation: "spinSlow 5s linear infinite",
        }} />
      )}
      <div style={{
        width: "100%", height: "100%", borderRadius: "50%",
        background: locked ? "#111827" : `linear-gradient(135deg, ${t.gFrom}, ${t.gTo})`,
        border: `${t.status === "active" ? "3px" : "2px"} solid ${locked ? "#1f2937" : t.status === "done" ? t.glow + "66" : t.status === "active" ? t.glow : t.glow + "33"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: t.status === "active" ? 24 : 20,
        boxShadow: t.status === "active"
          ? `0 0 18px ${t.glow}99, 0 0 36px ${t.glow}44`
          : t.status === "done" ? `0 0 8px ${t.glow}44` : "0 4px 12px rgba(0,0,0,0.5)",
        position: "relative", overflow: "hidden",
      }}>
        {locked ? "🔒" : t.status === "done" ? (
          <span style={{ fontSize: 20 }}>{t.icon}</span>
        ) : t.icon}
        {/* shine overlay for completed */}
        {t.status === "done" && (
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15), transparent 60%)",
            borderRadius: "50%",
          }} />
        )}
      </div>
      {/* done tick */}
      {t.status === "done" && (
        <div style={{
          position: "absolute", bottom: -2, right: -2,
          width: 18, height: 18, borderRadius: "50%",
          background: "linear-gradient(135deg,#16a34a,#15803d)",
          border: "2px solid #090514",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, fontWeight: 900, color: "white",
          boxShadow: "0 0 6px #22c55e88",
        }}>✓</div>
      )}
    </div>
  );
}

/* ─── Info card ─── */
function Card({ t, align }: { t: Tappa; align: "left" | "right" }) {
  const [hover, setHover] = useState(false);
  const locked = t.status === "locked";
  const isActive = t.status === "active";

  return (
    <button
      disabled={locked}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        background: locked
          ? "rgba(15,23,42,0.5)"
          : isActive
          ? `linear-gradient(135deg, ${t.gFrom}ee, ${t.gTo}cc)`
          : hover
          ? `linear-gradient(135deg, ${t.gFrom}bb, ${t.gTo}99)`
          : `linear-gradient(135deg, ${t.gFrom}88, ${t.gTo}66)`,
        border: isActive
          ? `1.5px solid ${t.glow}88`
          : hover
          ? `1px solid ${t.glow}55`
          : `1px solid ${locked ? "#1f2937" : t.glow + "22"}`,
        borderRadius: 14,
        padding: "10px 12px",
        cursor: locked ? "not-allowed" : "pointer",
        textAlign: align,
        transform: hover && !locked ? "scale(1.03) translateY(-1px)" : "scale(1)",
        transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
        boxShadow: isActive ? `0 4px 16px ${t.glow}44` : hover ? `0 4px 12px ${t.glow}22` : "0 2px 8px rgba(0,0,0,0.3)",
        position: "relative", overflow: "hidden",
        opacity: locked ? 0.35 : 1,
      }}
    >
      {/* shimmer on active */}
      {isActive && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 14,
          background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)",
          backgroundSize: "300% auto",
          animation: "shimmer 2.5s linear infinite",
        }} />
      )}
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        justifyContent: align === "right" ? "flex-start" : "flex-end",
        marginBottom: 2,
      }}>
        {isActive && align === "right" && (
          <span style={{
            fontSize: 8, fontWeight: 900,
            background: t.glow, color: "#000",
            padding: "2px 5px", borderRadius: 99,
            animation: "badgeBounce 1.4s ease-in-out infinite",
          }}>QUI</span>
        )}
        <span style={{
          fontSize: 11, fontWeight: 900,
          color: locked ? "#334155" : isActive ? "white" : "rgba(255,255,255,0.85)",
          letterSpacing: "0.05em",
        }}>{t.label}</span>
        {isActive && align === "left" && (
          <span style={{
            fontSize: 8, fontWeight: 900,
            background: t.glow, color: "#000",
            padding: "2px 5px", borderRadius: 99,
            animation: "badgeBounce 1.4s ease-in-out infinite",
          }}>QUI</span>
        )}
      </div>
      <p style={{
        margin: 0, fontSize: 9.5, fontWeight: 700,
        color: locked ? "#1f2937" : "rgba(255,255,255,0.45)",
        textAlign: align,
      }}>{t.sub}</p>
      {t.badge && (
        <div style={{
          marginTop: 6,
          display: "inline-block",
          fontSize: 9, fontWeight: 800,
          background: isActive ? `${t.glow}33` : "rgba(255,255,255,0.07)",
          border: `1px solid ${isActive ? t.glow + "55" : "rgba(255,255,255,0.1)"}`,
          color: isActive ? t.glow : "rgba(255,255,255,0.4)",
          padding: "2px 7px", borderRadius: 99,
        }}>{t.badge}</div>
      )}
    </button>
  );
}

/* ─── Main ─── */
export function PercorsoTappe() {
  const nodeH = 96;
  const topPad = 20;
  const totalH = TAPPE.length * nodeH + topPad + 20;
  const done = TAPPE.filter(t => t.status === "done").length;
  const total = TAPPE.length;

  return (
    <>
      <style>{STYLE}</style>
      <div className="percorso-wrap no-sb" style={{ height: "100vh", overflowY: "auto" }}>

        {/* Starfield */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
          {STARS.map(s => (
            <div key={s.id} style={{
              position: "absolute",
              left: `${s.x}%`, top: `${s.y}%`,
              width: s.r, height: s.r, borderRadius: "50%",
              background: "white",
              ["--sop" as any]: s.op,
              opacity: s.op,
              animation: `floatStar ${s.dur}s ease-in-out ${s.del}s infinite`,
            }} />
          ))}
        </div>

        {/* ── Header ── */}
        <div style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "rgba(9,5,20,0.88)", backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(139,92,246,0.18)",
          padding: "12px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 9.5, color: "#a78bfa", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase" }}>MINKIARDS</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "white", lineHeight: 1.15 }}>Ciao, Luca!</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{
                fontSize: 17, fontWeight: 900,
                background: "linear-gradient(90deg,#f59e0b,#fde68a,#f59e0b)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                animation: "shimmer 2.5s linear infinite",
              }}>1.240 ⭐</div>
              <div style={{ fontSize: 9, color: "#4b5563", fontWeight: 700 }}>Rankiard</div>
            </div>
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
              border: "2px solid #a78bfa66",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 17, boxShadow: "0 0 10px #7c3aed55",
            }}>👤</div>
          </div>
        </div>

        {/* ── Rank bar ── */}
        <div style={{ padding: "10px 18px 4px", position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "#4b5563", fontWeight: 700, marginBottom: 4 }}>
            <span style={{ color: "#a78bfa" }}>Campione IV</span>
            <span>Campione III <span style={{ color: "#1f2937" }}>(1.500)</span></span>
          </div>
          <div style={{ height: 5, background: "#0f0a1e", borderRadius: 99, border: "1px solid #1e1040", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: "82%", borderRadius: 99,
              background: "linear-gradient(to right,#7c3aed,#6366f1,#60a5fa)",
              transition: "width 1.5s cubic-bezier(0.16,1,0.3,1)",
            }} />
          </div>
        </div>

        {/* ── Section title ── */}
        <div style={{
          padding: "14px 18px 8px", display: "flex", alignItems: "center", gap: 8, position: "relative", zIndex: 2,
        }}>
          <span style={{ width: 3, height: 17, background: "#f59e0b", borderRadius: 2, display: "inline-block", boxShadow: "0 0 7px #f59e0b" }} />
          <span style={{ fontSize: 12, fontWeight: 800, color: "#f1f5f9", letterSpacing: "0.05em" }}>IL TUO PERCORSO</span>
          <span style={{ marginLeft: "auto", fontSize: 10, color: "#374151", fontWeight: 700 }}>{done}/{total} completate</span>
        </div>

        {/* ── Map ── */}
        <div style={{ position: "relative", width: "100%", height: totalH, zIndex: 2 }}>
          <CenterPath />

          {TAPPE.map((t, i) => {
            const side: "left" | "right" = i % 2 === 0 ? "right" : "left";
            const y = topPad + i * nodeH;

            return (
              <div key={t.id} style={{
                position: "absolute", top: y, left: 0, right: 0,
                height: nodeH,
                display: "flex", alignItems: "center",
                padding: "0 14px",
                gap: 8,
                animationDelay: `${i * 0.07}s`,
              }}>
                {side === "left" ? (
                  <>
                    <Card t={t} align="right" />
                    <Node t={t} />
                    <div style={{ flex: 1 }} />
                  </>
                ) : (
                  <>
                    <div style={{ flex: 1 }} />
                    <Node t={t} />
                    <Card t={t} align="left" />
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* ── CTA button ── */}
        <div style={{ padding: "4px 18px 36px", position: "relative", zIndex: 2 }}>
          <button style={{
            width: "100%", padding: "15px",
            borderRadius: 18,
            background: "linear-gradient(135deg,#14532d,#166534)",
            border: "2px solid #4ade8066",
            color: "white", fontSize: 15, fontWeight: 900,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            letterSpacing: "0.06em",
            boxShadow: "0 0 20px rgba(74,222,128,0.35), 0 8px 28px rgba(0,0,0,0.4)",
            animation: "glowPulse 2s ease-in-out infinite",
          }}>
            🎮 GIOCA ORA
          </button>
        </div>
      </div>
    </>
  );
}
