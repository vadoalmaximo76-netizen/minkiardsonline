import { create } from 'zustand';

export type VoiceType = 'device' | 'cloud';

interface NarratorStore {
  enabled: boolean;
  currentMessage: string;
  visible: boolean;
  selectedVoiceName: string;
  selectedVoiceType: VoiceType;
  setEnabled: (enabled: boolean) => void;
  showMessage: (message: string) => void;
  dismiss: () => void;
  setSelectedVoice: (name: string, type: VoiceType) => void;
}

const useNarrator = create<NarratorStore>((set) => ({
  enabled: localStorage.getItem('minkiards_narrator_enabled') !== 'false',
  currentMessage: '',
  visible: false,
  selectedVoiceName: localStorage.getItem('minkiards_narrator_voice') || '',
  selectedVoiceType: (localStorage.getItem('minkiards_narrator_voice_type') as VoiceType) || 'device',
  setEnabled: (enabled: boolean) => {
    localStorage.setItem('minkiards_narrator_enabled', String(enabled));
    set({ enabled });
  },
  showMessage: (message: string) => set({ currentMessage: message, visible: true }),
  dismiss: () => set({ visible: false, currentMessage: '' }),
  setSelectedVoice: (name: string, type: VoiceType) => {
    localStorage.setItem('minkiards_narrator_voice', name);
    localStorage.setItem('minkiards_narrator_voice_type', type);
    set({ selectedVoiceName: name, selectedVoiceType: type });
  },
}));

export default useNarrator;
