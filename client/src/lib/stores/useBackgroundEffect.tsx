import { create } from 'zustand';

export type GameEvent = 
  | 'idle'
  | 'my-turn'
  | 'opponent-turn'
  | 'attack'
  | 'defense'
  | 'death'
  | 'evolution'
  | 'bonus'
  | 'dice'
  | 'special-move'
  | 'card-played'
  | 'hostage'
  | 'clash';

interface EventColors {
  gradient: string;
  orb1: string;
  orb2: string;
  orb3: string;
  orb4: string;
  orb5: string;
  opacity1: number;
  opacity2: number;
  opacity3: number;
  opacity4: number;
  opacity5: number;
  auroraColor1: string;
  auroraColor2: string;
  auroraOpacity: number;
  pulseColor: string;
  pulseOpacity: number;
}

const EVENT_COLORS: Record<GameEvent, EventColors> = {
  'idle': {
    gradient: 'radial-gradient(ellipse at 20% 10%, rgba(88, 28, 135, 0.35) 0%, transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(30, 58, 138, 0.3) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(6, 182, 212, 0.15) 0%, transparent 60%), radial-gradient(ellipse at 10% 70%, rgba(139, 92, 246, 0.2) 0%, transparent 50%), linear-gradient(180deg, #03050d 0%, #070b1a 30%, #0a1028 60%, #060918 100%)',
    orb1: '#9333ea', orb2: '#3b82f6', orb3: '#06b6d4', orb4: '#8b5cf6', orb5: '#6366f1',
    opacity1: 0.2, opacity2: 0.15, opacity3: 0.12, opacity4: 0.1, opacity5: 0.08,
    auroraColor1: 'rgba(139, 92, 246, 0.08)', auroraColor2: 'rgba(59, 130, 246, 0.06)',
    auroraOpacity: 0.5,
    pulseColor: 'rgba(88, 28, 135, 0.1)', pulseOpacity: 0.3,
  },
  'my-turn': {
    gradient: 'radial-gradient(ellipse at 25% 15%, rgba(234, 179, 8, 0.45) 0%, transparent 55%), radial-gradient(ellipse at 75% 85%, rgba(245, 158, 11, 0.35) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(251, 191, 36, 0.2) 0%, transparent 60%), radial-gradient(ellipse at 15% 60%, rgba(252, 211, 77, 0.25) 0%, transparent 50%), linear-gradient(180deg, #0d0a02 0%, #1a1508 30%, #241e0a 60%, #100c03 100%)',
    orb1: '#eab308', orb2: '#f59e0b', orb3: '#fbbf24', orb4: '#fcd34d', orb5: '#f97316',
    opacity1: 0.3, opacity2: 0.25, opacity3: 0.2, opacity4: 0.15, opacity5: 0.12,
    auroraColor1: 'rgba(234, 179, 8, 0.15)', auroraColor2: 'rgba(245, 158, 11, 0.12)',
    auroraOpacity: 0.8,
    pulseColor: 'rgba(251, 191, 36, 0.15)', pulseOpacity: 0.6,
  },
  'opponent-turn': {
    gradient: 'radial-gradient(ellipse at 25% 15%, rgba(59, 130, 246, 0.4) 0%, transparent 55%), radial-gradient(ellipse at 75% 85%, rgba(99, 102, 241, 0.32) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(139, 92, 246, 0.18) 0%, transparent 60%), radial-gradient(ellipse at 85% 30%, rgba(37, 99, 235, 0.25) 0%, transparent 50%), linear-gradient(180deg, #030810 0%, #081028 30%, #0d1838 60%, #050a18 100%)',
    orb1: '#3b82f6', orb2: '#6366f1', orb3: '#8b5cf6', orb4: '#2563eb', orb5: '#818cf8',
    opacity1: 0.25, opacity2: 0.2, opacity3: 0.16, opacity4: 0.12, opacity5: 0.1,
    auroraColor1: 'rgba(59, 130, 246, 0.12)', auroraColor2: 'rgba(99, 102, 241, 0.1)',
    auroraOpacity: 0.7,
    pulseColor: 'rgba(99, 102, 241, 0.12)', pulseOpacity: 0.5,
  },
  'attack': {
    gradient: 'radial-gradient(ellipse at 35% 25%, rgba(239, 68, 68, 0.55) 0%, transparent 55%), radial-gradient(ellipse at 65% 75%, rgba(249, 115, 22, 0.45) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(220, 38, 38, 0.25) 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(185, 28, 28, 0.3) 0%, transparent 50%), linear-gradient(180deg, #150505 0%, #250a08 30%, #301010 60%, #180606 100%)',
    orb1: '#ef4444', orb2: '#f97316', orb3: '#dc2626', orb4: '#b91c1c', orb5: '#fb923c',
    opacity1: 0.4, opacity2: 0.35, opacity3: 0.3, opacity4: 0.2, opacity5: 0.15,
    auroraColor1: 'rgba(239, 68, 68, 0.2)', auroraColor2: 'rgba(249, 115, 22, 0.18)',
    auroraOpacity: 1,
    pulseColor: 'rgba(220, 38, 38, 0.25)', pulseOpacity: 0.8,
  },
  'defense': {
    gradient: 'radial-gradient(ellipse at 25% 15%, rgba(59, 130, 246, 0.48) 0%, transparent 55%), radial-gradient(ellipse at 75% 85%, rgba(6, 182, 212, 0.4) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(14, 165, 233, 0.22) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(56, 189, 248, 0.3) 0%, transparent 50%), linear-gradient(180deg, #030a14 0%, #081828 30%, #0c2038 60%, #050e1a 100%)',
    orb1: '#3b82f6', orb2: '#06b6d4', orb3: '#0ea5e9', orb4: '#38bdf8', orb5: '#22d3ee',
    opacity1: 0.35, opacity2: 0.28, opacity3: 0.22, opacity4: 0.16, opacity5: 0.12,
    auroraColor1: 'rgba(6, 182, 212, 0.18)', auroraColor2: 'rgba(59, 130, 246, 0.15)',
    auroraOpacity: 0.9,
    pulseColor: 'rgba(14, 165, 233, 0.2)', pulseOpacity: 0.7,
  },
  'death': {
    gradient: 'radial-gradient(ellipse at 35% 35%, rgba(139, 92, 246, 0.5) 0%, transparent 55%), radial-gradient(ellipse at 65% 65%, rgba(88, 28, 135, 0.42) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(0, 0, 0, 0.35) 0%, transparent 60%), radial-gradient(ellipse at 10% 50%, rgba(76, 29, 149, 0.3) 0%, transparent 50%), linear-gradient(180deg, #050218 0%, #0a0528 30%, #100838 60%, #060318 100%)',
    orb1: '#8b5cf6', orb2: '#581c87', orb3: '#4c1d95', orb4: '#7c3aed', orb5: '#6d28d9',
    opacity1: 0.4, opacity2: 0.32, opacity3: 0.25, opacity4: 0.18, opacity5: 0.14,
    auroraColor1: 'rgba(139, 92, 246, 0.2)', auroraColor2: 'rgba(88, 28, 135, 0.18)',
    auroraOpacity: 0.9,
    pulseColor: 'rgba(76, 29, 149, 0.22)', pulseOpacity: 0.7,
  },
  'evolution': {
    gradient: 'radial-gradient(ellipse at 25% 15%, rgba(234, 179, 8, 0.55) 0%, transparent 55%), radial-gradient(ellipse at 75% 85%, rgba(245, 158, 11, 0.48) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(252, 211, 77, 0.28) 0%, transparent 60%), radial-gradient(ellipse at 90% 20%, rgba(251, 191, 36, 0.35) 0%, transparent 50%), linear-gradient(180deg, #0d0a02 0%, #1f1808 30%, #2a200a 60%, #120e04 100%)',
    orb1: '#eab308', orb2: '#f59e0b', orb3: '#fcd34d', orb4: '#fbbf24', orb5: '#f97316',
    opacity1: 0.45, opacity2: 0.38, opacity3: 0.3, opacity4: 0.22, opacity5: 0.16,
    auroraColor1: 'rgba(234, 179, 8, 0.25)', auroraColor2: 'rgba(252, 211, 77, 0.2)',
    auroraOpacity: 1,
    pulseColor: 'rgba(245, 158, 11, 0.25)', pulseOpacity: 0.9,
  },
  'bonus': {
    gradient: 'radial-gradient(ellipse at 25% 15%, rgba(34, 197, 94, 0.48) 0%, transparent 55%), radial-gradient(ellipse at 75% 85%, rgba(16, 185, 129, 0.4) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(52, 211, 153, 0.2) 0%, transparent 60%), radial-gradient(ellipse at 15% 75%, rgba(74, 222, 128, 0.28) 0%, transparent 50%), linear-gradient(180deg, #030d05 0%, #081a10 30%, #0d2218 60%, #050f08 100%)',
    orb1: '#22c55e', orb2: '#10b981', orb3: '#34d399', orb4: '#4ade80', orb5: '#059669',
    opacity1: 0.35, opacity2: 0.28, opacity3: 0.22, opacity4: 0.16, opacity5: 0.12,
    auroraColor1: 'rgba(34, 197, 94, 0.15)', auroraColor2: 'rgba(16, 185, 129, 0.12)',
    auroraOpacity: 0.8,
    pulseColor: 'rgba(52, 211, 153, 0.18)', pulseOpacity: 0.6,
  },
  'dice': {
    gradient: 'radial-gradient(ellipse at 25% 15%, rgba(6, 182, 212, 0.48) 0%, transparent 55%), radial-gradient(ellipse at 75% 85%, rgba(20, 184, 166, 0.4) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(34, 211, 238, 0.22) 0%, transparent 60%), radial-gradient(ellipse at 85% 40%, rgba(45, 212, 191, 0.3) 0%, transparent 50%), linear-gradient(180deg, #030d10 0%, #081a20 30%, #0d2228 60%, #051015 100%)',
    orb1: '#06b6d4', orb2: '#14b8a6', orb3: '#22d3ee', orb4: '#2dd4bf', orb5: '#67e8f9',
    opacity1: 0.35, opacity2: 0.3, opacity3: 0.24, opacity4: 0.18, opacity5: 0.12,
    auroraColor1: 'rgba(6, 182, 212, 0.18)', auroraColor2: 'rgba(20, 184, 166, 0.15)',
    auroraOpacity: 0.85,
    pulseColor: 'rgba(34, 211, 238, 0.2)', pulseOpacity: 0.65,
  },
  'special-move': {
    gradient: 'radial-gradient(ellipse at 30% 20%, rgba(249, 115, 22, 0.5) 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, rgba(239, 68, 68, 0.42) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(245, 158, 11, 0.25) 0%, transparent 60%), radial-gradient(ellipse at 20% 70%, rgba(251, 146, 60, 0.32) 0%, transparent 50%), linear-gradient(180deg, #120805 0%, #221210 30%, #2d1a12 60%, #150a06 100%)',
    orb1: '#f97316', orb2: '#ef4444', orb3: '#f59e0b', orb4: '#fb923c', orb5: '#ea580c',
    opacity1: 0.38, opacity2: 0.32, opacity3: 0.25, opacity4: 0.18, opacity5: 0.14,
    auroraColor1: 'rgba(249, 115, 22, 0.2)', auroraColor2: 'rgba(239, 68, 68, 0.18)',
    auroraOpacity: 0.95,
    pulseColor: 'rgba(245, 158, 11, 0.22)', pulseOpacity: 0.75,
  },
  'card-played': {
    gradient: 'radial-gradient(ellipse at 25% 15%, rgba(99, 102, 241, 0.42) 0%, transparent 55%), radial-gradient(ellipse at 75% 85%, rgba(139, 92, 246, 0.35) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(168, 85, 247, 0.2) 0%, transparent 60%), radial-gradient(ellipse at 10% 60%, rgba(129, 140, 248, 0.28) 0%, transparent 50%), linear-gradient(180deg, #050518 0%, #0a0a28 30%, #101038 60%, #080820 100%)',
    orb1: '#6366f1', orb2: '#8b5cf6', orb3: '#a855f7', orb4: '#818cf8', orb5: '#c084fc',
    opacity1: 0.3, opacity2: 0.24, opacity3: 0.18, opacity4: 0.14, opacity5: 0.1,
    auroraColor1: 'rgba(99, 102, 241, 0.15)', auroraColor2: 'rgba(139, 92, 246, 0.12)',
    auroraOpacity: 0.7,
    pulseColor: 'rgba(168, 85, 247, 0.18)', pulseOpacity: 0.55,
  },
  'hostage': {
    gradient: 'radial-gradient(ellipse at 30% 20%, rgba(239, 68, 68, 0.45) 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, rgba(185, 28, 28, 0.38) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(153, 27, 27, 0.25) 0%, transparent 60%), radial-gradient(ellipse at 80% 15%, rgba(220, 38, 38, 0.3) 0%, transparent 50%), linear-gradient(180deg, #120303 0%, #220808 30%, #2d0e0e 60%, #150505 100%)',
    orb1: '#ef4444', orb2: '#b91c1c', orb3: '#991b1b', orb4: '#dc2626', orb5: '#f87171',
    opacity1: 0.38, opacity2: 0.3, opacity3: 0.22, opacity4: 0.16, opacity5: 0.12,
    auroraColor1: 'rgba(239, 68, 68, 0.18)', auroraColor2: 'rgba(185, 28, 28, 0.15)',
    auroraOpacity: 0.85,
    pulseColor: 'rgba(220, 38, 38, 0.2)', pulseOpacity: 0.7,
  },
  'clash': {
    gradient: 'radial-gradient(ellipse at 25% 15%, rgba(245, 158, 11, 0.55) 0%, transparent 55%), radial-gradient(ellipse at 75% 85%, rgba(239, 68, 68, 0.45) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(234, 179, 8, 0.28) 0%, transparent 60%), radial-gradient(ellipse at 10% 40%, rgba(251, 146, 60, 0.35) 0%, transparent 50%), linear-gradient(180deg, #120805 0%, #251810 30%, #302012 60%, #180c06 100%)',
    orb1: '#f59e0b', orb2: '#ef4444', orb3: '#eab308', orb4: '#fb923c', orb5: '#fbbf24',
    opacity1: 0.42, opacity2: 0.35, opacity3: 0.28, opacity4: 0.2, opacity5: 0.15,
    auroraColor1: 'rgba(245, 158, 11, 0.22)', auroraColor2: 'rgba(239, 68, 68, 0.2)',
    auroraOpacity: 1,
    pulseColor: 'rgba(234, 179, 8, 0.25)', pulseOpacity: 0.85,
  },
};

const EVENT_DURATION: Record<GameEvent, number> = {
  'idle': 0,
  'my-turn': 8000,
  'opponent-turn': 5000,
  'attack': 4000,
  'defense': 3500,
  'death': 5000,
  'evolution': 6000,
  'bonus': 3000,
  'dice': 3500,
  'special-move': 4500,
  'card-played': 2500,
  'hostage': 4000,
  'clash': 6000,
};

const EVENT_PRIORITY: Record<GameEvent, number> = {
  'idle': 0,
  'opponent-turn': 1,
  'my-turn': 2,
  'card-played': 3,
  'bonus': 4,
  'dice': 5,
  'defense': 6,
  'attack': 7,
  'special-move': 8,
  'hostage': 9,
  'death': 10,
  'evolution': 11,
  'clash': 12,
};

interface BackgroundEffectState {
  currentEvent: GameEvent;
  colors: EventColors;
  resetTimer: ReturnType<typeof setTimeout> | null;
  triggerEvent: (event: GameEvent) => void;
  reset: () => void;
}

export const useBackgroundEffect = create<BackgroundEffectState>((set, get) => ({
  currentEvent: 'idle',
  colors: EVENT_COLORS['idle'],
  resetTimer: null,

  triggerEvent: (event: GameEvent) => {
    const state = get();
    
    if (state.currentEvent !== 'idle' && EVENT_PRIORITY[event] < EVENT_PRIORITY[state.currentEvent]) {
      return;
    }

    if (state.resetTimer) {
      clearTimeout(state.resetTimer);
    }

    const duration = EVENT_DURATION[event];
    const timer = duration > 0 ? setTimeout(() => {
      set({ currentEvent: 'idle', colors: EVENT_COLORS['idle'], resetTimer: null });
    }, duration) : null;

    set({
      currentEvent: event,
      colors: EVENT_COLORS[event],
      resetTimer: timer,
    });
  },

  reset: () => {
    const state = get();
    if (state.resetTimer) {
      clearTimeout(state.resetTimer);
    }
    set({ currentEvent: 'idle', colors: EVENT_COLORS['idle'], resetTimer: null });
  },
}));

export { EVENT_COLORS };
