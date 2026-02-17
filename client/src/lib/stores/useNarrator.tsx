import { create } from 'zustand';

interface NarratorStore {
  enabled: boolean;
  currentMessage: string;
  visible: boolean;
  selectedVoiceName: string;
  setEnabled: (enabled: boolean) => void;
  showMessage: (message: string) => void;
  dismiss: () => void;
  setSelectedVoiceName: (name: string) => void;
}

const useNarrator = create<NarratorStore>((set) => ({
  enabled: localStorage.getItem('minkiards_narrator_enabled') !== 'false',
  currentMessage: '',
  visible: false,
  selectedVoiceName: localStorage.getItem('minkiards_narrator_voice') || '',
  setEnabled: (enabled: boolean) => {
    localStorage.setItem('minkiards_narrator_enabled', String(enabled));
    set({ enabled });
  },
  showMessage: (message: string) => set({ currentMessage: message, visible: true }),
  dismiss: () => set({ visible: false, currentMessage: '' }),
  setSelectedVoiceName: (name: string) => {
    localStorage.setItem('minkiards_narrator_voice', name);
    set({ selectedVoiceName: name });
  },
}));

export default useNarrator;
