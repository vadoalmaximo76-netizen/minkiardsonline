import { useEffect, useRef, useState, useCallback } from 'react';

export type AppSection = 'home' | 'play' | 'training' | 'rooms' | 'profile' | 'spectator' | 'admin' | 'draft' | 'leaderboard' | 'tournaments' | 'fanta' | 'gym';

export const BOTTOM_NAV_SECTIONS: AppSection[] = ['home', 'play', 'draft', 'tournaments', 'fanta'];

export const GAMEPAD_DEADZONE = 0.15;
export const GAMEPAD_CURSOR_SPEED = 8;

export interface GamepadButtonEvents {
  onButtonA: () => void;
  onButtonB: () => void;
  onLB: () => void;
  onRB: () => void;
  onStart: () => void;
  onDpadLeft: () => void;
  onDpadRight: () => void;
  onDpadUp: () => void;
  onDpadDown: () => void;
}

export interface GamepadState {
  connected: boolean;
  cursorX: number;
  cursorY: number;
  cursorVisible: boolean;
  mode: 'cursor' | 'game';
}

interface UseGamepadOptions {
  currentSection: AppSection;
  events: GamepadButtonEvents;
}

export function useGamepad({ currentSection, events }: UseGamepadOptions): GamepadState {
  const [connected, setConnected] = useState(false);
  const [cursor, setCursor] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [cursorVisible, setCursorVisible] = useState(false);

  const cursorRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const mouseActiveRef = useRef(false);
  const mouseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const prevButtonsRef = useRef<boolean[]>([]);
  const dpadCooldownRef = useRef(0);
  const connectedRef = useRef(false);

  const currentSectionRef = useRef(currentSection);
  const eventsRef = useRef(events);

  useEffect(() => { currentSectionRef.current = currentSection; }, [currentSection]);
  useEffect(() => { eventsRef.current = events; }, [events]);

  useEffect(() => {
    const onMouse = () => {
      mouseActiveRef.current = true;
      setCursorVisible(false);
      if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
      mouseTimerRef.current = setTimeout(() => {
        mouseActiveRef.current = false;
        if (connectedRef.current && currentSectionRef.current !== 'play') {
          setCursorVisible(true);
        }
      }, 3000);
    };
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('touchstart', onMouse, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('touchstart', onMouse);
      if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onConnect = (e: GamepadEvent) => {
      console.log('[Gamepad] Connected:', e.gamepad.id);
      setConnected(true);
      connectedRef.current = true;
      if (!mouseActiveRef.current && currentSectionRef.current !== 'play') {
        setCursorVisible(true);
      }
    };
    const onDisconnect = (e: GamepadEvent) => {
      console.log('[Gamepad] Disconnected:', e.gamepad.id);
      setConnected(false);
      connectedRef.current = false;
      setCursorVisible(false);
    };

    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);

    const pads = navigator.getGamepads?.();
    if (pads) {
      for (const pad of pads) {
        if (pad && pad.connected) {
          setConnected(true);
          connectedRef.current = true;
          if (!mouseActiveRef.current) setCursorVisible(true);
          break;
        }
      }
    }

    return () => {
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
    };
  }, []);

  const handleButtonEdge = useCallback((index: number, pressed: boolean, wasPressed: boolean, ts: number) => {
    if (!pressed || wasPressed) return;
    const ev = eventsRef.current;
    switch (index) {
      case 0: ev.onButtonA(); break;
      case 1: ev.onButtonB(); break;
      case 4: ev.onLB(); break;
      case 5: ev.onRB(); break;
      case 9: ev.onStart(); break;
    }
  }, []);

  useEffect(() => {
    const loop = (ts: number) => {
      const pads = navigator.getGamepads?.();
      if (pads) {
        let pad: Gamepad | null = null;
        for (const p of pads) { if (p && p.connected) { pad = p; break; } }

        if (pad) {
          const section = currentSectionRef.current;
          const isInGame = section === 'play';

          if (!isInGame) {
            const ax = pad.axes[0] ?? 0;
            const ay = pad.axes[1] ?? 0;
            const dx = Math.abs(ax) > GAMEPAD_DEADZONE ? ax : 0;
            const dy = Math.abs(ay) > GAMEPAD_DEADZONE ? ay : 0;

            if (dx !== 0 || dy !== 0) {
              const nx = Math.max(0, Math.min(window.innerWidth, cursorRef.current.x + dx * GAMEPAD_CURSOR_SPEED));
              const ny = Math.max(0, Math.min(window.innerHeight, cursorRef.current.y + dy * GAMEPAD_CURSOR_SPEED));
              cursorRef.current = { x: nx, y: ny };
              setCursor({ x: nx, y: ny });
              if (!mouseActiveRef.current) setCursorVisible(true);
            }

            const buttons = pad.buttons;
            const prev = prevButtonsRef.current;
            buttons.forEach((btn, i) => {
              handleButtonEdge(i, btn.pressed, prev[i] ?? false, ts);
            });

            if (ts - dpadCooldownRef.current > 300) {
              const ev = eventsRef.current;
              const dpadUp = pad.buttons[12]?.pressed;
              const dpadDown = pad.buttons[13]?.pressed;
              const dpadLeft = pad.buttons[14]?.pressed;
              const dpadRight = pad.buttons[15]?.pressed;
              if (dpadUp) { ev.onDpadUp(); dpadCooldownRef.current = ts; }
              else if (dpadDown) { ev.onDpadDown(); dpadCooldownRef.current = ts; }
              else if (dpadLeft) { ev.onDpadLeft(); dpadCooldownRef.current = ts; }
              else if (dpadRight) { ev.onDpadRight(); dpadCooldownRef.current = ts; }
            }

            prevButtonsRef.current = pad.buttons.map(b => b.pressed);
          } else {
            setCursorVisible(false);
            prevButtonsRef.current = [];
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [handleButtonEdge]);

  return {
    connected,
    cursorX: cursor.x,
    cursorY: cursor.y,
    cursorVisible: cursorVisible && connected && currentSection !== 'play',
    mode: currentSection === 'play' ? 'game' : 'cursor',
  };
}
