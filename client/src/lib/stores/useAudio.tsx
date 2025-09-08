import { create } from "zustand";

interface AudioState {
  backgroundMusic: HTMLAudioElement | null;
  hitSound: HTMLAudioElement | null;
  successSound: HTMLAudioElement | null;
  isMuted: boolean;
  audioContext: AudioContext | null;
  
  // Setter functions
  setBackgroundMusic: (music: HTMLAudioElement) => void;
  setHitSound: (sound: HTMLAudioElement) => void;
  setSuccessSound: (sound: HTMLAudioElement) => void;
  
  // Control functions
  toggleMute: () => void;
  playHit: () => void;
  playSuccess: () => void;
  playGameStart: () => void;
  playPlayerJoin: () => void;
  playChatMessage: () => void;
  playCardToGraveyard: () => void;
  playDiceRoll: () => void;
  playDamageSound: () => void;
  playBeeSound: () => void;
  initAudioContext: () => void;
}

export const useAudio = create<AudioState>((set, get) => ({
  backgroundMusic: null,
  hitSound: null,
  successSound: null,
  isMuted: true, // Start muted by default
  audioContext: null,
  
  setBackgroundMusic: (music) => set({ backgroundMusic: music }),
  setHitSound: (sound) => set({ hitSound: sound }),
  setSuccessSound: (sound) => set({ successSound: sound }),
  
  toggleMute: () => {
    const { isMuted } = get();
    const newMutedState = !isMuted;
    
    // Just update the muted state
    set({ isMuted: newMutedState });
    
    // Log the change
    console.log(`Sound ${newMutedState ? 'muted' : 'unmuted'}`);
  },
  
  playHit: () => {
    const { hitSound, isMuted } = get();
    if (hitSound) {
      // If sound is muted, don't play anything
      if (isMuted) {
        console.log("Hit sound skipped (muted)");
        return;
      }
      
      // Clone the sound to allow overlapping playback
      const soundClone = hitSound.cloneNode() as HTMLAudioElement;
      soundClone.volume = 0.3;
      soundClone.play().catch(error => {
        console.log("Hit sound play prevented:", error);
      });
    }
  },
  
  playSuccess: () => {
    const { successSound, isMuted } = get();
    if (successSound) {
      // If sound is muted, don't play anything
      if (isMuted) {
        console.log("Success sound skipped (muted)");
        return;
      }
      
      successSound.currentTime = 0;
      successSound.play().catch(error => {
        console.log("Success sound play prevented:", error);
      });
    }
  },

  initAudioContext: () => {
    if (!get().audioContext) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        set({ audioContext: ctx });
      } catch (error) {
        console.log("AudioContext not supported:", error);
      }
    }
  },

  playGameStart: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    // Triumphant ascending chord progression
    const frequencies = [262, 330, 392, 523]; // C4, E4, G4, C5
    frequencies.forEach((freq, index) => {
      setTimeout(() => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
        oscillator.type = 'square';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      }, index * 100);
    });
  },

  playPlayerJoin: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    // Happy notification sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.linearRampToValueAtTime(1200, audioContext.currentTime + 0.1);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  },

  playChatMessage: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    // Quick notification blip
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
    oscillator.type = 'triangle';
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  },

  playCardToGraveyard: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    // Sad losing sound - descending tones
    const frequencies = [440, 370, 294, 220]; // A4 down to A3
    frequencies.forEach((freq, index) => {
      setTimeout(() => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
        oscillator.type = 'sawtooth';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.25);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.25);
      }, index * 80);
    });
  },

  playDiceRoll: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    // Rolling dice sound - rapid series of clicks and rattles
    const rollDuration = 1000; // 1 second
    const clickCount = 12; // Number of individual click sounds
    
    for (let i = 0; i < clickCount; i++) {
      setTimeout(() => {
        // Create multiple oscillators for a complex dice rolling sound
        const frequencies = [200, 300, 400]; // Multiple frequency components
        
        frequencies.forEach((baseFreq, freqIndex) => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          // Add slight random variation to frequency for realism
          const freq = baseFreq + (Math.random() * 50 - 25);
          oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
          oscillator.type = 'square';
          
          // Short clicking sound
          const volume = 0.05 * (1 - i / clickCount); // Decrease volume over time
          gainNode.gain.setValueAtTime(0, audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.001);
          gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.05);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.05);
        });
      }, (i * rollDuration) / clickCount);
    }
  },

  playDamageSound: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    // Damage sound - sharp impact with distortion
    const oscillator1 = audioContext.createOscillator();
    const oscillator2 = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Sharp hit sound with two frequency components
    oscillator1.frequency.setValueAtTime(150, audioContext.currentTime);
    oscillator1.frequency.linearRampToValueAtTime(50, audioContext.currentTime + 0.1);
    oscillator1.type = 'square';
    
    oscillator2.frequency.setValueAtTime(300, audioContext.currentTime);
    oscillator2.frequency.linearRampToValueAtTime(100, audioContext.currentTime + 0.1);
    oscillator2.type = 'sawtooth';
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.15);
    
    oscillator1.start(audioContext.currentTime);
    oscillator1.stop(audioContext.currentTime + 0.15);
    oscillator2.start(audioContext.currentTime);
    oscillator2.stop(audioContext.currentTime + 0.15);
  },

  playBeeSound: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    // Bee buzzing sound - modulated oscillator to create buzzing effect
    const oscillator = audioContext.createOscillator();
    const modulator = audioContext.createOscillator();
    const modulatorGain = audioContext.createGain();
    const gainNode = audioContext.createGain();
    
    // Connect the modulator to modulate the main oscillator frequency
    modulator.connect(modulatorGain);
    modulatorGain.connect(oscillator.frequency);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Main buzzing frequency (around 200-300 Hz for bee)
    oscillator.frequency.setValueAtTime(250, audioContext.currentTime);
    oscillator.type = 'sawtooth';
    
    // Modulator creates the buzzing effect (rapid frequency modulation)
    modulator.frequency.setValueAtTime(30, audioContext.currentTime); // 30 Hz modulation
    modulator.type = 'sine';
    modulatorGain.gain.setValueAtTime(50, audioContext.currentTime); // Modulation depth
    
    // Envelope for natural sound
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime + 1.5);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 2);
    
    // Play for 2 seconds
    modulator.start(audioContext.currentTime);
    oscillator.start(audioContext.currentTime);
    modulator.stop(audioContext.currentTime + 2);
    oscillator.stop(audioContext.currentTime + 2);
  }
}));
