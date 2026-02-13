import React, { useState, useEffect, useCallback } from 'react';
import { create } from 'zustand';

type ToastType = 'attack' | 'defense' | 'death' | 'evolution' | 'bonus' | 'dice' | 'turn' | 'system' | 'success' | 'error';

interface GameToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface GameToastStore {
  toasts: GameToastItem[];
  addToast: (message: string, type: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const TOAST_ICONS: Record<ToastType, string> = {
  attack: '⚔️',
  defense: '🛡️',
  death: '💀',
  evolution: '✨',
  bonus: '🎁',
  dice: '🎲',
  turn: '🔄',
  system: '📋',
  success: '✅',
  error: '❌',
};

const TOAST_COLORS: Record<ToastType, string> = {
  attack: 'from-red-600/90 to-red-800/90 border-red-400/50',
  defense: 'from-blue-600/90 to-blue-800/90 border-blue-400/50',
  death: 'from-gray-700/90 to-gray-900/90 border-gray-400/50',
  evolution: 'from-amber-500/90 to-yellow-700/90 border-yellow-400/50',
  bonus: 'from-green-600/90 to-emerald-800/90 border-green-400/50',
  dice: 'from-purple-600/90 to-purple-800/90 border-purple-400/50',
  turn: 'from-cyan-600/90 to-cyan-800/90 border-cyan-400/50',
  system: 'from-slate-600/90 to-slate-800/90 border-slate-400/50',
  success: 'from-green-500/90 to-green-700/90 border-green-400/50',
  error: 'from-red-500/90 to-red-700/90 border-red-400/50',
};

export const useGameToast = create<GameToastStore>((set) => ({
  toasts: [],
  addToast: (message, type, duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    set((state) => ({
      toasts: [...state.toasts.slice(-4), { id, message, type, duration }],
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, duration);
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

const GameToastItemComponent: React.FC<{ toast: GameToastItem; onRemove: () => void }> = ({ toast, onRemove }) => {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), (toast.duration || 3000) - 400);
    return () => clearTimeout(timer);
  }, [toast.duration]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md bg-gradient-to-r ${TOAST_COLORS[toast.type]} text-white shadow-2xl cursor-pointer ${exiting ? 'animate-toast-exit' : 'animate-toast-enter'}`}
      onClick={onRemove}
    >
      <span className="text-xl animate-toast-icon">{TOAST_ICONS[toast.type]}</span>
      <span className="text-sm font-medium">{toast.message}</span>
    </div>
  );
};

export const GameToastContainer: React.FC = () => {
  const { toasts, removeToast } = useGameToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <GameToastItemComponent key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};
