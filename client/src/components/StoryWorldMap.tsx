import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { GymLeader } from '../types/gym';

/* ── Interfaces (unchanged) ─────────────────────────────────── */
export interface StoryLocality {
  id: number;
  name: string;
  type: string;
  description?: string | null;
  posX: number;
  posZ: number;
  icon: string;
  imageUrl?: string | null;
  isActive: boolean;
}

export interface StoryCollectible {
  id: number;
  type: 'coin' | 'card';
  subtype?: string;
  cardId?: string;
  imageUrl?: string;
  posX: number;
  posZ: number;
  creditValue?: number;
  collected: boolean;
}

export interface StoryWorldMapProps {
  leaders: GymLeader[];
  lostLeaderIds: number[];
  currentLeader: GymLeader | null;
  pendingGymGame?: { gameId: string; gymLeaderCpuName?: string; gymLeaderId?: number } | null;
  loading: boolean;
  getLeaderStatus: (leader: GymLeader) => 'completed' | 'available' | 'locked';
  onChallengeLeader: (leader: GymLeader) => void;
  onResumeGame: (leader: GymLeader, gameId: string) => void;
  localities?: StoryLocality[];
  collectibles?: StoryCollectible[];
}

/* ── World constants (identical to 3D version) ──────────────── */
const PLAYER_SPEED = 9;
const MAP_BOUND    = 42;

const ARENA_POSITIONS_BASE: [number, number][] = [
  [  0,  30 ], [ 26,  20 ], [ 36,   4 ], [ 24, -12 ],
  [  6, -26 ], [ -8, -36 ], [-22, -28 ], [-35, -12 ],
  [-34,   8 ], [-20,  22 ], [ -6,  36 ], [ 24,  36 ],
];

function getArenaPosition(idx: number): [number, number] {
  if (idx < ARENA_POSITIONS_BASE.length) return ARENA_POSITIONS_BASE[idx];
  const t = (idx - ARENA_POSITIONS_BASE.length + 1) * 1.37;
  const r = 28 + t * 3.5;
  const x = Math.round(Math.cos(t) * r);
  const z = Math.round(Math.sin(t) * r);
  return [Math.max(-38, Math.min(38, x)), Math.max(-40, Math.min(40, z))];
}

const TREE_DATA: { x: number; z: number; h: number; r: number }[] = [
  { x: 30, z: 30, h: 2.4, r: 0.9 }, { x:-28, z: 28, h: 2.0, r: 0.75 },
  { x: 32, z: 10, h: 2.8, r: 1.0 }, { x:-30, z:-12, h: 2.2, r: 0.85 },
  { x: 28, z:-35, h: 2.5, r: 0.95 }, { x:-32, z:-35, h: 2.0, r: 0.8 },
  { x:  5, z: 35, h: 2.6, r: 1.0 }, { x:-14, z: 32, h: 2.1, r: 0.7 },
  { x: 22, z: 24, h: 2.3, r: 0.9 }, { x: 36, z:-10, h: 2.4, r: 0.85 },
  { x:-36, z: 10, h: 2.2, r: 0.8 }, { x: 38, z:-25, h: 2.7, r: 1.0 },
  { x:-38, z:-22, h: 2.0, r: 0.75 }, { x:  0, z:-40, h: 2.8, r: 1.0 },
  { x: 18, z: 35, h: 2.1, r: 0.7 }, { x:-20, z:-42, h: 2.5, r: 0.9 },
  { x: 34, z: 36, h: 2.2, r: 0.8 }, { x:-34, z: 35, h: 2.4, r: 0.9 },
  { x: 40, z:  0, h: 2.3, r: 0.85 }, { x:-40, z: -5, h: 2.6, r: 0.95 },
  { x: 14, z:-42, h: 2.0, r: 0.75 }, { x:-10, z: 40, h: 2.2, r: 0.8 },
  { x: 24, z:-14, h: 2.5, r: 0.9 }, { x: -6, z:-38, h: 2.1, r: 0.7 },
  { x: 16, z: 28, h: 2.3, r: 0.85 },
];

const WATER_DATA: { x: number; z: number; r: number }[] = [
  { x:  6,  z: -8,  r: 6.5 },
  { x:-12,  z: 18,  r: 3.5 },
  { x: 22,  z:-28,  r: 3.0 },
  { x:-30,  z:-38,  r: 2.5 },
];

const HEDGE_DATA: { x:number; z:number; ry:number; n:number }[] = [
  { x:-12, z:  6, ry: 0,           n: 8 }, { x: 10, z:-40, ry: 0,           n: 6 },
  { x:-18, z: 16, ry: Math.PI / 2, n: 7 }, { x: -5, z:-18, ry: Math.PI / 2, n: 6 },
  { x: 28, z:  8, ry: Math.PI / 2, n: 5 }, { x:-22, z: -6, ry: 0.2,         n: 6 },
  { x: 15, z:-38, ry: 0,           n: 5 }, { x:-30, z: 30, ry: Math.PI / 2, n: 6 },
  { x:  2, z: 20, ry: 0.5,         n: 5 }, { x: 20, z:-30, ry: 0.2,         n: 4 },
];
const HEDGE_PIECES: { x:number; z:number; dark:boolean }[] = HEDGE_DATA.flatMap((row) =>
  Array.from({ length: row.n }, (_, i) => {
    const offset = (i - (row.n - 1) / 2) * 1.3;
    return { x: row.x + Math.sin(row.ry) * offset, z: row.z + Math.cos(row.ry) * offset, dark: i % 2 === 0 };
  })
);

const BOULDER_DATA: { x:number; z:number; sy:number; sx:number; twin:boolean }[] = [
  { x:-14, z: -6, sy:1.5, sx:1.2, twin:true  }, { x: 20, z:-22, sy:1.0, sx:0.9, twin:false },
  { x: -9, z: 17, sy:1.2, sx:1.1, twin:true  }, { x:  6, z:-16, sy:1.8, sx:1.4, twin:false },
  { x:-26, z:  9, sy:1.0, sx:0.8, twin:true  }, { x: 19, z: 29, sy:1.3, sx:1.0, twin:false },
  { x:-32, z: -4, sy:1.6, sx:1.3, twin:true  }, { x: 11, z:-31, sy:1.1, sx:0.9, twin:false },
  { x:-17, z: 26, sy:1.0, sx:1.0, twin:true  }, { x: 32, z: 14, sy:0.9, sx:0.8, twin:false },
  { x: -8, z:-26, sy:1.4, sx:1.2, twin:true  }, { x: 26, z:-36, sy:1.1, sx:0.9, twin:false },
  { x:-40, z: 20, sy:1.2, sx:1.0, twin:true  }, { x: 38, z: 22, sy:1.0, sx:0.8, twin:false },
  { x: 18, z:-38, sy:0.9, sx:1.1, twin:true  }, { x:-18, z:-38, sy:1.3, sx:1.0, twin:false },
  { x: 36, z:-32, sy:1.1, sx:0.9, twin:true  }, { x:-38, z:-28, sy:1.0, sx:1.2, twin:false },
];

const FLOWER_DATA: { x:number; z:number; r:number; color:string }[] = [
  { x:  8, z: 18, r:2.5, color:'#ff6b9d' }, { x:-20, z:  5, r:2.0, color:'#fbbf24' },
  { x: 16, z: -6, r:1.8, color:'#a78bfa' }, { x: -9, z: 28, r:2.2, color:'#34d399' },
  { x: 28, z: 10, r:1.6, color:'#f97316' }, { x:-28, z:-30, r:2.0, color:'#60a5fa' },
  { x:  5, z:-20, r:1.5, color:'#fbbf24' }, { x:-16, z: 35, r:1.8, color:'#ff6b9d' },
  { x: 20, z:-38, r:2.2, color:'#a78bfa' }, { x:-35, z: 30, r:1.6, color:'#34d399' },
  { x: -2, z:  8, r:1.4, color:'#f97316' }, { x: 33, z:-18, r:1.8, color:'#60a5fa' },
  { x:-10, z:-15, r:1.6, color:'#ff6b9d' }, { x: 22, z: 14, r:1.5, color:'#fbbf24' },
];

const LAMP_DATA: { x:number; z:number }[] = [
  { x:  8, z: 24 }, { x: 20, z: 18 }, { x: 32, z:  8 }, { x: 28, z: -6 },
  { x: 18, z:-16 }, { x:  4, z:-28 }, { x:-10, z:-34 }, { x:-24, z:-26 },
  { x:-36, z:-14 }, { x:-36, z:  0 }, { x:-28, z: 14 }, { x:-14, z: 26 },
  { x:  2, z: 36 },
];

const WALL_DATA: { x:number; z:number; ry:number; n:number }[] = [
  { x: 16, z:  7, ry: 0.1,         n: 5 }, { x: -4, z:-11, ry: Math.PI / 2, n: 5 },
  { x:-28, z:-17, ry: 0.3,         n: 6 }, { x:  9, z:-28, ry:-0.2,         n: 4 },
  { x:-19, z: 31, ry: 0.5,         n: 5 }, { x: 30, z:-28, ry: 1.2,         n: 4 },
];
const WALL_PIECES: { x:number; z:number; alt:boolean }[] = WALL_DATA.flatMap((wall) =>
  Array.from({ length: wall.n }, (_, i) => {
    const offset = (i - (wall.n - 1) / 2) * 1.2;
    return { x: wall.x + Math.sin(wall.ry) * offset, z: wall.z + Math.cos(wall.ry) * offset, alt: i % 2 === 0 };
  })
);

const _sr = (seed: number) => { const x = Math.sin(seed + 1) * 10000; return x - Math.floor(x); };
const TALLGRASS_PATCHES = [
  { cx: -3,  cz: 14,  n: 22 }, { cx: 10,  cz: -6,  n: 18 }, { cx:-25,  cz:  0,  n: 16 },
  { cx: 18,  cz:-20,  n: 16 }, { cx:-14,  cz:-14,  n: 14 }, { cx: -8,  cz: 36,  n: 12 },
].map((patch, pi) => ({
  cx: patch.cx, cz: patch.cz,
  blades: Array.from({ length: patch.n }, (_, i) => ({
    dx: (_sr(pi * 200 + i * 4)     - 0.5) * 5.5,
    dz: (_sr(pi * 200 + i * 4 + 1) - 0.5) * 5.5,
    h:  0.5 + _sr(pi * 200 + i * 4 + 2) * 0.55,
    ry: _sr(pi * 200 + i * 4 + 3) * Math.PI * 2,
  })),
}));

/* ── 2D Canvas rendering constants ───────────────────────────── */
const TILE = 20;

const ARENA_COLORS = [
  '#c0392b','#e67e22','#e8b800','#27ae60','#1abc9c',
  '#2980b9','#8e44ad','#e91e63','#ff5722','#607d8b',
  '#795548','#4caf50',
];

const LOCALITY_COLORS: Record<string, string> = {
  town: '#f97316', shop: '#3b82f6', inn: '#a855f7',
  forest: '#22c55e', shrine: '#eab308', custom: '#06b6d4',
};

/* ── Canvas helpers ───────────────────────────────────────────── */
function rrect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  const rad = Math.min(r, Math.min(Math.abs(w), Math.abs(h)) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y, x + w, y + rad, rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x, y + h, x, y + h - rad, rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x, y, x + rad, y, rad);
  ctx.closePath();
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lighten(hex: string, amt: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255,r+amt)},${Math.min(255,g+amt)},${Math.min(255,b+amt)})`;
}
function darken(hex: string, amt: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.max(0,r-amt)},${Math.max(0,g-amt)},${Math.max(0,b-amt)})`;
}

/* ── GPS Minimap overlay ─────────────────────────────────────── */
interface MinimapProps {
  playerRef: React.RefObject<{ x: number; z: number }>;
  arenaPositions: [number, number][];
  leaders: GymLeader[];
  getLeaderStatus: (leader: GymLeader) => 'completed' | 'available' | 'locked';
  localities: StoryLocality[];
}

function Minimap({ playerRef, arenaPositions, leaders, getLeaderStatus, localities }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const SIZE  = 160;
    const PAD   = 8;
    const WORLD = 84;
    const scale = (SIZE - PAD * 2) / WORLD;

    const toC = (wx: number, wz: number) => ({
      x: PAD + (wx + 42) * scale,
      y: PAD + (wz + 42) * scale,
    });

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) { rafRef.current = requestAnimationFrame(draw); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }

      ctx.clearRect(0, 0, SIZE, SIZE);

      rrect(ctx, 0, 0, SIZE, SIZE, 10);
      ctx.fillStyle = 'rgba(3,4,18,0.92)';
      ctx.fill();

      rrect(ctx, 0.5, 0.5, SIZE - 1, SIZE - 1, 10);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MAPPA', SIZE / 2, 14);

      /* Path */
      ctx.strokeStyle = 'rgba(200,168,83,0.45)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < Math.min(leaders.length, ARENA_POSITIONS_BASE.length) - 1; i++) {
        const [ax, az] = arenaPositions[i] ?? getArenaPosition(i);
        const [bx, bz] = arenaPositions[i+1] ?? getArenaPosition(i+1);
        const a = toC(ax, az); const b = toC(bx, bz);
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();

      /* Localities */
      localities.forEach(loc => {
        const { x, y } = toC(loc.posX, loc.posZ);
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = LOCALITY_COLORS[loc.type] ?? '#60a5fa';
        ctx.fillRect(-3, -3, 6, 6);
        ctx.restore();
      });

      /* Arenas */
      arenaPositions.forEach(([ax, az], idx) => {
        if (idx >= leaders.length) return;
        const status = getLeaderStatus(leaders[idx]);
        const { x, y } = toC(ax, az);
        const color = status === 'completed' ? '#4ade80' : status === 'available' ? '#fbbf24' : '#4b5563';
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
        if (status !== 'locked') {
          ctx.beginPath(); ctx.arc(x, y, 6.5, 0, Math.PI * 2);
          ctx.strokeStyle = color + '66'; ctx.lineWidth = 1.5; ctx.stroke();
        }
      });

      /* Player */
      const p = playerRef.current;
      if (p) {
        const { x, y } = toC(p.x, p.z);
        const grd = ctx.createRadialGradient(x, y, 0, x, y, 9);
        grd.addColorStop(0, 'rgba(167,139,250,0.55)');
        grd.addColorStop(1, 'rgba(167,139,250,0)');
        ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fillStyle = grd; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#a78bfa'; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [arenaPositions, leaders, getLeaderStatus, localities, playerRef]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
        opacity: hovered ? 1 : 0.55, transition: 'opacity 0.25s ease',
        zIndex: 20, borderRadius: 10, overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.7)', cursor: 'default',
      }}
    >
      <canvas ref={canvasRef} width={160} height={160} style={{ display: 'block' }} />
      {hovered && (
        <div style={{
          position: 'absolute', bottom: 4, right: 6,
          fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.05em',
        }}>
          🟢 completato &nbsp; 🟡 disponibile
        </div>
      )}
    </div>
  );
}

/* ── Mobile joystick button ─────────────────────────────────── */
interface JoystickBtnProps { label: string; onStart: () => void; onEnd: () => void; }

function JoystickBtn({ label, onStart, onEnd }: JoystickBtnProps) {
  return (
    <div
      onPointerDown={(e) => { e.preventDefault(); onStart(); }}
      onPointerUp={onEnd} onPointerLeave={onEnd}
      style={{
        width: 52, height: 52, borderRadius: 12,
        background: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, userSelect: 'none', cursor: 'pointer',
        touchAction: 'none', WebkitUserSelect: 'none',
      }}
    >
      {label}
    </div>
  );
}

/* ── Main exported component ────────────────────────────────── */
export function StoryWorldMap({
  leaders,
  lostLeaderIds,
  currentLeader,
  pendingGymGame,
  loading,
  getLeaderStatus,
  onChallengeLeader,
  onResumeGame,
  localities = [],
  collectibles = [],
}: StoryWorldMapProps) {

  /* ── Canvas + container refs ────────────────────────────── */
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sizeRef      = useRef<{ w: number; h: number }>({ w: 800, h: 600 });

  /* ── Game state refs (no re-render on change) ──────────── */
  const playerRef = useRef<{ x: number; z: number }>({ x: 0, z: 26 });
  const camRef    = useRef<{ x: number; z: number }>({ x: 0, z: 26 });
  const keysRef   = useRef<Set<string>>(new Set());
  const joyRef    = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const timeRef   = useRef(0);
  const walkRef   = useRef(0);
  const movingRef = useRef(false);

  /* ── Prop refs (stable for game loop) ──────────────────── */
  const leadersRef              = useRef(leaders);
  const getLeaderStatusRef      = useRef(getLeaderStatus);
  const onChallengeLeaderRef    = useRef(onChallengeLeader);
  const localitiesRef           = useRef(localities);
  const collectiblesRef         = useRef(collectibles);
  const localCollectedIdsRef    = useRef<Set<number>>(new Set());

  useEffect(() => { leadersRef.current = leaders; }, [leaders]);
  useEffect(() => { getLeaderStatusRef.current = getLeaderStatus; }, [getLeaderStatus]);
  useEffect(() => { onChallengeLeaderRef.current = onChallengeLeader; }, [onChallengeLeader]);
  useEffect(() => { localitiesRef.current = localities; }, [localities]);
  useEffect(() => { collectiblesRef.current = collectibles; }, [collectibles]);

  /* ── React UI state ────────────────────────────────────── */
  const [nearestLeaderId, setNearestLeaderId] = useState<number | null>(null);
  const [nearestDist,     setNearestDist]     = useState(Infinity);
  const [showHint,        setShowHint]        = useState(true);
  const [isTouchDevice] = useState(
    () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );
  const [nearCollectible,    setNearCollectible]    = useState<StoryCollectible | null>(null);
  const [localCollectedIds,  setLocalCollectedIds]  = useState<Set<number>>(new Set());
  const [isCollecting,       setIsCollecting]       = useState(false);
  const [collectResult,      setCollectResult]      = useState<{ type: string; credits?: number; cardId?: string; subtype?: string } | null>(null);
  const [cardReveal,         setCardReveal]         = useState<StoryCollectible | null>(null);

  /* floating "+X crediti" canvas animations */
  const floatingTextsRef = useRef<{ text: string; x: number; z: number; color: string; startTime: number }[]>([]);

  /* Keep ref in sync with state for game loop reads */
  useEffect(() => { localCollectedIdsRef.current = localCollectedIds; }, [localCollectedIds]);

  /* ── Arena positions (memoized) ────────────────────────── */
  const arenaPositions = useMemo(
    () => leaders.map((_, idx) => getArenaPosition(idx)),
    [leaders]
  );
  const arenaPositionsRef = useRef(arenaPositions);
  useEffect(() => { arenaPositionsRef.current = arenaPositions; }, [arenaPositions]);

  /* ── Visible collectibles ──────────────────────────────── */
  const visibleCollectibles = useMemo(
    () => collectibles.filter(c => !c.collected && !localCollectedIds.has(c.id)),
    [collectibles, localCollectedIds]
  );
  const visibleCollectiblesRef = useRef(visibleCollectibles);
  useEffect(() => { visibleCollectiblesRef.current = visibleCollectibles; }, [visibleCollectibles]);

  /* ── Derived state for HUD ─────────────────────────────── */
  const nearLeader = useMemo(() => leaders.find(l => l.id === nearestLeaderId) ?? null, [leaders, nearestLeaderId]);
  const completedCount = useMemo(() => leaders.filter(l => getLeaderStatus(l) === 'completed').length, [leaders, getLeaderStatus]);

  /* ── Proximity state refs (to debounce setState calls) ─── */
  const lastNearLeaderIdRef    = useRef<number | null>(null);
  const lastNearDistRef        = useRef(Infinity);
  const lastNearCollIdRef      = useRef<number | null>(null);
  const proximityTimerRef      = useRef(0);

  /* ── Keyboard listeners ────────────────────────────────── */
  useEffect(() => {
    const down = (e: KeyboardEvent) => keysRef.current.add(e.code);
    const up   = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  /* ── Canvas click: arena hit-testing (via React props on canvas) ── */
  const ARENA_HIT_RADIUS = 4.0;
  const canvasScreenToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const { w, h } = sizeRef.current;
    return {
      x: (clientX - rect.left - w / 2) / TILE + camRef.current.x,
      z: (clientY - rect.top  - h / 2) / TILE + camRef.current.z,
    };
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = canvasScreenToWorld(e.clientX, e.clientY);
    if (!pos) return;
    const lrs = leadersRef.current;
    const aps = arenaPositionsRef.current;
    let best: { leader: GymLeader; dist: number } | null = null;
    lrs.forEach((l, idx) => {
      const [ax, az] = aps[idx] ?? getArenaPosition(idx);
      const dist = Math.sqrt((pos.x - ax) ** 2 + (pos.z - az) ** 2);
      if (!best || dist < best.dist) best = { leader: l, dist };
    });
    if (best && best.dist < ARENA_HIT_RADIUS) {
      const status = getLeaderStatusRef.current(best.leader);
      if (status !== 'locked') onChallengeLeaderRef.current(best.leader);
    }
  }, [canvasScreenToWorld]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = canvasScreenToWorld(e.clientX, e.clientY);
    const canvas = canvasRef.current;
    if (!pos || !canvas) return;
    const lrs = leadersRef.current;
    const aps = arenaPositionsRef.current;
    for (let idx = 0; idx < lrs.length; idx++) {
      const [ax, az] = aps[idx] ?? getArenaPosition(idx);
      const dist = Math.sqrt((pos.x - ax) ** 2 + (pos.z - az) ** 2);
      if (dist < ARENA_HIT_RADIUS && getLeaderStatusRef.current(lrs[idx]) !== 'locked') {
        canvas.style.cursor = 'pointer'; return;
      }
    }
    canvas.style.cursor = 'default';
  }, [canvasScreenToWorld]);

  /* ── Resize observer ───────────────────────────────────── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        sizeRef.current = { w: width, h: height };
        const canvas = canvasRef.current;
        if (canvas) { canvas.width = width; canvas.height = height; }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  /* ── Texture / image loading ───────────────────────────── */
  const grassImgRef  = useRef<HTMLImageElement | null>(null);
  const sandImgRef   = useRef<HTMLImageElement | null>(null);
  const woodImgRef   = useRef<HTMLImageElement | null>(null);
  const grassPatRef  = useRef<CanvasPattern | null>(null);
  const sandPatRef   = useRef<CanvasPattern | null>(null);
  const woodPatRef   = useRef<CanvasPattern | null>(null);
  const leaderImgMapRef = useRef<Map<number, HTMLImageElement>>(new Map());

  useEffect(() => {
    const gi = new Image(); gi.src = '/textures/grass.png';
    const si = new Image(); si.src = '/textures/sand.jpg';
    const wi = new Image(); wi.src = '/textures/wood.jpg';
    grassImgRef.current = gi; sandImgRef.current = si; woodImgRef.current = wi;
  }, []);

  /* Preload leader images when leaders change */
  useEffect(() => {
    leaders.forEach(l => {
      if (l.leaderImageUrl && !leaderImgMapRef.current.has(l.id)) {
        const img = new Image();
        img.src = l.leaderImageUrl;
        leaderImgMapRef.current.set(l.id, img);
      }
    });
  }, [leaders]);

  /* ── Main game loop ────────────────────────────────────── */
  useEffect(() => {
    let raf = 0;
    let lastTime = performance.now();

    /* --- world → screen ----------------------------------- */
    const w2s = (wx: number, wz: number): [number, number] => {
      const { w, h } = sizeRef.current;
      return [
        Math.round((wx - camRef.current.x) * TILE + w / 2),
        Math.round((wz - camRef.current.z) * TILE + h / 2),
      ];
    };

    /* --- ensure texture patterns -------------------------- */
    const ensurePatterns = (ctx: CanvasRenderingContext2D, camX: number, camZ: number) => {
      const { w, h } = sizeRef.current;
      /* Grass */
      const gi = grassImgRef.current;
      if (gi && gi.complete && gi.naturalWidth > 0) {
        if (!grassPatRef.current) grassPatRef.current = ctx.createPattern(gi, 'repeat');
        if (grassPatRef.current) {
          const scale = (TILE * 4) / gi.naturalWidth;
          const ox = ((w / 2 - camX * TILE) % (gi.naturalWidth * scale) + gi.naturalWidth * scale) % (gi.naturalWidth * scale);
          const oz = ((h / 2 - camZ * TILE) % (gi.naturalWidth * scale) + gi.naturalWidth * scale) % (gi.naturalWidth * scale);
          grassPatRef.current.setTransform(new DOMMatrix([scale, 0, 0, scale, ox, oz]));
        }
      }
      /* Sand */
      const si = sandImgRef.current;
      if (si && si.complete && si.naturalWidth > 0) {
        if (!sandPatRef.current) sandPatRef.current = ctx.createPattern(si, 'repeat');
        if (sandPatRef.current) {
          const scale = (TILE * 2) / si.naturalWidth;
          const ox = ((w / 2 - camX * TILE) % (si.naturalWidth * scale) + si.naturalWidth * scale) % (si.naturalWidth * scale);
          const oz = ((h / 2 - camZ * TILE) % (si.naturalWidth * scale) + si.naturalWidth * scale) % (si.naturalWidth * scale);
          sandPatRef.current.setTransform(new DOMMatrix([scale, 0, 0, scale, ox, oz]));
        }
      }
      /* Wood */
      const wi = woodImgRef.current;
      if (wi && wi.complete && wi.naturalWidth > 0) {
        if (!woodPatRef.current) woodPatRef.current = ctx.createPattern(wi, 'repeat');
        if (woodPatRef.current) {
          const scale = TILE / wi.naturalWidth;
          const ox = ((w / 2 - camX * TILE) % (wi.naturalWidth * scale) + wi.naturalWidth * scale) % (wi.naturalWidth * scale);
          const oz = ((h / 2 - camZ * TILE) % (wi.naturalWidth * scale) + wi.naturalWidth * scale) % (wi.naturalWidth * scale);
          woodPatRef.current.setTransform(new DOMMatrix([scale, 0, 0, scale, ox, oz]));
        }
      }
    };

    /* --- draw helpers ------------------------------------- */
    const drawTree = (ctx: CanvasRenderingContext2D, tree: typeof TREE_DATA[0]) => {
      const [sx, sy] = w2s(tree.x, tree.z);
      const R = tree.r * TILE;
      /* shadow */
      ctx.beginPath(); ctx.ellipse(sx, sy + R * 0.2, R * 0.9, R * 0.38, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill();
      /* trunk */
      const tw = 0.22 * TILE; const th = R * 1.1;
      ctx.fillStyle = '#5c3318';
      ctx.fillRect(sx - tw / 2, sy - th * 0.15, tw, th * 0.55);
      /* foliage outer ring (darker) */
      ctx.beginPath(); ctx.arc(sx, sy - R * 0.9, R * 1.05, 0, Math.PI * 2);
      ctx.fillStyle = '#1a5c1a'; ctx.fill();
      /* foliage main */
      ctx.beginPath(); ctx.arc(sx, sy - R * 0.95, R, 0, Math.PI * 2);
      ctx.fillStyle = '#236b23'; ctx.fill();
      /* foliage highlight */
      ctx.beginPath(); ctx.arc(sx - R * 0.22, sy - R * 1.15, R * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = '#2e8c2e'; ctx.fill();
    };

    const drawArena = (
      ctx: CanvasRenderingContext2D,
      cx: number, cy: number,
      leader: GymLeader,
      status: 'completed' | 'available' | 'locked',
      isNear: boolean,
      idx: number,
      time: number,
    ) => {
      const color = ARENA_COLORS[idx % ARENA_COLORS.length];
      const bW = 3.2 * TILE; const bH = 3.6 * TILE;
      const roofH = bH * 0.32;

      /* proximity glow */
      if (isNear && status !== 'locked') {
        const pulse = 0.3 + Math.sin(time * 3) * 0.15;
        ctx.beginPath(); ctx.arc(cx, cy, bW * 0.72, 0, Math.PI * 2);
        ctx.strokeStyle = status === 'completed' ? `rgba(74,222,128,${pulse})` : `rgba(251,191,36,${pulse})`;
        ctx.lineWidth = 3; ctx.stroke();
      }

      /* shadow */
      ctx.beginPath(); ctx.ellipse(cx + 3, cy + bH * 0.38, bW * 0.42, bH * 0.18, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();

      /* body */
      const bodyColor = status === 'locked' ? '#374151' : color;
      rrect(ctx, cx - bW / 2, cy - bH / 2, bW, bH, 7);
      ctx.fillStyle = bodyColor; ctx.fill();
      ctx.strokeStyle = status === 'locked' ? '#4b5563' : darken(color, 40);
      ctx.lineWidth = 1.5; ctx.stroke();

      /* roof band */
      const roofColor = status === 'locked' ? '#4b5563' : lighten(color, 35);
      rrect(ctx, cx - bW / 2, cy - bH / 2, bW, roofH, 7);
      ctx.fillStyle = roofColor; ctx.fill();

      /* roof ridge line */
      ctx.beginPath();
      ctx.moveTo(cx - bW / 2 + 4, cy - bH / 2 + roofH);
      ctx.lineTo(cx + bW / 2 - 4, cy - bH / 2 + roofH);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1; ctx.stroke();

      /* door */
      const doorW = bW * 0.28; const doorH = bH * 0.25;
      ctx.fillStyle = darken(bodyColor, 50);
      ctx.fillRect(cx - doorW / 2, cy + bH / 2 - doorH - 1, doorW, doorH);
      /* door arch top */
      ctx.beginPath();
      ctx.arc(cx, cy + bH / 2 - doorH - 1, doorW / 2, Math.PI, 0);
      ctx.fill();

      /* windows */
      const winY = cy - bH * 0.08;
      [cx - bW * 0.22, cx + bW * 0.22].forEach(wx => {
        ctx.fillStyle = 'rgba(255,255,200,0.25)';
        ctx.fillRect(wx - 5, winY - 5, 10, 8);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
        ctx.strokeRect(wx - 5, winY - 5, 10, 8);
      });

      /* leader portrait (clipped circle) */
      const imgCy = cy - bH * 0.15;
      const leaderImg = leaderImgMapRef.current.get(leader.id);
      if (leaderImg && leaderImg.complete && leaderImg.naturalWidth > 0 && status !== 'locked') {
        const pr = 0.55 * TILE;
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, imgCy, pr, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(leaderImg, cx - pr, imgCy - pr, pr * 2, pr * 2);
        ctx.restore();
        ctx.beginPath(); ctx.arc(cx, imgCy, pr, 0, Math.PI * 2);
        ctx.strokeStyle = status === 'completed' ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 2; ctx.stroke();
      } else {
        /* emoji fallback */
        ctx.font = `${Math.round(0.7 * TILE)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(status === 'completed' ? '✓' : status === 'locked' ? '🔒' : '⚔️', cx, imgCy);
      }

      /* status chip */
      const chipColor = status === 'completed' ? '#4ade80' : status === 'available' ? '#fbbf24' : '#6b7280';
      ctx.beginPath(); ctx.arc(cx + bW * 0.36, cy - bH * 0.42, 7, 0, Math.PI * 2);
      ctx.fillStyle = chipColor; ctx.fill();
      ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#111';
      ctx.fillText(status === 'completed' ? '✓' : status === 'locked' ? '🔒' : '!', cx + bW * 0.36, cy - bH * 0.42);

      /* number badge */
      ctx.beginPath(); ctx.arc(cx - bW * 0.36, cy - bH * 0.42, 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${idx + 1}`, cx - bW * 0.36, cy - bH * 0.42);

      /* gym name */
      ctx.font = `bold ${Math.round(0.5 * TILE)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = status === 'locked' ? 'rgba(107,114,128,0.9)' : 'rgba(255,255,255,0.88)';
      const name = leader.gymName || leader.name;
      ctx.fillText(name.length > 12 ? name.slice(0, 11) + '…' : name, cx, cy + bH / 2 + 4);
    };

    const drawCollectible = (ctx: CanvasRenderingContext2D, c: StoryCollectible, time: number, alpha: number) => {
      const [sx, sy] = w2s(c.posX, c.posZ);
      const bob = Math.sin(time * 2.2 + c.id * 0.9) * 4;
      const spin = time * 1.8 + c.id;

      ctx.save();
      ctx.globalAlpha = alpha;

      /* ground glow */
      const glowColor = c.type === 'coin' ? 'rgba(251,191,36,0.3)' : 'rgba(167,139,250,0.25)';
      ctx.beginPath(); ctx.ellipse(sx, sy + 4, 14, 5, 0, 0, Math.PI * 2);
      ctx.fillStyle = glowColor; ctx.fill();

      if (c.type === 'coin') {
        /* spinning coin (ellipse squish) */
        const scaleX = Math.abs(Math.cos(spin));
        ctx.save(); ctx.translate(sx, sy - 12 + bob);
        ctx.scale(scaleX + 0.05, 1);
        ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24'; ctx.fill();
        ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
        /* star */
        ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('★', sx, sy - 12 + bob);
      } else {
        /* card */
        const cColor = c.subtype === 'personaggi' ? '#818cf8' : c.subtype === 'mossa' ? '#f87171' : '#4ade80';
        ctx.save(); ctx.translate(sx, sy - 10 + bob); ctx.rotate(Math.sin(time * 0.9 + c.id) * 0.15);
        rrect(ctx, -8, -11, 16, 22, 3); ctx.fillStyle = cColor; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1; ctx.stroke();
        /* shine stripe */
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(-6, -6, 12, 4);
        ctx.restore();
      }

      ctx.restore(); // restores globalAlpha
    };

    const drawPlayer = (ctx: CanvasRenderingContext2D, time: number, moving: boolean) => {
      const [sx, sy] = w2s(playerRef.current.x, playerRef.current.z);
      const bob = moving ? Math.sin(time * 8) * 1.5 : 0;

      /* shadow */
      ctx.beginPath(); ctx.ellipse(sx, sy + 8, 9, 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill();

      /* body */
      const bW = 0.55 * TILE; const bH = 0.72 * TILE;
      ctx.fillStyle = '#7c3aed';
      rrect(ctx, sx - bW / 2, sy - bH + 4 + bob, bW, bH, 4); ctx.fill();

      /* legs (alternating when moving) */
      const legW = bW * 0.35; const legH = bH * 0.28;
      const legSwing = moving ? Math.sin(time * 8) * 3 : 0;
      ctx.fillStyle = '#5b21b6';
      ctx.fillRect(sx - bW * 0.35, sy + bob + legSwing, legW, legH);
      ctx.fillRect(sx + bW * 0.35 - legW, sy + bob - legSwing, legW, legH);

      /* head */
      const hr = 0.28 * TILE;
      ctx.beginPath(); ctx.arc(sx, sy - bH + 4 + bob - hr * 0.4, hr, 0, Math.PI * 2);
      ctx.fillStyle = '#f4c07c'; ctx.fill();

      /* eyes */
      ctx.fillStyle = '#2a1a00';
      ctx.beginPath(); ctx.arc(sx - 3, sy - bH + 3 + bob - hr * 0.4, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + 3, sy - bH + 3 + bob - hr * 0.4, 1.8, 0, Math.PI * 2); ctx.fill();

      /* player indicator dot */
      ctx.beginPath(); ctx.arc(sx, sy - bH - hr - 6 + bob, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#a78bfa'; ctx.fill();
    };

    /* ---------------------------------------------------- */
    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.07);
      lastTime = now;
      timeRef.current += dt;
      const t = timeRef.current;

      /* ── Update player ─────────────────────────────── */
      const keys = keysRef.current;
      const joy  = joyRef.current;
      let dx = 0, dz = 0;
      if (keys.has('ArrowUp')    || keys.has('KeyW') || joy.z < -0.3) dz -= 1;
      if (keys.has('ArrowDown')  || keys.has('KeyS') || joy.z >  0.3) dz += 1;
      if (keys.has('ArrowLeft')  || keys.has('KeyA') || joy.x < -0.3) dx -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD') || joy.x >  0.3) dx += 1;

      const moving = dx !== 0 || dz !== 0;
      movingRef.current = moving;
      if (moving) {
        const len = Math.sqrt(dx * dx + dz * dz);
        dx /= len; dz /= len;
        playerRef.current.x = Math.max(-MAP_BOUND, Math.min(MAP_BOUND, playerRef.current.x + dx * PLAYER_SPEED * dt));
        playerRef.current.z = Math.max(-MAP_BOUND, Math.min(MAP_BOUND, playerRef.current.z + dz * PLAYER_SPEED * dt));
        walkRef.current += dt;
      }

      /* ── Camera smooth follow ──────────────────────── */
      const lerpF = 1 - Math.pow(0.08, dt);
      camRef.current.x += (playerRef.current.x - camRef.current.x) * lerpF;
      camRef.current.z += (playerRef.current.z - camRef.current.z) * lerpF;

      /* ── Proximity checks (throttled) ──────────────── */
      proximityTimerRef.current += dt;
      if (proximityTimerRef.current >= 0.12) {
        proximityTimerRef.current = 0;
        const px = playerRef.current.x, pz = playerRef.current.z;
        const lrs = leadersRef.current;
        const aps = arenaPositionsRef.current;

        let minDist = Infinity, minId: number | null = null;
        lrs.forEach((l, idx) => {
          const [ax, az] = aps[idx] ?? getArenaPosition(idx);
          const d = Math.sqrt((px - ax) ** 2 + (pz - az) ** 2);
          if (d < minDist) { minDist = d; minId = l.id; }
        });
        const nearId = minDist <= 9 ? minId : null;
        if (nearId !== lastNearLeaderIdRef.current) {
          lastNearLeaderIdRef.current = nearId;
          setNearestLeaderId(nearId);
        }
        if (Math.abs(minDist - lastNearDistRef.current) > 0.3) {
          lastNearDistRef.current = minDist;
          setNearestDist(minDist);
        }

        /* Collectibles */
        let nearC: StoryCollectible | null = null;
        for (const c of visibleCollectiblesRef.current) {
          if (Math.sqrt((px - c.posX) ** 2 + (pz - c.posZ) ** 2) < 2.8) { nearC = c; break; }
        }
        const nearCId = nearC?.id ?? null;
        if (nearCId !== lastNearCollIdRef.current) {
          lastNearCollIdRef.current = nearCId;
          if (nearC && localCollectedIdsRef.current.has(nearC.id)) {
            setNearCollectible(null);
          } else {
            setNearCollectible(nearC);
          }
        }
      }

      /* ── Draw ──────────────────────────────────────── */
      const canvas = canvasRef.current;
      if (!canvas) { raf = requestAnimationFrame(tick); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { raf = requestAnimationFrame(tick); return; }
      const { w, h } = sizeRef.current;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      ctx.clearRect(0, 0, w, h);

      const camX = camRef.current.x, camZ = camRef.current.z;
      ensurePatterns(ctx, camX, camZ);

      /* 1. Grass background */
      if (grassPatRef.current) {
        ctx.fillStyle = grassPatRef.current;
      } else {
        ctx.fillStyle = '#3db03d';
      }
      ctx.fillRect(0, 0, w, h);

      /* 2. Sand paths between arenas */
      const nArenas = Math.min(leadersRef.current.length, ARENA_POSITIONS_BASE.length);
      if (nArenas > 1) {
        ctx.strokeStyle = sandPatRef.current ?? '#c8a853';
        ctx.lineWidth = 3.5 * TILE;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let i = 0; i < nArenas - 1; i++) {
          const [ax, az] = arenaPositionsRef.current[i] ?? getArenaPosition(i);
          const [bx, bz] = arenaPositionsRef.current[i+1] ?? getArenaPosition(i+1);
          const [asx, asy] = w2s(ax, az);
          const [bsx, bsy] = w2s(bx, bz);
          ctx.beginPath(); ctx.moveTo(asx, asy); ctx.lineTo(bsx, bsy); ctx.stroke();
        }
        /* Sand borders */
        ctx.strokeStyle = '#b8943d';
        ctx.lineWidth = 3.5 * TILE + 3;
        ctx.globalAlpha = 0.12;
        for (let i = 0; i < nArenas - 1; i++) {
          const [ax, az] = arenaPositionsRef.current[i] ?? getArenaPosition(i);
          const [bx, bz] = arenaPositionsRef.current[i+1] ?? getArenaPosition(i+1);
          const [asx, asy] = w2s(ax, az);
          const [bsx, bsy] = w2s(bx, bz);
          ctx.beginPath(); ctx.moveTo(asx, asy); ctx.lineTo(bsx, bsy); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      /* 3. Water patches */
      WATER_DATA.forEach((wd) => {
        const [cx, cy] = w2s(wd.x, wd.z);
        const sr = wd.r * TILE;
        /* sandy shore */
        ctx.beginPath(); ctx.arc(cx, cy, sr + 1.4 * TILE, 0, Math.PI * 2);
        ctx.fillStyle = '#c8a86b'; ctx.fill();
        /* water surface */
        const alpha = 0.74 + Math.sin(t * 1.4) * 0.07;
        ctx.beginPath(); ctx.arc(cx, cy, sr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(26,120,216,${alpha})`; ctx.fill();
        /* shimmer */
        ctx.beginPath(); ctx.ellipse(cx + sr * 0.14, cy - sr * 0.12, sr * 0.32, sr * 0.13, -0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(128,200,255,0.28)'; ctx.fill();
      });

      /* 4. Flower patches */
      FLOWER_DATA.forEach((f) => {
        const [fx, fy] = w2s(f.x, f.z);
        const fr = f.r * TILE;
        ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2);
        ctx.fillStyle = f.color + '66'; ctx.fill();
        for (let j = 0; j < 5; j++) {
          const ang = j * 1.256 + t * 0.3;
          const dx = Math.cos(ang) * fr * 0.55, dy = Math.sin(ang) * fr * 0.55;
          ctx.beginPath(); ctx.arc(fx + dx, fy + dy, 3, 0, Math.PI * 2);
          ctx.fillStyle = f.color; ctx.fill();
        }
      });

      /* 5. Stone walls */
      WALL_PIECES.forEach((p) => {
        const [wx, wy] = w2s(p.x, p.z);
        ctx.fillStyle = p.alt ? '#8a7a6a' : '#7a6a5a';
        rrect(ctx, wx - 0.5 * TILE, wy - 0.45 * TILE, TILE, 0.9 * TILE, 3); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1; ctx.stroke();
      });

      /* 6. Hedges */
      HEDGE_PIECES.forEach((p) => {
        const [hx, hy] = w2s(p.x, p.z);
        const hr = 0.58 * TILE;
        ctx.fillStyle = p.dark ? '#1a5c1a' : '#236b23';
        ctx.fillRect(hx - hr * 0.95, hy - hr * 0.88, hr * 1.9, hr * 1.1);
        ctx.beginPath(); ctx.arc(hx, hy - hr * 0.62, hr * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = '#2d7a2d'; ctx.fill();
      });

      /* 7. Boulders */
      BOULDER_DATA.forEach((b, i) => {
        const [bx, by] = w2s(b.x, b.z);
        const br = b.sx * 0.82 * TILE;
        ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fillStyle = i % 3 === 0 ? '#8a8a8a' : i % 3 === 1 ? '#9a9080' : '#7a7878'; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.stroke();
        if (b.twin) {
          ctx.beginPath(); ctx.arc(bx + br * 0.6, by - br * 0.3, br * 0.55, 0, Math.PI * 2);
          ctx.fillStyle = '#7a7870'; ctx.fill();
        }
      });

      /* 8. Lamp posts */
      LAMP_DATA.forEach((l) => {
        const [lx, ly] = w2s(l.x, l.z);
        /* pole */
        ctx.strokeStyle = '#1e1e2e'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(lx, ly + 0.5 * TILE); ctx.lineTo(lx, ly - 1.8 * TILE); ctx.stroke();
        /* arm */
        ctx.beginPath(); ctx.moveTo(lx, ly - 1.8 * TILE); ctx.lineTo(lx + 0.6 * TILE, ly - 1.8 * TILE); ctx.stroke();
        /* globe */
        const glow = 0.12 + Math.sin(t * 0.8 + l.x) * 0.04;
        const gg = ctx.createRadialGradient(lx + 0.6 * TILE, ly - 1.8 * TILE, 0, lx + 0.6 * TILE, ly - 1.8 * TILE, 0.3 * TILE);
        gg.addColorStop(0, 'rgba(255,252,200,0.9)'); gg.addColorStop(1, 'rgba(255,232,80,0)');
        ctx.beginPath(); ctx.arc(lx + 0.6 * TILE, ly - 1.8 * TILE, 0.3 * TILE, 0, Math.PI * 2);
        ctx.fillStyle = gg; ctx.fill();
        ctx.beginPath(); ctx.arc(lx + 0.6 * TILE, ly - 1.8 * TILE, 0.18 * TILE, 0, Math.PI * 2);
        ctx.fillStyle = '#fffcdd'; ctx.fill();
        /* night glow halo */
        ctx.beginPath(); ctx.arc(lx + 0.6 * TILE, ly - 1.8 * TILE, 1.2 * TILE, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,240,120,${glow})`; ctx.fill();
      });

      /* 9. Tall grass */
      TALLGRASS_PATCHES.forEach((patch) => {
        patch.blades.forEach((blade, bi) => {
          const [gx, gy] = w2s(patch.cx + blade.dx, patch.cz + blade.dz);
          const bh = blade.h * TILE * 0.7;
          const sway = Math.sin(t * 1.2 + blade.dx * 0.4) * 1.5;
          ctx.strokeStyle = bi % 3 === 0 ? '#3aaa3a' : bi % 3 === 1 ? '#2e8c2e' : '#4dc44d';
          ctx.lineWidth = 2; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(gx, gy);
          ctx.quadraticCurveTo(gx + sway * 1.5, gy - bh * 0.5, gx + sway * 2, gy - bh);
          ctx.stroke();
        });
      });

      /* 10. Wooden bridge (near central lake) */
      const [brx, bry] = w2s(6, -1);
      ctx.save();
      ctx.translate(brx, bry); ctx.rotate(0.15);
      for (let i = 0; i < 5; i++) {
        const py = (i - 2) * 0.85 * TILE;
        ctx.fillStyle = woodPatRef.current ?? '#a0682a';
        ctx.fillRect(-2 * TILE, py - 0.4 * TILE, 4 * TILE, 0.76 * TILE);
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
        ctx.strokeRect(-2 * TILE, py - 0.4 * TILE, 4 * TILE, 0.76 * TILE);
      }
      /* railings */
      ctx.strokeStyle = '#7a4a20'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-1.9 * TILE, -2 * TILE); ctx.lineTo(-1.9 * TILE, 2 * TILE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo( 1.9 * TILE, -2 * TILE); ctx.lineTo( 1.9 * TILE, 2 * TILE); ctx.stroke();
      ctx.restore();

      /* ── Z-sorted sprites: trees + localities + arenas + collectibles + player ── */
      interface Sprite { z: number; draw: () => void; }
      const sprites: Sprite[] = [];

      /* trees */
      TREE_DATA.forEach(tree => {
        sprites.push({ z: tree.z, draw: () => drawTree(ctx, tree) });
      });

      /* localities */
      localitiesRef.current.forEach(loc => {
        sprites.push({
          z: loc.posZ,
          draw: () => {
            const [lx, ly] = w2s(loc.posX, loc.posZ);
            const lColor = LOCALITY_COLORS[loc.type] ?? '#06b6d4';
            /* glow disc */
            ctx.beginPath(); ctx.arc(lx, ly, 1.5 * TILE, 0, Math.PI * 2);
            ctx.fillStyle = lColor + '22'; ctx.fill();
            /* pillar */
            ctx.strokeStyle = lColor; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(lx, ly + 0.5 * TILE); ctx.lineTo(lx, ly - 1.5 * TILE); ctx.stroke();
            /* gem top */
            const gs = 6;
            ctx.save(); ctx.translate(lx, ly - 1.5 * TILE); ctx.rotate(Math.PI / 4);
            ctx.fillStyle = lColor;
            ctx.fillRect(-gs / 2, -gs / 2, gs, gs);
            ctx.restore();
            /* label */
            ctx.fillStyle = 'rgba(5,5,20,0.88)';
            rrect(ctx, lx - 36, ly - 2.5 * TILE - 14, 72, 18, 5); ctx.fill();
            ctx.strokeStyle = lColor + '55'; ctx.lineWidth = 1; ctx.stroke();
            ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = lColor;
            ctx.fillText(`${loc.icon} ${loc.name}`, lx, ly - 2.5 * TILE - 5);
          }
        });
      });

      /* arenas */
      leadersRef.current.forEach((leader, idx) => {
        const [ax, az] = arenaPositionsRef.current[idx] ?? getArenaPosition(idx);
        const status = getLeaderStatusRef.current(leader);
        const isNear = leader.id === lastNearLeaderIdRef.current;
        sprites.push({ z: az, draw: () => {
          const [cx, cy] = w2s(ax, az);
          drawArena(ctx, cx, cy, leader, status, isNear, idx, t);
        }});
      });

      /* collectibles — proximity-based fade-in only */
      const cpx = playerRef.current.x, cpz = playerRef.current.z;
      const REVEAL_DIST = 3.5; // world units
      visibleCollectiblesRef.current.forEach(c => {
        const dist = Math.sqrt((c.posX - cpx) ** 2 + (c.posZ - cpz) ** 2);
        if (dist > REVEAL_DIST) return;
        const alpha = Math.min(1, (REVEAL_DIST - dist) / 1.2);
        sprites.push({ z: c.posZ, draw: () => drawCollectible(ctx, c, t, alpha) });
      });

      /* player */
      sprites.push({ z: playerRef.current.z, draw: () => drawPlayer(ctx, t, movingRef.current) });

      sprites.sort((a, b) => a.z - b.z);
      sprites.forEach(s => s.draw());

      /* floating "+X crediti" texts (drawn on top of everything) */
      floatingTextsRef.current = floatingTextsRef.current.filter(ft => t - ft.startTime < 1.8);
      floatingTextsRef.current.forEach(ft => {
        const age = t - ft.startTime;
        const [fx, fy] = w2s(ft.x, ft.z);
        const rise = age * 45;
        const a = Math.max(0, 1 - age / 1.8);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = 'bold 17px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3;
        ctx.strokeText(ft.text, fx, fy - 20 - rise);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, fx, fy - 20 - rise);
        ctx.restore();
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []); // runs once — all mutable state via refs

  /* ── Misc handlers ─────────────────────────────────────── */
  useEffect(() => { const t = setTimeout(() => setShowHint(false), 5000); return () => clearTimeout(t); }, []);
  const setJoy = useCallback((x: number, z: number) => { joyRef.current = { x, z }; }, []);

  /* Perform the actual collect API call */
  const handleCollectDirect = useCallback(async (c: StoryCollectible) => {
    if (isCollecting) return;
    setIsCollecting(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch(`/api/story-mode/collect/${c.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setLocalCollectedIds(prev => new Set([...prev, c.id]));
        setCollectResult(data.reward);
        setNearCollectible(null);
        setCardReveal(null);
        if (c.type === 'coin') {
          const now = performance.now() / 1000;
          floatingTextsRef.current.push({
            text: `+${c.creditValue ?? 10} crediti`,
            x: c.posX, z: c.posZ, color: '#fbbf24', startTime: now,
          });
        }
        setTimeout(() => setCollectResult(null), 3500);
      }
    } catch (e) {
      console.error('Collect error', e);
    } finally {
      setIsCollecting(false);
    }
  }, [isCollecting]);

  /* Route: coins collect directly, cards open the reveal modal first */
  const handleCollectPrompt = useCallback(() => {
    if (!nearCollectible) return;
    if (nearCollectible.type === 'card') {
      setCardReveal(nearCollectible);
    } else {
      handleCollectDirect(nearCollectible);
    }
  }, [nearCollectible, handleCollectDirect]);

  /* ── Early returns ─────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-white/20 border-t-yellow-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/30 text-sm">Caricamento mappa…</p>
        </div>
      </div>
    );
  }
  if (leaders.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-white/30 text-sm">Nessuno stage disponibile</p>
      </div>
    );
  }

  const nearStatus  = nearLeader ? getLeaderStatus(nearLeader) : null;
  const hasPending  = nearLeader ? pendingGymGame?.gymLeaderId === nearLeader.id && !lostLeaderIds.includes(nearLeader.id) && nearStatus !== 'completed' : false;
  const hasLost     = nearLeader ? lostLeaderIds.includes(nearLeader.id) && nearStatus !== 'completed' : false;

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, overflow: 'hidden', minHeight: 0 }}>
      {/* Main canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        style={{ position: 'absolute', inset: 0, display: 'block', imageRendering: 'pixelated' }}
        tabIndex={0}
      />

      {/* GPS Minimap */}
      <Minimap
        playerRef={playerRef}
        arenaPositions={arenaPositions}
        leaders={leaders}
        getLeaderStatus={getLeaderStatus}
        localities={localities}
      />

      {/* Top-right HUD */}
      <div style={{
        position: 'absolute', top: 12, right: 12,
        background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10, padding: '6px 12px',
        color: 'rgba(255,255,255,0.60)', fontSize: 11, fontWeight: 700,
        pointerEvents: 'none', zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'right',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.45)' }}>WASD / ↑↓←→ — muoviti</span>
        <span style={{ color: '#4ade80', fontSize: 12 }}>
          ✓ Stage completati: <strong>{completedCount}/{leaders.length}</strong>
        </span>
        <span style={{ color: 'rgba(251,191,36,0.85)' }}>
          {nearLeader && nearStatus !== 'locked' && nearestDist <= 9
            ? `⚡ Stage attivo: ${nearLeader.gymName}`
            : '📍 Avvicinati ad uno Stage'}
        </span>
      </div>

      {/* Fading hint */}
      {showHint && (
        <div style={{
          position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.72)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 12, padding: '6px 14px',
          color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 700,
          pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 20,
        }}>
          Avvicinati a uno Stage o cliccaci sopra per sfidarlo
        </div>
      )}

      {/* Near leader bottom card */}
      {nearLeader && nearStatus !== 'locked' && nearestDist <= 9 && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(5,5,20,0.9) 100%)',
          borderTop: `2px solid ${nearStatus === 'completed' ? 'rgba(74,222,128,0.5)' : 'rgba(245,158,11,0.5)'}`,
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, zIndex: 30,
        }}>
          {nearLeader.leaderImageUrl ? (
            <img src={nearLeader.leaderImageUrl} alt={nearLeader.name} style={{
              width: 56, height: 56, borderRadius: '50%', objectFit: 'cover',
              border: `2px solid ${nearStatus === 'completed' ? '#4ade80' : '#fbbf24'}`, flexShrink: 0,
              boxShadow: `0 0 18px ${nearStatus === 'completed' ? '#4ade8055' : '#fbbf2455'}`,
            }} />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
              background: nearStatus === 'completed' ? 'rgba(22,101,52,0.6)' : 'rgba(120,53,15,0.6)',
              border: `2px solid ${nearStatus === 'completed' ? '#4ade8055' : '#fbbf2455'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>🏋️</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: nearStatus === 'completed' ? '#4ade80' : '#fbbf24' }}>
                ⚡ Stage {nearLeader.orderIndex}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: nearStatus === 'completed' ? '#86efac' : '#fde68a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nearLeader.gymName}
            </p>
            <p style={{ margin: '1px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              👊 {nearLeader.name}
              {' · '}{nearLeader.cpuLevel === 'easy' ? '🟢' : nearLeader.cpuLevel === 'medium' ? '🟡' : '🔴'}
              {' · '}❤️ {nearLeader.livesCount}
              {' · '}⭐ {nearLeader.rewardCredits}
            </p>
          </div>
          <div style={{ flexShrink: 0 }}>
            {hasPending ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button onClick={() => onResumeGame(nearLeader, pendingGymGame!.gameId)} style={{
                  background: 'linear-gradient(135deg,#ea580c,#c2410c)', border: 'none',
                  borderRadius: 10, color: 'white', fontSize: 13, fontWeight: 900,
                  padding: '8px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
                  boxShadow: '0 2px 10px rgba(234,88,12,0.4)',
                }}>⚔️ Riprendi</button>
                <button onClick={() => onChallengeLeader(nearLeader)} style={{
                  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 10, color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 800,
                  padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap',
                }}>Nuova partita</button>
              </div>
            ) : hasLost ? (
              <button onClick={() => onChallengeLeader(nearLeader)} style={{
                background: 'linear-gradient(135deg,#dc2626,#9333ea)', border: 'none',
                borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 900,
                padding: '10px 18px', cursor: 'pointer', whiteSpace: 'nowrap',
                boxShadow: '0 2px 12px rgba(220,38,38,0.5)',
              }}>⚔️ Riprova</button>
            ) : nearStatus === 'available' ? (
              <button onClick={() => onChallengeLeader(nearLeader)} style={{
                background: 'linear-gradient(135deg,#9333ea,#f59e0b)', border: 'none',
                borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 900,
                padding: '10px 18px', cursor: 'pointer', whiteSpace: 'nowrap',
                boxShadow: '0 2px 14px rgba(147,51,234,0.5)', letterSpacing: '0.04em',
              }}>⚔️ SFIDA!</button>
            ) : nearStatus === 'completed' ? (
              <button onClick={() => onChallengeLeader(nearLeader)} style={{
                background: 'rgba(74,222,128,0.15)', border: '1.5px solid rgba(74,222,128,0.4)',
                borderRadius: 10, color: '#86efac', fontSize: 13, fontWeight: 800,
                padding: '8px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
              }}>↺ Rigioca</button>
            ) : null}
          </div>
        </div>
      )}

      {/* Coin pickup popup (coins only — cards go to reveal modal) */}
      {nearCollectible && nearCollectible.type === 'coin' && !localCollectedIds.has(nearCollectible.id) && !cardReveal && (
        <div style={{
          position: 'absolute', bottom: isTouchDevice ? 180 : 120, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(5,5,20,0.92)',
          border: '2px solid rgba(251,191,36,0.7)',
          borderRadius: 14, padding: '14px 24px', zIndex: 50,
          textAlign: 'center', boxShadow: '0 0 30px rgba(251,191,36,0.2)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ fontSize: 32 }}>🪙</div>
          <div>
            <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: 15 }}>
              +{nearCollectible.creditValue ?? 10} crediti
            </div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>Moneta nascosta trovata!</div>
          </div>
          <button onClick={handleCollectPrompt} disabled={isCollecting} style={{
            background: 'linear-gradient(135deg,#f59e0b,#d97706)',
            border: 'none', borderRadius: 10, color: 'white', fontWeight: 900,
            fontSize: 14, padding: '9px 18px',
            cursor: isCollecting ? 'wait' : 'pointer', opacity: isCollecting ? 0.7 : 1,
          }}>
            {isCollecting ? '…' : '➕ Prendi'}
          </button>
        </div>
      )}

      {/* Card proximity hint (show that a card is near without revealing it) */}
      {nearCollectible && nearCollectible.type === 'card' && !localCollectedIds.has(nearCollectible.id) && !cardReveal && (
        <div style={{
          position: 'absolute', bottom: isTouchDevice ? 180 : 120, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(5,5,20,0.92)',
          border: `2px solid ${nearCollectible.subtype === 'personaggi' ? 'rgba(129,140,248,0.7)' : nearCollectible.subtype === 'mossa' ? 'rgba(248,113,113,0.7)' : 'rgba(74,222,128,0.7)'}`,
          borderRadius: 14, padding: '14px 24px', zIndex: 50,
          textAlign: 'center', boxShadow: '0 0 30px rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ fontSize: 32 }}>{nearCollectible.subtype === 'personaggi' ? '🧙' : nearCollectible.subtype === 'mossa' ? '⚔️' : '✨'}</div>
          <div>
            <div style={{ color: 'white', fontWeight: 900, fontSize: 15 }}>Carta trovata!</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>Clicca per scoprire di quale si tratta</div>
          </div>
          <button onClick={handleCollectPrompt} style={{
            background: nearCollectible.subtype === 'personaggi' ? 'linear-gradient(135deg,#818cf8,#6366f1)'
              : nearCollectible.subtype === 'mossa' ? 'linear-gradient(135deg,#f87171,#dc2626)'
              : 'linear-gradient(135deg,#4ade80,#16a34a)',
            border: 'none', borderRadius: 10, color: 'white', fontWeight: 900,
            fontSize: 14, padding: '9px 18px', cursor: 'pointer',
          }}>
            🃏 Scopri
          </button>
        </div>
      )}

      {/* Card reveal full modal */}
      {cardReveal && !localCollectedIds.has(cardReveal.id) && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.82)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80,
        }}>
          <div style={{
            background: 'rgba(5,5,20,0.98)', borderRadius: 20, padding: '28px 28px 22px',
            maxWidth: 320, width: '90%', textAlign: 'center',
            border: `2px solid ${cardReveal.subtype === 'personaggi' ? '#818cf8' : cardReveal.subtype === 'mossa' ? '#f87171' : '#4ade80'}`,
            boxShadow: `0 0 60px ${cardReveal.subtype === 'personaggi' ? 'rgba(129,140,248,0.3)' : cardReveal.subtype === 'mossa' ? 'rgba(248,113,113,0.3)' : 'rgba(74,222,128,0.3)'}`,
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase',
              color: cardReveal.subtype === 'personaggi' ? '#a5b4fc' : cardReveal.subtype === 'mossa' ? '#fca5a5' : '#86efac',
              marginBottom: 14 }}>
              {cardReveal.subtype === 'personaggi' ? '🧙 Carta Personaggio' : cardReveal.subtype === 'mossa' ? '⚔️ Carta Mossa' : '✨ Carta Bonus'} nascosta trovata!
            </div>
            {/* Card image */}
            {cardReveal.imageUrl ? (
              <div style={{ margin: '0 auto 18px', width: 140, height: 200, borderRadius: 10, overflow: 'hidden',
                boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                border: `2px solid ${cardReveal.subtype === 'personaggi' ? '#6366f1' : cardReveal.subtype === 'mossa' ? '#dc2626' : '#16a34a'}`,
              }}>
                <img src={cardReveal.imageUrl} alt="carta" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ) : (
              <div style={{ margin: '0 auto 18px', width: 140, height: 200, borderRadius: 10,
                background: `linear-gradient(135deg, ${cardReveal.subtype === 'personaggi' ? '#312e81,#4f46e5' : cardReveal.subtype === 'mossa' ? '#7f1d1d,#dc2626' : '#14532d,#16a34a'})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60,
                boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
              }}>
                {cardReveal.subtype === 'personaggi' ? '🧙' : cardReveal.subtype === 'mossa' ? '⚔️' : '✨'}
              </div>
            )}
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 18 }}>
              Aggiungi questa carta al tuo mazzo Story Mode
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setCardReveal(null)} style={{
                flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 13,
                padding: '10px 0', cursor: 'pointer',
              }}>↩ Dopo</button>
              <button onClick={() => handleCollectDirect(cardReveal)} disabled={isCollecting} style={{
                flex: 2,
                background: cardReveal.subtype === 'personaggi' ? 'linear-gradient(135deg,#818cf8,#6366f1)'
                  : cardReveal.subtype === 'mossa' ? 'linear-gradient(135deg,#f87171,#dc2626)'
                  : 'linear-gradient(135deg,#4ade80,#16a34a)',
                border: 'none', borderRadius: 10, color: 'white', fontWeight: 900,
                fontSize: 14, padding: '10px 0',
                cursor: isCollecting ? 'wait' : 'pointer', opacity: isCollecting ? 0.7 : 1,
              }}>
                {isCollecting ? '…' : '➕ Aggiungi al mazzo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collect success banner (card only — coins use floating canvas text) */}
      {collectResult && collectResult.type === 'card' && (
        <div style={{
          position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(5,5,20,0.95)',
          border: '1.5px solid rgba(74,222,128,0.6)',
          borderRadius: 12, padding: '10px 22px', zIndex: 50,
          color: '#4ade80', fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
        }}>
          ✅ Carta aggiunta al mazzo Story Mode!
        </div>
      )}

      {/* Mobile joystick */}
      {isTouchDevice && (
        <div style={{
          position: 'absolute',
          bottom: nearLeader && nearStatus !== 'locked' && nearestDist <= 9 ? 140 : 14,
          left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          zIndex: 25, transition: 'bottom 0.2s ease',
        }}>
          <JoystickBtn label="▲" onStart={() => setJoy(0, -1)} onEnd={() => setJoy(0, 0)} />
          <div style={{ display: 'flex', gap: 4 }}>
            <JoystickBtn label="◀" onStart={() => setJoy(-1, 0)} onEnd={() => setJoy(0, 0)} />
            <JoystickBtn label="▼" onStart={() => setJoy(0, 1)} onEnd={() => setJoy(0, 0)} />
            <JoystickBtn label="▶" onStart={() => setJoy(1, 0)} onEnd={() => setJoy(0, 0)} />
          </div>
        </div>
      )}
    </div>
  );
}
