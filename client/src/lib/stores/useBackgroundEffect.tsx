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
  opacity1: number;
  opacity2: number;
  opacity3: number;
}

const EVENT_COLORS: Record<GameEvent, EventColors> = {
  'idle': {
    gradient: 'radial-gradient(ellipse at 30% 20%, rgba(88, 28, 135, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(30, 58, 138, 0.12) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(6, 182, 212, 0.05) 0%, transparent 60%), linear-gradient(180deg, #050810 0%, #0a0f1e 40%, #0d1228 70%, #080c18 100%)',
    orb1: '#9333ea', orb2: '#3b82f6', orb3: '#06b6d4',
    opacity1: 0.07, opacity2: 0.05, opacity3: 0.04,
  },
  'my-turn': {
    gradient: 'radial-gradient(ellipse at 30% 20%, rgba(234, 179, 8, 0.2) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(245, 158, 11, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(251, 191, 36, 0.08) 0%, transparent 60%), linear-gradient(180deg, #0a0800 0%, #141005 40%, #1a1508 70%, #0c0a02 100%)',
    orb1: '#eab308', orb2: '#f59e0b', orb3: '#fbbf24',
    opacity1: 0.1, opacity2: 0.08, opacity3: 0.06,
  },
  'opponent-turn': {
    gradient: 'radial-gradient(ellipse at 30% 20%, rgba(59, 130, 246, 0.18) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(99, 102, 241, 0.14) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(139, 92, 246, 0.06) 0%, transparent 60%), linear-gradient(180deg, #030810 0%, #081020 40%, #0a1530 70%, #050a18 100%)',
    orb1: '#3b82f6', orb2: '#6366f1', orb3: '#8b5cf6',
    opacity1: 0.09, opacity2: 0.07, opacity3: 0.05,
  },
  'attack': {
    gradient: 'radial-gradient(ellipse at 40% 30%, rgba(239, 68, 68, 0.25) 0%, transparent 50%), radial-gradient(ellipse at 60% 70%, rgba(249, 115, 22, 0.2) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(220, 38, 38, 0.1) 0%, transparent 60%), linear-gradient(180deg, #100505 0%, #1a0808 40%, #200a0a 70%, #0f0404 100%)',
    orb1: '#ef4444', orb2: '#f97316', orb3: '#dc2626',
    opacity1: 0.15, opacity2: 0.12, opacity3: 0.1,
  },
  'defense': {
    gradient: 'radial-gradient(ellipse at 30% 20%, rgba(59, 130, 246, 0.22) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(6, 182, 212, 0.18) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(14, 165, 233, 0.08) 0%, transparent 60%), linear-gradient(180deg, #030810 0%, #061020 40%, #081828 70%, #040a15 100%)',
    orb1: '#3b82f6', orb2: '#06b6d4', orb3: '#0ea5e9',
    opacity1: 0.14, opacity2: 0.11, opacity3: 0.08,
  },
  'death': {
    gradient: 'radial-gradient(ellipse at 40% 40%, rgba(139, 92, 246, 0.25) 0%, transparent 50%), radial-gradient(ellipse at 60% 60%, rgba(88, 28, 135, 0.2) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(0, 0, 0, 0.15) 0%, transparent 60%), linear-gradient(180deg, #050310 0%, #0a0518 40%, #0d0820 70%, #060310 100%)',
    orb1: '#8b5cf6', orb2: '#581c87', orb3: '#1e1b4b',
    opacity1: 0.18, opacity2: 0.14, opacity3: 0.1,
  },
  'evolution': {
    gradient: 'radial-gradient(ellipse at 30% 20%, rgba(234, 179, 8, 0.28) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(245, 158, 11, 0.22) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(252, 211, 77, 0.12) 0%, transparent 60%), linear-gradient(180deg, #0a0800 0%, #151005 40%, #1f1a08 70%, #0d0a02 100%)',
    orb1: '#eab308', orb2: '#f59e0b', orb3: '#fcd34d',
    opacity1: 0.2, opacity2: 0.15, opacity3: 0.12,
  },
  'bonus': {
    gradient: 'radial-gradient(ellipse at 30% 20%, rgba(34, 197, 94, 0.22) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(16, 185, 129, 0.18) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(52, 211, 153, 0.08) 0%, transparent 60%), linear-gradient(180deg, #030a05 0%, #081510 40%, #0a1a12 70%, #050c08 100%)',
    orb1: '#22c55e', orb2: '#10b981', orb3: '#34d399',
    opacity1: 0.14, opacity2: 0.1, opacity3: 0.08,
  },
  'dice': {
    gradient: 'radial-gradient(ellipse at 30% 20%, rgba(6, 182, 212, 0.22) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(20, 184, 166, 0.18) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(34, 211, 238, 0.1) 0%, transparent 60%), linear-gradient(180deg, #030a0d 0%, #081518 40%, #0a1a1e 70%, #050c10 100%)',
    orb1: '#06b6d4', orb2: '#14b8a6', orb3: '#22d3ee',
    opacity1: 0.15, opacity2: 0.12, opacity3: 0.09,
  },
  'special-move': {
    gradient: 'radial-gradient(ellipse at 30% 20%, rgba(249, 115, 22, 0.22) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(239, 68, 68, 0.18) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(245, 158, 11, 0.1) 0%, transparent 60%), linear-gradient(180deg, #100805 0%, #1a0f08 40%, #20140a 70%, #0f0a04 100%)',
    orb1: '#f97316', orb2: '#ef4444', orb3: '#f59e0b',
    opacity1: 0.16, opacity2: 0.12, opacity3: 0.09,
  },
  'card-played': {
    gradient: 'radial-gradient(ellipse at 30% 20%, rgba(99, 102, 241, 0.2) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(139, 92, 246, 0.16) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(168, 85, 247, 0.08) 0%, transparent 60%), linear-gradient(180deg, #050510 0%, #0a0a1e 40%, #0f0f28 70%, #080818 100%)',
    orb1: '#6366f1', orb2: '#8b5cf6', orb3: '#a855f7',
    opacity1: 0.12, opacity2: 0.09, opacity3: 0.07,
  },
  'hostage': {
    gradient: 'radial-gradient(ellipse at 30% 20%, rgba(239, 68, 68, 0.2) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(185, 28, 28, 0.16) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(153, 27, 27, 0.1) 0%, transparent 60%), linear-gradient(180deg, #100303 0%, #1a0505 40%, #200808 70%, #0f0303 100%)',
    orb1: '#ef4444', orb2: '#b91c1c', orb3: '#991b1b',
    opacity1: 0.16, opacity2: 0.12, opacity3: 0.09,
  },
  'clash': {
    gradient: 'radial-gradient(ellipse at 30% 20%, rgba(245, 158, 11, 0.25) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(239, 68, 68, 0.2) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(234, 179, 8, 0.12) 0%, transparent 60%), linear-gradient(180deg, #100805 0%, #1a1008 40%, #201a0a 70%, #0f0a04 100%)',
    orb1: '#f59e0b', orb2: '#ef4444', orb3: '#eab308',
    opacity1: 0.18, opacity2: 0.14, opacity3: 0.1,
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
