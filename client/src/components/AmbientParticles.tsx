import React, { useMemo } from "react";

const PARTICLE_COLORS = [
  "rgba(147, 51, 234, 0.4)",
  "rgba(6, 182, 212, 0.35)",
  "rgba(59, 130, 246, 0.35)",
  "rgba(255, 255, 255, 0.2)",
  "rgba(139, 92, 246, 0.3)",
  "rgba(34, 211, 238, 0.3)",
];

interface Particle {
  id: number;
  size: number;
  color: string;
  left: number;
  top: number;
  duration: number;
  delay: number;
  xOffset1: number;
  yOffset1: number;
  xOffset2: number;
  yOffset2: number;
  xOffset3: number;
  yOffset3: number;
}

export const AmbientParticles: React.FC = () => {
  const particles = useMemo<Particle[]>(() => {
    const count = 18;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      size: 2 + Math.random() * 2,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      left: Math.random() * 100,
      top: Math.random() * 100,
      duration: 15 + Math.random() * 15,
      delay: -(Math.random() * 20),
      xOffset1: -30 + Math.random() * 60,
      yOffset1: -40 + Math.random() * 80,
      xOffset2: -50 + Math.random() * 100,
      yOffset2: -30 + Math.random() * 60,
      xOffset3: -20 + Math.random() * 40,
      yOffset3: -50 + Math.random() * 100,
    }));
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        borderRadius: "inherit",
        zIndex: 1,
      }}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: "50%",
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}, 0 0 ${p.size * 4}px ${p.color}`,
            animation: `ambient-float-${p.id} ${p.duration}s ease-in-out ${p.delay}s infinite`,
            opacity: 0.7,
          }}
        />
      ))}
      <style>
        {particles
          .map(
            (p) => `
          @keyframes ambient-float-${p.id} {
            0%, 100% { transform: translate(0, 0); opacity: 0.5; }
            25% { transform: translate(${p.xOffset1}px, ${p.yOffset1}px); opacity: 0.8; }
            50% { transform: translate(${p.xOffset2}px, ${p.yOffset2}px); opacity: 0.4; }
            75% { transform: translate(${p.xOffset3}px, ${p.yOffset3}px); opacity: 0.7; }
          }
        `
          )
          .join("\n")}
      </style>
    </div>
  );
};
