import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { GymLeader } from '../types/gym';
import { socket } from '../lib/socket';
import { CardInfoSheet } from './CardInfoSheet';
import {
  RuotaDellaFortuna, MemoryGame, SfidaAlDado,
  ReazioneRapida, QuizMinkiard, SassoCartaForbice,
} from './MiniGames';
import { FootballMinigames } from './FootballMinigames';
import { StoryWorld3D }          from './story3d/StoryWorld3D';
import { useStoryWorldLogic }    from '../hooks/useStoryWorldLogic';

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
  onStartPvp?: (gameId: string, opponentUsername: string, yourDeck: number[], opponentDeck: number[], yourRole: 'challenger' | 'target', livesCount?: number, youtubeMusicUrl?: string | null) => void;
  onCardCollected?: (cardId: string) => void;
  /* Quadrato hidden boss */
  quadratoLeader?: GymLeader | null;
  quadratoCompleted?: boolean;
  onTriggerQuadrato?: () => void;
  /* Avenger Borbonico dark figure */
  avengerBorbonico?: boolean;
  onTriggerAvengerBorbonico?: () => void;
  /* Wizard reward */
  chosenFaction?: string | null;
  wizardCardReceived?: boolean;
  onWizardCard?: () => void;
  /* Secret Room Easter egg */
  allLeadersCompleted?: boolean;
  onOpenSecretRoom?: () => void;
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
const PLAYER_SPEED = 6;
const MAP_BOUND    = 200;

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

/* ── Stage 13 position (remote corner of the map) ──────────────── */
const STAGE13_WORLD_POS: [number, number] = [-145, -170];

/* ── Secret Room position (opposite far corner — Campus Tecnopolis) ── */
const SECRET_ROOM_WORLD_POS: [number, number] = [155, -155];

/* ── City stage positions (progressive south→north scatter) ───── */
const CITY_STAGE_POSITIONS: [number, number][] = [
  [0, 170],       //  1 Piazza d'Ingresso
  [-65, 140],     //  2 Quartiere Residenziale Sud
  [80, 112],      //  3 Porto Sud
  [-100, 75],     //  4 Zona Industriale
  [60, 55],       //  5 Mercato Commerciale Est
  [0, 10],        //  6 Centro Città
  [-110, -10],    //  7 Distretto Ovest
  [100, -35],     //  8 Distretto Est
  [-55, -75],     //  9 Parco Grande
  [65, -100],     // 10 Università
  [-100, -140],   // 11 Porto Nord
  [35, -155],     // 12 Distretto Nord-Est
  [-25, -178],    // 13 Quartiere Storico
  [0, -190],      // 14 Torre Finale
];

function getCityStagePosition(idx: number, _total?: number): [number, number] {
  if (idx < CITY_STAGE_POSITIONS.length) return CITY_STAGE_POSITIONS[idx];
  const extra = idx - CITY_STAGE_POSITIONS.length;
  const angle = (extra * 2.399963) % (Math.PI * 2);
  return [Math.round(Math.cos(angle) * 130), Math.round(Math.sin(angle) * 130)];
}

function getArenaPosition(idx: number, total?: number): [number, number] {
  return getCityStagePosition(idx, total);
}

const TREE_DATA: { x: number; z: number; h: number; r: number }[] = [
  // Corso Principale (x≈0) street trees
  { x: 5, z: 150, h:2.2, r:0.60 }, { x:-5, z:140, h:2.0, r:0.55 },
  { x: 5, z: 130, h:2.1, r:0.58 }, { x:-5, z:118, h:2.2, r:0.60 },
  { x: 5, z:  70, h:2.0, r:0.55 }, { x:-5, z: 60, h:2.1, r:0.58 },
  { x: 5, z:  50, h:2.2, r:0.60 }, { x:-5, z: 40, h:2.0, r:0.55 },
  { x: 5, z:  30, h:2.1, r:0.58 }, { x:-5, z: 20, h:2.2, r:0.60 },
  { x: 5, z:  -5, h:2.0, r:0.55 }, { x:-5, z:-20, h:2.1, r:0.58 },
  { x: 5, z: -35, h:2.2, r:0.60 }, { x:-5, z:-55, h:2.0, r:0.55 },
  { x: 5, z: -80, h:2.1, r:0.58 }, { x:-5, z:-95, h:2.2, r:0.60 },
  { x: 5, z:-115, h:2.0, r:0.55 }, { x:-5, z:-135, h:2.1, r:0.58 },
  { x: 5, z:-155, h:2.2, r:0.60 }, { x:-5, z:-175, h:2.0, r:0.55 },
  // Viale Est (x=90) street trees
  { x:96, z:140, h:2.0, r:0.55 }, { x:84, z:128, h:2.1, r:0.58 },
  { x:96, z:112, h:2.2, r:0.60 }, { x:84, z: 96, h:2.0, r:0.55 },
  { x:96, z: 78, h:2.1, r:0.58 }, { x:84, z: 58, h:2.2, r:0.60 },
  { x:96, z: 35, h:2.0, r:0.55 }, { x:84, z:  5, h:2.1, r:0.58 },
  { x:96, z:-22, h:2.2, r:0.60 }, { x:84, z:-48, h:2.0, r:0.55 },
  // Viale Ovest (x=-90) street trees
  { x:-96, z:140, h:2.0, r:0.55 }, { x:-84, z:128, h:2.1, r:0.58 },
  { x:-96, z:110, h:2.2, r:0.60 }, { x:-84, z: 95, h:2.0, r:0.55 },
  { x:-96, z: 72, h:2.1, r:0.58 }, { x:-84, z: 55, h:2.2, r:0.60 },
  { x:-96, z: 28, h:2.0, r:0.55 }, { x:-84, z:  5, h:2.1, r:0.58 },
  { x:-96, z:-22, h:2.2, r:0.60 }, { x:-84, z:-48, h:2.0, r:0.55 },
  // Parco Grande (x: -80 to 0, z: -80 to -130) park cluster
  { x:-25, z: -85, h:2.8, r:1.05 }, { x:-45, z: -90, h:2.6, r:0.95 },
  { x:-65, z: -88, h:2.9, r:1.05 }, { x:-35, z: -98, h:2.7, r:0.95 },
  { x:-55, z:-102, h:2.5, r:0.90 }, { x:-72, z:-100, h:2.8, r:1.00 },
  { x:-28, z:-110, h:2.6, r:0.92 }, { x:-48, z:-115, h:2.8, r:1.00 },
  { x:-68, z:-118, h:2.5, r:0.90 }, { x:-30, z:-122, h:2.7, r:0.95 },
  { x:-50, z:-128, h:2.6, r:0.92 }, { x:-70, z:-125, h:2.8, r:1.00 },
  { x:-20, z: -95, h:2.4, r:0.85 }, { x:-60, z:-108, h:2.6, r:0.92 },
  // Via Sud Grande (z=160) plaza trees
  { x:-50, z:155, h:2.0, r:0.55 }, { x: 50, z:155, h:2.0, r:0.55 },
  { x:-30, z:165, h:2.1, r:0.58 }, { x: 30, z:165, h:2.1, r:0.58 },
  // Centro piazza trees
  { x: 35, z:-50, h:2.3, r:0.70 }, { x: 45, z:-55, h:2.1, r:0.65 },
  { x:-35, z:-50, h:2.3, r:0.70 }, { x:-45, z:-55, h:2.1, r:0.65 },
  // Far north trees
  { x:-30, z:-165, h:2.2, r:0.65 }, { x: 30, z:-165, h:2.2, r:0.65 },
  { x:-60, z:-155, h:2.0, r:0.60 }, { x: 60, z:-155, h:2.0, r:0.60 },
  // Scattered residential+port trees
  { x:-165, z: 55, h:2.0, r:0.60 }, { x:-155, z: 45, h:2.1, r:0.55 },
  { x: 155, z: 95, h:2.0, r:0.60 }, { x: 145, z: 80, h:2.1, r:0.55 },
  { x: 155, z: 42, h:2.0, r:0.58 }, { x:-155, z:-15, h:2.1, r:0.55 },
  // Extra Parco Grande cluster (denser interior)
  { x:-32, z: -95, h:2.7, r:1.00 }, { x:-58, z: -88, h:2.5, r:0.92 },
  { x:-75, z:-108, h:2.9, r:1.05 }, { x:-22, z:-118, h:2.6, r:0.95 },
  { x:-65, z:-132, h:2.8, r:1.00 }, { x:-38, z:-105, h:2.4, r:0.85 },
  { x:-55, z:-115, h:2.6, r:0.95 }, { x:-75, z: -90, h:2.7, r:1.00 },
  { x:-15, z:-130, h:2.5, r:0.88 }, { x:-42, z: -82, h:2.4, r:0.90 },
  // Nord district additional trees
  { x:-50, z:-175, h:2.3, r:0.70 }, { x: 50, z:-175, h:2.3, r:0.70 },
  { x:-100, z:-160, h:2.2, r:0.68 }, { x: 100, z:-160, h:2.2, r:0.68 },
  { x:-130, z:-145, h:2.0, r:0.62 }, { x: 130, z:-145, h:2.0, r:0.62 },
  { x: -80, z:-185, h:2.4, r:0.72 }, { x:  80, z:-185, h:2.4, r:0.72 },
  { x:-155, z:-170, h:2.1, r:0.65 }, { x: 155, z:-170, h:2.1, r:0.65 },
  // Parco Grande extended (new southern section)
  { x:-12, z:-138, h:2.6, r:0.92 }, { x:-30, z:-142, h:2.8, r:1.00 },
  { x:-60, z:-140, h:2.7, r:0.95 }, { x:-78, z:-138, h:2.5, r:0.90 },
  // Giardino Ovest (x:-172 to -110, z:32 to 98)
  { x:-165, z: 42, h:2.5, r:0.92 }, { x:-148, z: 52, h:2.7, r:0.98 },
  { x:-132, z: 46, h:2.4, r:0.88 }, { x:-158, z: 65, h:2.8, r:1.00 },
  { x:-138, z: 70, h:2.6, r:0.92 }, { x:-120, z: 60, h:2.4, r:0.85 },
  { x:-165, z: 78, h:2.7, r:0.95 }, { x:-148, z: 85, h:2.5, r:0.90 },
  { x:-128, z: 82, h:2.8, r:1.00 }, { x:-118, z: 92, h:2.4, r:0.85 },
  { x:-155, z: 92, h:2.6, r:0.92 }, { x:-142, z: 38, h:2.5, r:0.88 },
  // Giardino Est (x:108 to 172, z:-78 to -8)
  { x: 115, z:-68, h:2.5, r:0.90 }, { x: 135, z:-58, h:2.7, r:0.95 },
  { x: 158, z:-52, h:2.4, r:0.88 }, { x: 122, z:-42, h:2.8, r:1.00 },
  { x: 148, z:-38, h:2.6, r:0.92 }, { x: 165, z:-28, h:2.4, r:0.85 },
  { x: 118, z:-22, h:2.7, r:0.95 }, { x: 140, z:-16, h:2.5, r:0.90 },
  { x: 160, z:-68, h:2.6, r:0.92 }, { x: 112, z:-75, h:2.4, r:0.88 },
  // Parco Ingresso (x:-42 to 42, z:118 to 160)
  { x:-35, z:125, h:2.2, r:0.80 }, { x:-20, z:135, h:2.4, r:0.85 },
  { x:  0, z:128, h:2.3, r:0.82 }, { x: 20, z:138, h:2.4, r:0.85 },
  { x: 35, z:125, h:2.2, r:0.80 }, { x:-30, z:148, h:2.5, r:0.88 },
  { x: 30, z:150, h:2.5, r:0.88 }, { x: -5, z:155, h:2.3, r:0.82 },
  // ── BOSCO NORD-OVEST (x:-172 to -92, z:-200 to -72) dense forest ──
  { x:-168, z:-78,  h:3.8, r:1.55 }, { x:-155, z:-82,  h:4.0, r:1.65 }, { x:-142, z:-78,  h:3.6, r:1.48 },
  { x:-128, z:-82,  h:4.2, r:1.70 }, { x:-115, z:-80,  h:3.8, r:1.55 }, { x:-102, z:-78,  h:3.5, r:1.42 },
  { x:-162, z:-95,  h:4.0, r:1.65 }, { x:-148, z:-92,  h:3.7, r:1.52 }, { x:-135, z:-96,  h:4.2, r:1.70 },
  { x:-122, z:-92,  h:3.9, r:1.60 }, { x:-108, z:-90,  h:3.6, r:1.48 }, { x:-162, z:-90,  h:3.8, r:1.55 },
  { x:-170, z:-110, h:4.0, r:1.65 }, { x:-158, z:-108, h:3.8, r:1.55 }, { x:-145, z:-112, h:4.2, r:1.72 },
  { x:-132, z:-108, h:4.0, r:1.65 }, { x:-118, z:-110, h:3.7, r:1.52 }, { x:-105, z:-108, h:3.5, r:1.42 },
  { x:-165, z:-125, h:4.2, r:1.70 }, { x:-152, z:-122, h:4.0, r:1.65 }, { x:-138, z:-125, h:3.8, r:1.55 },
  { x:-125, z:-122, h:4.2, r:1.72 }, { x:-112, z:-125, h:3.9, r:1.60 }, { x:-100, z:-122, h:3.6, r:1.48 },
  { x:-170, z:-140, h:4.0, r:1.65 }, { x:-158, z:-138, h:4.2, r:1.70 }, { x:-145, z:-142, h:3.8, r:1.55 },
  { x:-130, z:-140, h:4.0, r:1.65 }, { x:-115, z:-142, h:4.2, r:1.72 }, { x:-100, z:-140, h:3.7, r:1.52 },
  { x:-168, z:-158, h:4.2, r:1.70 }, { x:-154, z:-155, h:3.8, r:1.55 }, { x:-140, z:-158, h:4.0, r:1.65 },
  { x:-125, z:-155, h:4.2, r:1.72 }, { x:-110, z:-158, h:3.9, r:1.60 }, { x:-165, z:-152, h:3.7, r:1.52 },
  { x:-170, z:-172, h:4.0, r:1.65 }, { x:-155, z:-172, h:4.2, r:1.70 }, { x:-140, z:-174, h:3.8, r:1.55 },
  { x:-126, z:-172, h:4.0, r:1.65 }, { x:-110, z:-175, h:4.2, r:1.72 }, { x:-168, z:-168, h:3.6, r:1.48 },
  { x:-165, z:-188, h:4.2, r:1.70 }, { x:-150, z:-190, h:3.8, r:1.55 }, { x:-135, z:-188, h:4.0, r:1.65 },
  { x:-120, z:-192, h:4.2, r:1.72 }, { x:-105, z:-188, h:3.7, r:1.52 }, { x:-158, z:-185, h:3.9, r:1.60 },
  // ── CAMPAGNA OVEST orchards (sparse, x:-165 to -95, z:-68 to 15) ──
  { x:-158, z:-62, h:2.2, r:0.78 }, { x:-148, z:-62, h:2.0, r:0.72 }, { x:-138, z:-62, h:2.2, r:0.78 },
  { x:-128, z:-62, h:2.0, r:0.72 }, { x:-118, z:-62, h:2.2, r:0.78 }, { x:-108, z:-62, h:2.0, r:0.72 },
  { x:-165, z:-42, h:2.4, r:0.82 }, { x:-150, z:-42, h:2.2, r:0.78 }, { x:-135, z:-42, h:2.4, r:0.82 },
  { x:-120, z:-42, h:2.2, r:0.78 }, { x:-105, z:-42, h:2.4, r:0.82 },
  { x:-162, z:-22, h:2.2, r:0.78 }, { x:-148, z:-22, h:2.4, r:0.82 }, { x:-133, z:-22, h:2.2, r:0.78 },
  { x:-118, z:-22, h:2.4, r:0.82 }, { x:-103, z:-22, h:2.2, r:0.78 },
  { x:-160, z:  0, h:2.0, r:0.72 }, { x:-145, z:  0, h:2.2, r:0.78 }, { x:-130, z:  0, h:2.0, r:0.72 },
  { x:-115, z:  0, h:2.2, r:0.78 }, { x:-100, z:  0, h:2.0, r:0.72 },
  // ── PIANURA RURALE poplars (slim, along field edges) ──
  { x:-80, z:-155, h:3.2, r:0.50 }, { x:-60, z:-155, h:3.4, r:0.52 }, { x:-40, z:-155, h:3.2, r:0.50 },
  { x:-20, z:-155, h:3.4, r:0.52 }, { x:  0, z:-155, h:3.2, r:0.50 }, { x: 20, z:-155, h:3.4, r:0.52 },
  { x: 40, z:-155, h:3.2, r:0.50 }, { x: 60, z:-155, h:3.4, r:0.52 }, { x: 80, z:-155, h:3.2, r:0.50 },
  { x:-80, z:-195, h:3.0, r:0.48 }, { x:-60, z:-195, h:3.2, r:0.50 }, { x:-40, z:-195, h:3.0, r:0.48 },
  { x:-20, z:-195, h:3.2, r:0.50 }, { x: 20, z:-195, h:3.0, r:0.48 }, { x: 40, z:-195, h:3.2, r:0.50 },
  { x: 60, z:-195, h:3.0, r:0.48 }, { x: 80, z:-195, h:3.2, r:0.50 },
  // ── CAMPUS TECNOPOLIS: ornamental trees in rows ──
  { x:100, z:-80,  h:2.5, r:0.75 }, { x:115, z:-80,  h:2.4, r:0.72 }, { x:130, z:-80,  h:2.6, r:0.78 },
  { x:145, z:-80,  h:2.5, r:0.75 }, { x:160, z:-80,  h:2.4, r:0.72 }, { x:168, z:-80,  h:2.5, r:0.75 },
  { x:100, z:-115, h:2.4, r:0.72 }, { x:115, z:-115, h:2.6, r:0.78 }, { x:145, z:-115, h:2.4, r:0.72 },
  { x:160, z:-115, h:2.5, r:0.75 }, { x:100, z:-138, h:2.5, r:0.75 }, { x:165, z:-138, h:2.4, r:0.72 },
];

const WATER_DATA: { x: number; z: number; r: number }[] = [
  { x: 152, z: 50,  r: 6.0 },  // Porto marina
  { x: 155, z: 72,  r: 5.5 },  // Porto basin
  { x: 150, z: 92,  r: 7.0 },  // Porto main dock
  { x: 140, z:155,  r: 5.0 },  // Porto Nord access
  { x:   0, z:  0,  r: 2.5 },  // Centro piazza fountain
  { x:   0, z:-58,  r: 2.0 },  // Cathedral fountain
  { x: -90, z:160,  r: 2.0 },  // Ingresso fountain ovest
  { x:  90, z:160,  r: 2.0 },  // Ingresso fountain est
  { x: -50, z:-105, r: 5.5 },  // Parco Grande pond
  { x:-140, z:-130, r: 4.5 },  // Porto Nord basin
  // ── New rural / forest water bodies ───────────────────────────
  { x:-148, z:-158, r: 7.5 },  // Lago Bosco (forest lake)
  { x:-125, z:-190, r: 5.0 },  // Stagno Bosco (forest pond)
  { x:  15, z:-180, r: 4.0 },  // Stagno Rurale (rural pond)
  { x: -50, z:-175, r: 3.0 },  // Pozza Rurale (field puddle)
  { x:-170, z: -32, r: 3.5 },  // Abbeveratoio Campagna (farm watering hole)
];

/* ── City park flower beds (only in park + plaza areas) ─────── */
const FLOWER_DATA: { x:number; z:number; r:number; color:string }[] = [
  // Parco Grande flower beds
  { x:-28, z: -88, r:2.0, color:'#ff6b9d' }, { x:-48, z: -95, r:1.8, color:'#fbbf24' },
  { x:-62, z:-100, r:2.2, color:'#a78bfa' }, { x:-35, z:-112, r:1.6, color:'#34d399' },
  { x:-55, z:-120, r:2.0, color:'#60a5fa' }, { x:-25, z:-105, r:1.8, color:'#f97316' },
  { x:-70, z:-110, r:2.0, color:'#ff6b9d' }, { x:-42, z:-125, r:1.6, color:'#fbbf24' },
  // Centro plaza flower beds
  { x:  5, z:  -5, r:1.4, color:'#ff6b9d' }, { x: -5, z:  -5, r:1.4, color:'#fbbf24' },
  { x: -5, z: -62, r:1.4, color:'#a78bfa' }, { x:  5, z: -62, r:1.4, color:'#34d399' },
  // Ingresso plaza beds
  { x:-12, z: 165, r:1.6, color:'#60a5fa' }, { x: 12, z: 165, r:1.6, color:'#f97316' },
  // University garden
  { x: 48, z: -88, r:1.8, color:'#4ade80' }, { x: 65, z: -92, r:1.6, color:'#fbbf24' },
  // Giardino Ovest flower beds
  { x:-162, z: 48, r:1.8, color:'#f97316' }, { x:-145, z: 62, r:2.0, color:'#a78bfa' },
  { x:-128, z: 75, r:1.6, color:'#ff6b9d' }, { x:-158, z: 85, r:1.8, color:'#fbbf24' },
  { x:-138, z: 92, r:1.6, color:'#34d399' }, { x:-122, z: 52, r:2.0, color:'#60a5fa' },
  // Giardino Est flower beds
  { x: 118, z:-65, r:1.8, color:'#ff6b9d' }, { x: 145, z:-42, r:2.0, color:'#fbbf24' },
  { x: 162, z:-22, r:1.6, color:'#a78bfa' }, { x: 128, z:-28, r:1.8, color:'#34d399' },
  { x: 150, z:-62, r:1.6, color:'#f97316' }, { x: 115, z:-18, r:2.0, color:'#60a5fa' },
  // Parco Ingresso flower beds
  { x:-32, z:128, r:1.6, color:'#ff6b9d' }, { x: 32, z:132, r:1.6, color:'#fbbf24' },
  { x: -8, z:148, r:1.8, color:'#a78bfa' }, { x:  8, z:148, r:1.8, color:'#4ade80' },
  // ── Campagna Ovest wildflowers (for butterflies) ─────────────
  { x:-142, z:-32, r:2.0, color:'#f97316' }, { x:-148, z: -5, r:1.8, color:'#a78bfa' },
  { x:-128, z:-46, r:2.0, color:'#fbbf24' }, { x:-155, z: 10, r:1.8, color:'#f97316' },
  { x:-135, z:-56, r:2.0, color:'#34d399' }, { x:-160, z:-20, r:1.8, color:'#60a5fa' },
  { x:-168, z:-48, r:1.6, color:'#fbbf24' }, { x:-110, z:-30, r:1.8, color:'#ff6b9d' },
  // ── Pianura Rurale wildflowers ────────────────────────────────
  { x: -30, z:-175, r:2.2, color:'#fbbf24' }, { x:  20, z:-185, r:2.0, color:'#a78bfa' },
  { x:  60, z:-165, r:1.8, color:'#f97316' }, { x: -60, z:-170, r:1.6, color:'#34d399' },
  { x:  80, z:-190, r:2.0, color:'#ff6b9d' }, { x: -80, z:-190, r:1.8, color:'#60a5fa' },
  { x:  40, z:-152, r:1.6, color:'#fbbf24' }, { x:-20, z:-162, r:2.0, color:'#f97316' },
];

/* ── Park benches (Z-sorted sprites) ────────────────────────── */
const BENCH_DATA: { x:number; z:number; rot:number }[] = [
  // Parco Grande benches (along park paths and clearings)
  { x:-30, z: -88, rot: 0.0 }, { x:-52, z: -92, rot: 1.5 },
  { x:-68, z:-105, rot: 0.0 }, { x:-38, z:-115, rot: 1.5 },
  { x:-58, z:-122, rot: 0.0 }, { x:-25, z:-100, rot: 1.5 },
  { x:-45, z:-130, rot: 0.0 }, { x:-72, z:-118, rot: 1.5 },
  { x:-20, z:-108, rot: 0.0 }, { x:-60, z: -98, rot: 0.0 },
  // Centro plaza benches (around fountain and piazza)
  { x:  8, z:   2, rot: 0.0 }, { x: -8, z:   2, rot: 0.0 },
  { x:  8, z:  -8, rot: 1.5 }, { x: -8, z:  -8, rot: 1.5 },
  { x:  5, z: -62, rot: 0.0 }, { x: -5, z: -62, rot: 0.0 },
  // Ingresso plaza benches
  { x:-18, z: 168, rot: 0.0 }, { x: 18, z: 168, rot: 0.0 },
  { x:  0, z: 175, rot: 1.5 },
  // Residenziale area benches
  { x:-110, z: 55, rot: 0.0 }, { x:-130, z: 72, rot: 1.5 },
  { x:-105, z: 85, rot: 0.0 }, { x:-125, z: 95, rot: 1.5 },
  // Via Commerciale benches
  { x:-50, z: 95, rot: 0.0 }, { x:-70, z: 95, rot: 0.0 },
  { x: 40, z: 95, rot: 0.0 }, { x: 60, z: 95, rot: 0.0 },
  // Giardino Ovest benches
  { x:-162, z: 58, rot: 0.0 }, { x:-145, z: 70, rot: 1.5 },
  { x:-158, z: 82, rot: 0.0 }, { x:-130, z: 88, rot: 1.5 },
  { x:-120, z: 56, rot: 0.0 }, { x:-148, z: 95, rot: 1.5 },
  // Giardino Est benches
  { x: 118, z:-60, rot: 0.0 }, { x: 145, z:-48, rot: 1.5 },
  { x: 162, z:-30, rot: 0.0 }, { x: 130, z:-22, rot: 1.5 },
  { x: 112, z:-35, rot: 0.0 }, { x: 155, z:-68, rot: 1.5 },
  // Parco Ingresso benches
  { x:-32, z:135, rot: 0.0 }, { x: 32, z:138, rot: 0.0 },
  { x: -5, z:152, rot: 1.5 }, { x:  5, z:145, rot: 1.5 },
];

/* ── Park paths / gravel trails + rural dirt sentieri ────────── */
const PARK_PATH_DATA: { x1:number; z1:number; x2:number; z2:number; w:number; dirt?:boolean }[] = [
  // Main park trail (N-S spine)
  { x1:-45, z1: -78, x2:-45, z2:-135, w: 2.5 },
  // Cross trails
  { x1:-80, z1:-100, x2:-10, z2:-100, w: 2.0 },
  { x1:-80, z1:-120, x2:-10, z2:-120, w: 2.0 },
  // Loop path (diagonal cuts)
  { x1:-45, z1: -90, x2:-25, z2: -90, w: 2.0 },
  { x1:-45, z1:-110, x2:-65, z2:-110, w: 2.0 },
  // Football field access
  { x1:-45, z1:-130, x2:-45, z2:-145, w: 2.5 },
  // Giardino Ovest paths
  { x1:-165, z1: 40, x2:-112, z2: 40, w: 2.0 },
  { x1:-140, z1: 40, x2:-140, z2: 98, w: 2.5 },
  { x1:-165, z1: 70, x2:-112, z2: 70, w: 2.0 },
  // Giardino Est paths
  { x1: 110, z1:-75, x2: 170, z2:-75, w: 2.0 },
  { x1: 140, z1:-75, x2: 140, z2: -8, w: 2.5 },
  { x1: 110, z1:-40, x2: 170, z2:-40, w: 2.0 },
  // Parco Ingresso paths
  { x1:-40, z1:122, x2: 40, z2:122, w: 2.0 },
  { x1:  0, z1:122, x2:  0, z2:158, w: 2.5 },
  { x1:-40, z1:150, x2: 40, z2:150, w: 2.0 },
  // ── Sentieri di terra battuta (Campagna Ovest, Bosco, Pianura Rurale) ──
  // Campagna Ovest: E-W boundary trail
  { x1:-165, z1:-68, x2: -95, z2:-68, w: 2.5, dirt:true },
  // Campagna Ovest: N-S spine trail
  { x1:-132, z1:-68, x2:-130, z2: 15, w: 2.5, dirt:true },
  // Campagna Ovest: cross sentiero
  { x1:-165, z1:-20, x2:-130, z2:-20, w: 2.0, dirt:true },
  { x1:-130, z1:-45, x2:-165, z2:-45, w: 2.0, dirt:true },
  // Bosco entrata
  { x1: -92, z1: -72, x2: -92, z2:-145, w: 2.0, dirt:true },
  // Bosco sentieri interni
  { x1:-145, z1:-100, x2: -92, z2:-100, w: 1.8, dirt:true },
  { x1:-155, z1:-150, x2:-108, z2:-130, w: 1.8, dirt:true },
  { x1:-120, z1:-145, x2:-120, z2:-200, w: 2.0, dirt:true },
  // Pianura Rurale: pista principale N-S
  { x1:   0, z1:-145, x2:   0, z2:-200, w: 3.0, dirt:true },
  // Pianura Rurale: E-W tracks
  { x1: -90, z1:-160, x2:  90, z2:-160, w: 2.5, dirt:true },
  { x1: -90, z1:-185, x2: 170, z2:-185, w: 2.0, dirt:true },
  // Campus: viali alberati
  { x1:  95, z1:-145, x2: 170, z2:-145, w: 2.5 },
  { x1: 130, z1:-145, x2: 130, z2: -72, w: 2.5 },
];

const LAMP_DATA: { x:number; z:number }[] = [
  // Corso Principale (x=0) — alternating sides
  { x: 3, z:180 }, { x:-3, z:175 }, { x: 3, z:165 }, { x:-3, z:155 },
  { x: 3, z:140 }, { x:-3, z:130 }, { x: 3, z:115 }, { x:-3, z:100 },
  { x: 3, z: 85 }, { x:-3, z: 70 }, { x: 3, z: 55 }, { x:-3, z: 40 },
  { x: 3, z: 25 }, { x:-3, z: 10 }, { x: 3, z: -5 }, { x:-3, z:-20 },
  { x: 3, z:-35 }, { x:-3, z:-50 }, { x: 3, z:-65 }, { x:-3, z:-80 },
  { x: 3, z:-100}, { x:-3, z:-120}, { x: 3, z:-140}, { x:-3, z:-160},
  { x: 3, z:-180}, { x:-3, z:-195},
  // Viale Est (x=90)
  { x: 85, z:150 }, { x: 95, z:135 }, { x: 85, z:120 }, { x: 95, z:100 },
  { x: 85, z: 80 }, { x: 95, z: 60 }, { x: 85, z: 40 }, { x: 95, z: 20 },
  { x: 85, z:  0 }, { x: 95, z:-20 }, { x: 85, z:-45 }, { x: 95, z:-70 },
  // Viale Ovest (x=-90)
  { x:-85, z:150 }, { x:-95, z:135 }, { x:-85, z:118 }, { x:-95, z: 98 },
  { x:-85, z: 78 }, { x:-95, z: 58 }, { x:-85, z: 38 }, { x:-95, z: 18 },
  { x:-85, z: -2 }, { x:-95, z:-22 }, { x:-85, z:-48 }, { x:-95, z:-72 },
  // Via del Centro (z=15)
  { x:-160, z:11 }, { x:-140, z:19 }, { x:-120, z:11 }, { x:-100, z:19 },
  { x: -60, z:11 }, { x: -40, z:19 }, { x: -20, z:11 }, { x:  20, z:19 },
  { x:  40, z:11 }, { x:  60, z:19 }, { x: 100, z:11 }, { x: 120, z:19 },
  { x: 140, z:11 }, { x: 160, z:19 },
  // Via Sud Grande (z=160)
  { x:-80, z:156 }, { x:-60, z:164 }, { x:-40, z:156 }, { x:-20, z:164 },
  { x: 20, z:156 }, { x: 40, z:164 }, { x: 60, z:156 }, { x: 80, z:164 },
  // Via Nord (z=-60)
  { x:-160, z:-56 }, { x:-140, z:-64 }, { x:-120, z:-56 }, { x:-100, z:-64 },
  { x: -60, z:-56 }, { x: -40, z:-64 }, { x: -20, z:-56 }, { x:  20, z:-64 },
  { x:  40, z:-56 }, { x:  60, z:-64 }, { x: 100, z:-56 }, { x: 120, z:-64 },
  { x: 140, z:-56 }, { x: 160, z:-64 },
];

/* ── City buildings ──────────────────────────────────────────── */
type BuildingType = 'house' | 'shop' | 'inn' | 'tower' | 'ruin' | 'church' | 'arcade' | 'farm' | 'barn';
const BUILDING_DATA: { x: number; z: number; type: BuildingType; w: number; h: number }[] = [
  // ── INGRESSO DISTRICT (z: 120-200) ──────────────────────────────
  { x:-22, z:185, type:'church', w:3.5, h:3.2 }, { x: 22, z:185, type:'tower',  w:2.5, h:3.5 },
  { x:-42, z:182, type:'house',  w:2.8, h:2.0 }, { x: 42, z:182, type:'house',  w:2.8, h:2.0 },
  { x:-62, z:178, type:'shop',   w:2.4, h:1.8 }, { x: 62, z:178, type:'shop',   w:2.4, h:1.8 },
  { x:-15, z:170, type:'inn',    w:3.2, h:2.5 }, { x: 15, z:170, type:'shop',   w:2.8, h:2.0 },
  { x:-38, z:168, type:'house',  w:2.2, h:2.2 }, { x: 38, z:168, type:'house',  w:2.2, h:2.2 },
  { x:-58, z:165, type:'house',  w:2.0, h:1.8 }, { x: 58, z:165, type:'house',  w:2.0, h:1.8 },
  { x:-72, z:162, type:'shop',   w:2.2, h:1.8 }, { x: 72, z:162, type:'shop',   w:2.2, h:1.8 },
  { x:-46, z:172, type:'church', w:2.5, h:2.4 }, { x: 46, z:172, type:'inn',    w:2.5, h:2.2 },
  { x:-22, z:155, type:'house',  w:2.5, h:2.2 }, { x: 22, z:155, type:'house',  w:2.5, h:2.2 },
  { x:-40, z:150, type:'shop',   w:2.4, h:1.8 }, { x: 40, z:150, type:'shop',   w:2.4, h:1.8 },
  { x:-62, z:148, type:'house',  w:2.0, h:1.8 }, { x: 62, z:148, type:'house',  w:2.0, h:1.8 },
  { x: -5, z:145, type:'inn',    w:2.8, h:2.2 }, { x: 76, z:145, type:'ruin',   w:2.2, h:1.6 },
  { x:-76, z:145, type:'house',  w:2.0, h:1.8 },
  { x:-22, z:135, type:'house',  w:2.2, h:2.0 }, { x: 22, z:135, type:'house',  w:2.2, h:2.0 },
  { x:-42, z:132, type:'shop',   w:2.4, h:1.8 }, { x: 42, z:132, type:'shop',   w:2.4, h:1.8 },
  { x:-62, z:130, type:'house',  w:2.0, h:1.8 }, { x: 62, z:130, type:'house',  w:2.0, h:1.8 },
  { x:  0, z:127, type:'church', w:3.0, h:2.6 },
  // ── RESIDENZIALE (x: -170 to -10, z: 30-120) ────────────────────
  { x:-100, z:112, type:'house',  w:3.0, h:3.5 }, { x:-122, z:108, type:'house',  w:2.8, h:3.2 },
  { x: -82, z:108, type:'house',  w:2.5, h:2.8 }, { x:-142, z:105, type:'shop',   w:2.4, h:2.0 },
  { x:-160, z:100, type:'house',  w:2.2, h:2.0 }, { x:-110, z: 98, type:'inn',    w:2.8, h:2.5 },
  { x: -98, z: 88, type:'house',  w:2.5, h:3.0 }, { x:-118, z: 85, type:'house',  w:2.5, h:3.2 },
  { x:-138, z: 82, type:'church', w:2.8, h:2.6 }, { x:-158, z: 80, type:'house',  w:2.2, h:2.0 },
  { x: -78, z: 78, type:'shop',   w:2.4, h:1.8 }, { x:-145, z: 70, type:'house',  w:2.5, h:2.8 },
  { x:-125, z: 68, type:'house',  w:2.5, h:3.0 }, { x:-105, z: 65, type:'inn',    w:2.8, h:2.2 },
  { x: -88, z: 62, type:'house',  w:2.2, h:2.0 }, { x:-162, z: 60, type:'shop',   w:2.4, h:1.8 },
  { x:-108, z: 50, type:'house',  w:2.8, h:3.2 }, { x:-128, z: 48, type:'house',  w:2.5, h:2.8 },
  { x:-148, z: 45, type:'church', w:2.6, h:2.4 }, { x:-165, z: 42, type:'house',  w:2.2, h:2.0 },
  { x: -85, z: 42, type:'shop',   w:2.4, h:1.8 }, { x:-120, z: 35, type:'house',  w:2.5, h:3.0 },
  { x:-140, z: 32, type:'inn',    w:2.8, h:2.2 }, { x:-155, z: 30, type:'house',  w:2.2, h:2.0 },
  { x: -32, z:108, type:'house',  w:2.2, h:2.5 }, { x: -48, z:100, type:'house',  w:2.2, h:2.5 },
  { x: -30, z: 90, type:'shop',   w:2.4, h:1.8 }, { x: -50, z: 82, type:'house',  w:2.2, h:2.2 },
  { x: -28, z: 72, type:'inn',    w:2.6, h:2.0 }, { x: -52, z: 65, type:'house',  w:2.0, h:2.0 },
  { x: -32, z: 55, type:'house',  w:2.2, h:2.2 }, { x: -50, z: 48, type:'shop',   w:2.2, h:1.8 },
  { x: -28, z: 40, type:'house',  w:2.0, h:2.0 }, { x: -52, z: 35, type:'house',  w:2.2, h:2.2 },
  { x: -15, z: 75, type:'house',  w:2.0, h:2.2 }, { x: -15, z: 55, type:'shop',   w:2.2, h:1.8 },
  { x: -15, z: 40, type:'house',  w:2.0, h:2.0 },
  // ── PORTO EST (x: 30-170, z: 0-150) ─────────────────────────────
  { x: 100, z:140, type:'house',  w:2.8, h:2.0 }, { x: 120, z:138, type:'ruin',   w:3.2, h:1.8 },
  { x: 140, z:135, type:'ruin',   w:3.5, h:1.6 }, { x: 160, z:130, type:'ruin',   w:3.0, h:1.8 },
  { x: 108, z:122, type:'inn',    w:2.8, h:2.2 }, { x: 128, z:118, type:'shop',   w:2.6, h:1.8 },
  { x: 148, z:115, type:'house',  w:2.4, h:1.8 }, { x: 168, z:112, type:'ruin',   w:2.8, h:1.6 },
  { x: 100, z:105, type:'shop',   w:2.6, h:1.8 }, { x: 118, z:100, type:'house',  w:2.4, h:2.0 },
  { x: 138, z: 98, type:'inn',    w:2.8, h:2.2 }, { x: 158, z: 95, type:'shop',   w:2.4, h:1.8 },
  { x: 108, z: 82, type:'house',  w:2.5, h:2.0 }, { x: 128, z: 78, type:'house',  w:2.5, h:2.0 },
  { x: 148, z: 75, type:'ruin',   w:3.0, h:1.8 }, { x: 165, z: 72, type:'house',  w:2.2, h:1.8 },
  { x: 102, z: 62, type:'church', w:2.8, h:2.4 }, { x: 122, z: 58, type:'shop',   w:2.5, h:1.8 },
  { x: 142, z: 55, type:'house',  w:2.4, h:2.0 }, { x: 162, z: 52, type:'ruin',   w:2.8, h:1.6 },
  { x: 105, z: 42, type:'inn',    w:2.8, h:2.2 }, { x: 125, z: 38, type:'house',  w:2.4, h:2.0 },
  { x: 145, z: 35, type:'shop',   w:2.4, h:1.8 }, { x: 165, z: 32, type:'house',  w:2.2, h:1.8 },
  { x: 108, z: 22, type:'house',  w:2.5, h:2.0 }, { x: 128, z: 18, type:'shop',   w:2.5, h:1.8 },
  { x: 148, z: 15, type:'house',  w:2.4, h:2.0 }, { x: 168, z: 12, type:'ruin',   w:2.8, h:1.6 },
  { x: 102, z:  5, type:'house',  w:2.4, h:2.0 }, { x: 122, z:  2, type:'shop',   w:2.4, h:1.8 },
  { x:  45, z:130, type:'house',  w:2.2, h:2.0 }, { x:  60, z:125, type:'shop',   w:2.4, h:1.8 },
  { x:  45, z:108, type:'inn',    w:2.5, h:2.2 }, { x:  62, z:100, type:'house',  w:2.2, h:2.0 },
  { x:  45, z: 85, type:'house',  w:2.2, h:2.0 }, { x:  62, z: 78, type:'shop',   w:2.4, h:1.8 },
  // ── CENTRO (x: -80 to 80, z: -70 to 30) ────────────────────────
  { x:-18, z: 22, type:'tower',  w:3.0, h:5.0 }, { x: 18, z: 22, type:'tower',  w:3.0, h:5.0 },
  { x:-38, z: 18, type:'tower',  w:2.8, h:4.0 }, { x: 38, z: 18, type:'tower',  w:2.8, h:4.0 },
  { x:-58, z: 15, type:'shop',   w:2.8, h:2.5 }, { x: 58, z: 15, type:'shop',   w:2.8, h:2.5 },
  { x:-72, z: 12, type:'house',  w:2.4, h:2.2 }, { x: 72, z: 12, type:'house',  w:2.4, h:2.2 },
  { x:-20, z:  5, type:'tower',  w:2.8, h:4.5 }, { x: 20, z:  5, type:'tower',  w:2.8, h:4.5 },
  { x:-42, z:  2, type:'shop',   w:2.6, h:2.5 }, { x: 42, z:  2, type:'shop',   w:2.6, h:2.5 },
  { x:-62, z: -2, type:'inn',    w:2.8, h:2.5 }, { x: 62, z: -2, type:'inn',    w:2.8, h:2.5 },
  { x:-75, z: -5, type:'shop',   w:2.4, h:2.0 }, { x: 75, z: -5, type:'shop',   w:2.4, h:2.0 },
  { x:-22, z:-12, type:'tower',  w:3.0, h:5.5 }, { x: 22, z:-12, type:'tower',  w:3.0, h:5.5 },
  { x:-44, z:-15, type:'church', w:3.0, h:3.5 }, { x: 44, z:-15, type:'shop',   w:2.8, h:2.5 },
  { x:-65, z:-18, type:'shop',   w:2.6, h:2.2 }, { x: 65, z:-18, type:'inn',    w:2.6, h:2.5 },
  { x:-78, z:-22, type:'house',  w:2.2, h:2.0 }, { x: 78, z:-22, type:'house',  w:2.2, h:2.0 },
  { x:-20, z:-28, type:'tower',  w:2.8, h:4.0 }, { x: 20, z:-28, type:'tower',  w:2.8, h:4.0 },
  { x:-42, z:-32, type:'shop',   w:2.6, h:2.5 }, { x: 42, z:-32, type:'shop',   w:2.6, h:2.5 },
  { x:-62, z:-35, type:'inn',    w:2.8, h:2.5 }, { x: 62, z:-35, type:'inn',    w:2.8, h:2.5 },
  { x:-75, z:-42, type:'shop',   w:2.4, h:2.0 }, { x: 75, z:-42, type:'shop',   w:2.4, h:2.0 },
  { x:-22, z:-50, type:'tower',  w:3.0, h:5.0 }, { x: 22, z:-50, type:'tower',  w:3.0, h:5.0 },
  { x:-44, z:-52, type:'shop',   w:2.6, h:2.2 }, { x: 44, z:-52, type:'shop',   w:2.6, h:2.2 },
  { x:-65, z:-55, type:'house',  w:2.4, h:2.2 }, { x: 65, z:-55, type:'house',  w:2.4, h:2.2 },
  { x:  0, z:-60, type:'church', w:4.0, h:4.0 },
  { x:-78, z:-62, type:'ruin',   w:2.2, h:1.8 }, { x: 78, z:-62, type:'ruin',   w:2.2, h:1.8 },
  // ── CAMPAGNA OVEST (x: -170 to -92, z: -72 to 18) ──────────────
  { x:-115, z: 18, type:'farm',  w:4.0, h:2.8 }, { x:-155, z: 14, type:'barn',  w:4.5, h:3.0 },
  { x:-138, z:  5, type:'farm',  w:3.8, h:2.6 }, { x:-162, z:  2, type:'barn',  w:4.0, h:2.8 },
  { x:-120, z:-15, type:'farm',  w:4.2, h:3.0 }, { x:-155, z:-18, type:'barn',  w:4.0, h:2.8 },
  { x:-138, z:-38, type:'farm',  w:3.8, h:2.6 }, { x:-162, z:-40, type:'barn',  w:4.5, h:3.0 },
  { x:-118, z:-55, type:'farm',  w:4.0, h:2.8 }, { x:-155, z:-58, type:'barn',  w:4.2, h:3.0 },
  // ── DISTRETTO NORD (x: -170 to 170, z: -200 to -70) ────────────
  { x: -45, z: -82, type:'house',  w:1.6, h:1.4 }, { x: -65, z: -88, type:'shop',   w:1.8, h:1.5 },
  { x: -30, z: -95, type:'house',  w:1.6, h:1.4 }, { x: -55, z:-105, type:'house',  w:1.6, h:1.4 },
  { x:  40, z: -92, type:'church', w:3.5, h:3.5 }, { x:  62, z: -95, type:'tower',  w:3.0, h:4.0 },
  { x:  42, z:-110, type:'house',  w:3.0, h:2.8 }, { x:  65, z:-112, type:'shop',   w:2.8, h:2.5 },
  { x:  40, z:-128, type:'inn',    w:3.0, h:2.5 }, { x:  62, z:-130, type:'house',  w:2.8, h:2.8 },
  { x:  78, z:-100, type:'house',  w:2.5, h:2.5 }, { x:  78, z:-120, type:'shop',   w:2.5, h:2.2 },
  { x:-100, z:-125, type:'house',  w:2.5, h:2.0 }, { x:-122, z:-128, type:'ruin',   w:3.0, h:1.8 },
  { x:-142, z:-130, type:'house',  w:2.5, h:2.0 }, { x:-162, z:-128, type:'ruin',   w:3.0, h:1.8 },
  { x:-102, z:-142, type:'shop',   w:2.5, h:1.8 }, { x:-122, z:-145, type:'house',  w:2.5, h:2.0 },
  { x:-145, z:-148, type:'inn',    w:2.8, h:2.2 }, { x:-165, z:-145, type:'house',  w:2.2, h:2.0 },
  { x: -22, z:-162, type:'church', w:3.0, h:3.5 }, { x:  22, z:-162, type:'tower',  w:2.8, h:4.5 },
  { x: -42, z:-165, type:'house',  w:2.5, h:2.5 }, { x:  42, z:-165, type:'house',  w:2.5, h:2.5 },
  { x: -60, z:-168, type:'shop',   w:2.5, h:2.2 }, { x:  60, z:-168, type:'shop',   w:2.5, h:2.2 },
  { x: -18, z:-178, type:'house',  w:2.5, h:2.8 }, { x:  18, z:-178, type:'house',  w:2.5, h:2.8 },
  { x: -40, z:-180, type:'inn',    w:2.5, h:2.2 }, { x:  40, z:-180, type:'inn',    w:2.5, h:2.2 },
  { x: -58, z:-182, type:'ruin',   w:2.5, h:1.8 }, { x:  58, z:-182, type:'ruin',   w:2.5, h:1.8 },
  { x:   0, z:-192, type:'tower',  w:4.0, h:6.0 },
  { x: -90, z: -82, type:'house',  w:2.5, h:2.2 }, { x:  90, z: -82, type:'house',  w:2.5, h:2.2 },
  { x:-108, z: -90, type:'shop',   w:2.5, h:2.0 }, { x: 108, z: -90, type:'shop',   w:2.5, h:2.0 },
  { x:-128, z: -92, type:'house',  w:2.5, h:2.2 }, { x: 128, z: -92, type:'house',  w:2.5, h:2.2 },
  { x:-148, z: -88, type:'ruin',   w:3.0, h:2.0 }, { x: 148, z: -88, type:'tower',  w:2.8, h:3.5 },
  { x:-165, z: -92, type:'house',  w:2.2, h:2.0 }, { x: 165, z: -92, type:'shop',   w:2.4, h:2.0 },
  { x: -88, z:-108, type:'house',  w:2.5, h:2.2 }, { x:  88, z:-108, type:'house',  w:2.5, h:2.2 },
  { x:-108, z:-115, type:'shop',   w:2.5, h:2.0 }, { x: 108, z:-115, type:'inn',    w:2.8, h:2.5 },
  { x:-130, z:-112, type:'house',  w:2.5, h:2.5 }, { x: 130, z:-112, type:'house',  w:2.5, h:2.5 },
  { x:-150, z:-110, type:'church', w:2.8, h:2.8 }, { x: 150, z:-110, type:'tower',  w:2.8, h:3.8 },
  { x:-165, z:-115, type:'house',  w:2.2, h:2.0 }, { x: 165, z:-115, type:'house',  w:2.2, h:2.0 },
  { x: -90, z:-132, type:'house',  w:2.5, h:2.2 }, { x:  90, z:-132, type:'house',  w:2.5, h:2.2 },
  { x:-115, z:-138, type:'inn',    w:2.8, h:2.5 }, { x: 115, z:-138, type:'shop',   w:2.5, h:2.0 },
  { x:-135, z:-142, type:'house',  w:2.5, h:2.2 }, { x: 135, z:-142, type:'church', w:2.8, h:3.0 },
  { x:-155, z:-140, type:'ruin',   w:3.0, h:1.8 }, { x: 155, z:-140, type:'house',  w:2.5, h:2.2 },
  { x: -90, z:-155, type:'house',  w:2.5, h:2.5 }, { x:  90, z:-155, type:'house',  w:2.5, h:2.5 },
  { x:-112, z:-160, type:'shop',   w:2.5, h:2.0 }, { x: 112, z:-160, type:'shop',   w:2.5, h:2.0 },
  { x:-135, z:-162, type:'tower',  w:2.8, h:3.5 }, { x: 135, z:-162, type:'inn',    w:2.8, h:2.5 },
  { x:-158, z:-160, type:'house',  w:2.2, h:2.0 }, { x: 158, z:-160, type:'house',  w:2.2, h:2.0 },
  { x: -80, z:-175, type:'house',  w:2.5, h:2.2 }, { x:  80, z:-175, type:'house',  w:2.5, h:2.2 },
  { x:-100, z:-180, type:'ruin',   w:3.0, h:1.8 }, { x: 100, z:-180, type:'tower',  w:2.8, h:3.5 },
  { x:-122, z:-178, type:'house',  w:2.5, h:2.0 }, { x: 122, z:-178, type:'house',  w:2.5, h:2.0 },
];

const BUILDING_COLORS: Record<BuildingType, { body: string; roof: string }> = {
  house:  { body: '#c8a87a', roof: '#8b5e3c' },
  shop:   { body: '#b8d4f0', roof: '#4a80c0' },
  inn:    { body: '#d4c88a', roof: '#8b6020' },
  tower:  { body: '#9a9a9a', roof: '#444' },
  ruin:   { body: '#7a7060', roof: '#4a4030' },
  church: { body: '#f0e8d0', roof: '#c04040' },
  arcade: { body: '#2d1a4e', roof: '#7c3aed' },
  farm:   { body: '#d4b878', roof: '#8b5a1a' },
  barn:   { body: '#c87840', roof: '#6b2a10' },
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
  { id: 'ruota',    name: 'Ruota della Fortuna', emoji: '🎡', x:  22, z:160,  color: '#a855f7' },
  { id: 'memory',   name: 'Memory delle Carte',  emoji: '🃏', x: -58, z: 85,  color: '#818cf8' },
  { id: 'dado',     name: 'Sfida al Dado',        emoji: '🎲', x: 125, z:-12,  color: '#f97316' },
  { id: 'reazione', name: 'Reazione Rapida',      emoji: '⚡', x:-125, z:-15,  color: '#fbbf24' },
  { id: 'quiz',     name: 'Quiz del Minkiard',    emoji: '❓', x: -45, z:-100, color: '#06b6d4' },
  { id: 'rps',      name: 'Sasso Carta Forbice',  emoji: '✂️', x:  55, z:-130, color: '#ec4899' },
];

/* ── City roads (only in urban zones: Centro, Porto, Ingresso, Residenziale) ── */
const ROAD_DATA: { x1:number; z1:number; x2:number; z2:number; w:number }[] = [
  // Main avenues (vertical N-S) — urban sections only
  { x1:  0, z1: -72, x2:  0, z2:200, w:6   },  // Corso Principale (urban section)
  { x1: 90, z1: -72, x2: 90, z2:160, w:5   },  // Viale Est (urban section)
  { x1:-90, z1: -72, x2:-90, z2:160, w:5   },  // Viale Ovest (urban section)
  { x1:150, z1: -80, x2:150, z2:180, w:4   },  // Via del Porto
  // Cross streets (horizontal E-W) — urban only
  { x1:-90, z1:160, x2: 90, z2:160, w:5.5 },   // Via Sud Grande
  { x1:-90, z1: 90, x2: 90, z2: 90, w:5   },   // Via Commerciale (urban)
  { x1: 90, z1: 90, x2:170, z2: 90, w:4   },   // Via Commerciale Est
  { x1:-90, z1: 15, x2:170, z2: 15, w:6   },   // Via del Centro (urban)
  { x1:-90, z1:-60, x2:170, z2:-60, w:5   },   // Via Nord (urban)
  { x1:  5, z1:-120, x2:170, z2:-120,w:4.5 },  // Via Parco (campus/porto only)
  // Secondary streets (urban only)
  { x1:-90, z1:  0, x2:  0, z2:  0, w:3   },
  { x1:  0, z1:  0, x2: 90, z2:  0, w:3   },
  { x1:-90, z1:-90, x2:  0, z2:-90, w:3.5 },
  { x1:  0, z1:-90, x2: 90, z2:-90, w:3.5 },
  { x1: 90, z1:-60, x2:170, z2:-60, w:3.5 },
  { x1:-90, z1: 45, x2:  0, z2: 45, w:3   },
  { x1:  0, z1: 45, x2: 90, z2: 45, w:3   },
  { x1: 30, z1: 15, x2: 30, z2: 90, w:3   },   // Via del Mercato
  { x1:-30, z1: 15, x2:-30, z2:120, w:3   },   // Via Residenziale
  { x1:-90, z1:120, x2:-30, z2:120, w:3   },
  { x1:-30, z1:120, x2:  0, z2:120, w:3   },
  { x1:  0, z1:-120,x2:  0, z2:-60, w:3.5 },
];

/* ── Urban canal / river strips ─────────────────────────────── */
const CANAL_DATA: { x1:number; z1:number; x2:number; z2:number; w:number }[] = [
  // Porto canal running N-S along east edge
  { x1: 148, z1:-80, x2: 148, z2: 180, w: 8  },
  // Small inner-city channel connecting porto basins
  { x1: 100, z1: 90, x2: 148, z2:  90, w: 5  },
];

/* ── Porto boats (pre-computed paths like cars) ──────────────── */
interface BoatDef { axis:'x'|'z'; fixed:number; from:number; to:number; speed:number; phase:number; color:string; len:number; wid:number }
const BOAT_DATA: BoatDef[] = [
  // Porto canal N-S traffic
  { axis:'z', fixed: 146, from: -70, to: 175, speed:0.012, phase:0.00, color:'#d4a843', len:4.5, wid:2.0 },
  { axis:'z', fixed: 150, from: 175, to: -70, speed:0.009, phase:0.45, color:'#8b5e3c', len:5.0, wid:2.2 },
  { axis:'z', fixed: 144, from:  30, to: 170, speed:0.011, phase:0.25, color:'#e8d5a3', len:3.8, wid:1.8 },
  // Porto basins moored boats (very slow drift)
  { axis:'x', fixed:  72, from: 100, to: 148, speed:0.006, phase:0.60, color:'#c47c5a', len:4.0, wid:1.8 },
  { axis:'x', fixed:  88, from: 148, to: 100, speed:0.008, phase:0.20, color:'#5b8fa8', len:3.5, wid:1.7 },
];

/* ── Pedestrian crosswalks at major intersections ───────────── */
const CROSSWALK_DATA: { x: number; z: number; horiz: boolean }[] = [
  // Corso Principale (x=0) crossings
  { x:  0, z:  15, horiz: true  }, { x:  0, z:  15, horiz: false },
  { x:  0, z:  90, horiz: true  }, { x:  0, z:  90, horiz: false },
  { x:  0, z: 160, horiz: true  }, { x:  0, z: 160, horiz: false },
  { x:  0, z: -60, horiz: true  }, { x:  0, z: -60, horiz: false },
  { x:  0, z:-120, horiz: true  }, { x:  0, z:-120, horiz: false },
  // Viale Est (x=90) crossings
  { x: 90, z:  15, horiz: true  }, { x: 90, z:  15, horiz: false },
  { x: 90, z:  90, horiz: true  }, { x: 90, z:  90, horiz: false },
  { x: 90, z: 160, horiz: true  }, { x: 90, z: 160, horiz: false },
  // Viale Ovest (x=-90) crossings
  { x:-90, z:  15, horiz: true  }, { x:-90, z:  15, horiz: false },
  { x:-90, z:  90, horiz: true  }, { x:-90, z:  90, horiz: false },
  { x:-90, z: 160, horiz: true  }, { x:-90, z: 160, horiz: false },
];

/* ── Animated city cars ──────────────────────────────────────── */
interface CarDef { axis:'x'|'z'; fixed:number; from:number; to:number; speed:number; phase:number; color:string; len:number; wid:number }
const CAR_DATA: CarDef[] = [
  { axis:'z', fixed: 2.5, from:-200, to: 200, speed:0.055, phase:0.00, color:'#e74c3c', len:3.2, wid:1.4 },
  { axis:'z', fixed:-2.5, from: 200, to:-200, speed:0.048, phase:0.50, color:'#3498db', len:3.2, wid:1.4 },
  { axis:'x', fixed: 12,  from:-170, to: 170, speed:0.040, phase:0.20, color:'#2ecc71', len:3.2, wid:1.4 },
  { axis:'x', fixed: 18,  from: 170, to:-170, speed:0.035, phase:0.70, color:'#f39c12', len:3.2, wid:1.4 },
  { axis:'z', fixed: 92,  from:-160, to: 160, speed:0.042, phase:0.30, color:'#9b59b6', len:3.0, wid:1.3 },
  { axis:'z', fixed: 88,  from: 160, to:-160, speed:0.038, phase:0.80, color:'#1abc9c', len:3.0, wid:1.3 },
  { axis:'z', fixed:-88,  from:-160, to: 160, speed:0.040, phase:0.15, color:'#e67e22', len:3.0, wid:1.3 },
  { axis:'z', fixed:-92,  from: 160, to:-160, speed:0.036, phase:0.65, color:'#c0392b', len:3.0, wid:1.3 },
  { axis:'x', fixed: 87,  from:-160, to:  90, speed:0.048, phase:0.40, color:'#f1c40f', len:3.0, wid:1.3 },
  { axis:'x', fixed: 93,  from:  90, to:-160, speed:0.043, phase:0.90, color:'#34495e', len:3.0, wid:1.3 },
  { axis:'x', fixed:-63,  from:-170, to: 170, speed:0.052, phase:0.55, color:'#ff6b6b', len:2.8, wid:1.3 },
  { axis:'x', fixed:-57,  from: 170, to:-170, speed:0.047, phase:0.05, color:'#4ecdc4', len:2.8, wid:1.3 },
];

/* ── Traffic lights at intersections ────────────────────────── */
const TRAFFIC_LIGHT_DATA: { x:number; z:number }[] = [
  { x:  4, z: 12 }, { x: -4, z: 12 }, { x:  4, z: 18 }, { x: -4, z: 18 },
  { x: 86, z: 12 }, { x: 94, z: 12 }, { x: 86, z: 18 }, { x: 94, z: 18 },
  { x:-86, z: 12 }, { x:-94, z: 12 }, { x:-86, z: 18 }, { x:-94, z: 18 },
  { x:  4, z:-63 }, { x: -4, z:-63 }, { x:  4, z:-57 }, { x: -4, z:-57 },
  { x:  4, z: 87 }, { x: -4, z: 87 }, { x:  4, z: 93 }, { x: -4, z: 93 },
  { x:  4, z:157 }, { x: -4, z:157 }, { x:  4, z:163 }, { x: -4, z:163 },
];

/* ── Rural river / stream segments (animated water flow) ─────── */
const RIVER_DATA: { x1:number; z1:number; x2:number; z2:number; w:number; color:string }[] = [
  // Ruscello Campagna Ovest (flows N→S along x≈-132)
  { x1:-135, z1:-68, x2:-132, z2: 18, w:3.0, color:'#2a8ad4' },
  // Affluente bosco → campagna
  { x1:-152, z1:-145, x2:-135, z2:-68, w:2.5, color:'#2278c0' },
  // Ruscello interno Bosco (x≈-118)
  { x1:-120, z1:-200, x2:-118, z2:-145, w:2.0, color:'#1e6eb8' },
  // Rivolo Pianura Rurale
  { x1: -20, z1:-200, x2: -18, z2:-160, w:2.0, color:'#3090d0' },
];

/* ── Flying birds (day only, pre-computed trajectories) ─────── */
type BirdDef = { wx: number; wz: number; dx: number; dz: number; speed: number; phase: number; flapOffset: number };
const BIRD_DATA: BirdDef[] = [
  // Flock 1: heading east over Campagna/Residenziale
  { wx:-185, wz: 55, dx: 0.80, dz: 0.05, speed:0.022, phase:0.00, flapOffset:0.0 },
  { wx:-185, wz: 53, dx: 0.80, dz: 0.05, speed:0.020, phase:0.12, flapOffset:0.2 },
  { wx:-185, wz: 57, dx: 0.78, dz: 0.06, speed:0.018, phase:0.25, flapOffset:0.4 },
  // Flock 2: heading west over Bosco
  { wx: 185, wz:-95, dx:-0.85, dz:-0.10, speed:0.020, phase:0.50, flapOffset:0.1 },
  { wx: 185, wz:-93, dx:-0.85, dz:-0.08, speed:0.018, phase:0.60, flapOffset:0.3 },
  { wx: 185, wz:-97, dx:-0.82, dz:-0.10, speed:0.016, phase:0.70, flapOffset:0.5 },
  // Solo birds over Pianura Rurale
  { wx:-185, wz:-162, dx: 0.90, dz: 0.12, speed:0.028, phase:0.30, flapOffset:0.0 },
  { wx: 185, wz: -25, dx:-0.78, dz:-0.05, speed:0.025, phase:0.80, flapOffset:0.6 },
];

/* ── Butterflies (Campagna Ovest + Pianura Rurale) ───────────── */
type ButterflyDef = { cx: number; cz: number; orbitR: number; speed: number; phase: number; color: string };
const BUTTERFLY_DATA: ButterflyDef[] = [
  { cx:-142, cz:-32, orbitR:3.5, speed:0.55, phase:0.00, color:'#f97316' },
  { cx:-148, cz: -5, orbitR:2.8, speed:0.72, phase:0.52, color:'#a78bfa' },
  { cx:-128, cz:-46, orbitR:3.2, speed:0.48, phase:0.28, color:'#fbbf24' },
  { cx:-155, cz: 10, orbitR:2.5, speed:0.68, phase:0.75, color:'#f97316' },
  { cx:-135, cz:-56, orbitR:3.0, speed:0.58, phase:0.10, color:'#34d399' },
  { cx:-160, cz:-20, orbitR:2.6, speed:0.82, phase:0.65, color:'#60a5fa' },
  { cx:-110, cz:-30, orbitR:2.8, speed:0.50, phase:0.40, color:'#ff6b9d' },
  { cx: -30, cz:-175, orbitR:3.0, speed:0.60, phase:0.20, color:'#fbbf24' },
  { cx:  20, cz:-185, orbitR:2.5, speed:0.70, phase:0.85, color:'#a78bfa' },
  { cx:  60, cz:-165, orbitR:2.8, speed:0.55, phase:0.35, color:'#34d399' },
];

/* ── Farm animals / sheep (Campagna Ovest) ───────────────────── */
type FarmAnimalDef = { x: number; z: number; wanderR: number; phase: number; speed: number };
const FARM_ANIMAL_DATA: FarmAnimalDef[] = [
  { x:-138, z:-42, wanderR:5, phase:0.00, speed:0.08 },
  { x:-148, z:-35, wanderR:4, phase:0.40, speed:0.07 },
  { x:-125, z:-52, wanderR:5, phase:0.80, speed:0.09 },
  { x:-155, z:-10, wanderR:5, phase:0.20, speed:0.06 },
  { x:-135, z:  2, wanderR:4, phase:0.60, speed:0.08 },
  { x:-160, z:-55, wanderR:3, phase:0.90, speed:0.07 },
  { x:-112, z: -8, wanderR:4, phase:0.15, speed:0.08 },
  { x:-168, z:-30, wanderR:5, phase:0.55, speed:0.07 },
];

/* ── Windmill (Pianura Rurale) ───────────────────────────────── */
const WINDMILL_DATA: { x: number; z: number }[] = [
  { x: 35, z:-185 },
];

/* ── Waving grass strips (Campagna Ovest + Pianura Rurale) ───── */
const GRASS_STRIP_DATA: { x: number; z: number; angle: number }[] = [
  // Campagna Ovest grass strips
  { x:-168, z:-55, angle: 0.2 }, { x:-150, z:-30, angle:-0.1 }, { x:-140, z: -8, angle: 0.3 },
  { x:-125, z:-62, angle:-0.2 }, { x:-105, z:-15, angle: 0.1 }, { x:-160, z:  8, angle:-0.3 },
  // Pianura Rurale grass strips
  { x: -70, z:-152, angle: 0.2 }, { x: -40, z:-168, angle:-0.1 }, { x: -10, z:-175, angle: 0.3 },
  { x:  30, z:-165, angle:-0.2 }, { x:  65, z:-175, angle: 0.1 }, { x:  90, z:-158, angle:-0.3 },
  { x: 120, z:-165, angle: 0.2 }, { x: 150, z:-175, angle:-0.1 },
  // Bosco undergrowth (dark tones)
  { x:-155, z:-88, angle: 0.4 }, { x:-138, z:-102, angle:-0.3 }, { x:-168, z:-130, angle: 0.2 },
  { x:-112, z:-135, angle:-0.2 }, { x:-145, z:-170, angle: 0.3 },
];

/* ── District zones for background coloring ─────────────────── */
const DISTRICT_DATA: { x1:number; z1:number; x2:number; z2:number; color:string }[] = [
  { x1: -92, z1: 112, x2:  92, z2:200, color:'#253a28' },  // 0 INGRESSO
  { x1:-172, z1:  18, x2: -12, z2:112, color:'#1e2a3a' },  // 1 BORGO RESIDENZIALE
  { x1:  18, z1: -12, x2: 172, z2:162, color:'#1a2235' },  // 2 PORTO EST
  { x1: -92, z1: -72, x2:  92, z2: 18, color:'#282828' },  // 3 CENTRO
  { x1:-172, z1: -72, x2: -92, z2: 18, color:'#2e4a18' },  // 4 CAMPAGNA OVEST
  { x1: -82, z1:-145, x2:   5, z2:-72, color:'#1a2e1a' },  // 5 PARCO GRANDE
  { x1:-172, z1:-200, x2: -92, z2:-72, color:'#0c1e08' },  // 6 BOSCO NORD-OVEST
  { x1: -92, z1:-200, x2: 172, z2:-145, color:'#364222' }, // 7 PIANURA RURALE
  { x1:  92, z1:-145, x2: 172, z2: -72, color:'#1a2832' }, // 8 CAMPUS TECNOPOLIS
  // ── Giardini sovrapposti ai distretti ─────────────────────────
  { x1:-172, z1:  32, x2:-110, z2:  98, color:'#183518' },  // 9 GIARDINO OVEST
  { x1: 108, z1: -78, x2: 172, z2:  -8, color:'#1c3820' },  // 10 GIARDINO EST
  { x1: -42, z1: 118, x2:  42, z2: 160, color:'#253a28' },  // 11 PARCO INGRESSO
];

/* ── Bridge decorations ──────────────────────────────────────── */
const BRIDGE_DATA: { x: number; z: number; ry: number }[] = [
  { x:  5, z:   0, ry: 0.1 },  // Centro fountain bridge
  { x:148, z:  70, ry: 1.5 },  // Porto marina bridge
  { x:-50, z:-103, ry: 0.3 },  // Park pond bridge
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

/* ── Football field (near Parco Grande) ──────────────────────── */
const FOOTBALL_FIELD_POS = { x: -45, z: -145 } as const;
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

/* ── Day/Night clock HUD ────────────────────────────────────── */
function DayNightClockHUD({ dayTimeRef }: { dayTimeRef: React.MutableRefObject<number> }) {
  const iconRef  = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    function formatTime(t: number) {
      const totalHours = t * 24;
      const h = Math.floor(totalHours) % 24;
      const m = Math.floor((totalHours - Math.floor(totalHours)) * 60);
      const ampm = h < 12 ? 'AM' : 'PM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      const mm = m.toString().padStart(2, '0');
      /* Match DayNight3D sun arc: sun above horizon t∈[0.25,0.75] → 6 AM–6 PM */
      return { icon: h >= 6 && h < 18 ? '☀️' : '🌙', label: `${displayH}:${mm} ${ampm}` };
    }

    function update() {
      const { icon, label } = formatTime(dayTimeRef.current);
      if (iconRef.current)  iconRef.current.textContent  = icon;
      if (labelRef.current) labelRef.current.textContent = label;
    }

    update();
    const id = setInterval(update, 3000);
    return () => clearInterval(id);
  }, [dayTimeRef]);

  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, zIndex: 25,
      background: 'rgba(3,4,18,0.82)', border: '1px solid rgba(255,255,255,0.13)',
      borderRadius: 10, padding: '5px 11px',
      display: 'flex', alignItems: 'center', gap: 6,
      boxShadow: '0 2px 12px rgba(0,0,0,0.55)',
      userSelect: 'none', pointerEvents: 'none',
    }}>
      <span ref={iconRef} style={{ fontSize: 16, lineHeight: 1 }} />
      <span ref={labelRef} style={{
        fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
        color: '#e5e7eb', fontFamily: 'monospace',
      }} />
    </div>
  );
}

function Minimap({ playerRef, arenaPositions, leaders, getLeaderStatus, localities }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const SIZE  = 180;
    const PAD   = 8;
    const WORLD = 400;
    const scale = (SIZE - PAD * 2) / WORLD;

    const toC = (wx: number, wz: number) => ({
      x: PAD + (wx + 200) * scale,
      y: PAD + (wz + 200) * scale,
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

      /* City districts */
      const districtColors: Record<string, string> = {
        '#253a28': 'rgba(37,58,40,0.7)',
        '#1e2a3a': 'rgba(30,42,58,0.7)',
        '#1a2235': 'rgba(26,34,53,0.7)',
        '#282828': 'rgba(40,40,40,0.7)',
        '#2e4a18': 'rgba(46,74,24,0.8)',    // CAMPAGNA OVEST
        '#1a2e1a': 'rgba(26,46,26,0.7)',
        '#0c1e08': 'rgba(12,30,8,0.88)',    // BOSCO NORD-OVEST
        '#364222': 'rgba(54,66,34,0.75)',   // PIANURA RURALE
        '#1a2832': 'rgba(26,40,50,0.75)',   // CAMPUS TECNOPOLIS
        '#183518': 'rgba(24,53,24,0.85)',
        '#1c3820': 'rgba(28,56,32,0.85)',
      };
      DISTRICT_DATA.forEach(d => {
        const a = toC(d.x1, d.z1);
        const b = toC(d.x2, d.z2);
        ctx.fillStyle = districtColors[d.color] ?? 'rgba(30,30,50,0.5)';
        ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      });

      /* Road network */
      ctx.lineCap = 'round';
      ROAD_DATA.forEach(road => {
        const a = toC(road.x1, road.z1);
        const b = toC(road.x2, road.z2);
        const wPx = road.w * scale;
        ctx.strokeStyle = 'rgba(80,80,95,0.85)';
        ctx.lineWidth = Math.max(1, wPx);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });

      /* Urban canals on minimap */
      CANAL_DATA.forEach(canal => {
        const a = toC(canal.x1, canal.z1);
        const b = toC(canal.x2, canal.z2);
        const wPx = canal.w * scale;
        ctx.strokeStyle = 'rgba(55,140,220,0.75)';
        ctx.lineWidth = Math.max(2, wPx);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });

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

/* ── Mobile analog joystick ──────────────────────────────────── */
function AnalogJoystick({ onMove, size = 130 }: { onMove: (x: number, z: number) => void; size?: number }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knobOffset, setKnobOffset] = React.useState({ x: 0, y: 0 });
  const [active, setActive] = React.useState(false);
  const activePtrId = useRef<number | null>(null);
  const maxRadius = size * 0.33;
  const knobSize  = size * 0.34;

  const updateFromClient = (clientX: number, clientY: number) => {
    if (!baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width  / 2);
    let dy = clientY - (rect.top  + rect.height / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxRadius) { dx = (dx / dist) * maxRadius; dy = (dy / dist) * maxRadius; }
    setKnobOffset({ x: dx, y: dy });
    onMove(dx / maxRadius, dy / maxRadius);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (activePtrId.current !== null) return;
    e.preventDefault();
    activePtrId.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setActive(true);
    updateFromClient(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerId !== activePtrId.current) return;
    updateFromClient(e.clientX, e.clientY);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerId !== activePtrId.current) return;
    activePtrId.current = null;
    setActive(false);
    setKnobOffset({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div
      ref={baseRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: 'rgba(0,0,0,0.38)',
        border: `2px solid ${active ? 'rgba(167,139,250,0.55)' : 'rgba(255,255,255,0.18)'}`,
        position: 'relative', touchAction: 'none',
        userSelect: 'none', WebkitUserSelect: 'none',
        boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
        transition: 'border-color 0.12s',
      }}
    >
      {/* subtle crosshair */}
      <div style={{ position:'absolute', top:'50%', left:'12%', right:'12%', height:1, background:'rgba(255,255,255,0.1)', transform:'translateY(-50%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', left:'50%', top:'12%', bottom:'12%', width:1, background:'rgba(255,255,255,0.1)', transform:'translateX(-50%)', pointerEvents:'none' }} />
      {/* knob */}
      <div
        style={{
          position: 'absolute',
          width: knobSize, height: knobSize, borderRadius: '50%',
          background: active ? 'rgba(167,139,250,0.80)' : 'rgba(255,255,255,0.28)',
          border: `2.5px solid ${active ? '#a78bfa' : 'rgba(255,255,255,0.50)'}`,
          boxShadow: active ? '0 0 22px rgba(167,139,250,0.65)' : '0 2px 10px rgba(0,0,0,0.45)',
          left: '50%', top: '50%',
          transform: `translate(calc(-50% + ${knobOffset.x}px), calc(-50% + ${knobOffset.y}px))`,
          transition: active ? 'none' : 'transform 0.14s ease, background 0.12s, box-shadow 0.12s',
          pointerEvents: 'none',
        }}
      />
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
  quadratoLeader = null,
  quadratoCompleted = false,
  onTriggerQuadrato,
  avengerBorbonico = false,
  onTriggerAvengerBorbonico,
  chosenFaction = null,
  wizardCardReceived = false,
  onWizardCard,
  allLeadersCompleted = false,
  onOpenSecretRoom,
}: StoryWorldMapProps) {

  /* ── Canvas + container refs ────────────────────────────── */
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sizeRef      = useRef<{ w: number; h: number }>({ w: 800, h: 600 });

  /* ── Game state refs (no re-render on change) ──────────── */
  // Restore last map position from localStorage so the player returns where they left off
  const _savedMapPos = (() => {
    try {
      const raw = localStorage.getItem(`storymap_pos_${userId}`);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.x === 'number' && typeof p.z === 'number') return p as { x: number; z: number };
      }
    } catch { /* ignore */ }
    return null;
  })();
  const playerRef    = useRef<{ x: number; z: number }>(_savedMapPos ?? { x: 0, z: 185 });
  const worldDayTimeRef = useRef<number>(
    (() => { const h = new Date().getHours() + new Date().getMinutes() / 60; return h / 24; })()
  );
  const camRef    = useRef<{ x: number; z: number }>(_savedMapPos ?? { x: 0, z: 185 });
  const keysRef   = useRef<Set<string>>(new Set());
  const joyRef    = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const timeRef   = useRef(0);
  const walkRef   = useRef(0);
  const movingRef = useRef(false);
  const facingRef = useRef<'left' | 'right'>('right');

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

  /* ── Quadrato ghost-ambush refs ──────────────────────────── */
  interface GhostFig { id: number; x: number; z: number; }
  const ghostFigsRef        = useRef<GhostFig[]>([]);
  const ambushActiveRef     = useRef(false);
  const quadratoTriggeredRef = useRef(false);
  const quadratoLeaderRef   = useRef<typeof quadratoLeader>(quadratoLeader);
  const quadratoCompletedRef = useRef(quadratoCompleted);
  const onTriggerQuadratoRef = useRef(onTriggerQuadrato);
  useEffect(() => { quadratoLeaderRef.current = quadratoLeader; }, [quadratoLeader]);
  useEffect(() => {
    quadratoCompletedRef.current = quadratoCompleted;
    if (quadratoCompleted) { ambushActiveRef.current = false; ghostFigsRef.current = []; }
  }, [quadratoCompleted]);
  useEffect(() => { onTriggerQuadratoRef.current = onTriggerQuadrato; }, [onTriggerQuadrato]);

  /* ── Avenger Borbonico dark figure refs ───────────────────── */
  interface DarkFig { x: number; z: number; }
  const darkFigRef              = useRef<DarkFig | null>(null);
  const avengerBorbonicoPropRef = useRef(avengerBorbonico);
  const avengerTriggeredRef     = useRef(false);
  const onTriggerAvengerRef     = useRef(onTriggerAvengerBorbonico);
  useEffect(() => {
    avengerBorbonicoPropRef.current = avengerBorbonico;
    if (!avengerBorbonico) { darkFigRef.current = null; }
  }, [avengerBorbonico]);
  useEffect(() => { onTriggerAvengerRef.current = onTriggerAvengerBorbonico; }, [onTriggerAvengerBorbonico]);

  /* ── Wizard reward figure ────────────────────────────────── */
  type WizardState = 'walking-to' | 'dialogue' | 'walking-away' | 'done';
  interface WizardFig { x: number; z: number; state: WizardState; dialogueTimer: number; }
  const wizardRef         = useRef<WizardFig | null>(null);
  const wizardDoneRef     = useRef(wizardCardReceived);
  const onWizardCardRef   = useRef(onWizardCard);
  const [wizardDialogue, setWizardDialogue] = useState(false);
  useEffect(() => {
    wizardDoneRef.current = wizardCardReceived;
    if (wizardCardReceived) { wizardRef.current = null; setWizardDialogue(false); }
  }, [wizardCardReceived]);

  /* ── Secret Room refs ────────────────────────────────────── */
  const allLeadersCompletedRef = useRef(allLeadersCompleted);
  const onOpenSecretRoomRef    = useRef(onOpenSecretRoom);
  const secretRevealedRef      = useRef(
    userId ? localStorage.getItem(`secretRoomRevealed_${userId}`) === 'true' : false
  );
  useEffect(() => {
    secretRevealedRef.current = userId
      ? localStorage.getItem(`secretRoomRevealed_${userId}`) === 'true'
      : false;
  }, [userId]);
  useEffect(() => { allLeadersCompletedRef.current = allLeadersCompleted; }, [allLeadersCompleted]);
  useEffect(() => { onOpenSecretRoomRef.current = onOpenSecretRoom; }, [onOpenSecretRoom]);
  useEffect(() => { onWizardCardRef.current = onWizardCard; }, [onWizardCard]);

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
    () => typeof window !== 'undefined' && (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches)
    )
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
  const [revealScheaOpen,    setRevealScheaOpen]    = useState(false);

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

  /* Stage 13 state */
  const [stage13Status, setStage13Status] = useState<any>(null);
  const [showStage13ChallengeModal, setShowStage13ChallengeModal] = useState(false);
  const [stage13ChallengeLoading, setStage13ChallengeLoading] = useState(false);
  const [stage13ChallengeError, setStage13ChallengeError] = useState<string | null>(null);
  const [stage13ChallengeSent, setStage13ChallengeSent] = useState(false);
  const stage13StatusRef = useRef<any>(null);

  /* victory history panel */
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  /* mobile portrait: chapter banner collapsed state */
  const [bannerCollapsed, setBannerCollapsed] = useState(true);

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

  /* ── Camera + control state via useStoryWorldLogic hook ─────────────────────────── */
  const {
    cameraYawRef,
    mobileCamRotateRef,
    camRotateMode,
    toggleCamRotate,
  } = useStoryWorldLogic();

  /* ── Football field state ───────────────────────────────── */
  const [nearFootball, setNearFootball] = useState(false);
  const [showFootballMinigame, setShowFootballMinigame] = useState(false);
  const lastNearFootballRef = useRef(false);
  const [nearStage13, setNearStage13] = useState(false);
  const lastNearStage13Ref = useRef(false);
  const [nearSecretRoom, setNearSecretRoom] = useState(false);
  const lastNearSecretRoomRef = useRef(false);

  /* Keep ref in sync with state for game loop reads */
  useEffect(() => { localCollectedIdsRef.current = localCollectedIds; }, [localCollectedIds]);

  /* ── Arena positions (memoized) ────────────────────────── */
  const arenaPositions = useMemo(
    () => leaders.map((_, idx) => getArenaPosition(idx, leaders.length)),
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

    // Check Secret Room click (only when all leaders completed)
    if (allLeadersCompletedRef.current) {
      const [srx, srz] = SECRET_ROOM_WORLD_POS;
      const srDist = Math.sqrt((pos.x - srx) ** 2 + (pos.z - srz) ** 2);
      if (srDist < ARENA_HIT_RADIUS * 1.5) {
        secretRevealedRef.current = true;
        if (userId) localStorage.setItem(`secretRoomRevealed_${userId}`, 'true');
        onOpenSecretRoomRef.current?.();
        return;
      }
    }

    // Check Stage 13 click first
    const [s13x, s13z] = STAGE13_WORLD_POS;
    const s13Dist = Math.sqrt((pos.x - s13x) ** 2 + (pos.z - s13z) ** 2);
    if (s13Dist < ARENA_HIT_RADIUS * 1.5) {
      const st = stage13StatusRef.current;
      if (st?.visibleStage && st.storyCompleted) {
        setShowStage13ChallengeModal(true);
        setStage13ChallengeSent(false);
        setStage13ChallengeError(null);
        return;
      }
    }

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

    // Cursor for Secret Room
    if (allLeadersCompletedRef.current) {
      const [srx, srz] = SECRET_ROOM_WORLD_POS;
      if (Math.sqrt((pos.x - srx) ** 2 + (pos.z - srz) ** 2) < ARENA_HIT_RADIUS * 1.5) {
        canvas.style.cursor = 'pointer';
        setTooltip(null);
        return;
      }
    }

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
    const handlePvpStart = (data: { gameId: string; yourRole: 'challenger' | 'target'; opponentUsername: string; opponentUserId: number; yourDeck: number[]; opponentDeck: number[]; livesCount?: number; youtubeMusicUrl?: string | null }) => {
      onStartPvp?.(data.gameId, data.opponentUsername, data.yourDeck, data.opponentDeck, data.yourRole, data.livesCount, data.youtubeMusicUrl);
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
      /* shadow base ring (Pokémon-style dark green) */
      ctx.beginPath(); ctx.arc(sx, fy, R * 1.12, 0, Math.PI * 2);
      ctx.fillStyle = '#1a4a10'; ctx.fill();
      /* main body (vivid medium green) */
      ctx.beginPath(); ctx.arc(sx, fy, R, 0, Math.PI * 2);
      ctx.fillStyle = '#2e8a2e'; ctx.fill();
      /* east-side ambient occlusion */
      ctx.beginPath(); ctx.arc(sx + R * 0.28, fy + R * 0.1, R * 0.72, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,30,0,0.35)'; ctx.fill();
      /* mid highlight layer (brighter green) */
      ctx.beginPath(); ctx.arc(sx - R * 0.14, fy - R * 0.18, R * 0.78, 0, Math.PI * 2);
      ctx.fillStyle = '#3da83d'; ctx.fill();
      /* top highlight (vivid bright green) */
      ctx.beginPath(); ctx.arc(sx - R * 0.3, fy - R * 0.34, R * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#58cc58'; ctx.fill();
      /* specular spot (light highlight) */
      ctx.beginPath(); ctx.arc(sx - R * 0.42, fy - R * 0.46, R * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = '#88e088'; ctx.fill();
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
      const rawName = status === 'locked' ? '???' : (leader.name.length > 14 ? leader.name.slice(0, 13) + '…' : leader.name);
      const diffIcon = status === 'locked' ? '🔒' : leader.cpuLevel === 'easy' ? '🟢' : leader.cpuLevel === 'medium' ? '🟡' : '🔴';
      const fullLabel = `${diffIcon} ${rawName}`;
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
      const facingLeft = facingRef.current === 'left';
      if (facingLeft) {
        ctx.save();
        ctx.translate(sx, 0);
        ctx.scale(-1, 1);
        ctx.translate(-sx, 0);
      }
      const bob = moving ? Math.sin(time * 8) * 1.5 : 0;
      const walkCycle = time * 8;
      const legSwing  = moving ? Math.sin(walkCycle) * 2 : 0;
      const armSwing  = moving ? Math.sin(walkCycle + Math.PI) * 2.5 : 0;

      /* proportions scaled to original TILE-based size */
      const bW = 0.55 * TILE;   // body half-width total = 11px
      const bH = 0.72 * TILE;   // body height = 14.4px
      const hr = 0.28 * TILE;   // head radius = 5.6px

      /* ── ground shadow (radial gradient) ── */
      const [pSunX, pSunZ] = getSunVec(time);
      const shGrd = ctx.createRadialGradient(sx + pSunX * 5, sy + 6 + pSunZ * 2, 0, sx + pSunX * 5, sy + 6 + pSunZ * 2, bW * 0.9);
      shGrd.addColorStop(0, 'rgba(0,0,0,0.35)');
      shGrd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.ellipse(sx + pSunX * 5, sy + 6 + pSunZ * 2, bW * 0.9, bW * 0.38, 0, 0, Math.PI * 2);
      ctx.fillStyle = shGrd; ctx.fill();

      /* ── shoes ── */
      const shW = bW * 0.4; const shH = 3;
      ctx.fillStyle = '#111827';
      rrect(ctx, sx - bW * 0.5, sy + bob + legSwing * 0.4 + 2, shW, shH, 1); ctx.fill();
      rrect(ctx, sx + bW * 0.1, sy + bob - legSwing * 0.4 + 2, shW, shH, 1); ctx.fill();

      /* ── legs (pants) ── */
      const legW = bW * 0.38; const legH = bH * 0.45;
      ctx.fillStyle = '#1e3a5f';
      ctx.fillRect(sx - bW * 0.48, sy - legH * 0.5 + bob + legSwing * 0.25, legW, legH);
      ctx.fillRect(sx + bW * 0.10, sy - legH * 0.5 + bob - legSwing * 0.25, legW, legH);

      /* ── arms ── */
      const armW = bW * 0.28; const armH = bH * 0.55;
      ctx.fillStyle = '#6d28d9';
      rrect(ctx, sx - bW / 2 - armW + 1, sy - bH * 0.8 + bob + armSwing, armW, armH, 1); ctx.fill();
      rrect(ctx, sx + bW / 2 - 1,         sy - bH * 0.8 + bob - armSwing, armW, armH, 1); ctx.fill();
      /* hands */
      ctx.fillStyle = '#f4c07c';
      ctx.beginPath(); ctx.arc(sx - bW / 2 - armW * 0.3, sy - bH * 0.25 + bob + armSwing, armW * 0.38, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + bW / 2 + armW * 0.3, sy - bH * 0.25 + bob - armSwing, armW * 0.38, 0, Math.PI * 2); ctx.fill();

      /* ── body / torso ── */
      const torsoGrd = ctx.createLinearGradient(sx - bW / 2, sy - bH + bob, sx + bW / 2, sy - legH * 0.5 + bob);
      torsoGrd.addColorStop(0, '#7c3aed');
      torsoGrd.addColorStop(0.5, '#6d28d9');
      torsoGrd.addColorStop(1, '#5b21b6');
      rrect(ctx, sx - bW / 2, sy - bH + 3 + bob, bW, bH - legH * 0.5, 2);
      ctx.fillStyle = torsoGrd; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.7; ctx.stroke();
      /* collar highlight */
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      rrect(ctx, sx - bW * 0.22, sy - bH + 3 + bob, bW * 0.44, bH * 0.25, 1); ctx.fill();
      /* torso side highlight */
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      rrect(ctx, sx - bW * 0.46, sy - bH + 4 + bob, bW * 0.44, bH * 0.7, 1); ctx.fill();

      /* ── backpack ── */
      ctx.fillStyle = '#4c1d95';
      rrect(ctx, sx + bW / 2 - 1, sy - bH * 0.9 + bob, bW * 0.36, bH * 0.6, 1); ctx.fill();
      ctx.strokeStyle = '#5b21b6'; ctx.lineWidth = 0.6; ctx.stroke();

      /* ── neck ── */
      ctx.fillStyle = '#e5a865';
      ctx.fillRect(sx - bW * 0.16, sy - bH + bob, bW * 0.32, bH * 0.22);

      /* ── head ── */
      const headCy = sy - bH + 3 + bob - hr * 0.4;
      ctx.beginPath(); ctx.arc(sx, headCy, hr, 0, Math.PI * 2);
      ctx.fillStyle = '#f4c07c'; ctx.fill();
      ctx.strokeStyle = 'rgba(180,120,40,0.30)'; ctx.lineWidth = 0.6; ctx.stroke();

      /* ── hair ── */
      ctx.beginPath(); ctx.arc(sx, headCy - hr * 0.18, hr * 0.88, Math.PI * 1.05, 0.05); ctx.closePath();
      ctx.fillStyle = '#2d1505'; ctx.fill();

      /* ── eyes ── */
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(sx - hr * 0.55, headCy, hr * 0.38, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + hr * 0.55, headCy, hr * 0.38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a0800';
      ctx.beginPath(); ctx.arc(sx - hr * 0.50, headCy, hr * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + hr * 0.50, headCy, hr * 0.22, 0, Math.PI * 2); ctx.fill();
      /* eye shine */
      ctx.fillStyle = 'rgba(255,255,255,0.60)';
      ctx.beginPath(); ctx.arc(sx - hr * 0.60, headCy - hr * 0.12, hr * 0.10, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + hr * 0.42, headCy - hr * 0.12, hr * 0.10, 0, Math.PI * 2); ctx.fill();

      /* ── mouth ── */
      ctx.strokeStyle = '#a0522d'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(sx, headCy + hr * 0.35, hr * 0.42, 0.1, Math.PI - 0.1); ctx.stroke();

      /* ── indicator glow above head ── */
      const dotY = headCy - hr - 5;
      const pulse = 0.85 + Math.sin(time * 3.5) * 0.15;
      const dotG = ctx.createRadialGradient(sx, dotY, 0, sx, dotY, hr * 0.8 * pulse);
      dotG.addColorStop(0, 'rgba(167,139,250,1)');
      dotG.addColorStop(1, 'rgba(109,40,217,0)');
      ctx.beginPath(); ctx.arc(sx, dotY, hr * 0.8 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = dotG; ctx.fill();
      ctx.beginPath(); ctx.arc(sx, dotY, hr * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = '#a78bfa'; ctx.fill();
      if (facingLeft) ctx.restore();
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
      if (keys.has('ArrowUp')    || keys.has('KeyW')) dz -= 1;
      if (keys.has('ArrowDown')  || keys.has('KeyS')) dz += 1;
      if (keys.has('ArrowLeft')  || keys.has('KeyA')) dx -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1;
      /* Analog joystick — use actual deflection so partial push = partial speed */
      if (Math.abs(joy.x) > 0.08 || Math.abs(joy.z) > 0.08) { dx += joy.x; dz += joy.z; }

      /* Camera-relative movement — rotate (dx, dz) by camera yaw so
         "forward" always points where the camera is looking.            */
      if (dx !== 0 || dz !== 0) {
        const yaw = cameraYawRef.current;
        const cosY = Math.cos(yaw);
        const sinY = Math.sin(yaw);
        const rdx = dx * cosY + dz * sinY;
        const rdz = dz * cosY - dx * sinY;
        dx = rdx; dz = rdz;
      }

      if (dx < 0) facingRef.current = 'left';
      else if (dx > 0) facingRef.current = 'right';

      const moving = (dx !== 0 || dz !== 0) && !wizardDialogue;
      movingRef.current = moving;
      if (moving) {
        const len = Math.sqrt(dx * dx + dz * dz);
        /* speedMult < 1 for partial joystick deflection; capped at 1 for keyboard/full push */
        const speedMult = Math.min(len, 1.0);
        playerRef.current.x = Math.max(-MAP_BOUND, Math.min(MAP_BOUND, playerRef.current.x + (dx / len) * PLAYER_SPEED * speedMult * dt));
        playerRef.current.z = Math.max(-MAP_BOUND, Math.min(MAP_BOUND, playerRef.current.z + (dz / len) * PLAYER_SPEED * speedMult * dt));
        walkRef.current += dt;
      }
      /* ── Full collision system ──────────────────────── */
      const PR = 0.45; // player collision radius
      {
        /* Arena buildings (AABB sliding) */
        const ARENA_HW = 1.85; const ARENA_HD = 2.05;
        arenaPositionsRef.current.forEach(([ax, az]) => {
          const oX = ARENA_HW + PR - Math.abs(playerRef.current.x - ax);
          const oZ = ARENA_HD + PR - Math.abs(playerRef.current.z - az);
          if (oX > 0 && oZ > 0) {
            if (oX < oZ) { playerRef.current.x += playerRef.current.x < ax ? -oX : oX; }
            else          { playerRef.current.z += playerRef.current.z < az ? -oZ : oZ; }
          }
        });
        /* City buildings (AABB sliding — w/h are full extents used as half-dims) */
        BUILDING_DATA.forEach(bld => {
          const hw = bld.w + PR;
          const hd = bld.h + PR;
          const oX = hw - Math.abs(playerRef.current.x - bld.x);
          const oZ = hd - Math.abs(playerRef.current.z - bld.z);
          if (oX > 0 && oZ > 0) {
            if (oX < oZ) { playerRef.current.x += playerRef.current.x < bld.x ? -oX : oX; }
            else          { playerRef.current.z += playerRef.current.z < bld.z ? -oZ : oZ; }
          }
        });
        /* Tree trunks (circular blocking) */
        const TRUNK_R = 0.35;
        TREE_DATA.forEach(tr => {
          const combR = TRUNK_R + PR;
          const dx2 = playerRef.current.x - tr.x;
          const dz2 = playerRef.current.z - tr.z;
          const dist2 = Math.sqrt(dx2 * dx2 + dz2 * dz2);
          if (dist2 < combR && dist2 > 0.001) {
            const push = combR - dist2;
            playerRef.current.x += (dx2 / dist2) * push;
            playerRef.current.z += (dz2 / dist2) * push;
          }
        });
        /* Water bodies (circular blocking) */
        WATER_DATA.forEach(wd => {
          const combR = wd.r + PR;
          const dx2 = playerRef.current.x - wd.x;
          const dz2 = playerRef.current.z - wd.z;
          const dist2 = Math.sqrt(dx2 * dx2 + dz2 * dz2);
          if (dist2 < combR && dist2 > 0.001) {
            const push = combR - dist2;
            playerRef.current.x += (dx2 / dist2) * push;
            playerRef.current.z += (dz2 / dist2) * push;
          }
        });
        /* Canal strips (AABB blocking) */
        CANAL_DATA.forEach(canal => {
          const isVert = canal.x1 === canal.x2;
          let cx: number, cz: number, chw: number, chd: number;
          if (isVert) {
            cx = canal.x1; chw = canal.w / 2;
            cz = (canal.z1 + canal.z2) / 2; chd = Math.abs(canal.z2 - canal.z1) / 2;
          } else {
            cz = canal.z1; chd = canal.w / 2;
            cx = (canal.x1 + canal.x2) / 2; chw = Math.abs(canal.x2 - canal.x1) / 2;
          }
          const oX = chw + PR - Math.abs(playerRef.current.x - cx);
          const oZ = chd + PR - Math.abs(playerRef.current.z - cz);
          if (oX > 0 && oZ > 0) {
            if (oX < oZ) { playerRef.current.x += playerRef.current.x < cx ? -oX : oX; }
            else          { playerRef.current.z += playerRef.current.z < cz ? -oZ : oZ; }
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
          if (!isNearFF) setShowFootballMinigame(false);
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

        /* Stage 13 proximity — gated by visibleStage AND storyCompleted (matches canvas-click gate) */
        if (stage13StatusRef.current?.visibleStage && stage13StatusRef.current?.storyCompleted) {
          const [s13x, s13z] = STAGE13_WORLD_POS;
          const s13dist = Math.sqrt((px - s13x) ** 2 + (pz - s13z) ** 2);
          const isNearS13 = s13dist < 8;
          if (isNearS13 !== lastNearStage13Ref.current) {
            lastNearStage13Ref.current = isNearS13;
            setNearStage13(isNearS13);
          }
        }

        /* Secret Room proximity (replaces canvas click) */
        if (allLeadersCompletedRef.current) {
          const [srx, srz] = SECRET_ROOM_WORLD_POS;
          const srdist = Math.sqrt((px - srx) ** 2 + (pz - srz) ** 2);
          const isNearSR = srdist < 8;
          if (isNearSR !== lastNearSecretRoomRef.current) {
            lastNearSecretRoomRef.current = isNearSR;
            setNearSecretRoom(isNearSR);
          }
        }
      }

      /* ── Quadrato ghost-ambush movement ─────────────── */
      if (quadratoLeaderRef.current && !quadratoCompletedRef.current && !quadratoTriggeredRef.current) {
        const px2 = playerRef.current.x, pz2 = playerRef.current.z;
        const lrs2 = leadersRef.current;
        const baseLeaders2 = lrs2.filter(l => !l.requiredFaction);
        if (baseLeaders2.length > 0) {
          // Find the max orderIndex across ALL leaders (including faction leaders like Bronx/Zody)
          const maxOrdIdx = Math.max(...lrs2.map(l => l.orderIndex));
          const preFinalLeaders = baseLeaders2.filter(l => l.orderIndex < maxOrdIdx);
          const firstFinalLeader = lrs2.find(l => l.orderIndex === maxOrdIdx);
          const firstFinalIdx = firstFinalLeader ? lrs2.indexOf(firstFinalLeader) : lrs2.length - 1;
          const [ambushAx, ambushAz] = getArenaPosition(firstFinalIdx >= 0 ? firstFinalIdx : lrs2.length - 1);
          const distToFinal = Math.sqrt((px2 - ambushAx) ** 2 + (pz2 - ambushAz) ** 2);
          // Trigger when all pre-final stages done and player approaches the final group
          const allPreFinalDone = preFinalLeaders.length > 0 && preFinalLeaders.every(l => getLeaderStatusRef.current(l) === 'completed');
          if (!ambushActiveRef.current && distToFinal <= 80 && allPreFinalDone) {
            ambushActiveRef.current = true;
            ghostFigsRef.current = [
              { id: 0, x: ambushAx + 65, z: ambushAz },
              { id: 1, x: ambushAx - 65, z: ambushAz },
              { id: 2, x: ambushAx,      z: ambushAz + 65 },
              { id: 3, x: ambushAx,      z: ambushAz - 65 },
            ];
          }
          if (ambushActiveRef.current) {
            const GHOST_SPEED = 9;
            let triggered = false;
            ghostFigsRef.current = ghostFigsRef.current.map(gf => {
              const gdx = px2 - gf.x;
              const gdz = pz2 - gf.z;
              const gdist = Math.sqrt(gdx * gdx + gdz * gdz);
              if (gdist < 1.8) { triggered = true; return gf; }
              if (gdist > 0.01) {
                return { ...gf, x: gf.x + (gdx / gdist) * GHOST_SPEED * dt, z: gf.z + (gdz / gdist) * GHOST_SPEED * dt };
              }
              return gf;
            });
            if (triggered) {
              quadratoTriggeredRef.current = true;
              ambushActiveRef.current = false;
              ghostFigsRef.current = [];
              onTriggerQuadratoRef.current?.();
            }
          }
        }
      }

      /* ── Avenger Borbonico dark figure movement ──────────── */
      if (avengerBorbonicoPropRef.current && !avengerTriggeredRef.current) {
        const px3a = playerRef.current.x, pz3a = playerRef.current.z;
        if (!darkFigRef.current) {
          /* Spawn behind the player (+12 north so they can see it approach) */
          darkFigRef.current = { x: px3a, z: pz3a + 12 };
        }
        const fig = darkFigRef.current;
        const dx3a = px3a - fig.x, dz3a = pz3a - fig.z;
        const d3a = Math.sqrt(dx3a * dx3a + dz3a * dz3a);
        if (d3a < 1.8) {
          avengerTriggeredRef.current = true;
          darkFigRef.current = null;
          onTriggerAvengerRef.current?.();
        } else if (d3a > 0.01) {
          const DARK_SPEED = 7;
          fig.x += (dx3a / d3a) * DARK_SPEED * dt;
          fig.z += (dz3a / d3a) * DARK_SPEED * dt;
        }
      }

      /* ── Wizard reward figure movement ─────────────── */
      if (quadratoCompletedRef.current && !wizardDoneRef.current) {
        const px3 = playerRef.current.x, pz3 = playerRef.current.z;
        const lrs3 = leadersRef.current;
        if (lrs3.length > 0) {
          const [lastAx3, lastAz3] = getArenaPosition(lrs3.length - 1);
          const distToLast3 = Math.sqrt((px3 - lastAx3) ** 2 + (pz3 - lastAz3) ** 2);
          if (!wizardRef.current && distToLast3 <= 25) {
            /* Spawn from last arena side, walking toward player */
            wizardRef.current = { x: lastAx3 + 3, z: lastAz3 - 4, state: 'walking-to', dialogueTimer: 0 };
          }
          if (wizardRef.current) {
            const wiz = wizardRef.current;
            if (wiz.state === 'walking-to') {
              const dx3 = px3 - wiz.x, dz3 = pz3 - wiz.z;
              const d3 = Math.sqrt(dx3 * dx3 + dz3 * dz3);
              if (d3 < 2.5) {
                wiz.state = 'dialogue';
                setWizardDialogue(true);
              } else if (d3 > 0.01) {
                const WSPD = 4;
                wiz.x += (dx3 / d3) * WSPD * dt;
                wiz.z += (dz3 / d3) * WSPD * dt;
              }
            } else if (wiz.state === 'walking-away') {
              /* Walk away from player */
              const dx3 = wiz.x - px3, dz3 = wiz.z - pz3;
              const d3 = Math.sqrt(dx3 * dx3 + dz3 * dz3);
              if (d3 > 35) {
                wiz.state = 'done';
                wizardDoneRef.current = true;
                wizardRef.current = null;
              } else if (d3 > 0.01) {
                wiz.x += (dx3 / d3) * 3 * dt;
                wiz.z += (dz3 / d3) * 3 * dt;
              }
            }
          }
        }
      }

      /* Throttled move emit + position save (every ~100ms) */
      if (userId) {
        moveEmitTimer.current += dt;
        if (moveEmitTimer.current >= 0.1) {
          moveEmitTimer.current = 0;
          if (authToken) {
            socket.emit('story-world:move', { x: playerRef.current.x, z: playerRef.current.z });
          }
          // Persist position so player returns here after missions / page reload
          try {
            localStorage.setItem(`storymap_pos_${userId}`, JSON.stringify({ x: playerRef.current.x, z: playerRef.current.z }));
          } catch { /* ignore quota errors */ }
        }
      }

      /* ── Draw (skipped when canvas not in DOM) ─────── */
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d') ?? null;
      if (canvas && ctx) {

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

      /* 1. City background: bright green grass base (Pokémon-style) */
      ctx.fillStyle = '#5a9e2f';
      ctx.fillRect(0, 0, w, h);

      /* District style config: [base, accent, grid] */
      const DISTRICT_STYLES = [
        /* 0  INGRESSO          */ { base:'#d4b866', accent:'#c8a250', grid:'rgba(0,0,0,0.10)', pattern:'cobble'  },
        /* 1  BORGO RESIDENZIALE*/ { base:'#c87a50', accent:'#b86840', grid:'rgba(0,0,0,0.10)', pattern:'brick'   },
        /* 2  PORTO EST         */ { base:'#5888b8', accent:'#4a78a8', grid:'rgba(0,0,0,0.12)', pattern:'dock'    },
        /* 3  CENTRO            */ { base:'#b0a898', accent:'#a09888', grid:'rgba(0,0,0,0.08)', pattern:'stone'   },
        /* 4  CAMPAGNA OVEST    */ { base:'#78c040', accent:'#68a832', grid:'rgba(0,0,0,0.05)', pattern:'meadow'  },
        /* 5  PARCO GRANDE      */ { base:'#52b830', accent:'#44a025', grid:'rgba(0,0,0,0.06)', pattern:'grass'   },
        /* 6  BOSCO NORD-OVEST  */ { base:'#2a6018', accent:'#1e4810', grid:'rgba(0,0,0,0.04)', pattern:'forest'  },
        /* 7  PIANURA RURALE    */ { base:'#90b848', accent:'#80a838', grid:'rgba(0,0,0,0.06)', pattern:'field'   },
        /* 8  CAMPUS TECNOPOLIS */ { base:'#6880a0', accent:'#587090', grid:'rgba(0,0,0,0.10)', pattern:'stone'   },
        /* 9  GIARDINO OVEST    */ { base:'#48b030', accent:'#3a9825', grid:'rgba(0,0,0,0.06)', pattern:'grass'   },
        /* 10 GIARDINO EST      */ { base:'#4aac32', accent:'#3c9228', grid:'rgba(0,0,0,0.06)', pattern:'grass'   },
        /* 11 PARCO INGRESSO    */ { base:'#52b838', accent:'#44a030', grid:'rgba(0,0,0,0.06)', pattern:'grass'   },
      ];
      DISTRICT_DATA.forEach((d, di) => {
        const [x1s, y1s] = w2s(d.x1, d.z1);
        const [x2s, y2s] = w2s(d.x2, d.z2);
        const rx = Math.min(x1s, x2s), ry = Math.min(y1s, y2s);
        const rw2 = Math.abs(x2s - x1s), rh2 = Math.abs(y2s - y1s);
        const sty = DISTRICT_STYLES[di] ?? { base:'#3a3a3a', accent:'#333', grid:'rgba(0,0,0,0.1)', pattern:'stone' };
        /* base fill */
        ctx.fillStyle = sty.base;
        ctx.fillRect(rx, ry, rw2, rh2);
        /* pattern overlay */
        ctx.save();
        ctx.beginPath(); ctx.rect(rx, ry, rw2, rh2);
        ctx.clip();
        if (sty.pattern === 'cobble') {
          /* Cobblestone: irregular small tiles (Pokémon sandy market style) */
          ctx.fillStyle = sty.accent;
          const ts = TILE * 0.55;
          for (let gx = rx - ts; gx < rx + rw2 + ts; gx += ts) {
            for (let gy = ry - ts; gy < ry + rh2 + ts; gy += ts) {
              const off = ((Math.round(gy / ts)) % 2) * ts * 0.5;
              ctx.fillRect(gx + off + 1, gy + 1, ts - 2, ts - 2);
            }
          }
          ctx.strokeStyle = 'rgba(100,60,0,0.25)'; ctx.lineWidth = 1;
          for (let gx = rx - ts; gx < rx + rw2 + ts; gx += ts) {
            for (let gy = ry - ts; gy < ry + rh2 + ts; gy += ts) {
              const off = ((Math.round(gy / ts)) % 2) * ts * 0.5;
              ctx.strokeRect(gx + off + 1, gy + 1, ts - 2, ts - 2);
            }
          }
        } else if (sty.pattern === 'brick') {
          /* Brick: horizontal staggered rows (warm terracotta) */
          ctx.fillStyle = sty.accent;
          const bw = TILE * 1.2, bh = TILE * 0.5;
          for (let gy = ry - bh; gy < ry + rh2 + bh; gy += bh) {
            const row = Math.round(gy / bh);
            const off = (row % 2) * bw * 0.5;
            for (let gx = rx - bw + off; gx < rx + rw2 + bw; gx += bw) {
              ctx.fillRect(gx + 1, gy + 1, bw - 2, bh - 2);
            }
          }
          ctx.strokeStyle = 'rgba(80,30,10,0.25)'; ctx.lineWidth = 0.8;
          for (let gy = ry - bh; gy < ry + rh2 + bh; gy += bh) {
            const row = Math.round(gy / bh);
            const off = (row % 2) * bw * 0.5;
            for (let gx = rx - bw + off; gx < rx + rw2 + bw; gx += bw) {
              ctx.strokeRect(gx + 1, gy + 1, bw - 2, bh - 2);
            }
          }
        } else if (sty.pattern === 'dock') {
          /* Dock: horizontal planks */
          ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
          const plankH = TILE * 0.65;
          for (let gy = ry; gy < ry + rh2; gy += plankH) {
            ctx.beginPath(); ctx.moveTo(rx, gy); ctx.lineTo(rx + rw2, gy); ctx.stroke();
          }
          /* vertical bolt lines */
          ctx.strokeStyle = 'rgba(0,0,0,0.10)';
          for (let gx = rx; gx < rx + rw2; gx += TILE * 3) {
            ctx.beginPath(); ctx.moveTo(gx, ry); ctx.lineTo(gx, ry + rh2); ctx.stroke();
          }
        } else if (sty.pattern === 'stone') {
          /* Large stone flags */
          ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.lineWidth = 1;
          const fs = TILE * 1.8;
          for (let gx = rx - fs; gx < rx + rw2 + fs; gx += fs) {
            for (let gy = ry - fs; gy < ry + rh2 + fs; gy += fs) {
              const off = ((Math.round(gy / fs)) % 2) * fs * 0.5;
              ctx.strokeRect(gx + off + 1, gy + 1, fs - 2, fs - 2);
            }
          }
        } else if (sty.pattern === 'cement') {
          /* Cement: subtle crack lines */
          ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 1;
          const cg = TILE * 2.5;
          for (let gx = rx; gx < rx + rw2; gx += cg) {
            ctx.beginPath(); ctx.moveTo(gx, ry); ctx.lineTo(gx, ry + rh2); ctx.stroke();
          }
          for (let gy = ry; gy < ry + rh2; gy += cg) {
            ctx.beginPath(); ctx.moveTo(rx, gy); ctx.lineTo(rx + rw2, gy); ctx.stroke();
          }
          /* stain overlay */
          ctx.fillStyle = 'rgba(0,0,0,0.04)';
          for (let i = 0; i < 6; i++) {
            const sx2 = rx + ((i * 37) % rw2); const sy2 = ry + ((i * 53) % rh2);
            ctx.fillRect(sx2, sy2, TILE * 1.2, TILE * 0.8);
          }
        } else if (sty.pattern === 'grass') {
          /* Grass: bright Pokémon-style texture with vivid highlights */
          ctx.strokeStyle = 'rgba(0,80,0,0.12)'; ctx.lineWidth = 0.8;
          const gg = TILE * 0.85;
          for (let gy = ry; gy < ry + rh2; gy += gg) {
            ctx.beginPath(); ctx.moveTo(rx, gy); ctx.lineTo(rx + rw2, gy); ctx.stroke();
          }
          /* vivid highlight patches */
          ctx.fillStyle = 'rgba(120,230,60,0.20)';
          for (let i = 0; i < 8; i++) {
            const px2 = rx + ((i * 41 + 7) % rw2); const py2 = ry + ((i * 29 + 3) % rh2);
            ctx.beginPath(); ctx.ellipse(px2, py2, TILE * 2.5, TILE * 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (sty.pattern === 'meadow') {
          /* Meadow: bright grass clumps + vivid wildflower dots */
          ctx.fillStyle = 'rgba(120,200,50,0.22)';
          for (let i = 0; i < 20; i++) {
            const mx = rx + ((i * 47 + 13) % Math.max(1, rw2));
            const my = ry + ((i * 31 + 7)  % Math.max(1, rh2));
            ctx.beginPath(); ctx.ellipse(mx, my, TILE * 3.0, TILE * 1.8, (i * 0.4), 0, Math.PI * 2);
            ctx.fill();
          }
          /* vivid wildflower dots */
          const fdots = ['rgba(255,220,40,0.60)','rgba(255,80,160,0.45)','rgba(80,200,255,0.45)'];
          for (let i = 0; i < 18; i++) {
            const fx3 = rx + ((i * 53 + 19) % Math.max(1, rw2));
            const fy3 = ry + ((i * 37 + 11) % Math.max(1, rh2));
            ctx.fillStyle = fdots[i % 3];
            ctx.beginPath(); ctx.arc(fx3, fy3, 3.0, 0, Math.PI * 2); ctx.fill();
          }
          /* subtle ploughing lines */
          ctx.strokeStyle = 'rgba(0,60,0,0.10)'; ctx.lineWidth = 0.8;
          for (let gy = ry; gy < ry + rh2; gy += TILE * 2.5) {
            ctx.beginPath(); ctx.moveTo(rx, gy); ctx.lineTo(rx + rw2, gy); ctx.stroke();
          }
        } else if (sty.pattern === 'forest') {
          /* Forest: rich dark canopy patches + dense texture */
          ctx.fillStyle = 'rgba(0,50,0,0.28)';
          for (let i = 0; i < 25; i++) {
            const fx3 = rx + ((i * 43 + 11) % Math.max(1, rw2));
            const fy3 = ry + ((i * 29 + 7)  % Math.max(1, rh2));
            ctx.beginPath();
            ctx.ellipse(fx3, fy3, TILE * 3.5, TILE * 2.5, i * 0.3, 0, Math.PI * 2);
            ctx.fill();
          }
          /* dappled light spots (vivid) */
          ctx.fillStyle = 'rgba(100,210,50,0.18)';
          for (let i = 0; i < 12; i++) {
            const fx3 = rx + ((i * 61 + 23) % Math.max(1, rw2));
            const fy3 = ry + ((i * 41 + 5)  % Math.max(1, rh2));
            ctx.beginPath(); ctx.arc(fx3, fy3, TILE * 1.2, 0, Math.PI * 2); ctx.fill();
          }
        } else if (sty.pattern === 'field') {
          /* Field: horizontal crop rows with bright alternating tones */
          const rowH = TILE * 1.4;
          for (let gy = ry; gy < ry + rh2; gy += rowH) {
            const rowIdx = Math.round(gy / rowH);
            ctx.fillStyle = (rowIdx % 2 === 0)
              ? 'rgba(120,170,50,0.18)'
              : 'rgba(160,210,70,0.20)';
            ctx.fillRect(rx, gy, rw2, rowH);
          }
          /* furrow lines */
          ctx.strokeStyle = 'rgba(0,50,0,0.10)'; ctx.lineWidth = 0.7;
          for (let gy = ry; gy < ry + rh2; gy += rowH) {
            ctx.beginPath(); ctx.moveTo(rx, gy); ctx.lineTo(rx + rw2, gy); ctx.stroke();
          }
          /* occasional boulder / shrub dots */
          ctx.fillStyle = 'rgba(120,100,50,0.20)';
          for (let i = 0; i < 6; i++) {
            const fx3 = rx + ((i * 71 + 17) % Math.max(1, rw2));
            const fy3 = ry + ((i * 53 + 13) % Math.max(1, rh2));
            ctx.beginPath(); ctx.arc(fx3, fy3, 3.5, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.restore();

        /* 1c. District edge transition — soft gradient blending at borders */
        const edgeW = TILE * 1.8;
        const edgeColorSolid = 'rgba(90,158,47,0.62)'; // base green (#5a9e2f) with alpha
        const edgeColorTransp = 'rgba(90,158,47,0)';
        // Left edge
        const lGrad = ctx.createLinearGradient(rx, ry, rx + edgeW, ry);
        lGrad.addColorStop(0, edgeColorSolid); lGrad.addColorStop(1, edgeColorTransp);
        ctx.fillStyle = lGrad;
        ctx.fillRect(rx, ry, edgeW, rh2);
        // Right edge
        const rGrad = ctx.createLinearGradient(rx + rw2 - edgeW, ry, rx + rw2, ry);
        rGrad.addColorStop(0, edgeColorTransp); rGrad.addColorStop(1, edgeColorSolid);
        ctx.fillStyle = rGrad;
        ctx.fillRect(rx + rw2 - edgeW, ry, edgeW, rh2);
        // Top edge
        const tGrad = ctx.createLinearGradient(rx, ry, rx, ry + edgeW);
        tGrad.addColorStop(0, edgeColorSolid); tGrad.addColorStop(1, edgeColorTransp);
        ctx.fillStyle = tGrad;
        ctx.fillRect(rx, ry, rw2, edgeW);
        // Bottom edge
        const bGrad = ctx.createLinearGradient(rx, ry + rh2 - edgeW, rx, ry + rh2);
        bGrad.addColorStop(0, edgeColorTransp); bGrad.addColorStop(1, edgeColorSolid);
        ctx.fillStyle = bGrad;
        ctx.fillRect(rx, ry + rh2 - edgeW, rw2, edgeW);
      });

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

      /* 2. City roads with proper sidewalks */
      const SIDEWALK_W = 1.8 * TILE; /* world units 1.8 → screen pixels */
      ROAD_DATA.forEach(road => {
        const isVert = road.x1 === road.x2;
        let sx1: number, sy1: number, sx2: number, sy2: number;
        if (isVert) {
          [sx1, sy1] = w2s(road.x1 - road.w / 2, Math.min(road.z1, road.z2));
          [sx2, sy2] = w2s(road.x1 + road.w / 2, Math.max(road.z1, road.z2));
        } else {
          [sx1, sy1] = w2s(Math.min(road.x1, road.x2), road.z1 - road.w / 2);
          [sx2, sy2] = w2s(Math.max(road.x1, road.x2), road.z1 + road.w / 2);
        }
        const rw = Math.abs(sx2 - sx1), rh = Math.abs(sy2 - sy1);
        const rx = Math.min(sx1, sx2), ry = Math.min(sy1, sy2);
        /* outer sidewalk strip: light concrete (Pokémon-style) */
        ctx.fillStyle = '#d0c8b8';
        ctx.fillRect(rx - SIDEWALK_W, ry - SIDEWALK_W, rw + SIDEWALK_W * 2, rh + SIDEWALK_W * 2);
        /* sidewalk flagstone hints */
        ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.lineWidth = 0.8;
        if (isVert) {
          for (let ty = ry - SIDEWALK_W; ty < ry + rh + SIDEWALK_W; ty += TILE * 1.2) {
            ctx.beginPath(); ctx.moveTo(rx - SIDEWALK_W, ty); ctx.lineTo(rx, ty); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(rx + rw, ty); ctx.lineTo(rx + rw + SIDEWALK_W, ty); ctx.stroke();
          }
        } else {
          for (let tx = rx - SIDEWALK_W; tx < rx + rw + SIDEWALK_W; tx += TILE * 1.2) {
            ctx.beginPath(); ctx.moveTo(tx, ry - SIDEWALK_W); ctx.lineTo(tx, ry); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(tx, ry + rh); ctx.lineTo(tx, ry + rh + SIDEWALK_W); ctx.stroke();
          }
        }
        /* curb edge (dark line between sidewalk and road) */
        ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2;
        ctx.strokeRect(rx, ry, rw, rh);
        /* road surface (medium grey - Pokémon style) */
        ctx.fillStyle = '#787878';
        ctx.fillRect(rx, ry, rw, rh);
        /* road edge stripes (white edge lines) */
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5;
        ctx.strokeRect(rx + 2, ry + 2, rw - 4, rh - 4);
        /* center dashes */
        const [mx1, my1] = isVert ? w2s(road.x1, Math.min(road.z1, road.z2)) : w2s(Math.min(road.x1, road.x2), road.z1);
        const [mx2, my2] = isVert ? w2s(road.x1, Math.max(road.z1, road.z2)) : w2s(Math.max(road.x1, road.x2), road.z1);
        ctx.strokeStyle = 'rgba(255,240,60,0.75)';
        ctx.lineWidth = 2;
        ctx.setLineDash([TILE * 1.5, TILE]);
        ctx.beginPath(); ctx.moveTo(mx1, my1); ctx.lineTo(mx2, my2); ctx.stroke();
        ctx.setLineDash([]);
      });

      /* 2b. Roundabouts at major intersections — grey ring + green center island */
      const ROUNDABOUT_DATA: { x: number; z: number; r: number }[] = [
        { x:   0, z:  15, r: 6.5 },  // Centro: Corso Principale ∩ Via del Centro
        { x:   0, z:  90, r: 5.5 },  // Corso Principale ∩ Via Commerciale
        { x:  90, z:  15, r: 5.0 },  // Viale Est ∩ Via del Centro
        { x: -90, z:  15, r: 5.0 },  // Viale Ovest ∩ Via del Centro
        { x:   0, z: 160, r: 5.5 },  // Corso Principale ∩ Via Sud Grande
      ];
      ROUNDABOUT_DATA.forEach(ra => {
        const [rax, ray] = w2s(ra.x, ra.z);
        const rR = ra.r * TILE;
        /* outer road ring */
        ctx.beginPath(); ctx.arc(rax, ray, rR, 0, Math.PI * 2);
        ctx.fillStyle = '#787878'; ctx.fill();
        /* edge line */
        ctx.beginPath(); ctx.arc(rax, ray, rR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
        /* dark outer border */
        ctx.beginPath(); ctx.arc(rax, ray, rR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2; ctx.stroke();
        /* green center island */
        const islandR = rR * 0.50;
        ctx.beginPath(); ctx.arc(rax, ray, islandR, 0, Math.PI * 2);
        ctx.fillStyle = '#52b830'; ctx.fill();
        /* island border */
        ctx.beginPath(); ctx.arc(rax, ray, islandR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,80,0,0.50)'; ctx.lineWidth = 1; ctx.stroke();
        /* island highlight patch */
        ctx.beginPath(); ctx.arc(rax - islandR * 0.2, ray - islandR * 0.2, islandR * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(120,220,60,0.30)'; ctx.fill();
      });

      /* Pedestrian crosswalks (zebra stripes at major intersections) */
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      CROSSWALK_DATA.forEach(cw => {
        const [cwx, cwz] = [cw.x, cw.z];
        const stripeW = TILE * 0.85;
        const stripeH = TILE * 0.32;
        const count = 5;
        if (cw.horiz) {
          /* horizontal crosswalk (pedestrians cross the road N-S) */
          const [startX, startY] = w2s(cwx - TILE * 3.5, cwz + TILE * 3.5);
          for (let s = 0; s < count; s++) {
            ctx.fillRect(startX + s * (stripeW + TILE * 0.18), startY, stripeW, stripeH);
          }
        } else {
          /* vertical crosswalk (pedestrians cross the road E-W) */
          const [startX2, startY2] = w2s(cwx - TILE * 3.5, cwz - TILE * 3.5);
          for (let s = 0; s < count; s++) {
            ctx.fillRect(startX2, startY2 + s * (stripeH + TILE * 0.18), stripeW, stripeH);
          }
        }
      });

      /* 3a. Urban canals / river strips */
      CANAL_DATA.forEach(canal => {
        const isVert = canal.x1 === canal.x2;
        let cx1: number, cy1: number, cx2: number, cy2: number;
        if (isVert) {
          [cx1, cy1] = w2s(canal.x1 - canal.w / 2, Math.min(canal.z1, canal.z2));
          [cx2, cy2] = w2s(canal.x1 + canal.w / 2, Math.max(canal.z1, canal.z2));
        } else {
          [cx1, cy1] = w2s(Math.min(canal.x1, canal.x2), canal.z1 - canal.w / 2);
          [cx2, cy2] = w2s(Math.max(canal.x1, canal.x2), canal.z1 + canal.w / 2);
        }
        const cw = Math.abs(cx2 - cx1), ch = Math.abs(cy2 - cy1);
        const crx = Math.min(cx1, cx2), cry = Math.min(cy1, cy2);
        /* canal water with animated ripple (vivid Pokémon blue) */
        const cWave = Math.sin(t * 1.1 + canal.x1 * 0.05) * 0.04;
        const cGrd = ctx.createLinearGradient(crx, cry, crx + cw, cry + ch);
        cGrd.addColorStop(0, `rgba(30,140,230,${0.90 + cWave})`);
        cGrd.addColorStop(0.5, `rgba(60,180,255,${0.85 + cWave})`);
        cGrd.addColorStop(1, `rgba(30,140,230,${0.90 + cWave})`);
        ctx.fillStyle = cGrd;
        ctx.fillRect(crx, cry, cw, ch);
        /* canal edge lines */
        ctx.strokeStyle = 'rgba(20,100,200,0.70)'; ctx.lineWidth = 1.5;
        ctx.strokeRect(crx, cry, cw, ch);
        /* animated shimmer lines */
        ctx.strokeStyle = 'rgba(160,230,255,0.45)'; ctx.lineWidth = 1.5;
        if (isVert) {
          const shimY = cry + ((t * 0.4 * TILE) % ch);
          ctx.setLineDash([TILE * 0.5, TILE * 0.8]);
          ctx.beginPath(); ctx.moveTo(crx + cw * 0.3, shimY); ctx.lineTo(crx + cw * 0.7, shimY + ch * 0.12); ctx.stroke();
          ctx.setLineDash([]);
        } else {
          const shimX = crx + ((t * 0.4 * TILE) % cw);
          ctx.setLineDash([TILE * 0.5, TILE * 0.8]);
          ctx.beginPath(); ctx.moveTo(shimX, cry + ch * 0.3); ctx.lineTo(shimX + cw * 0.12, cry + ch * 0.7); ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      /* 3b. Water patches (animated ripples + rotating shimmers) */
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
        /* water base (vivid Pokémon blue) */
        const wAlpha = 0.90 + Math.sin(t * 1.4 + wd.x) * 0.06;
        const waterGrad = ctx.createRadialGradient(wcx - sr * 0.2, wcy - sr * 0.15, 0, wcx, wcy, sr);
        waterGrad.addColorStop(0, `rgba(70,190,255,${wAlpha})`);
        waterGrad.addColorStop(0.6, `rgba(30,148,230,${wAlpha})`);
        waterGrad.addColorStop(1, `rgba(10,100,200,${wAlpha})`);
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
        const sway = Math.sin(t * 1.3 + f.x * 0.18) * fr * 0.08;
        /* bed shadow */
        ctx.beginPath(); ctx.ellipse(fx + sway + 2, fy + 2, fr * 1.05, fr * 0.45, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fill();
        /* grass bed base */
        ctx.beginPath(); ctx.ellipse(fx + sway, fy, fr * 0.95, fr * 0.42, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#2d6a18'; ctx.fill();
        /* petals — elliptical for natural look */
        const pAngle = t * 0.18 + f.x * 0.07;
        const nPetals = 6;
        for (let j = 0; j < nPetals; j++) {
          const ang = j * (Math.PI * 2 / nPetals) + pAngle;
          const petalDist = fr * 0.52;
          const px2 = fx + sway + Math.cos(ang) * petalDist;
          const py2 = fy + Math.sin(ang) * petalDist * 0.55;
          ctx.save();
          ctx.translate(px2, py2);
          ctx.rotate(ang);
          ctx.beginPath();
          ctx.ellipse(0, 0, fr * 0.38, fr * 0.22, 0, 0, Math.PI * 2);
          const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, fr * 0.38);
          pg.addColorStop(0, f.color + 'ff');
          pg.addColorStop(1, f.color + '88');
          ctx.fillStyle = pg; ctx.fill();
          ctx.restore();
        }
        /* center disc */
        ctx.beginPath(); ctx.arc(fx + sway, fy, fr * 0.24, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24'; ctx.fill();
        ctx.beginPath(); ctx.arc(fx + sway - fr * 0.06, fy - fr * 0.06, fr * 0.10, 0, Math.PI * 2);
        ctx.fillStyle = '#fde68a'; ctx.fill();
      });

      /* 4b. Park gravel paths + rural dirt sentieri */
      PARK_PATH_DATA.forEach(pp => {
        const isVert = Math.abs(pp.x2 - pp.x1) < 0.1;
        let ppx1: number, ppy1: number, ppx2: number, ppy2: number;
        if (isVert) {
          [ppx1, ppy1] = w2s(pp.x1 - pp.w / 2, Math.min(pp.z1, pp.z2));
          [ppx2, ppy2] = w2s(pp.x1 + pp.w / 2, Math.max(pp.z1, pp.z2));
        } else {
          [ppx1, ppy1] = w2s(Math.min(pp.x1, pp.x2), pp.z1 - pp.w / 2);
          [ppx2, ppy2] = w2s(Math.max(pp.x1, pp.x2), pp.z1 + pp.w / 2);
        }
        const ppw = Math.abs(ppx2 - ppx1), pph = Math.abs(ppy2 - ppy1);
        const pprx = Math.min(ppx1, ppx2), ppry = Math.min(ppy1, ppy2);
        if (pp.dirt) {
          /* dirt track: bright sandy-earth (Pokémon-style) */
          ctx.fillStyle = '#c8a060';
          ctx.fillRect(pprx, ppry, ppw, pph);
          /* dirt texture irregularities */
          ctx.fillStyle = 'rgba(90,55,20,0.22)';
          for (let gi = 0; gi < 8; gi++) {
            const gx2 = pprx + ((gi * 23 + 5) % Math.max(1, ppw));
            const gy2 = ppry + ((gi * 17 + 3) % Math.max(1, pph));
            ctx.beginPath(); ctx.ellipse(gx2, gy2, 3.5, 2.0, gi * 0.4, 0, Math.PI * 2); ctx.fill();
          }
          ctx.strokeStyle = 'rgba(80,50,15,0.35)'; ctx.lineWidth = 1;
          ctx.strokeRect(pprx, ppry, ppw, pph);
        } else {
          /* gravel base (light sandy gravel) */
          ctx.fillStyle = '#d8c898';
          ctx.fillRect(pprx, ppry, ppw, pph);
          /* gravel texture dots */
          ctx.fillStyle = 'rgba(110,90,55,0.22)';
          for (let gi = 0; gi < 5; gi++) {
            const gx2 = pprx + ((gi * 17 + 3) % Math.max(1, ppw));
            const gy2 = ppry + ((gi * 13 + 7) % Math.max(1, pph));
            ctx.beginPath(); ctx.arc(gx2, gy2, 1.5, 0, Math.PI * 2); ctx.fill();
          }
          /* edge */
          ctx.strokeStyle = 'rgba(90,70,35,0.40)'; ctx.lineWidth = 1;
          ctx.strokeRect(pprx, ppry, ppw, pph);
        }
      });

      /* 4c. Rural rivers and streams */
      RIVER_DATA.forEach(rv => {
        const isVert = Math.abs(rv.x2 - rv.x1) < 0.1;
        let rx1s: number, ry1s: number, rx2s: number, ry2s: number;
        if (isVert) {
          [rx1s, ry1s] = w2s(rv.x1 - rv.w / 2, Math.min(rv.z1, rv.z2));
          [rx2s, ry2s] = w2s(rv.x1 + rv.w / 2, Math.max(rv.z1, rv.z2));
        } else {
          [rx1s, ry1s] = w2s(Math.min(rv.x1, rv.x2), rv.z1 - rv.w / 2);
          [rx2s, ry2s] = w2s(Math.max(rv.x1, rv.x2), rv.z1 + rv.w / 2);
        }
        const rvW = Math.abs(rx2s - rx1s), rvH = Math.abs(ry2s - ry1s);
        const rvX = Math.min(rx1s, rx2s), rvY = Math.min(ry1s, ry2s);
        /* animated flow: offset by time */
        const flowOffset = (t * 18) % Math.max(1, isVert ? rvH : rvW);
        const rvGrd = isVert
          ? ctx.createLinearGradient(rvX, rvY, rvX + rvW, rvY)
          : ctx.createLinearGradient(rvX, rvY, rvX, rvY + rvH);
        const [rr, rg, rb] = hexToRgb(rv.color);
        rvGrd.addColorStop(0,   `rgba(${rr},${rg},${rb},0.75)`);
        rvGrd.addColorStop(0.5, `rgba(${Math.min(255,rr+30)},${Math.min(255,rg+30)},${Math.min(255,rb+40)},0.85)`);
        rvGrd.addColorStop(1,   `rgba(${rr},${rg},${rb},0.75)`);
        ctx.fillStyle = rvGrd;
        ctx.fillRect(rvX, rvY, rvW, rvH);
        /* ripple lines */
        ctx.strokeStyle = `rgba(${Math.min(255,rr+50)},${Math.min(255,rg+50)},${Math.min(255,rb+60)},0.40)`;
        ctx.lineWidth = 1;
        const rippleStep = isVert ? rvH / 4 : rvW / 4;
        for (let ri = 0; ri < 4; ri++) {
          const rOff = ((ri * rippleStep) + flowOffset) % Math.max(1, isVert ? rvH : rvW);
          if (isVert) {
            ctx.beginPath(); ctx.moveTo(rvX, rvY + rOff); ctx.lineTo(rvX + rvW, rvY + rOff); ctx.stroke();
          } else {
            ctx.beginPath(); ctx.moveTo(rvX + rOff, rvY); ctx.lineTo(rvX + rOff, rvY + rvH); ctx.stroke();
          }
        }
        /* bank shadows */
        ctx.strokeStyle = 'rgba(0,0,0,0.20)'; ctx.lineWidth = 1.5;
        ctx.strokeRect(rvX, rvY, rvW, rvH);
      });

      /* 4d. Waving grass strips (Campagna Ovest + Pianura Rurale + Bosco undergrowth) */
      GRASS_STRIP_DATA.forEach((gs) => {
        const [gsx, gsy] = w2s(gs.x, gs.z);
        const wave = Math.sin(t * 2.2 + gs.x * 0.3 + gs.z * 0.2) * 0.5;
        const isBosco = gs.z < -72 && gs.x < -92;
        const bladeColor = isBosco ? '#2e6018' : '#72aa30';
        const bladeCount = 7;
        ctx.save();
        ctx.translate(gsx, gsy);
        for (let bi = 0; bi < bladeCount; bi++) {
          const bx = (bi - bladeCount / 2) * 3.5;
          const bWave = wave + Math.sin(t * 3.1 + bi * 1.1) * 0.3;
          const bh = (TILE * 0.55) + (bi % 3) * 2;
          ctx.strokeStyle = bladeColor;
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = 0.65;
          ctx.beginPath();
          ctx.moveTo(bx, 0);
          ctx.quadraticCurveTo(bx + bWave * 4, -bh * 0.5, bx + bWave * 7, -bh);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      });

      /* 5-7. (walls/hedges/boulders replaced by city roads and buildings) */

      /* 8. Lamp posts — pre-compute night alpha here for use in sprites */
      const lampDayP = (t / 300) % 1;
      const lampNightA = lampDayP >= 0.87 ? 1 : lampDayP < 0.15 ? 1 : lampDayP > 0.75 ? (lampDayP - 0.75) / 0.12 : 0;

      /* 9. Waving grass (handled above in 4d) */

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

      /* animated city cars */
      const px_c = playerRef.current.x, pz_c = playerRef.current.z;
      CAR_DATA.forEach((car) => {
        const progress = ((t * car.speed + car.phase) % 1 + 1) % 1;
        const pos = car.from + (car.to - car.from) * progress;
        const wx = car.axis === 'z' ? car.fixed : pos;
        const wz = car.axis === 'x' ? car.fixed : pos;
        const carDist = Math.sqrt((wx - px_c) ** 2 + (wz - pz_c) ** 2);
        const isHonking = carDist < 9;
        sprites.push({ z: wz, draw: () => {
          const [csx, csy] = w2s(wx, wz);
          const cW = car.len * TILE; const cH = car.wid * TILE;
          const isHoriz = car.axis === 'x';
          const hDir = car.to > car.from ? 1 : -1;
          ctx.save();
          ctx.translate(csx, csy);
          if (isHoriz) ctx.rotate(Math.PI / 2);

          /* shadow (offset slightly in travel direction) */
          ctx.beginPath();
          ctx.ellipse(hDir * 3, cW * 0.1, cW * 0.48, cH * 0.28, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();

          /* body gradient */
          const bodyGrd = ctx.createLinearGradient(-cW / 2, 0, cW / 2, 0);
          const [cr, cg, cb] = hexToRgb(car.color);
          bodyGrd.addColorStop(0,   `rgb(${Math.max(0,cr-30)},${Math.max(0,cg-30)},${Math.max(0,cb-30)})`);
          bodyGrd.addColorStop(0.35, car.color);
          bodyGrd.addColorStop(0.65, `rgb(${Math.min(255,cr+30)},${Math.min(255,cg+30)},${Math.min(255,cb+30)})`);
          bodyGrd.addColorStop(1,   `rgb(${Math.max(0,cr-20)},${Math.max(0,cg-20)},${Math.max(0,cb-20)})`);
          rrect(ctx, -cW / 2, -cH / 2, cW, cH, 6);
          ctx.fillStyle = bodyGrd; ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();

          /* roof / cabin (darker inset rectangle — visible from above) */
          const roofW = cW * 0.52, roofH = cH * 0.72;
          const roofX = -roofW / 2, roofY = -roofH / 2;
          ctx.fillStyle = `rgba(${Math.max(0,cr-55)},${Math.max(0,cg-55)},${Math.max(0,cb-55)},0.82)`;
          rrect(ctx, roofX, roofY, roofW, roofH, 3);
          ctx.fill();

          /* windshield (front glass) */
          const frontZ = hDir > 0 ? roofY : roofY + roofH;
          ctx.fillStyle = 'rgba(160,215,255,0.65)';
          rrect(ctx, roofX + 2, frontZ + (hDir > 0 ? 0 : -roofH * 0.36), roofW - 4, roofH * 0.36, 3);
          ctx.fill();

          /* rear window */
          const rearZ = hDir > 0 ? roofY + roofH - roofH * 0.3 : roofY;
          ctx.fillStyle = 'rgba(100,170,220,0.45)';
          rrect(ctx, roofX + 3, rearZ, roofW - 6, roofH * 0.28, 2);
          ctx.fill();

          /* wheel arches (4 corners) */
          const archR = cH * 0.38;
          const wOffs = cW * 0.32;
          ctx.fillStyle = 'rgba(30,30,30,0.75)';
          [[-wOffs, -cH * 0.42], [wOffs, -cH * 0.42], [-wOffs, cH * 0.42], [wOffs, cH * 0.42]].forEach(([ax, az]) => {
            ctx.beginPath(); ctx.arc(ax as number, az as number, archR, 0, Math.PI * 2); ctx.fill();
          });
          /* wheel shine */
          ctx.fillStyle = 'rgba(180,180,180,0.35)';
          [[-wOffs, -cH * 0.42], [wOffs, -cH * 0.42], [-wOffs, cH * 0.42], [wOffs, cH * 0.42]].forEach(([ax, az]) => {
            ctx.beginPath(); ctx.arc((ax as number) - archR * 0.15, (az as number) - archR * 0.15, archR * 0.4, 0, Math.PI * 2); ctx.fill();
          });

          /* headlights (front) — round, bright */
          const frontEdge = hDir > 0 ? -cW / 2 + 3 : cW / 2 - 3;
          ctx.fillStyle = 'rgba(255,255,210,0.95)';
          [[-cH * 0.28], [cH * 0.28]].forEach(([side]) => {
            ctx.beginPath(); ctx.arc(frontEdge, side as number, cH * 0.16, 0, Math.PI * 2); ctx.fill();
          });
          /* headlight inner glow */
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          [[-cH * 0.28], [cH * 0.28]].forEach(([side]) => {
            ctx.beginPath(); ctx.arc(frontEdge, side as number, cH * 0.07, 0, Math.PI * 2); ctx.fill();
          });

          /* taillights (back) — red */
          const rearEdge = hDir > 0 ? cW / 2 - 3 : -cW / 2 + 3;
          ctx.fillStyle = 'rgba(220,40,40,0.9)';
          [[-cH * 0.26], [cH * 0.26]].forEach(([side]) => {
            ctx.beginPath(); ctx.arc(rearEdge, side as number, cH * 0.13, 0, Math.PI * 2); ctx.fill();
          });

          ctx.restore();

          /* honk bubble — drawn in world space, not rotated */
          if (isHonking) {
            const bubbleX = csx;
            const bubbleY = csy - cH * 0.9 - TILE * 0.4;
            const pulse = 0.9 + Math.sin(t * 10) * 0.1;
            ctx.save();
            ctx.translate(bubbleX, bubbleY);
            ctx.scale(pulse, pulse);
            /* bubble bg */
            rrect(ctx, -22, -14, 44, 20, 8);
            ctx.fillStyle = 'rgba(255,255,240,0.92)'; ctx.fill();
            ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5; ctx.stroke();
            /* tail */
            ctx.beginPath();
            ctx.moveTo(-5, 5); ctx.lineTo(5, 5); ctx.lineTo(0, 14); ctx.closePath();
            ctx.fillStyle = 'rgba(255,255,240,0.92)'; ctx.fill();
            ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1; ctx.stroke();
            /* text */
            ctx.fillStyle = '#92400e';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('📯 BEEP!', 0, 0);
            ctx.restore();
          }
        }});
      });

      /* Porto canal boats */
      BOAT_DATA.forEach((boat) => {
        const bProgress = ((t * boat.speed + boat.phase) % 1 + 1) % 1;
        const bPos = boat.from + (boat.to - boat.from) * bProgress;
        const bwx = boat.axis === 'z' ? boat.fixed : bPos;
        const bwz = boat.axis === 'x' ? boat.fixed : bPos;
        sprites.push({ z: bwz, draw: () => {
          const [bsx, bsy] = w2s(bwx, bwz);
          const bW = boat.len * TILE; const bH = boat.wid * TILE;
          const isHoriz = boat.axis === 'x';
          ctx.save();
          ctx.translate(bsx, bsy);
          if (isHoriz) ctx.rotate(Math.PI / 2);
          /* water wake */
          const wakeDir = boat.to > boat.from ? 1 : -1;
          const wakeGrd = ctx.createLinearGradient(0, -bW / 2, 0, -bW / 2 - bW * 0.8);
          wakeGrd.addColorStop(0, 'rgba(120,200,255,0.35)'); wakeGrd.addColorStop(1, 'rgba(120,200,255,0)');
          ctx.beginPath();
          ctx.moveTo(-bH * 0.5, -bW / 2 * wakeDir);
          ctx.lineTo( bH * 0.5, -bW / 2 * wakeDir);
          ctx.lineTo(0, -bW / 2 * wakeDir - bW * 0.8 * wakeDir);
          ctx.closePath();
          ctx.fillStyle = wakeGrd; ctx.fill();
          /* hull */
          ctx.beginPath();
          ctx.moveTo(-bH * 0.45, -bW / 2);
          ctx.lineTo( bH * 0.45, -bW / 2);
          ctx.lineTo( bH * 0.4,  bW / 2);
          ctx.lineTo(-bH * 0.4,  bW / 2);
          ctx.closePath();
          ctx.fillStyle = boat.color; ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
          /* cabin */
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillRect(-bH * 0.15, -bW * 0.3, bH * 0.3, bW * 0.45);
          /* mast */
          ctx.strokeStyle = '#8b7355'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(0, -bW * 0.35); ctx.lineTo(0, -bW * 0.85); ctx.stroke();
          ctx.restore();
        }});
      });

      /* lamp posts (Z-sorted) */
      LAMP_DATA.forEach((l) => {
        sprites.push({ z: l.z, draw: () => {
          const [lx, ly] = w2s(l.x, l.z);
          const lampGlX = lx + 0.6 * TILE; const lampGlY = ly - 1.8 * TILE;
          /* large night pool of light */
          if (lampNightA > 0.05) {
            const poolR = 3.8 * TILE;
            const poolGrad = ctx.createRadialGradient(lampGlX, lampGlY, 0, lampGlX, lampGlY, poolR);
            const poolInt = lampNightA * 0.26;
            poolGrad.addColorStop(0, `rgba(255,235,120,${poolInt * 2.2})`);
            poolGrad.addColorStop(0.3, `rgba(255,215,80,${poolInt * 1.4})`);
            poolGrad.addColorStop(0.6, `rgba(255,190,40,${poolInt * 0.6})`);
            poolGrad.addColorStop(1, 'rgba(255,170,20,0)');
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
        }});
      });

      /* park benches (Z-sorted) */
      BENCH_DATA.forEach((bench) => {
        sprites.push({ z: bench.z, draw: () => {
          const [bx, by] = w2s(bench.x, bench.z);
          const isHoriz = bench.rot > 0.5;
          const bW = isHoriz ? TILE * 0.55 : TILE * 1.4;
          const bH = isHoriz ? TILE * 1.4 : TILE * 0.55;

          /* shadow */
          const bshG = ctx.createLinearGradient(bx - bW / 2 + 3, by - bH / 2 + 4, bx + bW / 2 + 3, by + bH / 2 + 4);
          bshG.addColorStop(0, 'rgba(0,0,0,0.20)'); bshG.addColorStop(1, 'rgba(0,0,0,0.06)');
          ctx.fillStyle = bshG;
          ctx.fillRect(bx - bW / 2 + 3, by - bH / 2 + 4, bW, bH);

          /* ── seat (wooden slats with gradient) ── */
          const seatH = bH * 0.48;
          const seatY = by - bH * 0.14;
          const nSlats = isHoriz ? 3 : 4;
          const slatColors = ['#a0762a', '#8b6320', '#9e7128', '#7a5518'];
          for (let sl = 0; sl < nSlats; sl++) {
            const slW = bW / nSlats - 1;
            const slX = bx - bW / 2 + sl * (bW / nSlats);
            ctx.fillStyle = slatColors[sl % slatColors.length];
            rrect(ctx, slX, seatY - seatH / 2, slW, seatH, 1); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(slX + slW, seatY - seatH / 2); ctx.lineTo(slX + slW, seatY + seatH / 2); ctx.stroke();
          }
          /* seat top highlight */
          ctx.fillStyle = 'rgba(255,220,150,0.18)';
          ctx.fillRect(bx - bW / 2, seatY - seatH / 2, bW, seatH * 0.3);

          /* ── backrest ── */
          const brY = seatY - seatH / 2 - 5;
          const brH = bH * 0.28;
          ctx.fillStyle = '#8b6320';
          ctx.fillRect(bx - bW / 2, brY - brH, bW, brH);
          ctx.fillStyle = '#a07828';
          ctx.fillRect(bx - bW / 2, brY - brH, bW, brH * 0.4);
          /* backrest divider lines */
          ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.8;
          for (let si = 1; si < nSlats; si++) {
            const sx2 = bx - bW / 2 + si * (bW / nSlats);
            ctx.beginPath(); ctx.moveTo(sx2, brY - brH); ctx.lineTo(sx2, brY); ctx.stroke();
          }
          /* metal outline */
          ctx.strokeStyle = '#4a3510'; ctx.lineWidth = 1;
          ctx.strokeRect(bx - bW / 2, brY - brH, bW, brH);

          /* ── metal armrests ── */
          const armColor = '#3a3a3a';
          ctx.fillStyle = armColor;
          ctx.fillRect(bx - bW / 2 - 2, brY - brH, 4, brH + seatH + 6);
          ctx.fillRect(bx + bW / 2 - 2, brY - brH, 4, brH + seatH + 6);

          /* ── legs ── */
          ctx.fillStyle = '#2a2a2a';
          ctx.fillRect(bx - bW / 2 + 3, seatY + seatH / 2, 3, bH * 0.22);
          ctx.fillRect(bx + bW / 2 - 6, seatY + seatH / 2, 3, bH * 0.22);
        }});
      });

      /* traffic lights */
      const lightCycle = (t / 18) % 1;
      const isRed = lightCycle < 0.46;
      const isYellow = lightCycle >= 0.46 && lightCycle < 0.54;
      const lightColor = isRed ? '#ef4444' : isYellow ? '#fbbf24' : '#22c55e';
      TRAFFIC_LIGHT_DATA.forEach(tl => {
        sprites.push({ z: tl.z, draw: () => {
          const [tlx, tly] = w2s(tl.x, tl.z);
          ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(tlx, tly + 6); ctx.lineTo(tlx, tly - 18); ctx.stroke();
          ctx.fillStyle = '#111';
          rrect(ctx, tlx - 4, tly - 18, 8, 14, 2); ctx.fill();
          const lY = isRed ? tly - 15 : isYellow ? tly - 11 : tly - 7;
          ctx.beginPath(); ctx.arc(tlx, lY, 3, 0, Math.PI * 2);
          ctx.fillStyle = lightColor; ctx.fill();
          if (_nightAlpha > 0.05) {
            const glGrd = ctx.createRadialGradient(tlx, lY, 0, tlx, lY, 9);
            glGrd.addColorStop(0, lightColor + '55'); glGrd.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.beginPath(); ctx.arc(tlx, lY, 9, 0, Math.PI * 2);
            ctx.fillStyle = glGrd; ctx.fill();
          }
        }});
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

      /* Stage 13 – Human Boss Arena */
      const s13state = stage13StatusRef.current;
      const s13Visible = s13state?.visibleStage;
      const s13My = s13state?.myStage;
      if (s13Visible || s13My) {
        const [s13x, s13z] = STAGE13_WORLD_POS;
        sprites.push({ z: s13z, draw: () => {
          const [cx, cy] = w2s(s13x, s13z);
          const stage = s13Visible || s13My;
          const color = stage?.stageColor || '#7c3aed';
          const bW = 3.5 * TILE; const bH = 4.0 * TILE;
          const pulse = 0.5 + Math.sin(t * 2.5) * 0.2;

          // Glow
          ctx.save();
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, bW * 1.2);
          grad.addColorStop(0, color + '44');
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(cx, cy, bW * 1.2, 0, Math.PI * 2); ctx.fill();

          // Pulsing ring
          ctx.beginPath(); ctx.arc(cx, cy, bW * 0.8, 0, Math.PI * 2);
          ctx.strokeStyle = color + Math.round(pulse * 255).toString(16).padStart(2, '0');
          ctx.lineWidth = 3; ctx.stroke();

          // Top face (roof)
          const sideW = Math.round(bW * 0.15);
          const wallH = Math.round(bH * 0.28);
          const topY = cy - bH / 2;
          ctx.fillStyle = color + 'cc';
          ctx.fillRect(cx - bW / 2, topY, bW - sideW, bH - wallH);

          // Side wall
          ctx.fillStyle = color + '77';
          ctx.fillRect(cx + bW / 2 - sideW, topY + wallH * 0.3, sideW, bH - wallH);

          // Crown emoji at top
          ctx.font = `${Math.round(TILE * 0.9)}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('👑', cx, topY - TILE * 0.6);

          // Label
          const label = s13Visible
            ? `${stage.stageName} 👑`
            : `Il tuo Stage 👑`;
          const labelW = Math.max(110, label.length * 7);
          ctx.fillStyle = 'rgba(5,5,20,0.88)';
          rrect(ctx, cx - labelW / 2, cy + bH / 2 + 4, labelW, 18, 5); ctx.fill();
          ctx.strokeStyle = color + 'aa'; ctx.lineWidth = 1; ctx.stroke();
          ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = color;
          ctx.fillText(label.substring(0, 20), cx, cy + bH / 2 + 13);
          ctx.restore();
        }});
      }

      /* Secret Room — shown only after all leaders completed */
      if (allLeadersCompletedRef.current) {
        const [srx, srz] = SECRET_ROOM_WORLD_POS;
        sprites.push({ z: srz, draw: () => {
          const [cx, cy] = w2s(srx, srz);
          const pulse = 0.5 + Math.sin(t * 2.0) * 0.3;
          const glow  = 0.5 + Math.sin(t * 1.3) * 0.3;
          const bW = 3.0 * TILE;
          const bH = 3.6 * TILE;

          ctx.save();

          // Outer golden glow
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, bW * 1.4);
          grad.addColorStop(0, `rgba(251,191,36,${glow * 0.35})`);
          grad.addColorStop(0.5, `rgba(245,158,11,${glow * 0.15})`);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(cx, cy, bW * 1.4, 0, Math.PI * 2); ctx.fill();

          // Pulsing golden ring
          ctx.beginPath(); ctx.arc(cx, cy, bW * 0.85, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(251,191,36,${pulse * 0.8})`;
          ctx.lineWidth = 2.5; ctx.stroke();

          // Building body — dark stone
          const topY = cy - bH / 2;
          const sideW = Math.round(bW * 0.12);
          const wallH = Math.round(bH * 0.25);

          // Front wall (darker mossy stone)
          ctx.fillStyle = '#1c1a2e';
          ctx.fillRect(cx - bW / 2, topY + wallH, bW - sideW, bH - wallH);

          // Roof (golden stone)
          ctx.fillStyle = '#78350f';
          ctx.fillRect(cx - bW / 2, topY, bW - sideW, wallH);

          // Side wall (shadow)
          ctx.fillStyle = '#0f0e1a';
          ctx.fillRect(cx + bW / 2 - sideW, topY + wallH * 0.4, sideW, bH - wallH);

          // Arch door
          const doorW = bW * 0.28;
          const doorH = bH * 0.42;
          const doorX = cx - doorW / 2;
          const doorY = cy + bH / 2 - doorH - wallH * 0.1;
          const archRadius = doorW / 2;

          // Door fill — glowing gold interior
          ctx.fillStyle = `rgba(251,191,36,${0.15 + glow * 0.25})`;
          ctx.beginPath();
          ctx.arc(cx, doorY + archRadius, archRadius, Math.PI, 0);
          ctx.lineTo(doorX + doorW, doorY + doorH);
          ctx.lineTo(doorX, doorY + doorH);
          ctx.closePath();
          ctx.fill();

          // Door outline — golden
          ctx.strokeStyle = `rgba(251,191,36,${0.6 + pulse * 0.3})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, doorY + archRadius, archRadius, Math.PI, 0);
          ctx.lineTo(doorX + doorW, doorY + doorH);
          ctx.lineTo(doorX, doorY + doorH);
          ctx.closePath();
          ctx.stroke();

          // Lock icon in door centre
          ctx.font = `${Math.round(TILE * 0.55)}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('🔑', cx, doorY + doorH * 0.55);

          // Label badge
          const label = secretRevealedRef.current ? '🚪 La Stanza Segreta' : '???';
          const labelW = Math.max(90, label.length * (secretRevealedRef.current ? 7.5 : 9));
          ctx.fillStyle = 'rgba(5,4,20,0.9)';
          rrect(ctx, cx - labelW / 2, cy + bH / 2 + 4, labelW, 18, 5); ctx.fill();
          ctx.strokeStyle = `rgba(251,191,36,${0.5 + pulse * 0.4})`; ctx.lineWidth = 1; ctx.stroke();
          ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = `rgb(251,191,36)`;
          ctx.fillText(label, cx, cy + bH / 2 + 13);

          ctx.restore();
        }});
      }

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
          /* pseudo-3D dimensions */
          const sideW = Math.round(bW * 0.14);
          const wallH  = Math.round(bH * 0.28);
          const roofH2 = bH - wallH;
          const fLeft  = bx - bW / 2;
          const fRight = bx + bW / 2 - sideW;
          const sRight = bx + bW / 2;
          const topY   = by - bH / 2;
          const wallY  = by + bH / 2 - wallH;
          const botY   = by + bH / 2;

          /* directional shadow */
          const [bSunX, bSunZ] = getSunVec(t);
          ctx.beginPath();
          ctx.ellipse(bx + bSunX * bW * 0.28 + 3, by + bH * 0.32 + bSunZ * bH * 0.18, bW * 0.44, bH * 0.14, 0.08, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill();

          /* RIGHT SIDE WALL */
          const sideGrd2 = ctx.createLinearGradient(fRight, 0, sRight, 0);
          sideGrd2.addColorStop(0, darken(colors.body, 45));
          sideGrd2.addColorStop(1, darken(colors.body, 65));
          ctx.fillStyle = sideGrd2;
          ctx.beginPath(); ctx.roundRect(fRight, topY, sideW, bH, [0, 3, 3, 0]); ctx.fill();

          /* FRONT WALL (bottom portion) */
          const frontGrd2 = ctx.createLinearGradient(fLeft, wallY, fLeft, botY);
          frontGrd2.addColorStop(0, darken(colors.body, 12));
          frontGrd2.addColorStop(1, darken(colors.body, 32));
          ctx.fillStyle = frontGrd2;
          ctx.beginPath(); ctx.roundRect(fLeft, wallY, fRight - fLeft, wallH, [0, 0, 3, 3]); ctx.fill();

          /* ROOF / TOP FACE */
          const roofGrd3 = ctx.createLinearGradient(fLeft, topY, fRight, wallY);
          roofGrd3.addColorStop(0, lighten(colors.roof, 28));
          roofGrd3.addColorStop(0.6, colors.roof);
          roofGrd3.addColorStop(1, darken(colors.roof, 15));
          ctx.fillStyle = roofGrd3;
          ctx.beginPath(); ctx.roundRect(fLeft, topY, fRight - fLeft, roofH2, [5, 3, 0, 5]); ctx.fill();
          /* subtle tile lines on roof */
          ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 1;
          for (let li2 = 1; li2 <= 2; li2++) {
            const ly2 = topY + (roofH2 * li2) / 3;
            ctx.beginPath(); ctx.moveTo(fLeft + 3, ly2); ctx.lineTo(fRight - 3, ly2); ctx.stroke();
          }
          /* eave line */
          ctx.beginPath(); ctx.moveTo(fLeft + 3, wallY); ctx.lineTo(fRight, wallY);
          ctx.strokeStyle = 'rgba(0,0,0,0.20)'; ctx.lineWidth = 1.5; ctx.stroke();

          /* outlines */
          ctx.strokeStyle = darken(colors.body, 48); ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(fLeft, topY, fRight - fLeft, bH, [5, 0, 3, 5]); ctx.stroke();
          ctx.beginPath(); ctx.roundRect(fRight, topY, sideW, bH, [0, 3, 3, 0]); ctx.stroke();

          /* type-specific details */
          if (bld.type === 'farm') {
            /* Farm: hay window in loft + wooden fence post detail */
            ctx.fillStyle = '#8b6520aa';
            ctx.beginPath();
            ctx.arc(bx - sideW / 2, topY + roofH2 * 0.45, bW * 0.14, 0, Math.PI * 2); ctx.fill();
            /* silo hint (vertical stripe on side) */
            ctx.strokeStyle = 'rgba(160,120,60,0.4)'; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(fRight - 2, topY + 4); ctx.lineTo(fRight - 2, wallY - 2); ctx.stroke();
          } else if (bld.type === 'barn') {
            /* Barn: classic X cross-brace on door */
            ctx.strokeStyle = 'rgba(80,40,10,0.55)'; ctx.lineWidth = 1.5;
            const db2Left = bx - bW * 0.20 - sideW / 2;
            const db2Right = bx + bW * 0.02 - sideW / 2;
            const db2Top = botY - wallH * 0.82;
            ctx.beginPath(); ctx.moveTo(db2Left, botY); ctx.lineTo(db2Right, db2Top); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(db2Right, botY); ctx.lineTo(db2Left, db2Top); ctx.stroke();
            /* hay color accent on roof */
            ctx.fillStyle = 'rgba(220,180,60,0.22)';
            ctx.fillRect(fLeft + 4, topY + 2, (fRight - fLeft) * 0.5, roofH2 * 0.4);
          } else if (bld.type === 'ruin') {
            ctx.strokeStyle = 'rgba(0,0,0,0.32)'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(bx - bW * 0.2, by - bH * 0.28); ctx.lineTo(bx - bW * 0.05, by + bH * 0.22); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx + bW * 0.15, by - bH * 0.1); ctx.lineTo(bx + bW * 0.3, by + bH * 0.28); ctx.stroke();
          } else if (bld.type === 'church') {
            ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(bx - sideW / 2, by - bH / 2 - 10); ctx.lineTo(bx - sideW / 2, by - bH / 2 + 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx - sideW / 2 - 5, by - bH / 2 - 5); ctx.lineTo(bx - sideW / 2 + 5, by - bH / 2 - 5); ctx.stroke();
          } else if (bld.type === 'tower') {
            for (let ti = -1; ti <= 1; ti++) {
              ctx.fillStyle = colors.roof;
              rrect(ctx, bx + ti * bW * 0.22 - sideW / 2 - 4, topY - 8, 7, 8, 1); ctx.fill();
            }
          } else if (bld.type === 'inn') {
            ctx.strokeStyle = '#7a2020'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(fRight - 2, topY); ctx.lineTo(fRight - 2, topY - 11); ctx.stroke();
            ctx.fillStyle = '#ff3333';
            ctx.beginPath(); ctx.moveTo(fRight - 2, topY - 11); ctx.lineTo(fRight + 9, topY - 7); ctx.lineTo(fRight - 2, topY - 3); ctx.fill();
          } else if (bld.type === 'shop') {
            ctx.fillStyle = '#f97316aa';
            ctx.fillRect(fLeft, wallY - 4, fRight - fLeft, 4);
            /* shop awning stripes */
            ctx.fillStyle = 'rgba(255,255,255,0.20)';
            for (let si2 = 0; si2 < 4; si2++) {
              ctx.fillRect(fLeft + si2 * (fRight - fLeft) / 4, wallY - 4, (fRight - fLeft) / 8, 4);
            }
          }
          /* chimney for house/inn */
          if (bld.type === 'house' || bld.type === 'inn') {
            ctx.fillStyle = darken(colors.roof, 30);
            ctx.fillRect(bx - bW * 0.1, topY - 7, 5, 7);
            ctx.fillStyle = darken(colors.roof, 50);
            ctx.fillRect(bx - bW * 0.12, topY - 8, 9, 2);
          }

          /* arched door */
          const doorW2 = bW * 0.22; const doorH2 = wallH * 0.80;
          ctx.fillStyle = darken(colors.body, 60);
          ctx.fillRect(bx - doorW2 / 2 - sideW / 2, botY - doorH2, doorW2, doorH2);
          ctx.beginPath(); ctx.arc(bx - sideW / 2, botY - doorH2, doorW2 / 2, Math.PI, 0); ctx.fill();
          /* door highlight */
          ctx.fillStyle = 'rgba(255,255,255,0.07)';
          ctx.fillRect(bx - doorW2 / 2 - sideW / 2 + 2, botY - doorH2 + 2, doorW2 * 0.4, doorH2 * 0.5);
          /* door handle */
          ctx.beginPath(); ctx.arc(bx - sideW / 2 + doorW2 * 0.24, botY - doorH2 * 0.38, 2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,240,160,0.7)'; ctx.fill();

          /* windows with glass glint */
          if (bld.type !== 'ruin') {
            const winRowY = wallY + wallH * 0.25;
            [bx - bW * 0.20 - sideW / 2, bx + bW * 0.08 - sideW / 2].forEach(wx2 => {
              const wW2 = 10; const wH2 = 9;
              /* night: warm orange-yellow window glow behind frame */
              if (_nightAlpha > 0.05) {
                const winGlR = wW2 * 2.2;
                const winGlGrd = ctx.createRadialGradient(wx2, winRowY, 0, wx2, winRowY, winGlR);
                const winGlA = _nightAlpha * 0.55;
                winGlGrd.addColorStop(0, `rgba(255,200,80,${winGlA})`);
                winGlGrd.addColorStop(0.5, `rgba(255,160,40,${winGlA * 0.5})`);
                winGlGrd.addColorStop(1, 'rgba(255,120,20,0)');
                ctx.beginPath(); ctx.arc(wx2, winRowY, winGlR, 0, Math.PI * 2);
                ctx.fillStyle = winGlGrd; ctx.fill();
              }
              ctx.fillStyle = _nightAlpha > 0.05 ? `rgba(255,200,80,0.88)` : darken(colors.body, 55);
              ctx.fillRect(wx2 - wW2 / 2 - 1, winRowY - wH2 / 2 - 1, wW2 + 2, wH2 + 2);
              const wgGrd = ctx.createRadialGradient(wx2, winRowY, 0, wx2, winRowY, wW2);
              if (_nightAlpha > 0.05) {
                wgGrd.addColorStop(0, `rgba(255,240,160,${0.85 + _nightAlpha * 0.10})`);
                wgGrd.addColorStop(1, `rgba(255,180,60,${0.60 + _nightAlpha * 0.15})`);
              } else {
                wgGrd.addColorStop(0, 'rgba(255,255,190,0.65)');
                wgGrd.addColorStop(1, 'rgba(140,210,255,0.12)');
              }
              ctx.fillStyle = wgGrd;
              ctx.fillRect(wx2 - wW2 / 2, winRowY - wH2 / 2, wW2, wH2);
              ctx.strokeStyle = 'rgba(200,200,140,0.35)'; ctx.lineWidth = 0.8;
              ctx.beginPath(); ctx.moveTo(wx2, winRowY - wH2 / 2); ctx.lineTo(wx2, winRowY + wH2 / 2); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(wx2 - wW2 / 2, winRowY); ctx.lineTo(wx2 + wW2 / 2, winRowY); ctx.stroke();
              /* glass shine dot */
              ctx.fillStyle = 'rgba(255,255,255,0.45)';
              ctx.beginPath(); ctx.arc(wx2 - wW2 * 0.2, winRowY - wH2 * 0.2, 1.5, 0, Math.PI * 2); ctx.fill();
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

          /* same proportions as player */
          const opbW = 0.55 * TILE;
          const opbH = 0.72 * TILE;
          const ophr = 0.28 * TILE;
          const oplegH = opbH * 0.45;
          const oparmW = opbW * 0.28; const oparmH = opbH * 0.55;

          /* shadow */
          const opSh = ctx.createRadialGradient(osx + 2, osy + 6, 0, osx + 2, osy + 6, opbW * 0.9);
          opSh.addColorStop(0, 'rgba(0,0,0,0.30)'); opSh.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.beginPath(); ctx.ellipse(osx + 2, osy + 6, opbW * 0.9, opbW * 0.38, 0, 0, Math.PI * 2);
          ctx.fillStyle = opSh; ctx.fill();

          /* shoes */
          ctx.fillStyle = '#111827';
          rrect(ctx, osx - opbW * 0.5, osy + 2, opbW * 0.4, 3, 1); ctx.fill();
          rrect(ctx, osx + opbW * 0.1, osy + 2, opbW * 0.4, 3, 1); ctx.fill();

          /* legs */
          ctx.fillStyle = '#1e3a5f';
          ctx.fillRect(osx - opbW * 0.48, osy - oplegH * 0.5, opbW * 0.38, oplegH);
          ctx.fillRect(osx + opbW * 0.10, osy - oplegH * 0.5, opbW * 0.38, oplegH);

          /* arms */
          ctx.fillStyle = '#1d4ed8';
          rrect(ctx, osx - opbW / 2 - oparmW + 1, osy - opbH * 0.8, oparmW, oparmH, 1); ctx.fill();
          rrect(ctx, osx + opbW / 2 - 1,           osy - opbH * 0.8, oparmW, oparmH, 1); ctx.fill();
          ctx.fillStyle = '#f4c07c';
          ctx.beginPath(); ctx.arc(osx - opbW / 2 - oparmW * 0.3, osy - opbH * 0.25, oparmW * 0.38, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(osx + opbW / 2 + oparmW * 0.3, osy - opbH * 0.25, oparmW * 0.38, 0, Math.PI * 2); ctx.fill();

          /* torso */
          const opTG = ctx.createLinearGradient(osx - opbW / 2, osy - opbH, osx + opbW / 2, osy - oplegH * 0.5);
          opTG.addColorStop(0, '#2563eb'); opTG.addColorStop(0.5, '#1d4ed8'); opTG.addColorStop(1, '#1e40af');
          rrect(ctx, osx - opbW / 2, osy - opbH + 3, opbW, opbH - oplegH * 0.5, 2);
          ctx.fillStyle = opTG; ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.20)'; ctx.lineWidth = 0.7; ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.07)';
          rrect(ctx, osx - opbW * 0.46, osy - opbH + 4, opbW * 0.44, opbH * 0.7, 1); ctx.fill();

          /* neck */
          ctx.fillStyle = '#e5a865';
          ctx.fillRect(osx - opbW * 0.16, osy - opbH, opbW * 0.32, opbH * 0.22);

          /* head */
          const opHeadY = osy - opbH + 3 - ophr * 0.4;
          ctx.beginPath(); ctx.arc(osx, opHeadY, ophr, 0, Math.PI * 2);
          ctx.fillStyle = '#f4c07c'; ctx.fill();
          ctx.strokeStyle = 'rgba(180,120,40,0.25)'; ctx.lineWidth = 0.6; ctx.stroke();

          /* hair */
          ctx.beginPath(); ctx.arc(osx, opHeadY - ophr * 0.18, ophr * 0.88, Math.PI * 1.05, 0.05); ctx.closePath();
          ctx.fillStyle = '#2d1505'; ctx.fill();

          /* eyes */
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(osx - ophr * 0.55, opHeadY, ophr * 0.38, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(osx + ophr * 0.55, opHeadY, ophr * 0.38, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#1a0800';
          ctx.beginPath(); ctx.arc(osx - ophr * 0.50, opHeadY, ophr * 0.22, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(osx + ophr * 0.50, opHeadY, ophr * 0.22, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.60)';
          ctx.beginPath(); ctx.arc(osx - ophr * 0.60, opHeadY - ophr * 0.12, ophr * 0.10, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(osx + ophr * 0.42, opHeadY - ophr * 0.12, ophr * 0.10, 0, Math.PI * 2); ctx.fill();

          /* username badge */
          ctx.save();
          ctx.font = `bold ${Math.round(TILE * 0.5)}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const tw2 = ctx.measureText(op.username).width;
          const badgeY = opHeadY - ophr - 14;
          rrect(ctx, osx - tw2 / 2 - 7, badgeY, tw2 + 14, 14, 5);
          ctx.fillStyle = 'rgba(29,78,216,0.92)'; ctx.fill();
          ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = '#e0f2fe';
          ctx.fillText(op.username, osx, badgeY + 7);
          ctx.restore();
        }});
      });

      /* Quadrato ghost figures */
      ghostFigsRef.current.forEach((gf, gi) => {
        sprites.push({ z: gf.z, draw: () => {
          const [gsx, gsy] = w2s(gf.x, gf.z);
          const wobble = Math.sin(t * 3.5 + gi * 1.7) * 2.5;
          const bW = 0.62 * TILE; const bH = 0.9 * TILE;
          /* aura glow */
          const glowR = bH * 1.05;
          const glowGrad = ctx.createRadialGradient(gsx, gsy - bH * 0.5 + wobble, 0, gsx, gsy - bH * 0.3 + wobble, glowR);
          glowGrad.addColorStop(0, 'rgba(120,0,30,0.38)');
          glowGrad.addColorStop(0.5, 'rgba(60,0,15,0.18)');
          glowGrad.addColorStop(1, 'rgba(20,0,5,0)');
          ctx.beginPath();
          ctx.ellipse(gsx, gsy - bH * 0.3 + wobble, glowR * 0.75, glowR, 0, 0, Math.PI * 2);
          ctx.fillStyle = glowGrad; ctx.fill();
          /* shadow */
          ctx.beginPath(); ctx.ellipse(gsx, gsy + 5, bW * 0.5, 5, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fill();
          /* body silhouette */
          ctx.fillStyle = 'rgba(8,0,12,0.93)';
          rrect(ctx, gsx - bW / 2, gsy - bH + 4 + wobble, bW, bH, 6); ctx.fill();
          /* head */
          const hr = 0.30 * TILE;
          ctx.beginPath(); ctx.arc(gsx, gsy - bH + 4 + wobble - hr * 0.4, hr, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(8,0,12,0.96)'; ctx.fill();
          /* pulsing red eyes */
          const eyeA = 0.45 + Math.sin(t * 4 + gi * 1.3) * 0.35;
          ctx.fillStyle = `rgba(210,0,30,${eyeA})`;
          ctx.beginPath(); ctx.arc(gsx - 3.5, gsy - bH + 3 + wobble - hr * 0.4, 2.8, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(gsx + 3.5, gsy - bH + 3 + wobble - hr * 0.4, 2.8, 0, Math.PI * 2); ctx.fill();
        }});
      });

      /* Wizard reward figure */
      if (wizardRef.current && wizardRef.current.state !== 'done') {
        const wiz = wizardRef.current;
        sprites.push({ z: wiz.z, draw: () => {
          const [wx, wy] = w2s(wiz.x, wiz.z);
          const bob = Math.sin(t * 2.5) * (wiz.state === 'dialogue' ? 1 : 2.5);
          const bW = 0.55 * TILE; const bH = 0.92 * TILE;
          /* mystical aura */
          const aG = ctx.createRadialGradient(wx, wy - bH * 0.4 + bob, 0, wx, wy - bH * 0.3 + bob, bH * 1.15);
          aG.addColorStop(0, 'rgba(100,20,220,0.40)');
          aG.addColorStop(0.5, 'rgba(60,0,160,0.18)');
          aG.addColorStop(1, 'rgba(20,0,80,0)');
          ctx.beginPath();
          ctx.ellipse(wx, wy - bH * 0.35 + bob, bH * 0.85, bH * 1.05, 0, 0, Math.PI * 2);
          ctx.fillStyle = aG; ctx.fill();
          /* shadow */
          ctx.beginPath(); ctx.ellipse(wx, wy + 4, bW * 0.44, 5, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0,0,0,0.33)'; ctx.fill();
          /* robe body */
          ctx.fillStyle = 'rgba(38,0,88,0.96)';
          rrect(ctx, wx - bW / 2, wy - bH + 4 + bob, bW, bH, 9); ctx.fill();
          /* robe trim */
          ctx.strokeStyle = 'rgba(160,90,255,0.55)'; ctx.lineWidth = 1.5;
          rrect(ctx, wx - bW / 2, wy - bH + 4 + bob, bW, bH, 9); ctx.stroke();
          /* head */
          const hr = 0.27 * TILE;
          const headY = wy - bH + 4 + bob - hr * 0.3;
          ctx.beginPath(); ctx.arc(wx, headY, hr, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(32,15,44,0.97)'; ctx.fill();
          /* pointy hat */
          const hatW = bW * 0.82; const hatH = bH * 0.55;
          const hatTopY = headY - hr - hatH;
          ctx.beginPath();
          ctx.moveTo(wx - hatW / 2, headY - hr * 0.55);
          ctx.lineTo(wx, hatTopY);
          ctx.lineTo(wx + hatW / 2, headY - hr * 0.55);
          ctx.closePath();
          ctx.fillStyle = 'rgba(38,0,100,0.96)'; ctx.fill();
          ctx.strokeStyle = 'rgba(160,90,255,0.45)'; ctx.lineWidth = 1;
          ctx.stroke();
          /* hat brim */
          ctx.beginPath(); ctx.ellipse(wx, headY - hr * 0.55, hatW * 0.58, 4, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(55,0,130,0.9)'; ctx.fill();
          /* glowing eyes */
          const eg = 0.7 + Math.sin(t * 3.2) * 0.28;
          ctx.fillStyle = `rgba(140,220,255,${eg})`;
          ctx.beginPath(); ctx.arc(wx - 3.5, headY, 2.4, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(wx + 3.5, headY, 2.4, 0, Math.PI * 2); ctx.fill();
          /* staff */
          const sway = (wiz.state === 'walking-to' || wiz.state === 'walking-away') ? Math.sin(t * 2.5) * 3 : 0;
          const staffX = wx + bW * 0.42 + sway;
          ctx.strokeStyle = 'rgba(120,60,200,0.8)'; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(staffX, wy + 4 + bob);
          ctx.lineTo(staffX, hatTopY - 4);
          ctx.stroke();
          /* staff crystal */
          const cg = 0.65 + Math.sin(t * 4.5) * 0.30;
          ctx.fillStyle = `rgba(180,80,255,${cg})`;
          ctx.beginPath(); ctx.arc(staffX, hatTopY - 7, 3.8, 0, Math.PI * 2); ctx.fill();
          /* crystal inner glow */
          ctx.fillStyle = `rgba(230,180,255,${cg * 0.7})`;
          ctx.beginPath(); ctx.arc(staffX - 0.8, hatTopY - 8.5, 1.5, 0, Math.PI * 2); ctx.fill();
        }});
      }

      /* ── Birds (day only, flying across the map) ── */
      const birdDayP = (t / 300) % 1;
      const birdDayAlpha = birdDayP < 0.12 ? 0 : birdDayP < 0.22 ? (birdDayP - 0.12) / 0.10 : birdDayP > 0.78 ? Math.max(0, 1 - (birdDayP - 0.78) / 0.09) : 1.0;
      if (birdDayAlpha > 0.05) {
        BIRD_DATA.forEach((bird) => {
          const period = 1.0;
          const prog = ((t * bird.speed + bird.phase) % period + period) % period;
          /* wrap across -220 to +220 world units */
          const startX = bird.dx > 0 ? -220 : 220;
          const endX   = bird.dx > 0 ?  220 : -220;
          const startZ = bird.dz > 0 ? -220 : 220;
          const endZ   = bird.dz > 0 ?  220 : -220;
          const bwx = startX + (endX - startX) * prog;
          const bwz = startZ + (endZ - startZ) * prog;
          sprites.push({ z: bwz - 500, draw: () => {
            const [bsx, bsy] = w2s(bwx, bwz);
            /* "above" the world — draw at fixed screen offset above terrain */
            const altY = bsy - bird.alt * 45 - 30;
            const flap = Math.sin(t * 5.5 + bird.flapOffset * Math.PI * 2) * 0.5 + 0.5;
            ctx.save();
            ctx.globalAlpha = birdDayAlpha * 0.85;
            ctx.strokeStyle = '#1a1a18'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
            /* left wing */
            ctx.beginPath();
            ctx.moveTo(bsx - 1, altY);
            ctx.quadraticCurveTo(bsx - 6, altY - 4 - flap * 4, bsx - 11, altY - 2 - flap * 3);
            ctx.stroke();
            /* right wing */
            ctx.beginPath();
            ctx.moveTo(bsx + 1, altY);
            ctx.quadraticCurveTo(bsx + 6, altY - 4 - flap * 4, bsx + 11, altY - 2 - flap * 3);
            ctx.stroke();
            /* body dot */
            ctx.fillStyle = '#2a2a28';
            ctx.beginPath(); ctx.arc(bsx, altY, 1.2, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.restore();
          }});
        });
      }

      /* ── Butterflies (Campagna Ovest + Pianura Rurale, day only) ── */
      if (birdDayAlpha > 0.1) {
        BUTTERFLY_DATA.forEach((bf) => {
          const angle = t * bf.speed + bf.phase * Math.PI * 2;
          const bfwx = bf.cx + Math.cos(angle) * bf.orbitR;
          const bfwz = bf.cz + Math.sin(angle * 0.65) * bf.orbitR * 0.55;
          sprites.push({ z: bfwz, draw: () => {
            const [bfsx, bfsy] = w2s(bfwx, bfwz);
            const wingFlap = Math.abs(Math.sin(t * 8 + bf.phase * 6));
            const bfA = birdDayAlpha * 0.80;
            ctx.save();
            ctx.globalAlpha = bfA;
            ctx.translate(bfsx, bfsy - 4);
            /* wings */
            const [bfr, bfg, bfb] = hexToRgb(bf.color);
            ctx.fillStyle = `rgba(${bfr},${bfg},${bfb},0.85)`;
            /* upper wings */
            ctx.beginPath();
            ctx.ellipse(-3, -1, 4 * wingFlap, 3, -0.4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath();
            ctx.ellipse( 3, -1, 4 * wingFlap, 3,  0.4, 0, Math.PI * 2); ctx.fill();
            /* lower wings */
            ctx.fillStyle = `rgba(${bfr},${bfg},${bfb},0.60)`;
            ctx.beginPath();
            ctx.ellipse(-2.5, 2, 3 * wingFlap, 2, -0.6, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath();
            ctx.ellipse( 2.5, 2, 3 * wingFlap, 2,  0.6, 0, Math.PI * 2); ctx.fill();
            /* body */
            ctx.fillStyle = '#2a1a08'; ctx.globalAlpha = bfA;
            ctx.beginPath(); ctx.ellipse(0, 0, 1, 3.5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.restore();
          }});
        });
      }

      /* ── Farm animals / sheep (Campagna Ovest) ── */
      FARM_ANIMAL_DATA.forEach((sheep) => {
        const wanderAngle = t * sheep.speed + sheep.phase * Math.PI * 2;
        const swx = sheep.x + Math.cos(wanderAngle) * sheep.wanderR;
        const swz = sheep.z + Math.sin(wanderAngle * 0.7) * sheep.wanderR * 0.6;
        sprites.push({ z: swz, draw: () => {
          const [ssx, ssy] = w2s(swx, swz);
          ctx.save();
          ctx.translate(ssx, ssy);
          /* body — fluffy white oval */
          ctx.fillStyle = '#f0ede8';
          ctx.beginPath(); ctx.ellipse(0, -3, TILE * 0.38, TILE * 0.28, 0, 0, Math.PI * 2); ctx.fill();
          /* fluffy texture */
          ctx.fillStyle = '#e0ddd8';
          ctx.beginPath(); ctx.ellipse(-3, -4, 3.5, 2.5, -0.3, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse( 3, -4, 3.5, 2.5,  0.3, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse( 0, -6, 3.5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
          /* head */
          ctx.fillStyle = '#d8c8a0';
          ctx.beginPath(); ctx.ellipse(TILE * 0.25, -4, 3.5, 3, 0.4, 0, Math.PI * 2); ctx.fill();
          /* legs */
          ctx.fillStyle = '#c8b888';
          ctx.fillRect(-5, 0, 2, 6);
          ctx.fillRect(-2, 0, 2, 6);
          ctx.fillRect( 1, 0, 2, 6);
          ctx.fillRect( 4, 0, 2, 6);
          /* shadow */
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.beginPath(); ctx.ellipse(0, 3, TILE * 0.35, TILE * 0.12, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }});
      });

      /* ── Windmill (Pianura Rurale) ── */
      WINDMILL_DATA.forEach((wm) => {
        sprites.push({ z: wm.z, draw: () => {
          const [wmx, wmy] = w2s(wm.x, wm.z);
          const bladeRot = t * 0.8;
          /* tower */
          ctx.fillStyle = '#d4c8a0';
          ctx.beginPath();
          ctx.moveTo(wmx - TILE * 0.4, wmy + TILE * 0.8);
          ctx.lineTo(wmx + TILE * 0.4, wmy + TILE * 0.8);
          ctx.lineTo(wmx + TILE * 0.22, wmy - TILE * 1.4);
          ctx.lineTo(wmx - TILE * 0.22, wmy - TILE * 1.4);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#a89860'; ctx.lineWidth = 1.5; ctx.stroke();
          /* roof cap */
          ctx.fillStyle = '#7a5830';
          ctx.beginPath();
          ctx.moveTo(wmx - TILE * 0.26, wmy - TILE * 1.4);
          ctx.lineTo(wmx + TILE * 0.26, wmy - TILE * 1.4);
          ctx.lineTo(wmx, wmy - TILE * 1.9);
          ctx.closePath();
          ctx.fill();
          /* door */
          ctx.fillStyle = '#6a4820';
          ctx.fillRect(wmx - 4, wmy + TILE * 0.2, 8, TILE * 0.6);
          /* hub */
          const hubY = wmy - TILE * 1.2;
          ctx.fillStyle = '#555544';
          ctx.beginPath(); ctx.arc(wmx, hubY, 4, 0, Math.PI * 2); ctx.fill();
          /* 4 blades */
          for (let bi = 0; bi < 4; bi++) {
            const ba = bladeRot + (bi * Math.PI / 2);
            const bladeLen = TILE * 1.1;
            ctx.save();
            ctx.translate(wmx, hubY);
            ctx.rotate(ba);
            /* blade */
            ctx.fillStyle = '#e8ddb8';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(3, -bladeLen);
            ctx.lineTo(-3, -bladeLen);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#c0a860'; ctx.lineWidth = 0.8; ctx.stroke();
            ctx.restore();
          }
          /* shadow */
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.beginPath(); ctx.ellipse(wmx + 6, wmy + TILE * 0.85, TILE * 0.35, TILE * 0.1, 0.2, 0, Math.PI * 2); ctx.fill();
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

      /* ── Cinematic vignette (stronger at edges) ─────────── */
      {
        const vR = Math.max(w, h) * 0.78;
        const vGrad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.22, w / 2, h / 2, vR);
        vGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vGrad.addColorStop(0.50, 'rgba(0,0,0,0.06)');
        vGrad.addColorStop(0.78, 'rgba(0,0,0,0.22)');
        vGrad.addColorStop(1, 'rgba(0,0,0,0.62)');
        ctx.fillStyle = vGrad;
        ctx.fillRect(0, 0, w, h);
      }

      /* ── Gradient fog band at far map boundaries ─────────── */
      {
        const fogA = 0.28;
        /* top fog */
        const tFog = ctx.createLinearGradient(0, 0, 0, h * 0.18);
        tFog.addColorStop(0, `rgba(10,8,20,${fogA})`);
        tFog.addColorStop(1, 'rgba(10,8,20,0)');
        ctx.fillStyle = tFog; ctx.fillRect(0, 0, w, h * 0.18);
        /* bottom fog */
        const bFog = ctx.createLinearGradient(0, h * 0.82, 0, h);
        bFog.addColorStop(0, 'rgba(10,8,20,0)');
        bFog.addColorStop(1, `rgba(10,8,20,${fogA})`);
        ctx.fillStyle = bFog; ctx.fillRect(0, h * 0.82, w, h * 0.18);
        /* left fog */
        const lFog = ctx.createLinearGradient(0, 0, w * 0.14, 0);
        lFog.addColorStop(0, `rgba(10,8,20,${fogA})`);
        lFog.addColorStop(1, 'rgba(10,8,20,0)');
        ctx.fillStyle = lFog; ctx.fillRect(0, 0, w * 0.14, h);
        /* right fog */
        const rFog = ctx.createLinearGradient(w * 0.86, 0, w, 0);
        rFog.addColorStop(0, 'rgba(10,8,20,0)');
        rFog.addColorStop(1, `rgba(10,8,20,${fogA})`);
        ctx.fillStyle = rFog; ctx.fillRect(w * 0.86, 0, w * 0.14, h);
      }

      /* ── Day/night color grading tint ────────────────────── */
      {
        const _dayPG = (t / 300) % 1;
        /* daytime: subtle warm golden overlay (midday) */
        if (_dayPG > 0.25 && _dayPG < 0.65) {
          const strength = Math.min((_dayPG - 0.25) / 0.10, 1) * Math.min((0.65 - _dayPG) / 0.10, 1);
          ctx.fillStyle = `rgba(255,200,80,${strength * 0.04})`;
          ctx.fillRect(0, 0, w, h);
        }
        /* night: cool blue-purple tint */
        const _nightTint = _dayPG >= 0.87 ? 1 : _dayPG < 0.15 ? 1 : _dayPG > 0.75 ? (_dayPG - 0.75) / 0.12 : 0;
        if (_nightTint > 0.02) {
          ctx.fillStyle = `rgba(20,10,60,${_nightTint * 0.18})`;
          ctx.fillRect(0, 0, w, h);
        }
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

      } // end if (canvas && ctx) — draw block

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []); // runs once — all mutable state via refs

  /* ── Stage 13 fetch ──────────────────────────────────────── */
  useEffect(() => {
    if (!authToken) return;
    fetch('/api/story-mode/stage13/status', { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setStage13Status(data);
          stage13StatusRef.current = data;
        }
      })
      .catch(() => {});
  }, [authToken]);

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
  const isMobilePortrait  = isTouchDevice && !isLandscape;

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, overflow: 'hidden', minHeight: 0 }}>
      {/* 3D open-world layer */}
      <StoryWorld3D
        playerRef={playerRef}
        otherPlayersRef={otherPlayersRef}
        selfUserId={userId}
        dayTimeRef={worldDayTimeRef}
        cameraYawRef={cameraYawRef}
        mobileCamRotateRef={mobileCamRotateRef}
        ghostFigsRef={ghostFigsRef}
        wizardFigRef={wizardRef}
        darkFigRef={darkFigRef}
        leaders={leaders}
        arenaPositions={arenaPositions}
        getLeaderStatus={getLeaderStatus}
        visibleCollectibles={visibleCollectibles}
        buildingData={BUILDING_DATA}
        treeData={TREE_DATA}
        roadData={ROAD_DATA}
        onChallengeLeader={(leader) => {
          const status = getLeaderStatus(leader);
          if (status !== 'locked') onChallengeLeader(leader);
        }}
        onClickCollectible={(c) => setNearCollectible(c as StoryCollectible)}
      />

      {/* GPS Minimap */}
      <Minimap
        playerRef={playerRef}
        arenaPositions={arenaPositions}
        leaders={leaders}
        getLeaderStatus={getLeaderStatus}
        localities={localities}
      />

      {/* Day/Night clock HUD */}
      <DayNightClockHUD dayTimeRef={worldDayTimeRef} />

      {/* Chapter progress bar (top center) */}
      {(() => {
        const total = leaders.length;
        const completed = leaders.filter(l => getLeaderStatus(l) === 'completed').length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        const currentChapter = Math.min(completed + 1, total);
        if (isMobilePortrait) {
          return (
            <div
              onClick={() => setBannerCollapsed(c => !c)}
              style={{
                position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(3,4,18,0.92)', border: '1px solid rgba(255,255,255,0.1)',
                borderTop: 'none', borderRadius: '0 0 10px 10px',
                padding: bannerCollapsed ? '3px 12px 4px' : '4px 14px 6px',
                zIndex: 25, minWidth: 180, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(251,191,36,0.9)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  ⚔️ Cap. {currentChapter}/{total}
                </span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{pct}%</span>
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginLeft: 2 }}>{bannerCollapsed ? '▾' : '▴'}</span>
              </div>
              {!bannerCollapsed && (
                <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    width: `${pct}%`,
                    background: 'linear-gradient(90deg, #4ade80, #fbbf24)',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              )}
            </div>
          );
        }
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
        const compassSize = isMobilePortrait ? 28 : 36;
        return (
          <div style={{
            position: 'absolute',
            bottom: isMobilePortrait ? 'auto' : 90,
            top: isMobilePortrait ? 8 : 'auto',
            right: 'auto',
            left: isMobilePortrait ? 12 : 16,
            background: 'rgba(3,4,18,0.88)', border: '1.5px solid rgba(251,191,36,0.5)',
            borderRadius: isMobilePortrait ? 8 : 12,
            padding: isMobilePortrait ? '4px 6px' : '8px 12px', zIndex: 25,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobilePortrait ? 2 : 4,
            pointerEvents: 'none',
          }}>
            <div style={{
              width: compassSize, height: compassSize, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: compassSize, height: compassSize, borderRadius: '50%',
                border: '2px solid rgba(251,191,36,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 0, height: 0,
                  borderLeft: `${isMobilePortrait ? 5 : 7}px solid transparent`,
                  borderRight: `${isMobilePortrait ? 5 : 7}px solid transparent`,
                  borderBottom: `${isMobilePortrait ? 13 : 18}px solid #fbbf24`,
                  transformOrigin: '50% 75%',
                  transform: `rotate(${screenAngle + Math.PI / 2}rad)`,
                }} />
              </div>
            </div>
            {!isMobilePortrait && (
              <>
                <div style={{ fontSize: 9, color: 'rgba(251,191,36,0.8)', fontWeight: 800, textAlign: 'center' }}>
                  Prossima arena
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
                  {distLabel} u.m.
                </div>
              </>
            )}
            {isMobilePortrait && (
              <div style={{ fontSize: 8, color: 'rgba(251,191,36,0.7)', fontWeight: 700 }}>
                {distLabel}u
              </div>
            )}
          </div>
        );
      })()}

      {/* Victory History button */}
      {!showHistoryPanel && (
        <button
          onClick={() => setShowHistoryPanel(true)}
          style={{
            position: 'absolute',
            bottom: (() => {
              if (isMobileLandscape) return 8;
              if (isMobilePortrait) {
                const hasLeaderCard = !!(nearLeader && nearStatus !== 'locked' && nearestDist <= 9);
                const hasArcadeCard = !!(nearestArcadeId && nearestArcadeDist <= 9 && !nearLeader && !activeMinigame);
                const hasFootballCard = !!(nearFootball && !showFootballMinigame && !hasLeaderCard && !hasArcadeCard);
                return (hasLeaderCard || hasArcadeCard || hasFootballCard) ? 68 : 16;
              }
              return isTouchDevice ? (nearLeader && nearStatus !== 'locked' && nearestDist <= 9 ? 235 : 185) : 90;
            })(),
            left: isMobileLandscape ? 'auto' : isMobilePortrait ? 12 : isTouchDevice ? 188 : 16,
            right: isMobileLandscape ? 160 : 'auto',
            background: 'rgba(3,4,18,0.88)', border: '1.5px solid rgba(74,222,128,0.4)',
            borderRadius: 10, padding: isMobileLandscape ? '5px 10px' : isMobilePortrait ? '5px 8px' : '7px 12px', color: '#4ade80',
            fontSize: isMobileLandscape ? 11 : isMobilePortrait ? 11 : 12, fontWeight: 800, cursor: 'pointer', zIndex: 35,
            display: 'flex', alignItems: 'center', gap: isMobilePortrait ? 4 : 6,
          }}
        >
          🏆{isMobilePortrait ? '' : ' Storico'}
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

      {/* Wizard dialogue overlay */}
      {wizardDialogue && (
        <div
          className="absolute inset-x-0 bottom-24 flex justify-center items-end px-4 z-50 pointer-events-none"
        >
          <div
            className="relative max-w-sm w-full pointer-events-auto"
            style={{ background: 'rgba(10,0,30,0.94)', border: '1.5px solid rgba(160,90,255,0.6)', borderRadius: 16, padding: '14px 18px 18px', boxShadow: '0 0 32px rgba(100,0,200,0.45)' }}
          >
            {/* wizard icon top-left */}
            <div className="absolute -top-5 left-4 w-10 h-10 rounded-full flex items-center justify-center text-xl"
              style={{ background: 'rgba(38,0,88,0.97)', border: '1.5px solid rgba(160,90,255,0.5)', boxShadow: '0 0 12px rgba(100,20,220,0.5)' }}>
              🧙
            </div>
            <p className="text-purple-200 font-black text-xs mb-2 mt-1 opacity-70 tracking-wider uppercase">Lo Stregone</p>
            <p className="text-white font-semibold text-sm leading-relaxed">
              "Tieni, prendi questa carta... Usala bene e, con un po' di fortuna, scoprirai la forza di cui hai bisogno."
            </p>
            <button
              className="mt-4 w-full py-2 rounded-xl font-black text-sm transition-all active:scale-95"
              style={{ background: 'rgba(100,20,220,0.85)', color: 'white', border: '1px solid rgba(160,90,255,0.5)' }}
              onClick={() => {
                setWizardDialogue(false);
                if (wizardRef.current) wizardRef.current.state = 'walking-away';
                onWizardCardRef.current?.();
              }}
            >
              Prendi la carta
            </button>
          </div>
        </div>
      )}

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
            {tooltip.status === 'locked' ? '???' : tooltip.leader.gymName}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginBottom: 2 }}>
            {tooltip.status === 'locked' ? '🔒 ???' : `👊 ${tooltip.leader.name}`}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 2 }}>
            {tooltip.status === 'locked' ? '— —' : (tooltip.leader.cpuLevel === 'easy' ? '🟢 Facile' : tooltip.leader.cpuLevel === 'medium' ? '🟡 Medio' : '🔴 Difficile')}
            {tooltip.status !== 'locked' && <>{' · '}❤️ {tooltip.leader.livesCount}</>}
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
        position: 'absolute',
        top: isMobilePortrait ? 8 : 12,
        right: 12,
        background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10, padding: isMobileLandscape ? '4px 10px' : isMobilePortrait ? '3px 8px' : '6px 12px',
        color: 'rgba(255,255,255,0.60)', fontSize: isMobilePortrait ? 10 : 11, fontWeight: 700,
        pointerEvents: 'none', zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: isMobilePortrait ? 1 : 3, textAlign: 'right',
      }}>
        {!isMobileLandscape && !isMobilePortrait && (
          <span style={{ color: 'rgba(255,255,255,0.45)' }}>WASD / ↑↓←→ — muoviti</span>
        )}
        <span style={{ color: '#4ade80', fontSize: isMobileLandscape || isMobilePortrait ? 10 : 12 }}>
          ✓ <strong>{completedCount}/{leaders.length}</strong> stage
        </span>
        <span style={{ color: 'rgba(251,191,36,0.85)', fontSize: isMobileLandscape || isMobilePortrait ? 10 : 11 }}>
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
          padding: isMobileLandscape ? '8px 16px' : isMobilePortrait ? '8px 12px' : '14px 16px',
          display: 'flex', alignItems: 'center', gap: (isMobileLandscape || isMobilePortrait) ? 8 : 14, zIndex: 30,
        }}>
          {nearLeader.leaderImageUrl ? (
            <img src={nearLeader.leaderImageUrl} alt={nearLeader.name} style={{
              width: isMobileLandscape ? 36 : isMobilePortrait ? 40 : 56,
              height: isMobileLandscape ? 36 : isMobilePortrait ? 40 : 56,
              borderRadius: '50%', objectFit: 'cover',
              border: `2px solid ${nearStatus === 'completed' ? '#4ade80' : '#fbbf24'}`, flexShrink: 0,
              boxShadow: `0 0 18px ${nearStatus === 'completed' ? '#4ade8055' : '#fbbf2455'}`,
            }} />
          ) : (
            <div style={{
              width: isMobileLandscape ? 36 : isMobilePortrait ? 40 : 56,
              height: isMobileLandscape ? 36 : isMobilePortrait ? 40 : 56,
              borderRadius: '50%', flexShrink: 0,
              background: nearStatus === 'completed' ? 'rgba(22,101,52,0.6)' : 'rgba(120,53,15,0.6)',
              border: `2px solid ${nearStatus === 'completed' ? '#4ade8055' : '#fbbf2455'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: isMobileLandscape ? 16 : isMobilePortrait ? 18 : 22,
            }}>🏋️</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: nearStatus === 'completed' ? '#4ade80' : '#fbbf24' }}>
                ⚡ Stage {nearLeader.orderIndex}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: isMobilePortrait ? 13 : 15, fontWeight: 900, color: nearStatus === 'completed' ? '#86efac' : '#fde68a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nearLeader.gymName}
            </p>
            {!isMobilePortrait && (
              <p style={{ margin: '1px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                👊 {nearLeader.name}
                {' · '}{nearLeader.cpuLevel === 'easy' ? '🟢' : nearLeader.cpuLevel === 'medium' ? '🟡' : '🔴'}
                {' · '}❤️ {nearLeader.livesCount}
                {' · '}⭐ {nearLeader.rewardCredits}
              </p>
            )}
            {isMobilePortrait && (
              <p style={{ margin: '1px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nearLeader.cpuLevel === 'easy' ? '🟢' : nearLeader.cpuLevel === 'medium' ? '🟡' : '🔴'}
                {' '}❤️{nearLeader.livesCount}{' '}⭐{nearLeader.rewardCredits}
              </p>
            )}
          </div>
          <div style={{ flexShrink: 0 }}>
            {hasPending ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobilePortrait ? 4 : 6 }}>
                <button onClick={() => onResumeGame(nearLeader, pendingGymGame!.gameId)} style={{
                  background: 'linear-gradient(135deg,#ea580c,#c2410c)', border: 'none',
                  borderRadius: 10, color: 'white', fontSize: isMobilePortrait ? 12 : 13, fontWeight: 900,
                  padding: isMobilePortrait ? '6px 10px' : '8px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
                  boxShadow: '0 2px 10px rgba(234,88,12,0.4)',
                }}>⚔️ Riprendi</button>
                <button onClick={() => onChallengeLeader(nearLeader)} style={{
                  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 10, color: 'rgba(255,255,255,0.6)', fontSize: isMobilePortrait ? 10 : 11, fontWeight: 800,
                  padding: isMobilePortrait ? '4px 8px' : '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap',
                }}>Nuova partita</button>
              </div>
            ) : hasLost ? (
              <button onClick={() => onChallengeLeader(nearLeader)} style={{
                background: 'linear-gradient(135deg,#dc2626,#9333ea)', border: 'none',
                borderRadius: 10, color: 'white', fontSize: isMobilePortrait ? 12 : 14, fontWeight: 900,
                padding: isMobilePortrait ? '7px 12px' : '10px 18px', cursor: 'pointer', whiteSpace: 'nowrap',
                boxShadow: '0 2px 12px rgba(220,38,38,0.5)',
              }}>⚔️ Riprova</button>
            ) : nearStatus === 'available' ? (
              <button onClick={() => onChallengeLeader(nearLeader)} style={{
                background: 'linear-gradient(135deg,#9333ea,#f59e0b)', border: 'none',
                borderRadius: 10, color: 'white', fontSize: isMobilePortrait ? 12 : 14, fontWeight: 900,
                padding: isMobilePortrait ? '7px 12px' : '10px 18px', cursor: 'pointer', whiteSpace: 'nowrap',
                boxShadow: '0 2px 14px rgba(147,51,234,0.5)', letterSpacing: '0.04em',
              }}>⚔️ SFIDA!</button>
            ) : nearStatus === 'completed' ? (
              <button onClick={() => onChallengeLeader(nearLeader)} style={{
                background: 'rgba(74,222,128,0.15)', border: '1.5px solid rgba(74,222,128,0.4)',
                borderRadius: 10, color: '#86efac', fontSize: isMobilePortrait ? 11 : 13, fontWeight: 800,
                padding: isMobilePortrait ? '6px 10px' : '8px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
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
            padding: isMobileLandscape ? '8px 16px' : isMobilePortrait ? '8px 12px' : '14px 16px',
            display: 'flex', alignItems: 'center', gap: (isMobileLandscape || isMobilePortrait) ? 8 : 14, zIndex: 30,
          }}>
            <div style={{
              width: isMobileLandscape ? 36 : isMobilePortrait ? 40 : 52,
              height: isMobileLandscape ? 36 : isMobilePortrait ? 40 : 52,
              borderRadius: 12, flexShrink: 0,
              background: `linear-gradient(135deg, ${ab.color}44, ${ab.color}22)`,
              border: `2px solid ${ab.color}88`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: isMobileLandscape ? 18 : isMobilePortrait ? 20 : 26,
              boxShadow: `0 0 18px ${ab.color}44`,
            }}>{ab.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: ab.color }}>
                🎮 Arcade
              </div>
              <p style={{ margin: 0, fontSize: isMobilePortrait ? 13 : 15, fontWeight: 900, color: 'rgba(255,255,255,0.95)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ab.name}
              </p>
              {!isMobilePortrait && (
                <p style={{ margin: '1px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                  {coolText ? `⏳ Cooldown: ${coolText}` : 'Entra e gioca per guadagnare PR!'}
                </p>
              )}
            </div>
            <div style={{ flexShrink: 0 }}>
              {coolText ? (
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: isMobilePortrait ? 10 : 12, fontWeight: 700 }}>⏳ {coolText}</div>
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
                    border: 'none', borderRadius: 10, color: 'white',
                    fontSize: isMobilePortrait ? 12 : 14, fontWeight: 900,
                    padding: isMobilePortrait ? '7px 12px' : '10px 18px',
                    cursor: startingMinigame ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
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

      {/* Stage 13 proximity prompt */}
      {nearStage13 && !showStage13ChallengeModal && !showHistoryPanel && (
        <div style={{
          position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(3,4,18,0.95)', border: '2px solid rgba(124,58,237,0.7)',
          borderRadius: 14, padding: '12px 20px', display: 'flex', alignItems: 'center',
          gap: 12, zIndex: 50, boxShadow: '0 0 20px rgba(124,58,237,0.3)',
        }}>
          <span style={{ fontSize: 26 }}>👑</span>
          <div>
            <div style={{ color: '#c084fc', fontWeight: 900, fontSize: 15 }}>Arena Stage 13</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Sfida il boss umano!</div>
          </div>
          <button
            onClick={() => { setShowStage13ChallengeModal(true); setStage13ChallengeSent(false); setStage13ChallengeError(null); }}
            style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 900, cursor: 'pointer', fontSize: 13 }}
          >
            Sfida
          </button>
        </div>
      )}

      {/* Secret Room proximity prompt */}
      {nearSecretRoom && !showHistoryPanel && (
        <div style={{
          position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(3,4,18,0.95)', border: '2px solid rgba(251,191,36,0.7)',
          borderRadius: 14, padding: '12px 20px', display: 'flex', alignItems: 'center',
          gap: 12, zIndex: 50, boxShadow: '0 0 20px rgba(251,191,36,0.2)',
        }}>
          <span style={{ fontSize: 26 }}>🏆</span>
          <div>
            <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: 15 }}>Stanza Segreta</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Hai completato tutti i leader!</div>
          </div>
          <button
            onClick={() => onOpenSecretRoom?.()}
            style={{ background: '#d97706', color: 'white', border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 900, cursor: 'pointer', fontSize: 13 }}
          >
            Entra
          </button>
        </div>
      )}

      {/* Football field proximity panel */}
      {nearFootball && !showFootballMinigame && !showHistoryPanel && !(nearLeader && nearStatus !== 'locked' && nearestDist <= 9) && !(nearestArcadeId && nearestArcadeDist <= 9) && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(to top, rgba(0,10,0,0.97) 0%, rgba(0,15,0,0.9) 100%)',
          borderTop: '2px solid rgba(34,197,94,0.5)',
          padding: isMobileLandscape ? '8px 16px' : isMobilePortrait ? '8px 12px' : '14px 16px',
          display: 'flex', alignItems: 'center', gap: (isMobileLandscape || isMobilePortrait) ? 8 : 14, zIndex: 30,
        }}>
          <div style={{ fontSize: isMobileLandscape ? 28 : isMobilePortrait ? 30 : 40, flexShrink: 0 }}>⚽</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: isMobileLandscape ? 13 : isMobilePortrait ? 13 : 16, fontWeight: 900, color: '#4ade80' }}>
              Campo da Calcio
            </p>
            {!isMobilePortrait && (
              <p style={{ margin: '2px 0 0', fontSize: isMobileLandscape ? 11 : 13, color: 'rgba(255,255,255,0.5)' }}>
                4 mini-giochi · Guadagna Rankiard!
              </p>
            )}
          </div>
          <button
            onClick={() => setShowFootballMinigame(true)}
            style={{
              background: 'linear-gradient(135deg,#16a34a,#4ade80)', border: 'none',
              borderRadius: 10, color: 'white',
              fontSize: isMobileLandscape || isMobilePortrait ? 12 : 15, fontWeight: 900,
              padding: isMobileLandscape ? '8px 14px' : isMobilePortrait ? '7px 12px' : '10px 20px',
              cursor: 'pointer', whiteSpace: 'nowrap',
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setCardReveal(null)} style={{
                flex: 1, minWidth: 70, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 13,
                padding: '10px 0', cursor: 'pointer',
              }}>↩ Dopo</button>
              {cardReveal.cardId && (
                <button onClick={() => setRevealScheaOpen(true)} style={{
                  flex: 1, minWidth: 70, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)',
                  borderRadius: 10, color: '#a5b4fc', fontWeight: 700, fontSize: 13,
                  padding: '10px 0', cursor: 'pointer',
                }}>📋 Scheda</button>
              )}
              <button onClick={() => handleCollectDirect(cardReveal)} disabled={isCollecting} style={{
                flex: 2, minWidth: 120,
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

      {/* Card info sheet overlay (from cardReveal) */}
      {revealScheaOpen && cardReveal?.cardId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.88)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }} onClick={() => setRevealScheaOpen(false)}>
          <div
            style={{
              width: '100%', maxWidth: 440,
              background: '#111827',
              borderTop: '1px solid rgba(99,102,241,0.4)',
              borderRadius: '1.5rem 1.5rem 0 0',
              maxHeight: '80vh',
              display: 'flex', flexDirection: 'column',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
            }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>📋 Scheda carta</span>
              <button
                onClick={() => setRevealScheaOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.1)', border: 'none',
                  borderRadius: '50%', width: 28, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 16,
                }}
              >✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              <CardInfoSheet cardId={cardReveal.cardId} compact />
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

      {/* Stage 13 – Challenge Modal */}
      {showStage13ChallengeModal && stage13Status?.visibleStage && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', padding: '0 20px' }}
          onClick={() => { if (!stage13ChallengeLoading) setShowStage13ChallengeModal(false); }}
        >
          <div
            style={{ width: '100%', maxWidth: 400, background: '#0a0a1a', border: '1.5px solid rgba(124,58,237,0.5)', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={e => e.stopPropagation()}
          >
            {stage13ChallengeSent ? (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 40 }}>⚔️</div>
                <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: 18 }}>Sfida inviata!</div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Il boss ha 7 giorni per rispondere.</div>
                <button onClick={() => setShowStage13ChallengeModal(false)} style={{ padding: '8px 24px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 12, fontWeight: 900, cursor: 'pointer' }}>Chiudi</button>
              </div>
            ) : (
              <>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>⚔️</div>
                  <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: 18 }}>Sfida Stage 13</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
                    Vuoi sfidare lo Stage di <span style={{ color: stage13Status.visibleStage.stageColor, fontWeight: 700 }}>{stage13Status.visibleStage.bossUsername}</span>?
                  </div>
                  <div style={{ marginTop: 10, padding: '8px 16px', background: stage13Status.visibleStage.stageColor + '22', border: `1px solid ${stage13Status.visibleStage.stageColor}66`, borderRadius: 12, color: stage13Status.visibleStage.stageColor, fontWeight: 700, fontSize: 14 }}>
                    🏰 {stage13Status.visibleStage.stageName}
                  </div>
                </div>
                {stage13ChallengeError && (
                  <div style={{ background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, padding: '8px 16px', color: '#fca5a5', fontSize: 12, textAlign: 'center' }}>
                    {stage13ChallengeError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => setShowStage13ChallengeModal(false)}
                    style={{ flex: 1, padding: '10px 0', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                  >Annulla</button>
                  <button
                    onClick={async () => {
                      setStage13ChallengeLoading(true);
                      setStage13ChallengeError(null);
                      try {
                        const res = await fetch('/api/story-mode/stage13/challenge', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                          body: JSON.stringify({ stageId: stage13Status.visibleStage.id }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setStage13ChallengeSent(true);
                        } else {
                          setStage13ChallengeError(data.error || 'Errore');
                        }
                      } catch { setStage13ChallengeError('Errore di rete'); }
                      setStage13ChallengeLoading(false);
                    }}
                    disabled={stage13ChallengeLoading}
                    style={{ flex: 1, padding: '10px 0', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 12, fontWeight: 900, fontSize: 14, cursor: 'pointer', opacity: stage13ChallengeLoading ? 0.5 : 1 }}
                  >{stage13ChallengeLoading ? 'Attendere...' : 'Sfida!'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Stage 13 – Pending challenge as Challenger banner */}
      {stage13Status?.pendingChallengeAsChallenger && !showStage13ChallengeModal && (
        <div style={{
          position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10,10,26,0.96)', border: '1.5px solid rgba(124,58,237,0.6)',
          borderRadius: 14, padding: '10px 20px', zIndex: 60, textAlign: 'center',
          whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
        }}>
          <div style={{ color: '#a78bfa', fontWeight: 900, fontSize: 13 }}>
            ⏳ In attesa che <span style={{ color: '#fbbf24' }}>{stage13Status.pendingChallengeAsChallenger.bossUsername}</span> accetti la sfida
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 3 }}>
            {(() => {
              const expires = stage13Status.pendingChallengeAsChallenger.expiresAt ? new Date(stage13Status.pendingChallengeAsChallenger.expiresAt) : null;
              if (!expires) return 'Scade tra 7 giorni';
              const daysLeft = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
              return daysLeft <= 0 ? 'Scaduta' : `Scade tra ${daysLeft} giorn${daysLeft === 1 ? 'o' : 'i'}`;
            })()}
          </div>
        </div>
      )}

      {/* Stage 13 – Pending challenge as Boss notification */}
      {stage13Status?.pendingChallengeAsBoss && (
        <div style={{
          position: 'absolute', top: stage13Status?.pendingChallengeAsChallenger ? 110 : 60, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10,10,26,0.96)', border: '1.5px solid rgba(251,191,36,0.6)',
          borderRadius: 14, padding: '12px 20px', zIndex: 60, textAlign: 'center',
          maxWidth: 320, boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
        }}>
          <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: 13 }}>
            ⚔️ <span style={{ color: '#60a5fa' }}>{stage13Status.pendingChallengeAsBoss.challengerUsername}</span> vuole sfidare il tuo Stage 13!
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10, justifyContent: 'center' }}>
            <button
              onClick={async () => {
                try {
                  await fetch('/api/story-mode/stage13/respond', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                    body: JSON.stringify({ challengeId: stage13Status.pendingChallengeAsBoss.id, accept: false }),
                  });
                  const data = await fetch('/api/story-mode/stage13/status', { headers: { Authorization: `Bearer ${authToken}` } }).then(r => r.json());
                  if (data.success) { setStage13Status(data); stage13StatusRef.current = data; }
                } catch {}
              }}
              style={{ padding: '7px 14px', background: 'rgba(220,38,38,0.25)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
            >Rifiuta</button>
            <button
              onClick={async () => {
                try {
                  await fetch('/api/story-mode/stage13/respond', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                    body: JSON.stringify({ challengeId: stage13Status.pendingChallengeAsBoss.id, accept: true }),
                  });
                  const data = await fetch('/api/story-mode/stage13/status', { headers: { Authorization: `Bearer ${authToken}` } }).then(r => r.json());
                  if (data.success) { setStage13Status(data); stage13StatusRef.current = data; }
                } catch {}
              }}
              style={{ padding: '7px 14px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 10, fontWeight: 900, fontSize: 12, cursor: 'pointer' }}
            >Accetta</button>
          </div>
        </div>
      )}


      {/* Mobile analog joystick (bottom-left) */}
      {isTouchDevice && (
        <div style={{
          position: 'absolute',
          bottom: nearLeader && nearStatus !== 'locked' && nearestDist <= 9 ? 130 : 18,
          left: 16,
          zIndex: 32,
          transition: 'bottom 0.22s ease',
        }}>
          <AnalogJoystick
            size={isMobileLandscape ? 108 : 136}
            onMove={(x, z) => setJoy(x, z)}
          />
        </div>
      )}

      {/* 📷 Mobile camera-rotate toggle — fixed to top-right corner on touch devices */}
      {isTouchDevice && (
        <button
          onPointerDown={(e) => { e.stopPropagation(); }}
          onClick={toggleCamRotate}
          style={{
            position: 'absolute',
            top: 16, right: 16,
            width: isMobileLandscape ? 40 : 52,
            height: isMobileLandscape ? 40 : 52,
            borderRadius: '50%',
            background: camRotateMode ? 'rgba(99,102,241,0.9)' : 'rgba(0,0,0,0.55)',
            border: camRotateMode ? '2px solid #a5b4fc' : '2px solid rgba(255,255,255,0.2)',
            color: '#fff',
            fontSize: isMobileLandscape ? 18 : 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 35,
            boxShadow: camRotateMode ? '0 0 12px rgba(99,102,241,0.6)' : 'none',
            transition: 'all 0.18s ease',
          }}
          title={camRotateMode ? 'Movimento (tocca per cambiare)' : 'Ruota camera (tocca per cambiare)'}
        >
          📷
        </button>
      )}
    </div>
  );
}
