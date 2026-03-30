import { create } from "zustand";
import type { AppSection } from "../../hooks/useGamepad";

export type GamepadFocusZone = 'hand' | 'field-own' | 'field-enemy';

interface GamepadStore {
  connected: boolean;
  gamepadIndex: number | null;
  focusZone: GamepadFocusZone;
  focusIndex: number;
  modalFocusIndex: number;
  navSection: AppSection;
  primaryAction: (() => void) | undefined;
  setConnected: (v: boolean) => void;
  setGamepadIndex: (v: number | null) => void;
  setFocusZone: (z: GamepadFocusZone) => void;
  setFocusIndex: (i: number) => void;
  setModalFocusIndex: (i: number) => void;
  setNavSection: (section: AppSection) => void;
  setPrimaryAction: (action: (() => void) | undefined) => void;
}

export const useGamepadStore = create<GamepadStore>((set) => ({
  connected: false,
  gamepadIndex: null,
  focusZone: 'hand',
  focusIndex: 0,
  modalFocusIndex: 0,
  navSection: 'home',
  primaryAction: undefined,
  setConnected: (connected) => set({ connected }),
  setGamepadIndex: (gamepadIndex) => set({ gamepadIndex }),
  setFocusZone: (focusZone) => set({ focusZone, focusIndex: 0, modalFocusIndex: 0 }),
  setFocusIndex: (focusIndex) => set({ focusIndex }),
  setModalFocusIndex: (modalFocusIndex) => set({ modalFocusIndex }),
  setNavSection: (navSection) => set({ navSection }),
  setPrimaryAction: (primaryAction) => set({ primaryAction }),
}));
