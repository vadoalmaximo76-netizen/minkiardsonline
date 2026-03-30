import { create } from "zustand";

export type GamepadFocusZone = 'hand' | 'field-own' | 'field-enemy';

interface GamepadStore {
  connected: boolean;
  gamepadIndex: number | null;
  focusZone: GamepadFocusZone;
  focusIndex: number;
  modalFocusIndex: number;
  setConnected: (v: boolean) => void;
  setGamepadIndex: (v: number | null) => void;
  setFocusZone: (z: GamepadFocusZone) => void;
  setFocusIndex: (i: number) => void;
  setModalFocusIndex: (i: number) => void;
}

export const useGamepadStore = create<GamepadStore>((set) => ({
  connected: false,
  gamepadIndex: null,
  focusZone: 'hand',
  focusIndex: 0,
  modalFocusIndex: 0,
  setConnected: (connected) => set({ connected }),
  setGamepadIndex: (gamepadIndex) => set({ gamepadIndex }),
  setFocusZone: (focusZone) => set({ focusZone, focusIndex: 0, modalFocusIndex: 0 }),
  setFocusIndex: (focusIndex) => set({ focusIndex }),
  setModalFocusIndex: (modalFocusIndex) => set({ modalFocusIndex }),
}));
