import { create } from 'zustand';

interface NarratorStore {
  enabled: boolean;
  currentMessage: string;
  visible: boolean;
  setEnabled: (enabled: boolean) => void;
  showMessage: (message: string) => void;
  dismiss: () => void;
}

const useNarrator = create<NarratorStore>((set) => ({
  enabled: localStorage.getItem('minkiards_narrator_enabled') !== 'false',
  currentMessage: '',
  visible: false,
  setEnabled: (enabled: boolean) => {
    localStorage.setItem('minkiards_narrator_enabled', String(enabled));
    set({ enabled });
  },
  showMessage: (message: string) => set({ currentMessage: message, visible: true }),
  dismiss: () => set({ visible: false, currentMessage: '' }),
}));

export default useNarrator;
