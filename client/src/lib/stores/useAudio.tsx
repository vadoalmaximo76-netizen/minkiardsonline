import { create } from "zustand";

// Music intensity states for dynamic background music
export type MusicIntensity = 'calm' | 'planning' | 'action' | 'combat' | 'tension' | 'victory' | 'defeat';

interface DynamicMusicState {
  currentIntensity: MusicIntensity;
  targetIntensity: MusicIntensity;
  isTransitioning: boolean;
  musicVolume: number;
  musicTempo: number;
  baseFrequency: number;
  harmonies: number[];
  rhythmPattern: number[];
  musicContext: {
    oscillators: OscillatorNode[];
    gainNodes: GainNode[];
    isPlaying: boolean;
  };
}

interface AudioState {
  backgroundMusic: HTMLAudioElement | null;
  hitSound: HTMLAudioElement | null;
  successSound: HTMLAudioElement | null;
  isMuted: boolean;
  audioContext: AudioContext | null;
  
  // Dynamic music system
  dynamicMusic: DynamicMusicState;
  
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
  playCharacterSound: (soundType: string) => void;
  initAudioContext: () => void;
  
  // Dynamic music functions
  setMusicIntensity: (intensity: MusicIntensity) => void;
  startDynamicMusic: () => void;
  stopDynamicMusic: () => void;
  updateMusicForGameEvent: (eventType: string, gameState?: any) => void;
  transitionToIntensity: (targetIntensity: MusicIntensity) => void;
  getMusicParameters: (intensity: MusicIntensity) => { volume: number; tempo: number; baseFrequency: number; harmonies: number[] };
}

export const useAudio = create<AudioState>((set, get) => ({
  backgroundMusic: null,
  hitSound: null,
  successSound: null,
  isMuted: true, // Start muted by default
  audioContext: null,
  
  // Dynamic music system initialization
  dynamicMusic: {
    currentIntensity: 'calm',
    targetIntensity: 'calm',
    isTransitioning: false,
    musicVolume: 0.15,
    musicTempo: 120, // BPM
    baseFrequency: 220, // A3
    harmonies: [1, 1.25, 1.5, 2], // Perfect fifth, octave harmonies
    rhythmPattern: [1, 0, 0.5, 0], // Basic 4/4 pattern
    musicContext: {
      oscillators: [],
      gainNodes: [],
      isPlaying: false
    }
  },
  
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
  },

  playCharacterSound: (soundType: string) => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    switch (soundType.toLowerCase()) {
      case 'bee':
        // Use the dedicated bee sound function
        get().playBeeSound();
        break;
      case 'animal_dog':
        // Dog barking sound
        const frequencies = [150, 300, 450];
        frequencies.forEach((freq, index) => {
          setTimeout(() => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
            oscillator.type = 'square';
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
          }, index * 200);
        });
        break;

      case 'animal_cat':
        // Cat meowing sound
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.linearRampToValueAtTime(600, audioContext.currentTime + 0.3);
        oscillator.frequency.linearRampToValueAtTime(350, audioContext.currentTime + 0.6);
        oscillator.type = 'triangle';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.12, audioContext.currentTime + 0.1);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.8);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.8);
        break;

      case 'animal_bird':
        // Bird chirping sound
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            
            osc.connect(gain);
            gain.connect(audioContext.destination);
            
            osc.frequency.setValueAtTime(800 + Math.random() * 400, audioContext.currentTime);
            osc.type = 'sine';
            
            gain.gain.setValueAtTime(0, audioContext.currentTime);
            gain.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.05);
            gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
            
            osc.start(audioContext.currentTime);
            osc.stop(audioContext.currentTime + 0.2);
          }, i * 150);
        }
        break;

      case 'robot_mechanical':
        // Robotic/mechanical sound
        const robotOsc = audioContext.createOscillator();
        const robotGain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        
        robotOsc.connect(filter);
        filter.connect(robotGain);
        robotGain.connect(audioContext.destination);
        
        robotOsc.frequency.setValueAtTime(80, audioContext.currentTime);
        robotOsc.type = 'square';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, audioContext.currentTime);
        
        robotGain.gain.setValueAtTime(0, audioContext.currentTime);
        robotGain.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.1);
        robotGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1);
        
        robotOsc.start(audioContext.currentTime);
        robotOsc.stop(audioContext.currentTime + 1);
        break;

      case 'magic_spell':
        // Magical/spell sound
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            const magicOsc = audioContext.createOscillator();
            const magicGain = audioContext.createGain();
            
            magicOsc.connect(magicGain);
            magicGain.connect(audioContext.destination);
            
            magicOsc.frequency.setValueAtTime(200 + i * 100, audioContext.currentTime);
            magicOsc.type = 'sine';
            
            magicGain.gain.setValueAtTime(0, audioContext.currentTime);
            magicGain.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1);
            magicGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.4);
            
            magicOsc.start(audioContext.currentTime);
            magicOsc.stop(audioContext.currentTime + 0.4);
          }, i * 100);
        }
        break;

      case 'explosion':
        // Explosion sound
        const noise = audioContext.createBufferSource();
        const noiseGain = audioContext.createGain();
        const bufferSize = audioContext.sampleRate * 0.5;
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        
        noise.buffer = buffer;
        noise.connect(noiseGain);
        noiseGain.connect(audioContext.destination);
        
        noiseGain.gain.setValueAtTime(0, audioContext.currentTime);
        noiseGain.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
        
        noise.start(audioContext.currentTime);
        noise.stop(audioContext.currentTime + 0.5);
        break;

      case 'human_voice':
        // Human voice approximation
        const voiceOsc = audioContext.createOscillator();
        const voiceGain = audioContext.createGain();
        
        voiceOsc.connect(voiceGain);
        voiceGain.connect(audioContext.destination);
        
        voiceOsc.frequency.setValueAtTime(120, audioContext.currentTime);
        voiceOsc.frequency.linearRampToValueAtTime(150, audioContext.currentTime + 0.3);
        voiceOsc.frequency.linearRampToValueAtTime(100, audioContext.currentTime + 0.6);
        voiceOsc.type = 'sawtooth';
        
        voiceGain.gain.setValueAtTime(0, audioContext.currentTime);
        voiceGain.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1);
        voiceGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.8);
        
        voiceOsc.start(audioContext.currentTime);
        voiceOsc.stop(audioContext.currentTime + 0.8);
        break;

      default:
        // Default character entrance sound
        const defaultOsc = audioContext.createOscillator();
        const defaultGain = audioContext.createGain();
        
        defaultOsc.connect(defaultGain);
        defaultGain.connect(audioContext.destination);
        
        defaultOsc.frequency.setValueAtTime(440, audioContext.currentTime);
        defaultOsc.type = 'triangle';
        
        defaultGain.gain.setValueAtTime(0, audioContext.currentTime);
        defaultGain.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1);
        defaultGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
        
        defaultOsc.start(audioContext.currentTime);
        defaultOsc.stop(audioContext.currentTime + 0.5);
        break;
    }
  },

  // Dynamic music system functions
  setMusicIntensity: (intensity: MusicIntensity) => {
    const state = get();
    if (state.isMuted || !state.audioContext) return;
    
    console.log(`Music intensity changing from ${state.dynamicMusic.currentIntensity} to ${intensity}`);
    
    set(prevState => ({
      dynamicMusic: {
        ...prevState.dynamicMusic,
        targetIntensity: intensity,
        isTransitioning: true
      }
    }));
    
    // Start transition to new intensity
    get().transitionToIntensity(intensity);
  },

  transitionToIntensity: (targetIntensity: MusicIntensity) => {
    const { audioContext, dynamicMusic } = get();
    if (!audioContext) return;

    // Get music parameters for target intensity
    const musicParams = get().getMusicParameters(targetIntensity);
    
    // Transition duration in seconds
    const transitionDuration = 3;
    const currentTime = audioContext.currentTime;
    
    // Update oscillators and gain nodes gradually
    dynamicMusic.musicContext.gainNodes.forEach((gainNode, index) => {
      if (gainNode) {
        gainNode.gain.linearRampToValueAtTime(
          musicParams.volume * (1 - index * 0.2), // Reduce volume for higher harmonies
          currentTime + transitionDuration
        );
      }
    });
    
    dynamicMusic.musicContext.oscillators.forEach((oscillator, index) => {
      if (oscillator) {
        const newFreq = musicParams.baseFrequency * musicParams.harmonies[index];
        oscillator.frequency.linearRampToValueAtTime(
          newFreq,
          currentTime + transitionDuration
        );
      }
    });
    
    // Update state after transition
    setTimeout(() => {
      set(prevState => ({
        dynamicMusic: {
          ...prevState.dynamicMusic,
          currentIntensity: targetIntensity,
          isTransitioning: false,
          musicVolume: musicParams.volume,
          musicTempo: musicParams.tempo,
          baseFrequency: musicParams.baseFrequency,
          harmonies: musicParams.harmonies
        }
      }));
    }, transitionDuration * 1000);
  },

  getMusicParameters: (intensity: MusicIntensity) => {
    switch (intensity) {
      case 'calm':
        return {
          volume: 0.08,
          tempo: 90,
          baseFrequency: 220, // A3
          harmonies: [1, 1.25, 1.5], // Gentle harmonies
        };
      case 'planning':
        return {
          volume: 0.12,
          tempo: 110,
          baseFrequency: 247, // B3
          harmonies: [1, 1.25, 1.5, 2], // More complex harmonies
        };
      case 'action':
        return {
          volume: 0.18,
          tempo: 140,
          baseFrequency: 294, // D4
          harmonies: [1, 1.33, 1.67, 2], // Energetic intervals
        };
      case 'combat':
        return {
          volume: 0.25,
          tempo: 160,
          baseFrequency: 330, // E4
          harmonies: [1, 1.2, 1.4, 1.8, 2.2], // Dissonant, intense
        };
      case 'tension':
        return {
          volume: 0.22,
          tempo: 130,
          baseFrequency: 277, // C#4
          harmonies: [1, 1.15, 1.45, 1.95], // Tense intervals
        };
      case 'victory':
        return {
          volume: 0.3,
          tempo: 120,
          baseFrequency: 392, // G4
          harmonies: [1, 1.25, 1.5, 2, 2.5], // Triumphant major chords
        };
      case 'defeat':
        return {
          volume: 0.15,
          tempo: 80,
          baseFrequency: 196, // G3
          harmonies: [1, 1.2, 1.3], // Minor, sad intervals
        };
      default:
        return {
          volume: 0.1,
          tempo: 100,
          baseFrequency: 220,
          harmonies: [1, 1.25, 1.5],
        };
    }
  },

  startDynamicMusic: () => {
    const { audioContext, isMuted, dynamicMusic } = get();
    if (isMuted || !audioContext || dynamicMusic.musicContext.isPlaying) return;
    
    console.log('Starting dynamic background music');
    
    const musicParams = get().getMusicParameters(dynamicMusic.currentIntensity);
    const oscillators: OscillatorNode[] = [];
    const gainNodes: GainNode[] = [];
    
    // Create oscillators for each harmony
    musicParams.harmonies.forEach((harmony, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const filterNode = audioContext.createBiquadFilter();
      
      // Setup filter for warmth
      filterNode.type = 'lowpass';
      filterNode.frequency.setValueAtTime(800 + index * 200, audioContext.currentTime);
      filterNode.Q.setValueAtTime(0.5, audioContext.currentTime);
      
      // Connect audio nodes
      oscillator.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Set frequency and type
      oscillator.frequency.setValueAtTime(
        musicParams.baseFrequency * harmony, 
        audioContext.currentTime
      );
      oscillator.type = index === 0 ? 'sine' : 'triangle'; // Bass + harmonies
      
      // Set volume (lower for higher harmonies)
      const volume = musicParams.volume * (1 - index * 0.15);
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 2);
      
      oscillator.start(audioContext.currentTime);
      
      oscillators.push(oscillator);
      gainNodes.push(gainNode);
    });
    
    // Update state
    set(prevState => ({
      dynamicMusic: {
        ...prevState.dynamicMusic,
        musicContext: {
          oscillators,
          gainNodes,
          isPlaying: true
        }
      }
    }));
  },

  stopDynamicMusic: () => {
    const { dynamicMusic, audioContext } = get();
    if (!audioContext || !dynamicMusic.musicContext.isPlaying) return;
    
    console.log('Stopping dynamic background music');
    
    // Fade out all oscillators
    dynamicMusic.musicContext.gainNodes.forEach(gainNode => {
      if (gainNode) {
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1);
      }
    });
    
    // Stop oscillators after fade out
    setTimeout(() => {
      dynamicMusic.musicContext.oscillators.forEach(oscillator => {
        if (oscillator) {
          try {
            oscillator.stop();
          } catch (e) {
            // Oscillator already stopped
          }
        }
      });
      
      set(prevState => ({
        dynamicMusic: {
          ...prevState.dynamicMusic,
          musicContext: {
            oscillators: [],
            gainNodes: [],
            isPlaying: false
          }
        }
      }));
    }, 1000);
  },

  updateMusicForGameEvent: (eventType: string, gameState?: any) => {
    const { dynamicMusic } = get();
    let newIntensity: MusicIntensity = dynamicMusic.currentIntensity;
    
    console.log(`Game event: ${eventType}, current intensity: ${dynamicMusic.currentIntensity}`);
    
    switch (eventType) {
      case 'game_start':
        newIntensity = 'calm';
        get().startDynamicMusic();
        break;
      case 'player_turn_start':
        newIntensity = 'planning';
        break;
      case 'card_played':
        newIntensity = 'action';
        break;
      case 'attack_initiated':
      case 'damage_dealt':
        newIntensity = 'combat';
        break;
      case 'low_health':
      case 'critical_moment':
        newIntensity = 'tension';
        break;
      case 'player_victory':
        newIntensity = 'victory';
        setTimeout(() => get().setMusicIntensity('calm'), 5000); // Return to calm after celebration
        break;
      case 'player_defeat':
        newIntensity = 'defeat';
        setTimeout(() => get().setMusicIntensity('calm'), 5000); // Return to calm after mourning
        break;
      case 'game_end':
        get().stopDynamicMusic();
        return;
      case 'idle':
      case 'waiting':
        newIntensity = 'calm';
        break;
    }
    
    if (newIntensity !== dynamicMusic.currentIntensity) {
      get().setMusicIntensity(newIntensity);
    }
  }
}));
