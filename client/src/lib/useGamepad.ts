import { useEffect, useRef, useCallback } from "react";
import { useGamepadStore, GamepadFocusZone } from "./stores/useGamepadStore";
import { useGameState } from "./stores/useGameState";

const AXIS_DEAD_ZONE = 0.5;
const REPEAT_DELAY_MS = 500;
const REPEAT_INTERVAL_MS = 150;

type ButtonRepeatEntry = { timer: ReturnType<typeof setTimeout> | null; interval: ReturnType<typeof setInterval> | null };

interface GameCard {
  id: string;
  owner: string;
}

function getHandCards(playerName: string): GameCard[] {
  const gs = useGameState.getState().gameState;
  return (gs?.players?.[playerName]?.hand ?? []) as GameCard[];
}

function getFieldCards(playerName: string, zone: GamepadFocusZone): GameCard[] {
  const gs = useGameState.getState().gameState;
  const field = (gs?.field ?? []) as GameCard[];
  if (zone === 'field-own') return field.filter(c => c.owner === playerName);
  if (zone === 'field-enemy') return field.filter(c => c.owner !== playerName);
  return [];
}

function getZoneCards(playerName: string, zone: GamepadFocusZone): GameCard[] {
  if (zone === 'hand') return getHandCards(playerName);
  return getFieldCards(playerName, zone);
}

function clickCardById(cardId: string): void {
  const cardOuter = document.querySelector<HTMLElement>(`[data-card-id="${cardId}"]`);
  if (!cardOuter) return;
  const clickable = cardOuter.querySelector<HTMLElement>('[data-card-clickable="true"]');
  (clickable ?? cardOuter).click();
}

function clickEndTurnButton(): void {
  const btn = document.querySelector<HTMLElement>('[data-action="end-turn"]');
  btn?.click();
}

function isModalOpen(): boolean {
  return !!(
    document.querySelector('[data-modal="hand"]') ||
    document.querySelector('[data-modal="dice"]') ||
    document.querySelector('[data-modal="target"]')
  );
}

function navigateModal(direction: 'left' | 'right'): void {
  const store = useGamepadStore.getState();
  const focused = document.querySelectorAll<HTMLElement>('[data-modal-option]');
  if (focused.length === 0) return;
  const total = focused.length;
  const current = Math.min(store.modalFocusIndex, total - 1);
  const next =
    direction === 'left'
      ? (current - 1 + total) % total
      : (current + 1) % total;
  store.setModalFocusIndex(next);
  focused[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function confirmModal(): void {
  const store = useGamepadStore.getState();
  const focused = document.querySelectorAll<HTMLElement>('[data-modal-option]');
  const el = focused[store.modalFocusIndex];
  if (!el) return;
  const clickable = el.querySelector<HTMLElement>('[data-card-clickable="true"]');
  (clickable ?? el).click();
}

export function useGamepad() {
  const rafRef = useRef<number | null>(null);
  const prevButtonsRef = useRef<boolean[]>([]);
  const buttonHeldRef = useRef<Record<number, ButtonRepeatEntry>>({});
  const prevAxisRef = useRef<'neutral' | 'left' | 'right'>('neutral');

  const clearButtonRepeat = useCallback((btn: number) => {
    const held = buttonHeldRef.current[btn];
    if (!held) return;
    if (held.timer) clearTimeout(held.timer);
    if (held.interval) clearInterval(held.interval);
    buttonHeldRef.current[btn] = { timer: null, interval: null };
  }, []);

  const navigate = useCallback((direction: 'left' | 'right') => {
    if (isModalOpen()) {
      navigateModal(direction);
      return;
    }

    const store = useGamepadStore.getState();
    const pName = useGameState.getState().playerName;
    const cards = getZoneCards(pName, store.focusZone);
    const count = cards.length;
    if (count === 0) return;
    const next =
      direction === 'left'
        ? (store.focusIndex - 1 + count) % count
        : (store.focusIndex + 1) % count;
    store.setFocusIndex(next);
  }, []);

  const changeZone = useCallback((direction: 'next' | 'prev') => {
    if (isModalOpen()) return;
    const store = useGamepadStore.getState();
    const zones: GamepadFocusZone[] = ['hand', 'field-own', 'field-enemy'];
    const idx = zones.indexOf(store.focusZone);
    const next =
      direction === 'next'
        ? (idx + 1) % zones.length
        : (idx - 1 + zones.length) % zones.length;
    store.setFocusZone(zones[next]);
  }, []);

  const confirmAction = useCallback(() => {
    if (isModalOpen()) {
      confirmModal();
      return;
    }

    const store = useGamepadStore.getState();
    const pName = useGameState.getState().playerName;
    const cards = getZoneCards(pName, store.focusZone);
    const card = cards[store.focusIndex];
    if (!card) return;
    clickCardById(card.id);
  }, []);

  const cancelAction = useCallback(() => {
    const store = useGamepadStore.getState();
    if (isModalOpen()) {
      store.setModalFocusIndex(0);
      const cancelBtn = document.querySelector<HTMLButtonElement>('[data-modal-cancel]');
      if (cancelBtn) {
        cancelBtn.click();
        return;
      }
      const targetModal = document.querySelector<HTMLElement>('[data-modal="target"]');
      if (targetModal) {
        targetModal.click();
        return;
      }
    }
    store.setFocusZone('hand');
    store.setFocusIndex(0);
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(escEvent);
  }, []);

  const endTurn = useCallback(() => {
    clickEndTurnButton();
  }, []);

  const handleButtonPress = useCallback((btn: number) => {
    switch (btn) {
      case 0: confirmAction(); break;
      case 1: cancelAction(); break;
      case 9: endTurn(); break;
      case 4: changeZone('prev'); break;
      case 5: changeZone('next'); break;
      default: break;
    }
  }, [confirmAction, cancelAction, endTurn, changeZone]);

  const pollGamepad = useCallback(() => {
    const store = useGamepadStore.getState();
    const gamepadIndex = store.gamepadIndex;

    if (gamepadIndex === null) {
      rafRef.current = requestAnimationFrame(pollGamepad);
      return;
    }

    const gamepads = navigator.getGamepads();
    const gp = gamepads[gamepadIndex];

    if (!gp) {
      rafRef.current = requestAnimationFrame(pollGamepad);
      return;
    }

    const prev = prevButtonsRef.current;
    const curr = gp.buttons.map(b => b.pressed);

    curr.forEach((pressed, i) => {
      const wasPrev = prev[i] ?? false;
      if (pressed && !wasPrev) {
        handleButtonPress(i);
        if (i === 14 || i === 15) {
          if (!buttonHeldRef.current[i]) buttonHeldRef.current[i] = { timer: null, interval: null };
          clearButtonRepeat(i);
          const dir: 'left' | 'right' = i === 14 ? 'left' : 'right';
          navigate(dir);
          buttonHeldRef.current[i].timer = setTimeout(() => {
            buttonHeldRef.current[i].interval = setInterval(() => navigate(dir), REPEAT_INTERVAL_MS);
          }, REPEAT_DELAY_MS);
        }
      } else if (!pressed && wasPrev) {
        clearButtonRepeat(i);
      }
    });
    prevButtonsRef.current = curr;

    const lx = gp.axes[0] ?? 0;
    const prevAxis = prevAxisRef.current;
    if (Math.abs(lx) < AXIS_DEAD_ZONE) {
      prevAxisRef.current = 'neutral';
    } else if (lx < -AXIS_DEAD_ZONE && prevAxis !== 'left') {
      prevAxisRef.current = 'left';
      navigate('left');
    } else if (lx > AXIS_DEAD_ZONE && prevAxis !== 'right') {
      prevAxisRef.current = 'right';
      navigate('right');
    }

    rafRef.current = requestAnimationFrame(pollGamepad);
  }, [handleButtonPress, navigate, clearButtonRepeat]);

  useEffect(() => {
    const handleConnect = (e: GamepadEvent) => {
      console.log('[Gamepad] Connected:', e.gamepad.id);
      useGamepadStore.getState().setConnected(true);
      useGamepadStore.getState().setGamepadIndex(e.gamepad.index);
      window.dispatchEvent(
        new CustomEvent<{ id: string }>('gamepad-connected', { detail: { id: e.gamepad.id } })
      );
    };

    const handleDisconnect = (e: GamepadEvent) => {
      console.log('[Gamepad] Disconnected:', e.gamepad.id);
      useGamepadStore.getState().setConnected(false);
      useGamepadStore.getState().setGamepadIndex(null);
      window.dispatchEvent(
        new CustomEvent<{ id: string }>('gamepad-disconnected', { detail: { id: e.gamepad.id } })
      );
    };

    window.addEventListener('gamepadconnected', handleConnect);
    window.addEventListener('gamepaddisconnected', handleDisconnect);

    const existing = navigator.getGamepads();
    for (let i = 0; i < existing.length; i++) {
      const gp = existing[i];
      if (gp) {
        useGamepadStore.getState().setConnected(true);
        useGamepadStore.getState().setGamepadIndex(gp.index);
        break;
      }
    }

    rafRef.current = requestAnimationFrame(pollGamepad);

    return () => {
      window.removeEventListener('gamepadconnected', handleConnect);
      window.removeEventListener('gamepaddisconnected', handleDisconnect);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      Object.keys(buttonHeldRef.current).forEach(k => clearButtonRepeat(Number(k)));
    };
  }, [pollGamepad, clearButtonRepeat]);
}
