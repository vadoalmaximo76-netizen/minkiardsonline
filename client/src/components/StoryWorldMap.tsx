import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { GymLeader } from '../types/gym';
import { socket } from '../lib/socket';
import {
  RuotaDellaFortuna, MemoryGame, SfidaAlDado,
  ReazioneRapida, QuizMinkiard, SassoCartaForbice,
} from './MiniGames';
import { FootballMinigames } from './FootballMinigames';

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
  /* Multiplayer presence */
  userId?: number;
  username?: string;
  authToken?: string | null;
  onStartPvp?: (gameId: string, opponentUsername: string, yourDeck: number[], opponentDeck: number[], yourRole: 'challenger' | 'target') => void;
  onCardCollected?: (cardId: string) => void;
}

interface OtherPlayer {
  userId: number;
  username: string;
  avatar: string | null;
  x: number;
  z: number;
}

/* ── Particle types ─────────────────────────────────────────── */
type LeafParticle = {
  wx: number; wz: number;          // bezier P0 — tree origin (world units)
  cx: number; cz: number;          // bezier P1 offset (control point)
  ex: number; ez: number;          // bezier P2 offset (end point)
  life: number; maxLife: number; speed: number; size: number;
};
type FireflyParticle = { wx: number; wz: number; phase: number; speed: number; size: number; orbitR: number };

/* ── World constants ─────────────────────────────────────────── */
const PLAYER_SPEED = 11;
const MAP_BOUND    = 80;

/* ── Pre-computed star field (deterministic, no Math.random in render) ── */
const STAR_DATA: { sx: number; sy: number; r: number; twinkle: number }[] = (() => {
  const stars: { sx: number; sy: number; r: number; twinkle: number }[] = [];
  for (let i = 0; i < 160; i++) {
    const a = (i * 2.399963) % (Math.PI * 2);
    const rr = Math.sqrt((i + 1) / 160) * 950;
    stars.push({
      sx: Math.cos(a) * rr,
      sy: Math.sin(a) * rr * 0.72,
      r: 0.4 + ((i * 37) % 9) * 0.18,
      twinkle: ((i * 53) % 100) / 100,
    });
  }
  return stars;
})();

const ARENA_POSITIONS_BASE: [number, number][] = [
  [  0,  68 ], [ 40,  52 ], [ 68,  18 ], [ 58, -20 ],
  [ 28, -58 ], [ -5, -74 ], [-44, -56 ], [-70, -18 ],
  [-64,  26 ], [-38,  60 ], [  8,  78 ], [ 48,  68 ],
];

function getArenaPosition(idx: number): [number, number] {
  if (idx < ARENA_POSITIONS_BASE.length) return ARENA_POSITIONS_BASE[idx];
  const t = (idx - ARENA_POSITIONS_BASE.length + 1) * 1.37;
  const r = 50 + t * 4;
  const x = Math.round(Math.cos(t) * r);
  const z = Math.round(Math.sin(t) * r);
  return [Math.max(-72, Math.min(72, x)), Math.max(-76, Math.min(76, z))];
}

const TREE_DATA: { x: number; z: number; h: number; r: number }[] = [
  // NW dense forest
  { x:-50, z:-32, h:2.5, r:0.95 }, { x:-56, z:-28, h:2.2, r:0.85 },
  { x:-48, z:-42, h:2.6, r:1.0  }, { x:-60, z:-40, h:2.0, r:0.8  },
  { x:-42, z:-30, h:2.3, r:0.9  }, { x:-58, z:-36, h:2.1, r:0.7  },
  { x:-66, z:-50, h:2.4, r:0.85 }, { x:-44, z:-62, h:2.5, r:0.95 },
  { x:-52, z:-68, h:2.2, r:0.8  }, { x:-36, z:-66, h:2.6, r:1.0  },
  { x:-62, z:-62, h:2.0, r:0.75 }, { x:-54, z:-44, h:2.4, r:0.9  },
  // NE forest
  { x: 38, z:-38, h:2.4, r:0.9  }, { x: 46, z:-44, h:2.1, r:0.75 },
  { x: 52, z:-32, h:2.6, r:0.95 }, { x: 30, z:-44, h:2.2, r:0.85 },
  { x: 42, z:-55, h:2.0, r:0.8  }, { x: 55, z:-48, h:2.4, r:0.9  },
  { x: 62, z:-52, h:2.2, r:0.8  }, { x: 48, z:-62, h:2.5, r:0.9  },
  // Central woods
  { x:-18, z:  2, h:2.3, r:0.85 }, { x:-26, z:-14, h:2.1, r:0.75 },
  { x: 18, z: -8, h:2.5, r:0.9  }, { x: -9, z:-22, h:2.2, r:0.8  },
  { x: 25, z: 10, h:2.0, r:0.75 }, { x: -4, z:  8, h:2.3, r:0.85 },
  { x: 32, z: -2, h:2.1, r:0.75 }, { x:-32, z: -2, h:2.2, r:0.8  },
  // Eastern border trees
  { x: 72, z: 36, h:2.4, r:0.85 }, { x: 76, z: 52, h:2.2, r:0.8  },
  { x: 70, z:-10, h:2.6, r:0.95 }, { x: 78, z:-28, h:2.1, r:0.75 },
  { x: 74, z: 10, h:2.4, r:0.9  }, { x: 76, z:-50, h:2.2, r:0.8  },
  // Western border trees
  { x:-72, z: 12, h:2.5, r:0.9  }, { x:-78, z: -5, h:2.3, r:0.85 },
  { x:-74, z: 40, h:2.0, r:0.75 }, { x:-76, z: 55, h:2.4, r:0.9  },
  { x:-76, z:-22, h:2.2, r:0.8  }, { x:-74, z: -8, h:2.5, r:0.9  },
  // South area palms/trees
  { x: 20, z: 55, h:2.2, r:0.8  }, { x:-15, z: 52, h:2.5, r:0.9  },
  { x:-22, z: 45, h:2.1, r:0.75 }, { x: 56, z: 60, h:2.3, r:0.85 },
  { x:-56, z: 62, h:2.0, r:0.8  }, { x: 62, z: 70, h:2.4, r:0.9  },
  { x: 75, z: 65, h:2.2, r:0.8  }, { x:-70, z: 68, h:2.5, r:0.9  },
  // North mountain trees
  { x:  8, z:-55, h:2.6, r:0.95 }, { x: -5, z:-62, h:2.2, r:0.8  },
  { x: 18, z:-68, h:2.4, r:0.9  }, { x:-22, z:-52, h:2.1, r:0.75 },
  { x: 14, z:-78, h:2.3, r:0.85 }, { x:-15, z:-78, h:2.5, r:0.9  },
  // Interior scattered
  { x: 45, z: 32, h:2.1, r:0.75 }, { x:-48, z: 42, h:2.5, r:0.9  },
  { x:-62, z: 10, h:2.3, r:0.85 }, { x: 35, z: 18, h:2.2, r:0.8  },
];

const WATER_DATA: { x: number; z: number; r: number }[] = [
  { x: 10, z: -4,  r: 7.0 },   // central lake
  { x:-12, z: 20,  r: 4.0 },   // NW pond
  { x: 26, z:-26,  r: 3.5 },   // NE pond
  { x:-32, z:-38,  r: 3.0 },   // NW lake
  { x: 65, z:  8,  r: 6.5 },   // east coast sea
  { x: 55, z: 48,  r: 4.5 },   // SE bay
  { x:-58, z: 40,  r: 5.5 },   // west harbor
  { x:  5, z: 85,  r: 14.0 },  // south sea
  { x: 38, z:-46,  r: 3.5 },   // north lake
  { x:-36, z: 36,  r: 3.5 },   // SW pond
  { x:-68, z:-52,  r: 4.0 },   // far NW lake
  { x: 22, z: 75,  r: 5.0 },   // SE coast
  { x: 68, z:-42,  r: 3.0 },   // NE lake
  { x:-15, z:-70,  r: 4.5 },   // north polar lake
];

const HEDGE_DATA: { x:number; z:number; ry:number; n:number }[] = [
  { x:-14, z:  6, ry: 0,           n: 8 }, { x: 10, z:-42, ry: 0,           n: 6 },
  { x:-18, z: 16, ry: Math.PI / 2, n: 7 }, { x: -5, z:-18, ry: Math.PI / 2, n: 6 },
  { x: 28, z:  8, ry: Math.PI / 2, n: 5 }, { x:-22, z: -6, ry: 0.2,         n: 6 },
  { x: 15, z:-40, ry: 0,           n: 5 }, { x:-30, z: 30, ry: Math.PI / 2, n: 6 },
  { x:  2, z: 22, ry: 0.5,         n: 5 }, { x: 20, z:-32, ry: 0.2,         n: 4 },
  { x: 44, z: 28, ry: 0,           n: 7 }, { x:-44, z: 24, ry: Math.PI / 2, n: 5 },
  { x: 38, z:-12, ry: 0.4,         n: 6 }, { x:-35, z:-20, ry: 0,           n: 5 },
  { x: 60, z: 36, ry: Math.PI / 2, n: 4 }, { x:-60, z: 55, ry: 0.3,         n: 5 },
  { x: 18, z: 40, ry: 0,           n: 6 }, { x:-18, z: 40, ry: Math.PI / 2, n: 4 },
  { x: 55, z:-10, ry: 0.2,         n: 5 }, { x:-50, z:-14, ry: 0,           n: 4 },
  { x: 32, z: 60, ry: 0,           n: 6 }, { x:-30, z: 70, ry: Math.PI / 2, n: 5 },
  { x: 48, z:-32, ry: 0.6,         n: 5 }, { x:-48, z: 60, ry: 0.4,         n: 6 },
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
  { x: -8, z:-26, sy:1.4, sx:1.2, twin:true  }, { x: 26, z:-38, sy:1.1, sx:0.9, twin:false },
  { x:-40, z: 20, sy:1.2, sx:1.0, twin:true  }, { x: 38, z: 22, sy:1.0, sx:0.8, twin:false },
  { x: 18, z:-40, sy:0.9, sx:1.1, twin:true  }, { x:-18, z:-40, sy:1.3, sx:1.0, twin:false },
  { x: 36, z:-32, sy:1.1, sx:0.9, twin:true  }, { x:-38, z:-28, sy:1.0, sx:1.2, twin:false },
  // Mountain boulders (north)
  { x: 15, z:-62, sy:2.0, sx:1.8, twin:true  }, { x: 22, z:-70, sy:2.2, sx:2.0, twin:false },
  { x:  5, z:-68, sy:1.8, sx:1.6, twin:true  }, { x:-10, z:-60, sy:2.0, sx:1.8, twin:false },
  { x: 30, z:-65, sy:1.6, sx:1.4, twin:true  }, { x:-24, z:-65, sy:1.8, sx:1.6, twin:false },
  { x: 38, z:-72, sy:2.2, sx:2.0, twin:true  }, { x:-32, z:-72, sy:2.0, sx:1.8, twin:false },
  // Western ruins boulders
  { x:-58, z:-10, sy:1.5, sx:1.3, twin:true  }, { x:-65, z:-28, sy:1.8, sx:1.5, twin:false },
  { x:-72, z: -5, sy:1.4, sx:1.2, twin:true  }, { x:-60, z: 15, sy:1.0, sx:0.9, twin:false },
  // East coast boulders
  { x: 62, z: 32, sy:1.2, sx:1.0, twin:true  }, { x: 70, z:-22, sy:1.5, sx:1.3, twin:false },
  { x: 72, z: 55, sy:1.0, sx:0.9, twin:false }, { x: 55, z: 70, sy:1.2, sx:1.0, twin:true  },
  // Scattered large rocks
  { x: 45, z: -5, sy:1.4, sx:1.2, twin:true  }, { x:-45, z: -8, sy:1.3, sx:1.1, twin:false },
  { x: 28, z: 42, sy:1.1, sx:0.9, twin:true  }, { x:-28, z: 45, sy:1.2, sx:1.0, twin:false },
];

const FLOWER_DATA: { x:number; z:number; r:number; color:string }[] = [
  { x:  8, z: 18, r:2.5, color:'#ff6b9d' }, { x:-20, z:  5, r:2.0, color:'#fbbf24' },
  { x: 16, z: -6, r:1.8, color:'#a78bfa' }, { x: -9, z: 28, r:2.2, color:'#34d399' },
  { x: 28, z: 10, r:1.6, color:'#f97316' }, { x:-28, z:-30, r:2.0, color:'#60a5fa' },
  { x:  5, z:-20, r:1.5, color:'#fbbf24' }, { x:-16, z: 35, r:1.8, color:'#ff6b9d' },
  { x: 20, z:-40, r:2.2, color:'#a78bfa' }, { x:-35, z: 30, r:1.6, color:'#34d399' },
  { x: -2, z:  8, r:1.4, color:'#f97316' }, { x: 33, z:-18, r:1.8, color:'#60a5fa' },
  { x:-10, z:-15, r:1.6, color:'#ff6b9d' }, { x: 22, z: 14, r:1.5, color:'#fbbf24' },
  { x: 48, z: 10, r:2.0, color:'#f97316' }, { x:-45, z:  8, r:1.8, color:'#ff6b9d' },
  { x: 15, z: 35, r:1.6, color:'#34d399' }, { x:-18, z: 55, r:2.0, color:'#fbbf24' },
  { x: 42, z: 60, r:1.8, color:'#a78bfa' }, { x:-42, z: 70, r:1.6, color:'#60a5fa' },
  { x: 72, z: 28, r:2.0, color:'#ff6b9d' }, { x:-72, z: 28, r:1.8, color:'#34d399' },
  { x: 35, z:-30, r:1.5, color:'#fbbf24' }, { x:-38, z:-15, r:2.0, color:'#f97316' },
  { x: -2, z:-35, r:1.8, color:'#60a5fa' }, { x: 55, z:-32, r:1.6, color:'#a78bfa' },
  { x: 22, z: 36, r:1.4, color:'#ff6b9d' }, { x:-20, z: 35, r:1.6, color:'#fbbf24' },
  { x: 60, z: 50, r:2.0, color:'#34d399' }, { x:-55, z: 48, r:1.8, color:'#60a5fa' },
];

const LAMP_DATA: { x:number; z:number }[] = [
  // Path lights following arena route
  { x:  8, z: 64 }, { x: 20, z: 58 }, { x: 32, z: 52 }, { x: 40, z: 44 },
  { x: 50, z: 34 }, { x: 58, z: 24 }, { x: 62, z: 12 }, { x: 60, z:  0 },
  { x: 58, z:-12 }, { x: 48, z:-22 }, { x: 38, z:-38 }, { x: 28, z:-48 },
  { x: 12, z:-60 }, { x: -2, z:-68 }, { x:-14, z:-62 }, { x:-28, z:-54 },
  { x:-42, z:-44 }, { x:-55, z:-32 }, { x:-62, z:-18 }, { x:-66, z: -6 },
  { x:-65, z:  8 }, { x:-62, z: 20 }, { x:-54, z: 32 }, { x:-44, z: 48 },
  { x:-36, z: 58 }, { x:-20, z: 68 }, { x: -8, z: 74 }, { x:  8, z: 74 },
  // Town squares
  { x:  5, z: 55 }, { x: -5, z: 55 }, { x: 45, z: 65 }, { x: 30, z: 44 },
  { x:-30, z: 58 }, { x:-18, z: 62 }, { x: 65, z: 20 }, { x: 70, z: 28 },
];

const WALL_DATA: { x:number; z:number; ry:number; n:number }[] = [
  { x: 16, z:  7, ry: 0.1,         n: 5 }, { x: -4, z:-11, ry: Math.PI / 2, n: 5 },
  { x:-28, z:-17, ry: 0.3,         n: 6 }, { x:  9, z:-28, ry:-0.2,         n: 4 },
  { x:-19, z: 31, ry: 0.5,         n: 5 }, { x: 30, z:-28, ry: 1.2,         n: 4 },
  // West ruins walls
  { x:-62, z:-14, ry: 0.2,         n: 7 }, { x:-68, z:-28, ry: Math.PI / 2, n: 6 },
  { x:-58, z: -4, ry: 1.1,         n: 5 }, { x:-72, z: -8, ry: 0.3,         n: 4 },
  // North fortress walls
  { x: 50, z:-28, ry: 0,           n: 8 }, { x: 62, z:-18, ry: Math.PI / 2, n: 6 },
  { x: 55, z:-35, ry: 0.4,         n: 5 },
  // South town walls
  { x:-10, z: 62, ry: 0,           n: 6 }, { x: 10, z: 62, ry: 0,           n: 6 },
  { x: 35, z: 55, ry: Math.PI / 2, n: 5 }, { x:-35, z: 55, ry: Math.PI / 2, n: 5 },
  // Additional perimeter
  { x: 70, z: 35, ry: Math.PI / 2, n: 6 }, { x:-70, z: 35, ry: Math.PI / 2, n: 5 },
  { x: 25, z:-75, ry: 0,           n: 7 }, { x:-20, z:-75, ry: 0,           n: 6 },
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
  { cx: 35,  cz: -5,  n: 16 }, { cx:-35,  cz: -5,  n: 14 }, { cx: 50,  cz: 42,  n: 12 },
  { cx:-50,  cz: 50,  n: 10 }, { cx: 18,  cz: 62,  n: 14 }, { cx:-25,  cz: 62,  n: 12 },
  { cx: 42,  cz:-25,  n: 10 }, { cx:-40,  cz:-38,  n: 12 }, { cx:  0,  cz:-45,  n: 10 },
  { cx: 60,  cz: 20,  n: 8  }, { cx:-60,  cz: 20,  n: 8  }, { cx: 30,  cz: 30,  n: 12 },
  { cx:-30,  cz: 38,  n: 10 }, { cx: 55,  cz:-24,  n: 8  }, { cx:-55,  cz:-24,  n: 8  },
].map((patch, pi) => ({
  cx: patch.cx, cz: patch.cz,
  blades: Array.from({ length: patch.n }, (_, i) => ({
    dx: (_sr(pi * 200 + i * 4)     - 0.5) * 5.5,
    dz: (_sr(pi * 200 + i * 4 + 1) - 0.5) * 5.5,
    h:  0.5 + _sr(pi * 200 + i * 4 + 2) * 0.55,
    ry: _sr(pi * 200 + i * 4 + 3) * Math.PI * 2,
  })),
}));

/* ── Buildings ───────────────────────────────────────────────── */
type BuildingType = 'house' | 'shop' | 'inn' | 'tower' | 'ruin' | 'church' | 'arcade';
const BUILDING_DATA: { x: number; z: number; type: BuildingType; w: number; h: number }[] = [
  // South starting town (arena 1: 0,68)
  { x:  8, z: 58, type:'house',  w:2.2, h:1.8 }, { x: -9, z: 58, type:'house',  w:2.0, h:1.8 },
  { x: 14, z: 62, type:'inn',    w:2.8, h:2.2 }, { x:-14, z: 54, type:'shop',   w:2.4, h:1.8 },
  { x:  6, z: 50, type:'house',  w:2.0, h:1.6 }, { x: -4, z: 50, type:'house',  w:1.8, h:1.6 },
  { x: -2, z: 62, type:'church', w:2.8, h:2.4 }, { x: 18, z: 54, type:'house',  w:1.8, h:1.6 },
  // SE village (arena 2: 40,52)
  { x: 30, z: 46, type:'house',  w:2.2, h:1.8 }, { x: 44, z: 46, type:'house',  w:2.0, h:1.8 },
  { x: 36, z: 56, type:'shop',   w:2.4, h:1.8 }, { x: 50, z: 56, type:'house',  w:1.8, h:1.6 },
  { x: 28, z: 56, type:'inn',    w:2.4, h:2.0 },
  // East port (arena 3: 68,18)
  { x: 62, z: 22, type:'house',  w:2.2, h:1.8 }, { x: 72, z: 24, type:'house',  w:2.0, h:1.8 },
  { x: 64, z: 14, type:'inn',    w:2.6, h:2.0 }, { x: 74, z: 14, type:'shop',   w:2.0, h:1.6 },
  { x: 60, z: 30, type:'house',  w:1.8, h:1.6 },
  // NE fort (arena 4: 58,-20)
  { x: 50, z:-14, type:'house',  w:2.0, h:1.6 }, { x: 60, z:-26, type:'ruin',   w:2.2, h:2.0 },
  { x: 65, z:-14, type:'tower',  w:1.8, h:3.0 }, { x: 52, z:-28, type:'ruin',   w:2.0, h:1.6 },
  // North snowfield (arena 5: 28,-58)
  { x: 20, z:-52, type:'house',  w:2.0, h:1.6 }, { x: 30, z:-56, type:'house',  w:1.8, h:1.6 },
  { x: 24, z:-64, type:'inn',    w:2.4, h:2.0 },
  // Far north ruins (arena 6: -5,-74)
  { x: -5, z:-68, type:'ruin',   w:2.4, h:1.8 }, { x:-14, z:-76, type:'tower',  w:1.8, h:2.8 },
  { x:  4, z:-78, type:'ruin',   w:2.0, h:1.6 },
  // NW forest village (arena 7: -44,-56)
  { x:-35, z:-48, type:'house',  w:2.0, h:1.8 }, { x:-46, z:-50, type:'house',  w:2.2, h:1.8 },
  { x:-40, z:-64, type:'church', w:2.6, h:2.2 }, { x:-50, z:-60, type:'ruin',   w:2.0, h:1.6 },
  // West ruins (arena 8: -70,-18)
  { x:-62, z:-10, type:'ruin',   w:2.8, h:2.0 }, { x:-72, z:-22, type:'tower',  w:2.0, h:3.0 },
  { x:-60, z:-28, type:'ruin',   w:2.4, h:1.8 }, { x:-74, z:-10, type:'ruin',   w:2.0, h:1.6 },
  // West harbor (arena 9: -64,26)
  { x:-56, z: 22, type:'house',  w:2.2, h:1.8 }, { x:-66, z: 28, type:'house',  w:2.0, h:1.8 },
  { x:-70, z: 20, type:'inn',    w:2.8, h:2.0 }, { x:-62, z: 32, type:'shop',   w:2.4, h:1.8 },
  { x:-72, z: 32, type:'house',  w:1.8, h:1.6 },
  // SW coastal town (arena 10: -38,60)
  { x:-28, z: 55, type:'house',  w:2.2, h:1.8 }, { x:-40, z: 55, type:'house',  w:2.0, h:1.8 },
  { x:-32, z: 65, type:'inn',    w:2.6, h:2.0 }, { x:-20, z: 65, type:'shop',   w:2.4, h:1.8 },
  { x:-44, z: 65, type:'church', w:2.4, h:2.0 }, { x:-48, z: 55, type:'house',  w:1.8, h:1.6 },
  // SE tower arena 12 (48,68)
  { x: 42, z: 62, type:'house',  w:2.0, h:1.8 }, { x: 54, z: 62, type:'shop',   w:2.2, h:1.8 },
  { x: 48, z: 74, type:'tower',  w:2.0, h:2.8 }, { x: 58, z: 72, type:'house',  w:1.8, h:1.6 },
  // Center village
  { x:  0, z: 12, type:'house',  w:2.0, h:1.8 }, { x:  8, z:  6, type:'shop',   w:2.4, h:1.8 },
  { x: -8, z:  6, type:'house',  w:2.0, h:1.8 }, { x: 12, z: -8, type:'ruin',   w:2.2, h:1.8 },
  { x:-18, z: -4, type:'house',  w:1.8, h:1.6 }, { x:-10, z:  0, type:'inn',    w:2.2, h:1.8 },
  // Scattered farmhouses & landmarks
  { x: 22, z: 32, type:'house',  w:1.8, h:1.6 }, { x:-12, z: 34, type:'house',  w:1.8, h:1.6 },
  { x: 42, z:-28, type:'house',  w:1.8, h:1.6 }, { x:-28, z:-28, type:'church', w:2.2, h:2.0 },
  { x: 18, z:-38, type:'house',  w:1.8, h:1.6 }, { x:-50, z: 10, type:'house',  w:1.8, h:1.6 },
  { x: 50, z: 35, type:'house',  w:1.8, h:1.6 }, { x:-25, z: 20, type:'inn',    w:2.4, h:2.0 },
  { x: 35, z: -3, type:'house',  w:1.8, h:1.6 }, { x:-40, z: -8, type:'house',  w:1.8, h:1.6 },
  { x: 65, z:-32, type:'tower',  w:2.0, h:3.0 }, { x:-65, z: 55, type:'church', w:2.4, h:2.2 },
  { x: 48, z: 18, type:'house',  w:1.8, h:1.6 }, { x:-48, z: 25, type:'house',  w:1.8, h:1.6 },
];

const BUILDING_COLORS: Record<BuildingType, { body: string; roof: string }> = {
  house:  { body: '#d4a96a', roof: '#a0522d' },
  shop:   { body: '#b8d4f0', roof: '#4a80c0' },
  inn:    { body: '#d4c88a', roof: '#8b6020' },
  tower:  { body: '#9a9a9a', roof: '#555555' },
  ruin:   { body: '#8a8070', roof: '#5a5040' },
  church: { body: '#f0e8d0', roof: '#c04040' },
  arcade: { body: '#2d1a4e', roof: '#7c3aed' },
};

/* ── Arcade mini-game buildings ─────────────────────────────── */
interface ArcadeBuilding {
  id: string;
  name: string;
  emoji: string;
  x: number;
  z: number;
  color: string;
}

const ARCADE_BUILDINGS: ArcadeBuilding[] = [
  { id: 'ruota',    name: 'Ruota della Fortuna', emoji: '🎡', x:  20, z: 22,  color: '#a855f7' },
  { id: 'memory',   name: 'Memory delle Carte',  emoji: '🃏', x: -30, z:-8,   color: '#818cf8' },
  { id: 'dado',     name: 'Sfida al Dado',        emoji: '🎲', x:  55, z:-45,  color: '#f97316' },
  { id: 'reazione', name: 'Reazione Rapida',      emoji: '⚡', x: -52, z:-35,  color: '#fbbf24' },
  { id: 'quiz',     name: 'Quiz del Minkiard',    emoji: '❓', x: -20, z: 44,  color: '#06b6d4' },
  { id: 'rps',      name: 'Sasso Carta Forbice',  emoji: '✂️', x:  36, z:-76,  color: '#ec4899' },
];

/* ── Bridge positions ────────────────────────────────────────── */
const BRIDGE_DATA: { x: number; z: number; ry: number }[] = [
  { x:  6, z:  1, ry: 0.15 },   // central lake
  { x: 65, z:  5, ry: 1.05 },   // east coast
  { x:-58, z: 42, ry: 0.85 },   // west harbor
  { x:-12, z: 22, ry: 0.35 },   // NW pond
  { x: 26, z:-24, ry: 0.2  },   // NE pond
];

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
  football_field: '#22c55e',
};

/* ── Football field (static, always present) ──────────────── */
const FOOTBALL_FIELD_POS = { x: -30, z: 20 } as const;
const FOOTBALL_FIELD_RADIUS = 9;
const FOOTBALL_FIELD_LOCALITY = {
  id: -1,
  name: 'Campo da Calcio',
  type: 'football_field',
  posX: FOOTBALL_FIELD_POS.x,
  posZ: FOOTBALL_FIELD_POS.z,
  icon: '⚽',
  isActive: true,
} as const;

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

/* ── Unlock animation registry ───────────────────────────────── */
interface UnlockAnim { startTime: number; arenaIdx: number; }

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
    const SIZE  = 180;
    const PAD   = 8;
    const WORLD = 160;
    const scale = (SIZE - PAD * 2) / WORLD;

    const toC = (wx: number, wz: number) => ({
      x: PAD + (wx + 80) * scale,
      y: PAD + (wz + 80) * scale,
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

      /* Football field on minimap */
      const { x: ffmx, y: ffmy } = toC(FOOTBALL_FIELD_POS.x, FOOTBALL_FIELD_POS.z);
      ctx.save();
      ctx.fillStyle = '#22c55e';
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.8;
      ctx.fillRect(ffmx - 4, ffmy - 3, 8, 6);
      ctx.strokeRect(ffmx - 4, ffmy - 3, 8, 6);
      ctx.font = '6px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'white';
      ctx.fillText('⚽', ffmx, ffmy);
      ctx.restore();

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
      <canvas ref={canvasRef} width={180} height={180} style={{ display: 'block' }} />
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
interface JoystickBtnProps { label: string; onStart: () => void; onEnd: () => void; size?: number; }

function JoystickBtn({ label, onStart, onEnd, size = 64 }: JoystickBtnProps) {
  const [active, setActive] = React.useState(false);
  const fontSize = size <= 44 ? 18 : 26;
  const borderRadius = size <= 44 ? 10 : 14;
  return (
    <div
      onPointerDown={(e) => { e.preventDefault(); setActive(true); onStart(); }}
      onPointerUp={() => { setActive(false); onEnd(); }}
      onPointerLeave={() => { setActive(false); onEnd(); }}
      style={{
        width: size, height: size, borderRadius,
        background: active ? 'rgba(167,139,250,0.55)' : 'rgba(255,255,255,0.14)',
        border: `2px solid ${active ? 'rgba(167,139,250,0.9)' : 'rgba(255,255,255,0.3)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize, userSelect: 'none', cursor: 'pointer',
        touchAction: 'none', WebkitUserSelect: 'none',
        boxShadow: active ? '0 0 16px rgba(167,139,250,0.5)' : '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'background 0.08s, border-color 0.08s, box-shadow 0.08s',
        transform: active ? 'scale(0.93)' : 'scale(1)',
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
  userId,
  username,
  authToken,
  onStartPvp,
  onCardCollected,
}: StoryWorldMapProps) {

  /* ── Canvas + container refs ────────────────────────────── */
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sizeRef      = useRef<{ w: number; h: number }>({ w: 800, h: 600 });

  /* ── Game state refs (no re-render on change) ──────────── */
  const playerRef = useRef<{ x: number; z: number }>({ x: 0, z: 72 });
  const camRef    = useRef<{ x: number; z: number }>({ x: 0, z: 72 });
  const keysRef   = useRef<Set<string>>(new Set());
  const joyRef    = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const timeRef   = useRef(0);
  const walkRef   = useRef(0);
  const movingRef = useRef(false);

  /* ── Multiplayer presence refs ──────────────────────────── */
  const otherPlayersRef  = useRef<Map<number, OtherPlayer>>(new Map());
  const moveEmitTimer    = useRef(0);

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

  /* ── Detect arena unlocks → trigger animation ───────────────── */
  useEffect(() => {
    const now = timeRef.current;
    leaders.forEach((leader, idx) => {
      const newStatus = getLeaderStatus(leader);
      const prevStatus = prevStatusMapRef.current.get(leader.id);
      if (prevStatus === 'locked' && newStatus === 'available') {
        unlockAnimsRef.current.set(idx, { startTime: now, arenaIdx: idx });
      }
      prevStatusMapRef.current.set(leader.id, newStatus);
    });
  }, [leaders, getLeaderStatus]);

  /* ── React UI state ────────────────────────────────────── */
  const [nearestLeaderId, setNearestLeaderId] = useState<number | null>(null);
  const [nearestDist,     setNearestDist]     = useState(Infinity);
  const [showHint,        setShowHint]        = useState(true);
  const [isTouchDevice] = useState(
    () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );
  const [isLandscape, setIsLandscape] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(orientation: landscape)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    const handler = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const [nearCollectible,    setNearCollectible]    = useState<StoryCollectible | null>(null);
  const [localCollectedIds,  setLocalCollectedIds]  = useState<Set<number>>(new Set());
  const [isCollecting,       setIsCollecting]       = useState(false);
  const [collectResult,      setCollectResult]      = useState<{ type: string; credits?: number; cardId?: string; subtype?: string } | null>(null);
  const [cardReveal,         setCardReveal]         = useState<StoryCollectible | null>(null);

  /* ── Multiplayer state ──────────────────────────────────── */
  const [proximityPlayer,   setProximityPlayer]   = useState<OtherPlayer | null>(null);
  const [incomingChallenge, setIncomingChallenge] = useState<{ challengerUserId: number; challengerUsername: string; challengerAvatar: string | null } | null>(null);
  const [pvpCreditsAlert,   setPvpCreditsAlert]   = useState<number | null>(null);
  const [challengeSent,     setChallengeSent]     = useState(false);

  /* floating "+X crediti" canvas animations */
  const floatingTextsRef = useRef<{ text: string; x: number; z: number; color: string; startTime: number }[]>([]);

  /* unlock animations */
  const unlockAnimsRef = useRef<Map<number, UnlockAnim>>(new Map());
  const prevStatusMapRef = useRef<Map<number, string>>(new Map());

  /* tooltip state */
  const [tooltip, setTooltip] = useState<{ leader: GymLeader; status: 'completed' | 'available' | 'locked'; x: number; y: number } | null>(null);

  /* victory history panel */
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  /* ── Arcade mini-game state ─────────────────────────────── */
  const [nearestArcadeId,  setNearestArcadeId]  = useState<string | null>(null);
  const [nearestArcadeDist,setNearestArcadeDist]= useState(Infinity);
  const [activeMinigame,   setActiveMinigame]   = useState<ArcadeBuilding | null>(null);
  const [minigameCooldowns,setMinigameCooldowns]= useState<Record<string, number>>({});
  const [minigameResult,   setMinigameResult]   = useState<{ gameName: string; pr: number } | null>(null);
  const [minigameSession,  setMinigameSession]  = useState<{ token: string; serverData: Record<string, unknown> } | null>(null);
  const [startingMinigame, setStartingMinigame] = useState(false);
  const lastNearArcadeIdRef  = useRef<string | null>(null);
  const lastNearArcadeDistRef= useRef(Infinity);
  const [userPR, setUserPR] = useState<number>(0);

  /* ── Football field state ───────────────────────────────── */
  const [nearFootball, setNearFootball] = useState(false);
  const [showFootballMinigame, setShowFootballMinigame] = useState(false);
  const lastNearFootballRef = useRef(false);

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

  /* ── Particle / atmosphere refs ──────────────────────────── */
  const leavesRef    = useRef<LeafParticle[]>([]);
  const firefliesRef = useRef<FireflyParticle[]>([]);

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
    const w = canvas.width  || rect.width;
    const h = canvas.height || rect.height;
    const scaleX = rect.width  > 0 ? w / rect.width  : 1;
    const scaleY = rect.height > 0 ? h / rect.height : 1;
    return {
      x: ((clientX - rect.left) * scaleX - w / 2) / TILE + playerRef.current.x,
      z: ((clientY - rect.top)  * scaleY - h / 2) / TILE + playerRef.current.z,
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
      if (dist < ARENA_HIT_RADIUS * 1.5) {
        const status = getLeaderStatusRef.current(lrs[idx]);
        canvas.style.cursor = status !== 'locked' ? 'pointer' : 'default';
        setTooltip({ leader: lrs[idx], status, x: e.clientX, y: e.clientY });
        return;
      }
    }
    canvas.style.cursor = 'default';
    setTooltip(null);
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

  /* ── Multiplayer Socket Presence ───────────────────────── */
  useEffect(() => {
    if (!userId || !authToken) return;
    const tok = authToken;

    // Ensure socket is connected
    if (!socket.connected) socket.connect();

    // Join the story world
    socket.emit('story-world:join', {
      authToken: tok,
      x: playerRef.current.x,
      z: playerRef.current.z,
    });

    const handlePlayers = (players: OtherPlayer[]) => {
      const m = new Map<number, OtherPlayer>();
      players.forEach(p => m.set(p.userId, p));
      otherPlayersRef.current = m;
    };
    const handleJoined = (p: OtherPlayer) => {
      if (p.userId === userId) return;
      otherPlayersRef.current.set(p.userId, p);
    };
    const handleMoved = ({ userId: uid, x, z }: { userId: number; x: number; z: number }) => {
      const p = otherPlayersRef.current.get(uid);
      if (p) { p.x = x; p.z = z; }
    };
    const handleLeft = ({ userId: uid }: { userId: number }) => {
      otherPlayersRef.current.delete(uid);
    };
    const handleChallengeReceived = (data: { challengerUserId: number; challengerUsername: string; challengerAvatar: string | null }) => {
      setIncomingChallenge(data);
    };
    const handleChallengeDeclined = () => {
      setChallengeSent(false);
    };
    const handlePvpStart = (data: { gameId: string; yourRole: 'challenger' | 'target'; opponentUsername: string; opponentUserId: number; yourDeck: number[]; opponentDeck: number[] }) => {
      onStartPvp?.(data.gameId, data.opponentUsername, data.yourDeck, data.opponentDeck, data.yourRole);
    };
    const handleCreditsEarned = ({ credits }: { credits: number }) => {
      setPvpCreditsAlert(credits);
      setTimeout(() => setPvpCreditsAlert(null), 4500);
    };

    socket.on('story-world:players',           handlePlayers);
    socket.on('story-world:player-joined',     handleJoined);
    socket.on('story-world:player-moved',      handleMoved);
    socket.on('story-world:player-left',       handleLeft);
    socket.on('story-world:challenge-received',handleChallengeReceived);
    socket.on('story-world:challenge-declined',handleChallengeDeclined);
    socket.on('story-world:pvp-start',         handlePvpStart);
    socket.on('story-world:pvp-credits-earned',handleCreditsEarned);

    return () => {
      socket.emit('story-world:leave');
      socket.off('story-world:players',           handlePlayers);
      socket.off('story-world:player-joined',     handleJoined);
      socket.off('story-world:player-moved',      handleMoved);
      socket.off('story-world:player-left',       handleLeft);
      socket.off('story-world:challenge-received',handleChallengeReceived);
      socket.off('story-world:challenge-declined',handleChallengeDeclined);
      socket.off('story-world:pvp-start',         handlePvpStart);
      socket.off('story-world:pvp-credits-earned',handleCreditsEarned);
    };
  }, [userId, authToken, onStartPvp]);

  /* ── Main game loop ────────────────────────────────────── */
  useEffect(() => {
    /* ── Sync canvas size immediately before first frame ── */
    const container = containerRef.current;
    const canvas0   = canvasRef.current;
    if (container && canvas0) {
      const { width, height } = container.getBoundingClientRect();
      if (width > 0 && height > 0) {
        sizeRef.current = { w: width, h: height };
        canvas0.width   = width;
        canvas0.height  = height;
      }
    }

    let raf = 0;
    let lastTime = performance.now();

    /* --- Initialize leaf & firefly particles (once) -------- */
    if (leavesRef.current.length === 0 && TREE_DATA.length > 0) {
      for (let pi = 0; pi < 40; pi++) {
        const tree = TREE_DATA[pi % TREE_DATA.length];
        const ph = (pi * 0.618) % 1;
        /* bezier control/end offsets (world-unit offsets from tree origin) */
        const cx = ((pi * 13 + 3) % 41) * 0.07 - 1.4;   // P1 horizontal drift
        const cz = ((pi * 7) % 18) * 0.06 + 0.8;          // P1 downward
        const ex = ((pi * 11 - 5) % 33) * 0.09 - 1.5;    // P2 horizontal land
        const ez = ((pi * 19) % 14) * 0.12 + 2.8;         // P2 fully fallen
        leavesRef.current.push({
          wx: tree.x, wz: tree.z,
          cx, cz, ex, ez,
          life: ph * (3.5 + ((pi * 37) % 5) * 0.4),
          maxLife: 3.5 + ((pi * 37) % 5) * 0.4,
          speed: 0.55 + ((pi * 53) % 10) * 0.04,
          size: 2.5 + ((pi * 17) % 4) * 0.5,
        });
      }
    }
    if (firefliesRef.current.length === 0 && TREE_DATA.length > 0) {
      for (let fi = 0; fi < 20; fi++) {
        const treeIdx = (fi * 7) % TREE_DATA.length;
        const tree = TREE_DATA[treeIdx];
        firefliesRef.current.push({
          wx: tree.x + ((fi * 3 - 4) % 9) - 4,
          wz: tree.z + ((fi * 5 - 3) % 7) - 3,
          phase: fi * 0.285,
          speed: 0.25 + ((fi * 31) % 7) * 0.04,
          size: 1.5 + ((fi * 19) % 3) * 0.5,
          orbitR: 1.5 + ((fi * 13) % 5) * 0.4,
        });
      }
    }

    /* --- world → screen: always centered on player -------- */
    const w2s = (wx: number, wz: number): [number, number] => {
      const cvs = canvasRef.current;
      const w = cvs ? cvs.width : sizeRef.current.w;
      const h = cvs ? cvs.height : sizeRef.current.h;
      return [
        Math.round((wx - playerRef.current.x) * TILE + w / 2),
        Math.round((wz - playerRef.current.z) * TILE + h / 2),
      ];
    };

    /* --- shared sun direction helper ---------------------- */
    const getSunVec = (time: number): [number, number] => {
      const dp = (time / 300) % 1;
      const angle = dp * Math.PI * 2 - Math.PI * 0.5;
      return [Math.cos(angle), Math.sin(angle)];
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
    const drawTree = (ctx: CanvasRenderingContext2D, tree: typeof TREE_DATA[0], time: number) => {
      const [sx, sy] = w2s(tree.x, tree.z);
      const R = tree.r * TILE;
      /* directional shadow follows sun angle */
      const [sunX, sunZ] = getSunVec(time);
      const shDX = sunX * R * 0.85;
      const shDZ = sunZ * R * 0.32;
      ctx.beginPath();
      ctx.ellipse(sx + shDX, sy + R * 0.18 + shDZ, R * 1.05, R * 0.36, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill();
      /* tapered trunk */
      const tw = 0.24 * TILE; const th = R * 0.75;
      const trunkGrad = ctx.createLinearGradient(sx - tw / 2, sy, sx + tw / 2, sy);
      trunkGrad.addColorStop(0, '#3d1f08'); trunkGrad.addColorStop(0.5, '#6b3d1a'); trunkGrad.addColorStop(1, '#2d1605');
      ctx.fillStyle = trunkGrad;
      ctx.beginPath();
      ctx.moveTo(sx - tw * 0.52, sy + th * 0.12);
      ctx.lineTo(sx + tw * 0.52, sy + th * 0.12);
      ctx.lineTo(sx + tw * 0.28, sy - th * 0.62);
      ctx.lineTo(sx - tw * 0.28, sy - th * 0.62);
      ctx.closePath(); ctx.fill();
      /* foliage - 5 layers for volumetric look */
      const fy = sy - R * 0.88;
      /* shadow base ring */
      ctx.beginPath(); ctx.arc(sx, fy, R * 1.12, 0, Math.PI * 2);
      ctx.fillStyle = '#0d3310'; ctx.fill();
      /* main body */
      ctx.beginPath(); ctx.arc(sx, fy, R, 0, Math.PI * 2);
      ctx.fillStyle = '#1a5c1a'; ctx.fill();
      /* east-side ambient occlusion */
      ctx.beginPath(); ctx.arc(sx + R * 0.28, fy + R * 0.1, R * 0.72, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,18,0,0.32)'; ctx.fill();
      /* mid highlight layer */
      ctx.beginPath(); ctx.arc(sx - R * 0.14, fy - R * 0.18, R * 0.78, 0, Math.PI * 2);
      ctx.fillStyle = '#236b23'; ctx.fill();
      /* top highlight */
      ctx.beginPath(); ctx.arc(sx - R * 0.3, fy - R * 0.34, R * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#35a035'; ctx.fill();
      /* specular spot */
      ctx.beginPath(); ctx.arc(sx - R * 0.42, fy - R * 0.46, R * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = '#4ec44e'; ctx.fill();
    };

    const drawArena = (
      ctx: CanvasRenderingContext2D,
      cx: number, cy: number,
      leader: GymLeader,
      status: 'completed' | 'available' | 'locked',
      isNear: boolean,
      idx: number,
      time: number,
      unlockAnim?: UnlockAnim | null,
    ) => {
      const color = ARENA_COLORS[idx % ARENA_COLORS.length];
      const bW = 3.2 * TILE; const bH = 3.6 * TILE;

      /* unlock glow animation */
      if (unlockAnim) {
        const age = time - unlockAnim.startTime;
        const DURATION = 2.5;
        if (age < DURATION) {
          const progress = age / DURATION;
          const rings = 3;
          for (let ri = 0; ri < rings; ri++) {
            const ringProgress = (progress + ri / rings) % 1;
            const ringR = bW * 0.5 + ringProgress * bW * 1.5;
            const ringAlpha = (1 - ringProgress) * 0.65;
            ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(251,191,36,${ringAlpha})`;
            ctx.lineWidth = 3 * (1 - ringProgress); ctx.stroke();
          }
          /* particles */
          for (let pi = 0; pi < 8; pi++) {
            const angle = (pi / 8) * Math.PI * 2 + progress * 2;
            const dist = bW * 0.4 + progress * bW * 1.2;
            const px2 = cx + Math.cos(angle) * dist;
            const py2 = cy + Math.sin(angle) * dist;
            const pAlpha = Math.max(0, 1 - progress * 1.5);
            ctx.beginPath(); ctx.arc(px2, py2, 4 * pAlpha, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(251,191,36,${pAlpha})`; ctx.fill();
          }
        }
      }

      /* proximity glow */
      if (isNear && status !== 'locked') {
        const pulse = 0.3 + Math.sin(time * 3) * 0.15;
        ctx.beginPath(); ctx.arc(cx, cy, bW * 0.72, 0, Math.PI * 2);
        ctx.strokeStyle = status === 'completed' ? `rgba(74,222,128,${pulse})` : `rgba(251,191,36,${pulse})`;
        ctx.lineWidth = 3; ctx.stroke();
      }

      /* ─── Pseudo-3D building ─────────────────────────────── */
      const bodyColor = status === 'locked' ? '#374151' : color;

      /* directional cast shadow */
      const [sunX2, sunZ2] = getSunVec(time);
      const shDX2 = sunX2 * bW * 0.32;
      const shDY2 = sunZ2 * bH * 0.2;
      ctx.beginPath();
      ctx.ellipse(cx + shDX2 + 3, cy + bH * 0.35 + shDY2, bW * 0.46, bH * 0.17, 0.1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();

      /* 3-face building geometry */
      const sideW2 = Math.round(bW * 0.15);   // right-wall strip width
      const wallH2 = Math.round(bH * 0.30);   // south front wall height
      const roofH2 = bH - wallH2;              // roof/top face height
      const fLeft  = cx - bW / 2;
      const fRight = cx + bW / 2 - sideW2;    // right edge of front/roof
      const sRight = cx + bW / 2;              // rightmost edge (side wall)
      const topY   = cy - bH / 2;
      const wallY  = cy + bH / 2 - wallH2;    // y where roof ends, wall begins
      const botY   = cy + bH / 2;

      /* RIGHT SIDE WALL (darkest — in shadow) */
      const sideGrad = ctx.createLinearGradient(fRight, 0, sRight, 0);
      sideGrad.addColorStop(0, darken(bodyColor, 50));
      sideGrad.addColorStop(1, darken(bodyColor, 72));
      ctx.fillStyle = sideGrad;
      ctx.beginPath();
      ctx.roundRect(fRight, topY, sideW2, bH, [0, 4, 4, 0]);
      ctx.fill();

      /* SOUTH FRONT WALL (medium dark, gradient top→bottom) */
      const frontGrad = ctx.createLinearGradient(fLeft, wallY, fLeft, botY);
      frontGrad.addColorStop(0, darken(bodyColor, 18));
      frontGrad.addColorStop(1, darken(bodyColor, 40));
      ctx.fillStyle = frontGrad;
      ctx.beginPath();
      ctx.roundRect(fLeft, wallY, fRight - fLeft, wallH2, [0, 0, 4, 4]);
      ctx.fill();

      /* ROOF / TOP FACE (lightest — sun-lit) */
      const roofGrad2 = ctx.createLinearGradient(fLeft, topY, fRight, wallY);
      roofGrad2.addColorStop(0, lighten(bodyColor, 55));
      roofGrad2.addColorStop(0.55, lighten(bodyColor, 30));
      roofGrad2.addColorStop(1, lighten(bodyColor, 10));
      ctx.fillStyle = roofGrad2;
      ctx.beginPath();
      ctx.roundRect(fLeft, topY, fRight - fLeft, roofH2, [7, 4, 0, 7]);
      ctx.fill();

      /* ROOF tile hints (horizontal lines) */
      ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 1;
      for (let li = 1; li <= 3; li++) {
        const lineY2 = topY + (roofH2 * li) / 4;
        ctx.beginPath();
        ctx.moveTo(fLeft + 3, lineY2); ctx.lineTo(fRight - 3, lineY2);
        ctx.stroke();
      }

      /* EAVE LINE (roof-to-wall divider) */
      ctx.beginPath();
      ctx.moveTo(fLeft + 4, wallY); ctx.lineTo(fRight, wallY);
      ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1.5; ctx.stroke();

      /* BUILDING OUTLINE */
      ctx.strokeStyle = status === 'locked' ? '#4b5563' : darken(color, 48);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(fLeft, topY, fRight - fLeft, bH, [7, 0, 4, 7]); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(fRight, topY, sideW2, bH, [0, 4, 4, 0]); ctx.stroke();

      /* DOOR (front wall, arched) */
      const doorW = bW * 0.22; const doorH = wallH2 * 0.76;
      const doorBotY = botY - 2; const doorX = cx - doorW / 2;
      ctx.fillStyle = darken(bodyColor, 62);
      ctx.fillRect(doorX, doorBotY - doorH, doorW, doorH);
      ctx.beginPath(); ctx.arc(cx, doorBotY - doorH, doorW / 2, Math.PI, 0); ctx.fill();
      /* door highlight */
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(doorX + 2, doorBotY - doorH + 2, doorW * 0.38, doorH * 0.55);
      /* door handle */
      ctx.beginPath(); ctx.arc(cx + doorW * 0.26, doorBotY - doorH * 0.4, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,240,160,0.65)'; ctx.fill();

      /* WINDOWS (front wall, glowing) */
      const winRowY = wallY + wallH2 * 0.28;
      [cx - bW * 0.23, cx + bW * 0.1].forEach(wx => {
        const wW = 10; const wH = 9;
        /* frame */
        ctx.fillStyle = darken(bodyColor, 58);
        ctx.fillRect(wx - wW / 2 - 1, winRowY - wH / 2 - 1, wW + 2, wH + 2);
        /* glass */
        const wg = ctx.createRadialGradient(wx, winRowY, 0, wx, winRowY, wW);
        wg.addColorStop(0, 'rgba(255,255,180,0.55)');
        wg.addColorStop(1, 'rgba(160,220,255,0.10)');
        ctx.fillStyle = wg;
        ctx.fillRect(wx - wW / 2, winRowY - wH / 2, wW, wH);
        /* cross bar */
        ctx.strokeStyle = 'rgba(200,200,140,0.30)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(wx, winRowY - wH / 2); ctx.lineTo(wx, winRowY + wH / 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(wx - wW / 2, winRowY); ctx.lineTo(wx + wW / 2, winRowY); ctx.stroke();
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

      /* ── Above-node icon + boss label (always visible) ── */
      const iconY = cy - bH / 2 - 36;
      const iconEmoji = status === 'completed' ? '🏆' : status === 'available' ? '⚔️' : '🔒';
      const iconSize = status === 'available' ? Math.round(TILE * 0.85 + Math.sin(time * 2.5) * 2) : Math.round(TILE * 0.8);
      ctx.font = `${iconSize}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(iconEmoji, cx, iconY);

      /* boss name label pill */
      const labelText = leader.name.length > 14 ? leader.name.slice(0, 13) + '…' : leader.name;
      const diffIcon = leader.cpuLevel === 'easy' ? '🟢' : leader.cpuLevel === 'medium' ? '🟡' : '🔴';
      const fullLabel = `${diffIcon} ${labelText}`;
      ctx.font = 'bold 9px sans-serif';
      const textW = ctx.measureText(fullLabel).width;
      const pillX = cx - textW / 2 - 7;
      const pillY = iconY - 16;
      const pillW = textW + 14;
      const pillH = 15;
      ctx.fillStyle = status === 'locked' ? 'rgba(20,20,30,0.82)' : 'rgba(5,5,20,0.88)';
      rrect(ctx, pillX, pillY, pillW, pillH, 5);
      ctx.fill();
      ctx.strokeStyle = status === 'completed' ? 'rgba(74,222,128,0.5)' : status === 'available' ? 'rgba(251,191,36,0.5)' : 'rgba(107,114,128,0.3)';
      ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = status === 'locked' ? 'rgba(156,163,175,0.8)' : 'rgba(255,255,255,0.9)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(fullLabel, cx, pillY + pillH / 2);
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

      /* directional shadow */
      const [pSunX, pSunZ] = getSunVec(time);
      ctx.beginPath(); ctx.ellipse(sx + pSunX * 7, sy + 7 + pSunZ * 3, 9, 3.5, 0, 0, Math.PI * 2);
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
      /* AABB collision: arena buildings */
      {
        const ARENA_HW = 1.85; const ARENA_HD = 2.05; const PR = 0.58;
        arenaPositionsRef.current.forEach(([ax, az]) => {
          const oX = ARENA_HW + PR - Math.abs(playerRef.current.x - ax);
          const oZ = ARENA_HD + PR - Math.abs(playerRef.current.z - az);
          if (oX > 0 && oZ > 0) {
            if (oX < oZ) {
              playerRef.current.x += playerRef.current.x < ax ? -oX : oX;
            } else {
              playerRef.current.z += playerRef.current.z < az ? -oZ : oZ;
            }
          }
        });
        /* AABB collision: large boulders (axis-min-penetration slide) */
        BOULDER_DATA.forEach(b => {
          if (b.sx <= 1.3) return;
          const BHW = b.sx * 0.72 + PR;
          const BHD = b.sx * 0.72 + PR;
          const oX = BHW - Math.abs(playerRef.current.x - b.x);
          const oZ = BHD - Math.abs(playerRef.current.z - b.z);
          if (oX > 0 && oZ > 0) {
            if (oX < oZ) {
              playerRef.current.x += playerRef.current.x < b.x ? -oX : oX;
            } else {
              playerRef.current.z += playerRef.current.z < b.z ? -oZ : oZ;
            }
          }
        });
      }

      /* ── Camera: player always centered ────────────── */
      camRef.current.x = playerRef.current.x;
      camRef.current.z = playerRef.current.z;

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

        /* Football field proximity */
        const ffDist = Math.sqrt((px - FOOTBALL_FIELD_POS.x) ** 2 + (pz - FOOTBALL_FIELD_POS.z) ** 2);
        const isNearFF = ffDist <= FOOTBALL_FIELD_RADIUS;
        if (isNearFF !== lastNearFootballRef.current) {
          lastNearFootballRef.current = isNearFF;
          setNearFootball(isNearFF);
          if (!isNearFF) setShowFootballPanel(false);
        }

        /* Other player proximity (for PvP challenge button) */
        let closestOp: OtherPlayer | null = null;
        let closestDist = 6;
        otherPlayersRef.current.forEach(op => {
          const d = Math.sqrt((px - op.x) ** 2 + (pz - op.z) ** 2);
          if (d < closestDist) { closestDist = d; closestOp = op; }
        });
        setProximityPlayer(closestOp);

        /* Arcade buildings proximity */
        let arcadeMinDist = Infinity, arcadeMinId: string | null = null;
        ARCADE_BUILDINGS.forEach(ab => {
          const d = Math.sqrt((px - ab.x) ** 2 + (pz - ab.z) ** 2);
          if (d < arcadeMinDist) { arcadeMinDist = d; arcadeMinId = ab.id; }
        });
        const nearArcadeId = arcadeMinDist <= 9 ? arcadeMinId : null;
        if (nearArcadeId !== lastNearArcadeIdRef.current) {
          lastNearArcadeIdRef.current = nearArcadeId;
          setNearestArcadeId(nearArcadeId);
        }
        if (Math.abs(arcadeMinDist - lastNearArcadeDistRef.current) > 0.3) {
          lastNearArcadeDistRef.current = arcadeMinDist;
          setNearestArcadeDist(arcadeMinDist);
        }
      }

      /* Throttled move emit (every ~100ms) */
      if (userId && authToken) {
        moveEmitTimer.current += dt;
        if (moveEmitTimer.current >= 0.1) {
          moveEmitTimer.current = 0;
          socket.emit('story-world:move', { x: playerRef.current.x, z: playerRef.current.z });
        }
      }

      /* ── Draw ──────────────────────────────────────── */
      const canvas = canvasRef.current;
      if (!canvas) { raf = requestAnimationFrame(tick); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { raf = requestAnimationFrame(tick); return; }

      /* Always sync canvas buffer to container's actual CSS size */
      const cw = canvas.offsetWidth  || containerRef.current?.offsetWidth  || sizeRef.current.w;
      const ch = canvas.offsetHeight || containerRef.current?.offsetHeight || sizeRef.current.h;
      if (cw > 0 && ch > 0) {
        if (canvas.width  !== cw) canvas.width  = cw;
        if (canvas.height !== ch) canvas.height = ch;
        sizeRef.current = { w: cw, h: ch };
      }
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);

      const camX = playerRef.current.x, camZ = playerRef.current.z;
      ensurePatterns(ctx, camX, camZ);

      /* 1. Grass background */
      if (grassPatRef.current) {
        ctx.fillStyle = grassPatRef.current;
      } else {
        ctx.fillStyle = '#3db03d';
      }
      ctx.fillRect(0, 0, w, h);

      /* 1b. Day/night cycle: compute atmosphere values (applied post-render) */
      const _dayP = (t / 300) % 1;
      let _nightAlpha = 0;
      if (_dayP < 0.15) { _nightAlpha = (1 - _dayP / 0.15) * 0.55; }
      else if (_dayP > 0.75 && _dayP < 0.87) { _nightAlpha = ((_dayP - 0.75) / 0.12) * 0.55; }
      else if (_dayP >= 0.87) { _nightAlpha = 0.55; }
      /* stars — drawn before world objects so they appear behind terrain */
      if (_nightAlpha > 0.05) {
        STAR_DATA.forEach(star => {
          const stx = w / 2 + star.sx * (w / 1900);
          const sty = h / 2 + star.sy * (h / 1500);
          if (stx < 0 || stx > w || sty < 0 || sty > h) return;
          const tw2 = 0.7 + Math.sin(t * (1.2 + star.twinkle) + star.twinkle * 12) * 0.3;
          ctx.beginPath(); ctx.arc(stx, sty, star.r * tw2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${_nightAlpha * tw2 * 0.95})`; ctx.fill();
        });
      }
      /* sky colour — only computed here; radialGradient applied post-render */
      let _skyR = 0, _skyG = 0, _skyB = 0, _skyA = 0;
      if (_dayP < 0.15) {
        _skyR = 10; _skyG = 20; _skyB = 60; _skyA = (1 - _dayP / 0.15) * 0.52;
      } else if (_dayP < 0.25) {
        const p = (_dayP - 0.15) / 0.10;
        _skyR = 255; _skyG = 140 - Math.round(p * 60); _skyB = 60; _skyA = (1 - p) * 0.25;
      } else if (_dayP < 0.65) {
        _skyA = 0;
      } else if (_dayP < 0.75) {
        const p = (_dayP - 0.65) / 0.10;
        _skyR = 255; _skyG = Math.round(100 - p * 60); _skyB = 20; _skyA = p * 0.28;
      } else if (_dayP < 0.87) {
        const p = (_dayP - 0.75) / 0.12;
        _skyR = 10; _skyG = 20; _skyB = 55; _skyA = p * 0.52;
      } else {
        _skyR = 8; _skyG = 14; _skyB = 48; _skyA = 0.52;
      }

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

      /* 3. Water patches (animated ripples + rotating shimmers) */
      WATER_DATA.forEach((wd) => {
        const [wcx, wcy] = w2s(wd.x, wd.z);
        const sr = wd.r * TILE;
        /* sandy shore gradient */
        const shoreGrad = ctx.createRadialGradient(wcx, wcy, sr * 0.88, wcx, wcy, sr + 1.5 * TILE);
        shoreGrad.addColorStop(0, 'rgba(180,148,80,0)');
        shoreGrad.addColorStop(0.5, '#c8a86b');
        shoreGrad.addColorStop(1, '#b89050');
        ctx.beginPath(); ctx.arc(wcx, wcy, sr + 1.5 * TILE, 0, Math.PI * 2);
        ctx.fillStyle = shoreGrad; ctx.fill();
        /* water base */
        const wAlpha = 0.78 + Math.sin(t * 1.4 + wd.x) * 0.06;
        const waterGrad = ctx.createRadialGradient(wcx - sr * 0.2, wcy - sr * 0.15, 0, wcx, wcy, sr);
        waterGrad.addColorStop(0, `rgba(55,160,240,${wAlpha})`);
        waterGrad.addColorStop(0.6, `rgba(26,120,216,${wAlpha})`);
        waterGrad.addColorStop(1, `rgba(10,80,170,${wAlpha})`);
        ctx.beginPath(); ctx.arc(wcx, wcy, sr, 0, Math.PI * 2);
        ctx.fillStyle = waterGrad; ctx.fill();
        /* concentric ripple rings */
        const ripPhase = (t * 0.65) % 1;
        for (let ri = 0; ri < 3; ri++) {
          const rp = (ripPhase + ri / 3) % 1;
          const rr2 = sr * rp;
          if (rr2 > 0 && rr2 < sr) {
            ctx.beginPath(); ctx.arc(wcx, wcy, rr2, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(140,210,255,${(1 - rp) * 0.22})`;
            ctx.lineWidth = 1.5; ctx.stroke();
          }
        }
        /* rotating shimmers (8 total) */
        for (let si = 0; si < 8; si++) {
          const sAngl = t * 0.5 + si * (Math.PI * 2 / 8);
          const sDist = sr * 0.35;
          const shX = wcx + Math.cos(sAngl) * sDist;
          const shY = wcy + Math.sin(sAngl) * sDist * 0.55;
          ctx.beginPath();
          ctx.ellipse(shX, shY, sr * 0.2, sr * 0.07, sAngl + 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(180,230,255,${0.22 + Math.sin(t * 2 + si) * 0.08})`; ctx.fill();
        }
        /* caustics overlay */
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let ci = 0; ci < 4; ci++) {
          const cAngle = t * 0.35 + ci * (Math.PI / 2);
          const cx2 = wcx + Math.cos(cAngle) * sr * 0.25;
          const cy2 = wcy + Math.sin(cAngle) * sr * 0.18;
          const cR = sr * (0.12 + Math.sin(t * 1.1 + ci) * 0.04);
          ctx.beginPath(); ctx.arc(cx2, cy2, cR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(100,200,255,${0.06 + Math.sin(t * 1.7 + ci) * 0.03})`; ctx.fill();
        }
        ctx.restore();
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

      /* 7. Boulders (with directional shadow) */
      const [bSunX, bSunZ] = getSunVec(t);
      BOULDER_DATA.forEach((b, i) => {
        const [bx, by] = w2s(b.x, b.z);
        const br = b.sx * 0.82 * TILE;
        /* directional cast shadow */
        ctx.beginPath();
        ctx.ellipse(bx + bSunX * br * 0.7, by + br * 0.25 + bSunZ * br * 0.28, br * 1.15, br * 0.42, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.20)'; ctx.fill();
        /* boulder body */
        ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fillStyle = i % 3 === 0 ? '#8a8a8a' : i % 3 === 1 ? '#9a9080' : '#7a7878'; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.stroke();
        if (b.twin) {
          ctx.beginPath(); ctx.arc(bx + br * 0.6, by - br * 0.3, br * 0.55, 0, Math.PI * 2);
          ctx.fillStyle = '#7a7870'; ctx.fill();
        }
      });

      /* 8. Lamp posts (enhanced night glow) */
      const lampDayP = (t / 300) % 1;
      const lampNightA = lampDayP >= 0.87 ? 1 : lampDayP < 0.15 ? 1 : lampDayP > 0.75 ? (lampDayP - 0.75) / 0.12 : 0;
      LAMP_DATA.forEach((l) => {
        const [lx, ly] = w2s(l.x, l.z);
        const lampGlX = lx + 0.6 * TILE; const lampGlY = ly - 1.8 * TILE;
        /* large night pool of light (draw first, under pole) */
        if (lampNightA > 0.05) {
          const poolR = 2.8 * TILE;
          const poolGrad = ctx.createRadialGradient(lampGlX, lampGlY, 0, lampGlX, lampGlY, poolR);
          const poolInt = lampNightA * 0.18;
          poolGrad.addColorStop(0, `rgba(255,235,120,${poolInt * 1.8})`);
          poolGrad.addColorStop(0.4, `rgba(255,210,80,${poolInt})`);
          poolGrad.addColorStop(1, 'rgba(255,190,40,0)');
          ctx.beginPath(); ctx.arc(lampGlX, lampGlY, poolR, 0, Math.PI * 2);
          ctx.fillStyle = poolGrad; ctx.fill();
        }
        /* pole */
        ctx.strokeStyle = '#1e1e2e'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(lx, ly + 0.5 * TILE); ctx.lineTo(lx, ly - 1.8 * TILE); ctx.stroke();
        /* arm */
        ctx.beginPath(); ctx.moveTo(lx, ly - 1.8 * TILE); ctx.lineTo(lampGlX, lampGlY); ctx.stroke();
        /* globe glow gradient */
        const glow = 0.10 + Math.sin(t * 0.8 + l.x) * 0.04;
        const gg = ctx.createRadialGradient(lampGlX, lampGlY, 0, lampGlX, lampGlY, 0.3 * TILE);
        gg.addColorStop(0, 'rgba(255,255,210,0.98)'); gg.addColorStop(1, 'rgba(255,220,60,0)');
        ctx.beginPath(); ctx.arc(lampGlX, lampGlY, 0.3 * TILE, 0, Math.PI * 2);
        ctx.fillStyle = gg; ctx.fill();
        ctx.beginPath(); ctx.arc(lampGlX, lampGlY, 0.16 * TILE, 0, Math.PI * 2);
        ctx.fillStyle = '#fff8e8'; ctx.fill();
        /* close halo */
        ctx.beginPath(); ctx.arc(lampGlX, lampGlY, 1.1 * TILE, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,240,120,${glow + lampNightA * 0.12})`; ctx.fill();
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

      /* 10. Wooden bridges */
      BRIDGE_DATA.forEach(br => {
        const [bsx, bsy] = w2s(br.x, br.z);
        ctx.save();
        ctx.translate(bsx, bsy); ctx.rotate(br.ry);
        for (let i = 0; i < 5; i++) {
          const py = (i - 2) * 0.85 * TILE;
          ctx.fillStyle = woodPatRef.current ?? '#a0682a';
          ctx.fillRect(-2 * TILE, py - 0.4 * TILE, 4 * TILE, 0.76 * TILE);
          ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
          ctx.strokeRect(-2 * TILE, py - 0.4 * TILE, 4 * TILE, 0.76 * TILE);
        }
        ctx.strokeStyle = '#7a4a20'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-1.9 * TILE, -2 * TILE); ctx.lineTo(-1.9 * TILE, 2 * TILE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo( 1.9 * TILE, -2 * TILE); ctx.lineTo( 1.9 * TILE, 2 * TILE); ctx.stroke();
        ctx.restore();
      });

      /* ── Z-sorted sprites: buildings + trees + localities + arenas + collectibles + player ── */
      interface Sprite { z: number; draw: () => void; }
      const sprites: Sprite[] = [];

      /* trees */
      TREE_DATA.forEach(tree => {
        sprites.push({ z: tree.z, draw: () => drawTree(ctx, tree, t) });
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

      /* ── Football field (static) ─────────────────────────── */
      sprites.push({
        z: FOOTBALL_FIELD_POS.z,
        draw: () => {
          const [fx, fy] = w2s(FOOTBALL_FIELD_POS.x, FOOTBALL_FIELD_POS.z);
          const fw = 5.5 * TILE; const fh = 3.8 * TILE;
          /* Ground: green pitch */
          ctx.save();
          ctx.fillStyle = '#1a7a1a';
          rrect(ctx, fx - fw / 2, fy - fh / 2, fw, fh, 4);
          ctx.fill();
          /* Pitch markings */
          ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5;
          /* Perimeter */
          rrect(ctx, fx - fw / 2 + 3, fy - fh / 2 + 3, fw - 6, fh - 6, 2);
          ctx.stroke();
          /* Center line */
          ctx.beginPath(); ctx.moveTo(fx, fy - fh / 2 + 3); ctx.lineTo(fx, fy + fh / 2 - 3); ctx.stroke();
          /* Center circle */
          ctx.beginPath(); ctx.arc(fx, fy, 0.7 * TILE, 0, Math.PI * 2); ctx.stroke();
          /* Left goal */
          ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(fx - fw / 2 - 6, fy - fh * 0.22);
          ctx.lineTo(fx - fw / 2, fy - fh * 0.22);
          ctx.lineTo(fx - fw / 2, fy + fh * 0.22);
          ctx.lineTo(fx - fw / 2 - 6, fy + fh * 0.22);
          ctx.stroke();
          /* Right goal */
          ctx.beginPath();
          ctx.moveTo(fx + fw / 2 + 6, fy - fh * 0.22);
          ctx.lineTo(fx + fw / 2, fy - fh * 0.22);
          ctx.lineTo(fx + fw / 2, fy + fh * 0.22);
          ctx.lineTo(fx + fw / 2 + 6, fy + fh * 0.22);
          ctx.stroke();
          /* Proximity pulse */
          const isNearFF2 = lastNearFootballRef.current;
          if (isNearFF2) {
            const pulse = 0.4 + Math.sin(t * 3.5) * 0.2;
            ctx.beginPath(); ctx.arc(fx, fy, fw * 0.6, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(74,222,128,${pulse})`;
            ctx.lineWidth = 2.5; ctx.stroke();
          }
          /* Label */
          const labelW = 90;
          ctx.fillStyle = 'rgba(5,5,20,0.88)';
          rrect(ctx, fx - labelW / 2, fy - fh / 2 - 22, labelW, 18, 5); ctx.fill();
          ctx.strokeStyle = 'rgba(74,222,128,0.55)'; ctx.lineWidth = 1; ctx.stroke();
          ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = '#4ade80';
          ctx.fillText('⚽ Campo da Calcio', fx, fy - fh / 2 - 13);
          ctx.restore();
        },
      });

      /* arenas */
      leadersRef.current.forEach((leader, idx) => {
        const [ax, az] = arenaPositionsRef.current[idx] ?? getArenaPosition(idx);
        const status = getLeaderStatusRef.current(leader);
        const isNear = leader.id === lastNearLeaderIdRef.current;
        const unlockAnim = unlockAnimsRef.current.get(idx) ?? null;
        /* clean up expired animations */
        if (unlockAnim && t - unlockAnim.startTime > 2.5) {
          unlockAnimsRef.current.delete(idx);
        }
        sprites.push({ z: az, draw: () => {
          const [cx, cy] = w2s(ax, az);
          drawArena(ctx, cx, cy, leader, status, isNear, idx, t, unlockAnim);
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

      /* buildings */
      BUILDING_DATA.forEach(bld => {
        const [bx, by] = w2s(bld.x, bld.z);
        const bW = bld.w * TILE;
        const bH = bld.h * TILE;
        const colors = BUILDING_COLORS[bld.type] ?? BUILDING_COLORS.house;
        sprites.push({ z: bld.z, draw: () => {
          /* shadow */
          ctx.beginPath();
          ctx.ellipse(bx + 3, by + bH * 0.3, bW * 0.45, bH * 0.15, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill();
          /* body */
          rrect(ctx, bx - bW / 2, by - bH / 2, bW, bH, 4);
          ctx.fillStyle = colors.body; ctx.fill();
          ctx.strokeStyle = darken(colors.body, 40); ctx.lineWidth = 1.5; ctx.stroke();
          /* roof strip */
          const roofH = bH * 0.3;
          rrect(ctx, bx - bW / 2, by - bH / 2, bW, roofH, 4);
          ctx.fillStyle = colors.roof; ctx.fill();
          /* type-specific details */
          if (bld.type === 'ruin') {
            ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(bx - bW * 0.2, by - bH * 0.28); ctx.lineTo(bx - bW * 0.05, by + bH * 0.22); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx + bW * 0.15, by - bH * 0.1); ctx.lineTo(bx + bW * 0.3, by + bH * 0.28); ctx.stroke();
          } else if (bld.type === 'church') {
            ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(bx, by - bH / 2 - 9); ctx.lineTo(bx, by - bH / 2 + 1); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx - 5, by - bH / 2 - 5); ctx.lineTo(bx + 5, by - bH / 2 - 5); ctx.stroke();
          } else if (bld.type === 'tower') {
            for (let ti = -1; ti <= 1; ti++) {
              ctx.fillStyle = colors.roof;
              ctx.fillRect(bx + ti * bW * 0.28 - 4, by - bH / 2 - 6, 7, 6);
            }
          } else if (bld.type === 'inn') {
            ctx.strokeStyle = '#7a2020'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(bx + bW / 2 - 2, by - bH / 2); ctx.lineTo(bx + bW / 2 - 2, by - bH / 2 - 10); ctx.stroke();
            ctx.fillStyle = '#ff3333';
            ctx.beginPath(); ctx.moveTo(bx + bW / 2 - 2, by - bH / 2 - 10); ctx.lineTo(bx + bW / 2 + 8, by - bH / 2 - 7); ctx.lineTo(bx + bW / 2 - 2, by - bH / 2 - 4); ctx.fill();
          } else if (bld.type === 'shop') {
            ctx.fillStyle = '#f97316';
            ctx.fillRect(bx - bW / 2, by - bH / 2 + roofH, bW, 4);
          }
          /* door */
          const doorW = bW * 0.24; const doorH = bH * 0.28;
          ctx.fillStyle = darken(colors.body, 55);
          ctx.fillRect(bx - doorW / 2, by + bH / 2 - doorH, doorW, doorH);
          ctx.beginPath(); ctx.arc(bx, by + bH / 2 - doorH, doorW / 2, Math.PI, 0); ctx.fill();
          /* windows */
          if (bld.type !== 'ruin') {
            [bx - bW * 0.24, bx + bW * 0.24].forEach(wx => {
              ctx.fillStyle = 'rgba(255,255,180,0.38)';
              ctx.fillRect(wx - 4, by + bH * 0.04 - 4, 8, 6);
              ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
              ctx.strokeRect(wx - 4, by + bH * 0.04 - 4, 8, 6);
            });
          }
        }});
      });

      /* arcade buildings */
      ARCADE_BUILDINGS.forEach(ab => {
        const isNearArcade = ab.id === lastNearArcadeIdRef.current;
        sprites.push({ z: ab.z, draw: () => {
          const [ax, ay] = w2s(ab.x, ab.z);
          const bW = 3.0 * TILE; const bH = 2.8 * TILE;
          /* neon glow halo */
          ctx.beginPath(); ctx.ellipse(ax, ay + bH * 0.2, bW * 0.7, bH * 0.2, 0, 0, Math.PI * 2);
          ctx.fillStyle = `${ab.color}44`; ctx.fill();
          /* body */
          rrect(ctx, ax - bW / 2, ay - bH / 2, bW, bH, 6);
          ctx.fillStyle = '#1e0a3e'; ctx.fill();
          ctx.strokeStyle = ab.color; ctx.lineWidth = isNearArcade ? 2.5 : 1.5; ctx.stroke();
          /* roof */
          const roofH = bH * 0.28;
          rrect(ctx, ax - bW / 2, ay - bH / 2, bW, roofH, 6);
          ctx.fillStyle = ab.color + 'cc'; ctx.fill();
          /* sign board */
          rrect(ctx, ax - bW * 0.38, ay - bH * 0.1, bW * 0.76, bH * 0.3, 4);
          ctx.fillStyle = `rgba(0,0,0,0.6)`; ctx.fill();
          ctx.strokeStyle = ab.color + '88'; ctx.lineWidth = 1; ctx.stroke();
          /* emoji icon */
          ctx.font = `${Math.round(TILE * 0.7)}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(ab.emoji, ax, ay + bH * 0.04);
          /* name label */
          ctx.font = `bold ${Math.round(TILE * 0.38)}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillStyle = ab.color;
          const nameShort = ab.name.length > 14 ? ab.name.slice(0, 13) + '…' : ab.name;
          ctx.fillText(nameShort, ax, ay + bH / 2 + 4);
          /* neon outline flash when near */
          if (isNearArcade) {
            ctx.strokeStyle = ab.color;
            ctx.lineWidth = 2 + Math.sin(t * 4) * 0.5;
            rrect(ctx, ax - bW / 2 - 3, ay - bH / 2 - 3, bW + 6, bH + 6, 8);
            ctx.stroke();
          }
          /* decorative neon dots */
          for (let di = 0; di < 4; di++) {
            const dox = (di / 3 - 0.5) * bW * 0.6;
            ctx.beginPath(); ctx.arc(ax + dox, ay - bH * 0.32, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = di % 2 === 0 ? ab.color : '#ffffff88'; ctx.fill();
          }
        }});
      });

      /* other online players */
      otherPlayersRef.current.forEach(op => {
        sprites.push({ z: op.z, draw: () => {
          const [osx, osy] = w2s(op.x, op.z);
          const bW = 0.55 * TILE; const bH = 0.72 * TILE;
          /* shadow */
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.beginPath(); ctx.ellipse(osx, osy + 4, bW * 0.55, 5, 0, 0, Math.PI * 2); ctx.fill();
          /* body */
          ctx.fillStyle = '#2563eb';
          rrect(ctx, osx - bW / 2, osy - bH + 4, bW, bH, 4); ctx.fill();
          /* legs */
          const legW2 = bW * 0.35; const legH2 = bH * 0.28;
          ctx.fillStyle = '#1d4ed8';
          ctx.fillRect(osx - bW * 0.35, osy, legW2, legH2);
          ctx.fillRect(osx + bW * 0.35 - legW2, osy, legW2, legH2);
          /* head */
          ctx.beginPath(); ctx.arc(osx, osy - bH + 4 - 0.28 * TILE * 0.4, 0.28 * TILE, 0, Math.PI * 2);
          ctx.fillStyle = '#f4c07c'; ctx.fill();
          /* username label */
          ctx.save();
          ctx.font = `bold ${Math.round(TILE * 0.55)}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          const labelY = osy - bH - 0.28 * TILE * 1.6;
          ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 3;
          ctx.strokeText(op.username, osx, labelY);
          ctx.fillStyle = '#e0f2fe';
          ctx.fillText(op.username, osx, labelY);
          ctx.restore();
        }});
      });

      /* player */
      sprites.push({ z: playerRef.current.z, draw: () => drawPlayer(ctx, t, movingRef.current) });

      sprites.sort((a, b) => a.z - b.z);
      sprites.forEach(s => s.draw());

      /* ── Falling leaves — bezier trajectory ───────────────── */
      leavesRef.current.forEach(lp => {
        lp.life += dt * lp.speed;
        if (lp.life >= lp.maxLife) {
          /* re-init with new random bezier path */
          const seed = Math.round(lp.wx * 31 + lp.wz * 17 + t * 3) & 0xfff;
          lp.cx = ((seed * 13 + 3) % 41) * 0.07 - 1.4;
          lp.cz = ((seed * 7) % 18) * 0.06 + 0.8;
          lp.ex = ((seed * 11 + 5) % 33) * 0.09 - 1.5;
          lp.ez = ((seed * 19) % 14) * 0.12 + 2.8;
          lp.life = 0;
        }
        const prog = lp.life / lp.maxLife;
        /* quadratic bezier: B(t) = (1-t)²P0 + 2t(1-t)P1 + t²P2 */
        const mt = 1 - prog;
        const bx = mt * mt * lp.wx + 2 * mt * prog * (lp.wx + lp.cx) + prog * prog * (lp.wx + lp.ex);
        const bz = mt * mt * lp.wz + 2 * mt * prog * (lp.wz + lp.cz) + prog * prog * (lp.wz + lp.ez);
        const [lsx, lsy] = w2s(bx, bz);
        const leafA = Math.min(1, Math.min(prog * 5, (1 - prog) * 5)) * 0.60;
        if (leafA > 0.02) {
          ctx.save();
          ctx.globalAlpha = leafA;
          ctx.translate(lsx, lsy);
          ctx.rotate(prog * Math.PI * 3.5);
          ctx.fillStyle = prog > 0.65 ? '#8B5E2A' : '#3a8c3a';
          ctx.beginPath();
          ctx.ellipse(0, 0, lp.size * 1.5, lp.size * 0.7, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });

      /* ── Fireflies (night only) ─────────────────────────── */
      const ffDayP = (t / 300) % 1;
      const ffNightA = ffDayP >= 0.87 ? 1 : ffDayP < 0.12 ? 1 : ffDayP > 0.78 ? (ffDayP - 0.78) / 0.09 : 0;
      if (ffNightA > 0.05) {
        firefliesRef.current.forEach(ff => {
          const angle = t * ff.speed + ff.phase;
          const fx2 = ff.wx + Math.cos(angle) * ff.orbitR;
          const fz2 = ff.wz + Math.sin(angle * 0.7) * ff.orbitR * 0.5;
          const [ffsx, ffsy] = w2s(fx2, fz2);
          const pulse = 0.5 + Math.sin(t * 3.2 + ff.phase * 7) * 0.5;
          const ffA = ffNightA * pulse * 0.88;
          if (ffA > 0.05) {
            const ffGrad = ctx.createRadialGradient(ffsx, ffsy, 0, ffsx, ffsy, ff.size * 4);
            ffGrad.addColorStop(0, `rgba(180,255,120,${ffA})`);
            ffGrad.addColorStop(0.3, `rgba(120,220,80,${ffA * 0.5})`);
            ffGrad.addColorStop(1, 'rgba(80,180,40,0)');
            ctx.beginPath(); ctx.arc(ffsx, ffsy, ff.size * 4, 0, Math.PI * 2);
            ctx.fillStyle = ffGrad; ctx.fill();
            ctx.beginPath(); ctx.arc(ffsx, ffsy, ff.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(220,255,180,${ffA})`; ctx.fill();
          }
        });
      }

      /* ── Post-render: radialGradient atmosphere overlay ──── */
      if (_skyA > 0.005) {
        const atmoR = Math.hypot(w, h) * 0.65;
        const atmoGrad = ctx.createRadialGradient(w / 2, h / 2, atmoR * 0.1, w / 2, h / 2, atmoR);
        atmoGrad.addColorStop(0, `rgba(${_skyR},${_skyG},${_skyB},${_skyA * 0.30})`);
        atmoGrad.addColorStop(0.55, `rgba(${_skyR},${_skyG},${_skyB},${_skyA * 0.50})`);
        atmoGrad.addColorStop(1, `rgba(${_skyR},${_skyG},${_skyB},${_skyA * 0.72})`);
        ctx.fillStyle = atmoGrad;
        ctx.fillRect(0, 0, w, h);
      }

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
        if (c.type === 'card') {
          onCardCollected?.(c.cardId ?? String(c.id));
        }
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
  }, [isCollecting, onCardCollected]);

  /* Route: coins collect directly, cards open the reveal modal first */
  const handleCollectPrompt = useCallback(() => {
    if (!nearCollectible) return;
    if (nearCollectible.type === 'card') {
      setCardReveal(nearCollectible);
    } else {
      handleCollectDirect(nearCollectible);
    }
  }, [nearCollectible, handleCollectDirect]);

  /* ── Arcade: fetch user PR on mount ─────────────────────── */
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    const authHeaders = { Authorization: `Bearer ${token}` };
    fetch('/api/profile', { credentials: 'include', headers: authHeaders })
      .then(r => r.json())
      .then(d => { if (d.profile?.user?.puntiRankiard != null) setUserPR(d.profile.user.puntiRankiard); })
      .catch(() => {});
    fetch('/api/minigame/cooldowns', { credentials: 'include', headers: authHeaders })
      .then(r => r.json())
      .then(d => { if (d.success && d.cooldowns) setMinigameCooldowns(d.cooldowns); })
      .catch(() => {});
  }, []);

  /* ── Arcade: handle mini-game completion (submits session result for server-side PR) ── */
  const handleMinigameComplete = useCallback(async (sr: import('./MiniGames').SessionResult, gameName: string) => {
    const token = localStorage.getItem('authToken');
    try {
      const res = await fetch('/api/minigame/reward', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ gameId: sr.gameId, sessionToken: sr.sessionToken, result: sr.result }),
      });
      const data = await res.json();
      if (data.success) {
        setUserPR(data.newTotal ?? userPR);
        if (data.cooldownUntil) {
          setMinigameCooldowns(prev => ({ ...prev, [sr.gameId]: data.cooldownUntil }));
        }
        setMinigameResult({ gameName, pr: data.prAwarded ?? 0 });
      } else {
        if (data.cooldownUntil) {
          setMinigameCooldowns(prev => ({ ...prev, [sr.gameId]: data.cooldownUntil }));
        }
        setMinigameResult({ gameName, pr: 0 });
      }
    } catch (e) {
      console.error('Minigame reward error', e);
    }
    setTimeout(() => setMinigameResult(null), 3500);
    setActiveMinigame(null);
    setMinigameSession(null);
  }, [userPR]);

  /* Cooldown: check remaining time */
  const getArcadeCooldownText = useCallback((gameId: string): string | null => {
    const cooldown = minigameCooldowns[gameId];
    if (!cooldown) return null;
    const remaining = cooldown - Date.now();
    if (remaining <= 0) return null;
    const mins = Math.ceil(remaining / 60000);
    return `${mins}m`;
  }, [minigameCooldowns]);

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
  const isMobileLandscape = isTouchDevice && isLandscape;

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, overflow: 'hidden', minHeight: 0 }}>
      {/* Main canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={() => setTooltip(null)}
        style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated' }}
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

      {/* Chapter progress bar (top center) */}
      {(() => {
        const total = leaders.length;
        const completed = leaders.filter(l => getLeaderStatus(l) === 'completed').length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        const currentChapter = Math.min(completed + 1, total);
        return (
          <div style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(3,4,18,0.9)', border: '1px solid rgba(255,255,255,0.1)',
            borderTop: 'none', borderRadius: '0 0 12px 12px',
            padding: '6px 18px 8px', zIndex: 25, minWidth: 220,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            pointerEvents: 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(251,191,36,0.9)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                ⚔️ Capitolo {currentChapter} di {total}
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{pct}%</span>
            </div>
            <div style={{ width: '100%', height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #4ade80, #fbbf24)',
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        );
      })()}

      {/* Directional compass to next available arena */}
      {(() => {
        if (isMobileLandscape) return null;
        const nextArena = leaders.find(l => getLeaderStatus(l) === 'available');
        if (!nextArena) return null;
        const idx = leaders.indexOf(nextArena);
        const [ax, az] = arenaPositions[idx] ?? getArenaPosition(idx);
        const px = playerRef.current.x, pz = playerRef.current.z;
        const dx = ax - px, dz = az - pz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 6) return null; // close enough, no arrow needed
        const angle = Math.atan2(dz, dx); // angle in world space (x = right, z = down)
        const screenAngle = angle; // canvas uses same convention
        const distLabel = Math.round(dist);
        return (
          <div style={{
            position: 'absolute', bottom: 90, left: 16,
            background: 'rgba(3,4,18,0.88)', border: '1.5px solid rgba(251,191,36,0.5)',
            borderRadius: 12, padding: '8px 12px', zIndex: 25,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            pointerEvents: 'none',
          }}>
            <div style={{
              width: 36, height: 36, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                border: '2px solid rgba(251,191,36,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 0, height: 0,
                  borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: '18px solid #fbbf24',
                  transformOrigin: '50% 75%',
                  transform: `rotate(${screenAngle + Math.PI / 2}rad)`,
                }} />
              </div>
            </div>
            <div style={{ fontSize: 9, color: 'rgba(251,191,36,0.8)', fontWeight: 800, textAlign: 'center' }}>
              Prossima arena
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
              {distLabel} u.m.
            </div>
          </div>
        );
      })()}

      {/* Victory History button */}
      {!showHistoryPanel && (
        <button
          onClick={() => setShowHistoryPanel(true)}
          style={{
            position: 'absolute',
            bottom: isMobileLandscape
              ? 8
              : isTouchDevice ? (nearLeader && nearStatus !== 'locked' && nearestDist <= 9 ? 235 : 185) : 90,
            left: isMobileLandscape ? 'auto' : isTouchDevice ? 188 : 16,
            right: isMobileLandscape ? 160 : 'auto',
            background: 'rgba(3,4,18,0.88)', border: '1.5px solid rgba(74,222,128,0.4)',
            borderRadius: 10, padding: isMobileLandscape ? '5px 10px' : '7px 12px', color: '#4ade80',
            fontSize: isMobileLandscape ? 11 : 12, fontWeight: 800, cursor: 'pointer', zIndex: 35,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          🏆 Storico
        </button>
      )}

      {showHistoryPanel && (() => {
        const completed = leaders.filter(l => getLeaderStatus(l) === 'completed');
        return (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'rgba(3,4,18,0.97)', borderTop: '2px solid rgba(74,222,128,0.4)',
            zIndex: 40, padding: isMobileLandscape ? '8px 16px' : '14px 16px',
            maxHeight: isMobileLandscape ? '85vh' : '55%', overflow: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: '#4ade80', fontWeight: 900, fontSize: 14 }}>🏆 Storico vittorie</span>
              <button onClick={() => setShowHistoryPanel(false)} style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: 12, padding: '4px 10px', cursor: 'pointer',
              }}>✕</button>
            </div>
            {completed.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center', margin: '20px 0' }}>Nessuna vittoria ancora</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {completed.map((leader, i) => (
                  <div key={leader.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)',
                    borderRadius: 10, padding: '10px 14px',
                  }}>
                    {leader.leaderImageUrl ? (
                      <img src={leader.leaderImageUrl} alt={leader.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(74,222,128,0.4)', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(22,101,52,0.5)', border: '1.5px solid rgba(74,222,128,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🏋️</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#86efac', fontWeight: 800, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {leader.gymName}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>
                        👊 {leader.name} · {leader.cpuLevel === 'easy' ? '🟢 Facile' : leader.cpuLevel === 'medium' ? '🟡 Medio' : '🔴 Difficile'}
                      </div>
                    </div>
                    <div style={{ color: '#4ade80', fontSize: 11, fontWeight: 800, textAlign: 'right', flexShrink: 0 }}>
                      ✓ Completato
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Tooltip overlay */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x + 14,
          top: tooltip.y - 10,
          background: 'rgba(3,4,18,0.96)',
          border: `1.5px solid ${tooltip.status === 'completed' ? 'rgba(74,222,128,0.6)' : tooltip.status === 'available' ? 'rgba(251,191,36,0.6)' : 'rgba(107,114,128,0.4)'}`,
          borderRadius: 10, padding: '10px 14px', zIndex: 100,
          pointerEvents: 'none', minWidth: 160, maxWidth: 220,
          boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
        }}>
          <div style={{ color: tooltip.status === 'completed' ? '#4ade80' : tooltip.status === 'available' ? '#fbbf24' : '#9ca3af', fontWeight: 900, fontSize: 12, marginBottom: 4 }}>
            {tooltip.status === 'completed' ? '🏆 Completato' : tooltip.status === 'available' ? '⚔️ Disponibile' : '🔒 Bloccato'}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 800, fontSize: 13, marginBottom: 3 }}>
            {tooltip.leader.gymName}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginBottom: 2 }}>
            👊 {tooltip.leader.name}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 2 }}>
            {tooltip.leader.cpuLevel === 'easy' ? '🟢 Facile' : tooltip.leader.cpuLevel === 'medium' ? '🟡 Medio' : '🔴 Difficile'}
            {' · '}❤️ {tooltip.leader.livesCount}
          </div>
          {tooltip.status === 'available' && (
            <div style={{ color: 'rgba(251,191,36,0.7)', fontSize: 10, marginTop: 4, fontStyle: 'italic' }}>
              Avvicinati per sfidare
            </div>
          )}
          {tooltip.status === 'locked' && (
            <div style={{ color: 'rgba(156,163,175,0.6)', fontSize: 10, marginTop: 4, fontStyle: 'italic' }}>
              Completa le arene precedenti
            </div>
          )}
        </div>
      )}

      {/* Top-right HUD */}
      <div style={{
        position: 'absolute', top: 12, right: 12,
        background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10, padding: isMobileLandscape ? '4px 10px' : '6px 12px',
        color: 'rgba(255,255,255,0.60)', fontSize: 11, fontWeight: 700,
        pointerEvents: 'none', zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'right',
      }}>
        {!isMobileLandscape && (
          <span style={{ color: 'rgba(255,255,255,0.45)' }}>WASD / ↑↓←→ — muoviti</span>
        )}
        <span style={{ color: '#4ade80', fontSize: isMobileLandscape ? 10 : 12 }}>
          ✓ <strong>{completedCount}/{leaders.length}</strong> stage
        </span>
        <span style={{ color: 'rgba(251,191,36,0.85)', fontSize: isMobileLandscape ? 10 : 11 }}>
          {nearLeader && nearStatus !== 'locked' && nearestDist <= 9
            ? `⚡ ${nearLeader.gymName}`
            : '📍 Avvicinati'}
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
          padding: isMobileLandscape ? '8px 16px' : '14px 16px',
          display: 'flex', alignItems: 'center', gap: isMobileLandscape ? 8 : 14, zIndex: 30,
        }}>
          {nearLeader.leaderImageUrl ? (
            <img src={nearLeader.leaderImageUrl} alt={nearLeader.name} style={{
              width: isMobileLandscape ? 36 : 56, height: isMobileLandscape ? 36 : 56,
              borderRadius: '50%', objectFit: 'cover',
              border: `2px solid ${nearStatus === 'completed' ? '#4ade80' : '#fbbf24'}`, flexShrink: 0,
              boxShadow: `0 0 18px ${nearStatus === 'completed' ? '#4ade8055' : '#fbbf2455'}`,
            }} />
          ) : (
            <div style={{
              width: isMobileLandscape ? 36 : 56, height: isMobileLandscape ? 36 : 56,
              borderRadius: '50%', flexShrink: 0,
              background: nearStatus === 'completed' ? 'rgba(22,101,52,0.6)' : 'rgba(120,53,15,0.6)',
              border: `2px solid ${nearStatus === 'completed' ? '#4ade8055' : '#fbbf2455'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: isMobileLandscape ? 16 : 22,
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

      {/* ── Arcade proximity HUD ──────────────────────────────── */}
      {nearestArcadeId && nearestArcadeDist <= 9 && !nearLeader && !activeMinigame && (() => {
        const ab = ARCADE_BUILDINGS.find(a => a.id === nearestArcadeId);
        if (!ab) return null;
        const coolText = getArcadeCooldownText(ab.id);
        return (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(to top, rgba(10,2,30,0.97) 0%, rgba(20,5,50,0.9) 100%)',
            borderTop: `2px solid ${ab.color}88`,
            padding: isMobileLandscape ? '8px 16px' : '14px 16px',
            display: 'flex', alignItems: 'center', gap: isMobileLandscape ? 8 : 14, zIndex: 30,
          }}>
            <div style={{
              width: isMobileLandscape ? 36 : 52, height: isMobileLandscape ? 36 : 52, borderRadius: 12, flexShrink: 0,
              background: `linear-gradient(135deg, ${ab.color}44, ${ab.color}22)`,
              border: `2px solid ${ab.color}88`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: isMobileLandscape ? 18 : 26,
              boxShadow: `0 0 18px ${ab.color}44`,
            }}>{ab.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: ab.color }}>
                🎮 Arcade
              </div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: 'rgba(255,255,255,0.95)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ab.name}
              </p>
              <p style={{ margin: '1px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                {coolText ? `⏳ Cooldown: ${coolText}` : 'Entra e gioca per guadagnare PR!'}
              </p>
            </div>
            <div style={{ flexShrink: 0 }}>
              {coolText ? (
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: 700 }}>⏳ {coolText}</div>
              ) : (
                <button
                  disabled={startingMinigame}
                  onClick={async () => {
                    const token = localStorage.getItem('authToken');
                    setStartingMinigame(true);
                    try {
                      const r = await fetch('/api/minigame/start', {
                        method: 'POST', credentials: 'include',
                        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                        body: JSON.stringify({ gameId: ab.id }),
                      });
                      const d = await r.json();
                      if (d.success) {
                        const { sessionToken, currentPR: srvPR, ...rest } = d;
                        if (srvPR != null) setUserPR(srvPR);
                        setMinigameSession({ token: sessionToken, serverData: rest });
                        setActiveMinigame(ab);
                      } else if (d.cooldownUntil) {
                        setMinigameCooldowns(prev => ({ ...prev, [ab.id]: d.cooldownUntil }));
                      }
                    } catch (_) {}
                    setStartingMinigame(false);
                  }}
                  style={{
                    background: `linear-gradient(135deg, ${ab.color}, ${ab.color}bb)`,
                    border: 'none', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 900,
                    padding: '10px 18px', cursor: startingMinigame ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                    boxShadow: `0 2px 14px ${ab.color}55`, letterSpacing: '0.04em',
                    opacity: startingMinigame ? 0.6 : 1,
                  }}>
                  {startingMinigame ? '⏳…' : '🎮 Gioca!'}
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Arcade active mini-game modal ─────────────────────── */}
      {activeMinigame && minigameSession && (() => {
        const ab = activeMinigame;
        const onClose = () => { setActiveMinigame(null); setMinigameSession(null); };
        const onComplete = (sr: import('./MiniGames').SessionResult) => handleMinigameComplete(sr, ab.name);
        const commonProps = {
          gameId: ab.id, gameName: ab.name, onClose, onComplete, userPR,
          sessionToken: minigameSession.token,
          serverData: minigameSession.serverData,
        };
        switch (ab.id) {
          case 'ruota':    return <RuotaDellaFortuna {...commonProps} />;
          case 'memory':   return <MemoryGame {...commonProps} />;
          case 'dado':     return <SfidaAlDado {...commonProps} />;
          case 'reazione': return <ReazioneRapida {...commonProps} />;
          case 'quiz':     return <QuizMinkiard {...commonProps} />;
          case 'rps':      return <SassoCartaForbice {...commonProps} />;
          default:         return null;
        }
      })()}

      {/* ── Arcade result toast ───────────────────────────────── */}
      {minigameResult && (
        <div style={{
          position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(5,5,20,0.97)',
          border: `1.5px solid ${minigameResult.pr > 0 ? 'rgba(74,222,128,0.6)' : minigameResult.pr < 0 ? 'rgba(239,68,68,0.6)' : 'rgba(251,191,36,0.6)'}`,
          borderRadius: 12, padding: '10px 22px', zIndex: 150,
          color: minigameResult.pr > 0 ? '#4ade80' : minigameResult.pr < 0 ? '#ef4444' : '#fbbf24',
          fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
          pointerEvents: 'none',
        }}>
          🎮 {minigameResult.gameName}: {minigameResult.pr > 0 ? `+${minigameResult.pr}` : minigameResult.pr} PR
        </div>
      )}

      {/* Football field proximity panel */}
      {nearFootball && !showFootballMinigame && !showHistoryPanel && !(nearLeader && nearStatus !== 'locked' && nearestDist <= 9) && !(nearestArcadeId && nearestArcadeDist <= 9) && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(to top, rgba(0,10,0,0.97) 0%, rgba(0,15,0,0.9) 100%)',
          borderTop: '2px solid rgba(34,197,94,0.5)',
          padding: isMobileLandscape ? '8px 16px' : '14px 16px',
          display: 'flex', alignItems: 'center', gap: isMobileLandscape ? 8 : 14, zIndex: 30,
        }}>
          <div style={{ fontSize: isMobileLandscape ? 28 : 40, flexShrink: 0 }}>⚽</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: isMobileLandscape ? 13 : 16, fontWeight: 900, color: '#4ade80' }}>
              Campo da Calcio
            </p>
            <p style={{ margin: '2px 0 0', fontSize: isMobileLandscape ? 11 : 13, color: 'rgba(255,255,255,0.5)' }}>
              4 mini-giochi · Guadagna Rankiard!
            </p>
          </div>
          <button
            onClick={() => setShowFootballMinigame(true)}
            style={{
              background: 'linear-gradient(135deg,#16a34a,#4ade80)', border: 'none',
              borderRadius: 10, color: 'white', fontSize: isMobileLandscape ? 13 : 15, fontWeight: 900,
              padding: isMobileLandscape ? '8px 14px' : '10px 20px', cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: '0 2px 14px rgba(74,222,128,0.4)',
            }}
          >
            🎮 Gioca
          </button>
        </div>
      )}

      {/* Football minigame overlay */}
      {showFootballMinigame && (
        <FootballMinigames
          authToken={authToken ?? null}
          onClose={() => setShowFootballMinigame(false)}
          onCreditsEarned={(credits) => {
            const now = performance.now() / 1000;
            floatingTextsRef.current.push({
              text: `+${credits} crediti`,
              x: FOOTBALL_FIELD_POS.x, z: FOOTBALL_FIELD_POS.z,
              color: '#4ade80', startTime: now,
            });
          }}
        />
      )}


      {/* Coin pickup popup (coins only — cards go to reveal modal) */}
      {nearCollectible && nearCollectible.type === 'coin' && !localCollectedIds.has(nearCollectible.id) && !cardReveal && (
        <div style={{
          position: 'absolute',
          bottom: isMobileLandscape ? 'auto' : isTouchDevice ? 180 : 120,
          top: isMobileLandscape ? 8 : 'auto',
          left: isMobileLandscape ? 8 : '50%',
          transform: isMobileLandscape ? 'none' : 'translateX(-50%)',
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
          position: 'absolute',
          bottom: isMobileLandscape ? 'auto' : isTouchDevice ? 180 : 120,
          top: isMobileLandscape ? 8 : 'auto',
          left: isMobileLandscape ? 8 : '50%',
          transform: isMobileLandscape ? 'none' : 'translateX(-50%)',
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

      {/* Nearby player interaction banner */}
      {proximityPlayer && !nearLeader && !incomingChallenge && (
        <div style={{
          position: 'absolute',
          bottom: isMobileLandscape ? 'auto' : isTouchDevice ? 190 : 80,
          top: isMobileLandscape ? 8 : 'auto',
          left: isMobileLandscape ? '50%' : '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(5,5,30,0.95)',
          border: '2px solid rgba(59,130,246,0.7)',
          borderRadius: 14, padding: '12px 22px', zIndex: 50,
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
          whiteSpace: 'nowrap',
        }}>
          <div style={{ fontSize: 28 }}>⚔️</div>
          <div>
            <div style={{ color: '#93c5fd', fontWeight: 900, fontSize: 14 }}>{proximityPlayer.username}</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>Giocatore nelle vicinanze</div>
          </div>
          {!challengeSent ? (
            <button
              onClick={() => {
                socket.emit('story-world:challenge', { targetUserId: proximityPlayer.userId, authToken });
                setChallengeSent(true);
                setTimeout(() => setChallengeSent(false), 12000);
              }}
              style={{
                background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
                border: 'none', borderRadius: 10, color: 'white', fontWeight: 900,
                fontSize: 13, padding: '8px 16px', cursor: 'pointer',
              }}
            >
              ⚡ Sfida PvP
            </button>
          ) : (
            <div style={{ color: '#93c5fd', fontSize: 12, fontStyle: 'italic' }}>Sfida inviata…</div>
          )}
        </div>
      )}

      {/* Incoming PvP challenge banner */}
      {incomingChallenge && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          background: 'rgba(5,5,20,0.98)', borderRadius: 20, padding: '28px 32px',
          border: '2px solid rgba(245,158,11,0.8)', zIndex: 90,
          textAlign: 'center', boxShadow: '0 0 60px rgba(245,158,11,0.3)',
          minWidth: 280,
        }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>⚔️</div>
          <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: 18, marginBottom: 4 }}>
            Sfida PvP!
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 18 }}>
            <strong style={{ color: '#fde68a' }}>{incomingChallenge.challengerUsername}</strong> ti sfida!
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => {
                socket.emit('story-world:challenge-response', {
                  challengerUserId: incomingChallenge.challengerUserId,
                  accepted: true,
                  authToken,
                });
                setIncomingChallenge(null);
              }}
              style={{
                background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                border: 'none', borderRadius: 10, color: 'white', fontWeight: 900,
                fontSize: 14, padding: '10px 24px', cursor: 'pointer',
              }}
            >
              ✅ Accetta
            </button>
            <button
              onClick={() => {
                socket.emit('story-world:challenge-response', {
                  challengerUserId: incomingChallenge.challengerUserId,
                  accepted: false,
                  authToken,
                });
                setIncomingChallenge(null);
              }}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 700,
                fontSize: 14, padding: '10px 24px', cursor: 'pointer',
              }}
            >
              ✕ Rifiuta
            </button>
          </div>
        </div>
      )}

      {/* PvP credits earned alert */}
      {pvpCreditsAlert !== null && (
        <div style={{
          position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(5,5,20,0.95)',
          border: '1.5px solid rgba(74,222,128,0.7)',
          borderRadius: 12, padding: '10px 24px', zIndex: 60,
          color: '#4ade80', fontWeight: 900, fontSize: 15, whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
        }}>
          🏆 Vittoria PvP! +{pvpCreditsAlert} crediti
        </div>
      )}

      {/* Mobile d-pad (bottom-left always) */}
      {isTouchDevice && (
        <div style={{
          position: 'absolute',
          bottom: nearLeader && nearStatus !== 'locked' && nearestDist <= 9 ? 130 : 18,
          left: 16,
          right: 'auto',
          display: 'grid',
          gridTemplateColumns: isMobileLandscape ? 'repeat(3, 44px)' : 'repeat(3, 64px)',
          gridTemplateRows: isMobileLandscape ? 'repeat(3, 44px)' : 'repeat(3, 64px)',
          gap: isMobileLandscape ? 3 : 5,
          zIndex: 32,
          transition: 'bottom 0.22s ease',
          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
        }}>
          {/* row 1: empty | up | empty */}
          <div />
          <JoystickBtn
            label="▲"
            onStart={() => setJoy(0, -1)}
            onEnd={() => setJoy(0, 0)}
            size={isMobileLandscape ? 44 : 64}
          />
          <div />
          {/* row 2: left | center (empty) | right */}
          <JoystickBtn
            label="◀"
            onStart={() => setJoy(-1, 0)}
            onEnd={() => setJoy(0, 0)}
            size={isMobileLandscape ? 44 : 64}
          />
          <div style={{
            borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }} />
          <JoystickBtn
            label="▶"
            onStart={() => setJoy(1, 0)}
            onEnd={() => setJoy(0, 0)}
            size={isMobileLandscape ? 44 : 64}
          />
          {/* row 3: empty | down | empty */}
          <div />
          <JoystickBtn
            label="▼"
            onStart={() => setJoy(0, 1)}
            onEnd={() => setJoy(0, 0)}
            size={isMobileLandscape ? 44 : 64}
          />
          <div />
        </div>
      )}
    </div>
  );
}
