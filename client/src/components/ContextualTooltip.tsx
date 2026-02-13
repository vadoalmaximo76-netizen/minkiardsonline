import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, Info } from 'lucide-react';
import { create } from 'zustand';

interface TooltipData {
  id: string;
  trigger: string;
  title: string;
  message: string;
  position: string;
  isActive: boolean;
  priority: number;
}

interface TooltipStore {
  tooltips: TooltipData[];
  dismissedIds: string[];
  currentTooltip: TooltipData | null;
  setTooltips: (tooltips: TooltipData[]) => void;
  triggerTooltip: (trigger: string) => void;
  dismissCurrent: () => void;
  dismissAll: () => void;
  isLoaded: boolean;
  setLoaded: (v: boolean) => void;
}

const DISMISSED_KEY = 'minkiards_dismissed_tooltips';

const loadDismissed = (): string[] => {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

const saveDismissed = (ids: string[]) => {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
};

export const useTooltipStore = create<TooltipStore>((set, get) => ({
  tooltips: [],
  dismissedIds: loadDismissed(),
  currentTooltip: null,
  isLoaded: false,
  setLoaded: (v) => set({ isLoaded: v }),
  setTooltips: (tooltips) => set({ tooltips }),
  triggerTooltip: (trigger) => {
    const state = get();
    if (state.currentTooltip) return;
    const match = state.tooltips
      .filter(t => t.trigger === trigger && t.isActive && !state.dismissedIds.includes(t.id))
      .sort((a, b) => a.priority - b.priority)[0];
    if (match) {
      set({ currentTooltip: match });
    }
  },
  dismissCurrent: () => {
    const state = get();
    if (state.currentTooltip) {
      const newDismissed = [...state.dismissedIds, state.currentTooltip.id];
      saveDismissed(newDismissed);
      set({ dismissedIds: newDismissed, currentTooltip: null });
    }
  },
  dismissAll: () => {
    const allIds = get().tooltips.map(t => t.id);
    saveDismissed(allIds);
    set({ dismissedIds: allIds, currentTooltip: null });
  },
}));

export const ContextualTooltipLoader: React.FC = () => {
  const { setTooltips, setLoaded, isLoaded } = useTooltipStore();

  useEffect(() => {
    if (isLoaded) return;
    fetch('/api/contextual-tooltips')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.tooltips) {
          setTooltips(data.tooltips);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [isLoaded, setTooltips, setLoaded]);

  return null;
};

export const ContextualTooltipDisplay: React.FC = () => {
  const { currentTooltip, dismissCurrent, dismissAll } = useTooltipStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (currentTooltip) {
      const timer = setTimeout(() => setVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [currentTooltip]);

  if (!currentTooltip) return null;

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(dismissCurrent, 300);
  };

  const handleDismissAll = () => {
    setVisible(false);
    setTimeout(dismissAll, 300);
  };

  const positionClass = currentTooltip.position === 'top'
    ? 'top-20 left-1/2 -translate-x-1/2'
    : currentTooltip.position === 'bottom'
    ? 'bottom-24 left-1/2 -translate-x-1/2'
    : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';

  return (
    <div className={`fixed ${positionClass} z-[90] max-w-sm w-[90vw] transition-all duration-300 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
      <div className="bg-gradient-to-br from-indigo-900/95 to-purple-900/95 backdrop-blur-xl border border-purple-400/30 rounded-2xl p-4 shadow-2xl shadow-purple-900/40">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Info size={16} className="text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-bold text-sm mb-1">{currentTooltip.title}</h4>
            <p className="text-white/80 text-xs leading-relaxed">{currentTooltip.message}</p>
          </div>
          <button onClick={handleDismiss} className="text-white/50 hover:text-white/90 transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/10">
          <button onClick={handleDismissAll} className="text-white/40 hover:text-white/70 text-xs transition-colors">
            Non mostrare più
          </button>
          <button onClick={handleDismiss} className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-xs font-medium transition-colors">
            Ho capito <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};