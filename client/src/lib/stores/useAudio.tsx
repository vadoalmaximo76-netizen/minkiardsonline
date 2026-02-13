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
  playCharacterSound: (soundType: string) => void;
  playCardAnimationSound: (cardName: string) => void;
  initAudioContext: () => void;
  playAttackSound: () => void;
  playDeathSound: () => void;
  playCardPickup: () => void;
  playCardPlay: () => void;
  playTurnChange: () => void;
  playVictory: () => void;
  playDefeat: () => void;
  playDefenseActivated: () => void;
  playBonusActivated: () => void;
  playPersistentDamage: () => void;
  playStarGain: () => void;
  playStarLoss: () => void;
  playPointGain: () => void;
  playPointLoss: () => void;
  playAttackBlocked: () => void;
  playCardDraw: () => void;
  playClashTap: () => void;
  playClashBattleStart: () => void;
  playClashVictory: () => void;
  playMyTurn: () => void;
  playDeckShuffle: () => void;
  playEffectActivate: () => void;
  playHostageApplied: () => void;
  playHostageReleased: () => void;
  playPersonaggioEnter: () => void;
  playCardReveal: () => void;
  playErrorSound: () => void;
  playPlayerEliminated: () => void;
  playSorosActivation: () => void;
  playFusionSound: () => void;
  playCardPlayedToField: () => void;
  playButtonClick: () => void;
  playPanelOpen: () => void;
  playPanelClose: () => void;
  playModalOpen: () => void;
  playModalClose: () => void;
  playToggleOn: () => void;
  playToggleOff: () => void;
  playTabSwitch: () => void;
  playNotification: () => void;
  playConfirm: () => void;
  playCancel: () => void;
  playHoverTick: () => void;
  playPopupAppear: () => void;
  playCountdown: () => void;
  playLevelUp: () => void;
  soundSettings: {
    turnChange: boolean;
    attack: boolean;
    defense: boolean;
    death: boolean;
    cardPlay: boolean;
    bonus: boolean;
    dice: boolean;
    chat: boolean;
    myTurn: boolean;
  };
  setSoundSettings: (settings: Partial<AudioState['soundSettings']>) => void;
}

export const useAudio = create<AudioState>((set, get) => ({
  backgroundMusic: null,
  hitSound: null,
  successSound: null,
  isMuted: false, // Sound effects enabled by default
  audioContext: null,
  soundSettings: (() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('minkiards-sound-settings') : null;
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      turnChange: true, attack: true, defense: true, death: true,
      cardPlay: true, bonus: true, dice: true, chat: true, myTurn: true
    };
  })(),
  setSoundSettings: (newSettings) => {
    const current = get().soundSettings;
    const updated = { ...current, ...newSettings };
    set({ soundSettings: updated });
    try { localStorage.setItem('minkiards-sound-settings', JSON.stringify(updated)); } catch {}
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
    if (!get().soundSettings.chat) return;

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
    if (!get().soundSettings.death) return;

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
    if (!get().soundSettings.dice) return;

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
    if (!get().soundSettings.attack) return;

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

  playCardAnimationSound: (cardName: string) => {
    const { audioContext, isMuted } = get();
    
    if (!audioContext || isMuted) {
      console.log(`Card animation sound skipped for ${cardName} (${!audioContext ? 'no context' : 'muted'})`);
      return;
    }

    const normalizedName = cardName.toUpperCase().trim();
    console.log(`Playing card animation sound for: ${normalizedName}`);

    switch (normalizedName) {
      case 'BOMBA':
      case 'ATTACCO KAMIKAZE':
      case 'ESPLOSIONE ATOMICA':
        // Explosion sound
        const explosion = audioContext.createOscillator();
        const explosionGain = audioContext.createGain();
        const explosionNoise = audioContext.createBufferSource();
        const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.5, audioContext.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseData.length; i++) {
          noiseData[i] = Math.random() * 2 - 1;
        }
        explosionNoise.buffer = noiseBuffer;
        
        explosion.connect(explosionGain);
        explosionNoise.connect(explosionGain);
        explosionGain.connect(audioContext.destination);
        
        explosion.frequency.setValueAtTime(200, audioContext.currentTime);
        explosion.frequency.exponentialRampToValueAtTime(20, audioContext.currentTime + 0.5);
        explosion.type = 'sawtooth';
        
        explosionGain.gain.setValueAtTime(0.3, audioContext.currentTime);
        explosionGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
        
        explosion.start(audioContext.currentTime);
        explosionNoise.start(audioContext.currentTime);
        explosion.stop(audioContext.currentTime + 0.8);
        explosionNoise.stop(audioContext.currentTime + 0.8);
        break;

      case 'DUELLO':
      case 'FUCILE A POMPA':
        // Gunshot sound
        const gunshot = audioContext.createOscillator();
        const gunshotGain = audioContext.createGain();
        const gunshotNoise = audioContext.createBufferSource();
        const gunNoiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);
        const gunNoiseData = gunNoiseBuffer.getChannelData(0);
        for (let i = 0; i < gunNoiseData.length; i++) {
          gunNoiseData[i] = Math.random() * 2 - 1;
        }
        gunshotNoise.buffer = gunNoiseBuffer;
        
        gunshot.connect(gunshotGain);
        gunshotNoise.connect(gunshotGain);
        gunshotGain.connect(audioContext.destination);
        
        gunshot.frequency.setValueAtTime(150, audioContext.currentTime);
        gunshot.type = 'square';
        
        gunshotGain.gain.setValueAtTime(0.3, audioContext.currentTime);
        gunshotGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        gunshot.start(audioContext.currentTime);
        gunshotNoise.start(audioContext.currentTime);
        gunshot.stop(audioContext.currentTime + 0.1);
        gunshotNoise.stop(audioContext.currentTime + 0.1);
        break;

      case 'INFLUENZA':
        // Sneeze sound
        const sneeze = audioContext.createOscillator();
        const sneezeGain = audioContext.createGain();
        const sneezeNoise = audioContext.createBufferSource();
        const sneezeBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.3, audioContext.sampleRate);
        const sneezeData = sneezeBuffer.getChannelData(0);
        for (let i = 0; i < sneezeData.length; i++) {
          sneezeData[i] = Math.random() * 2 - 1;
        }
        sneezeNoise.buffer = sneezeBuffer;
        
        sneeze.connect(sneezeGain);
        sneezeNoise.connect(sneezeGain);
        sneezeGain.connect(audioContext.destination);
        
        sneeze.frequency.setValueAtTime(800, audioContext.currentTime);
        sneeze.frequency.linearRampToValueAtTime(200, audioContext.currentTime + 0.3);
        sneeze.type = 'sawtooth';
        
        sneezeGain.gain.setValueAtTime(0, audioContext.currentTime);
        sneezeGain.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.05);
        sneezeGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        sneeze.start(audioContext.currentTime);
        sneezeNoise.start(audioContext.currentTime);
        sneeze.stop(audioContext.currentTime + 0.3);
        sneezeNoise.stop(audioContext.currentTime + 0.3);
        break;

      case 'CANZONE NEOMELODICA':
        // Musical melody
        const melody = [440, 494, 523, 587, 659];
        melody.forEach((freq, i) => {
          const note = audioContext.createOscillator();
          const noteGain = audioContext.createGain();
          
          note.connect(noteGain);
          noteGain.connect(audioContext.destination);
          
          note.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.2);
          note.type = 'sine';
          
          noteGain.gain.setValueAtTime(0, audioContext.currentTime + i * 0.2);
          noteGain.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + i * 0.2 + 0.05);
          noteGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.2 + 0.3);
          
          note.start(audioContext.currentTime + i * 0.2);
          note.stop(audioContext.currentTime + i * 0.2 + 0.3);
        });
        break;

      case 'MOTOSEGA':
        // Chainsaw sound
        const chainsaw = audioContext.createOscillator();
        const chainsawGain = audioContext.createGain();
        const chainsawNoise = audioContext.createBufferSource();
        const chainsawBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
        const chainsawData = chainsawBuffer.getChannelData(0);
        for (let i = 0; i < chainsawData.length; i++) {
          chainsawData[i] = Math.random() * 2 - 1;
        }
        chainsawNoise.buffer = chainsawBuffer;
        
        chainsaw.connect(chainsawGain);
        chainsawNoise.connect(chainsawGain);
        chainsawGain.connect(audioContext.destination);
        
        chainsaw.frequency.setValueAtTime(80, audioContext.currentTime);
        chainsaw.type = 'sawtooth';
        
        chainsawGain.gain.setValueAtTime(0.15, audioContext.currentTime);
        chainsawGain.gain.linearRampToValueAtTime(0.01, audioContext.currentTime + 2);
        
        chainsaw.start(audioContext.currentTime);
        chainsawNoise.start(audioContext.currentTime);
        chainsaw.stop(audioContext.currentTime + 2);
        chainsawNoise.stop(audioContext.currentTime + 2);
        break;

      case 'SAETTA':
        // Thunder/lightning sound
        const thunder = audioContext.createOscillator();
        const thunderGain = audioContext.createGain();
        const thunderNoise = audioContext.createBufferSource();
        const thunderBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 1, audioContext.sampleRate);
        const thunderData = thunderBuffer.getChannelData(0);
        for (let i = 0; i < thunderData.length; i++) {
          thunderData[i] = Math.random() * 2 - 1;
        }
        thunderNoise.buffer = thunderBuffer;
        
        thunder.connect(thunderGain);
        thunderNoise.connect(thunderGain);
        thunderGain.connect(audioContext.destination);
        
        thunder.frequency.setValueAtTime(100, audioContext.currentTime);
        thunder.frequency.exponentialRampToValueAtTime(30, audioContext.currentTime + 1);
        thunder.type = 'sawtooth';
        
        thunderGain.gain.setValueAtTime(0.2, audioContext.currentTime);
        thunderGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
        
        thunder.start(audioContext.currentTime);
        thunderNoise.start(audioContext.currentTime);
        thunder.stop(audioContext.currentTime + 1);
        thunderNoise.stop(audioContext.currentTime + 1);
        break;

      case 'UNA TEMPESTA BABY':
        // Storm sound (wind + rain)
        const storm = audioContext.createOscillator();
        const stormGain = audioContext.createGain();
        const stormNoise = audioContext.createBufferSource();
        const stormBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
        const stormData = stormBuffer.getChannelData(0);
        for (let i = 0; i < stormData.length; i++) {
          stormData[i] = Math.random() * 2 - 1;
        }
        stormNoise.buffer = stormBuffer;
        
        storm.connect(stormGain);
        stormNoise.connect(stormGain);
        stormGain.connect(audioContext.destination);
        
        storm.frequency.setValueAtTime(60, audioContext.currentTime);
        storm.type = 'sawtooth';
        
        stormGain.gain.setValueAtTime(0.1, audioContext.currentTime);
        stormGain.gain.linearRampToValueAtTime(0.01, audioContext.currentTime + 2);
        
        storm.start(audioContext.currentTime);
        stormNoise.start(audioContext.currentTime);
        storm.stop(audioContext.currentTime + 2);
        stormNoise.stop(audioContext.currentTime + 2);
        break;

      case 'ACCETTATA':
      case 'MAZZA DA BASEBALL':
      case 'PADELLATA IN FACCIA':
      case 'PUGNO':
        // Impact/hit sound
        const impact = audioContext.createOscillator();
        const impactGain = audioContext.createGain();
        
        impact.connect(impactGain);
        impactGain.connect(audioContext.destination);
        
        impact.frequency.setValueAtTime(150, audioContext.currentTime);
        impact.frequency.exponentialRampToValueAtTime(30, audioContext.currentTime + 0.2);
        impact.type = 'square';
        
        impactGain.gain.setValueAtTime(0.3, audioContext.currentTime);
        impactGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        impact.start(audioContext.currentTime);
        impact.stop(audioContext.currentTime + 0.2);
        break;

      case 'ACCHIAPPT CHESSA':
      case 'OMBELICO LANCIAFIAMME':
        // Flame sound
        const flame = audioContext.createOscillator();
        const flameGain = audioContext.createGain();
        const flameNoise = audioContext.createBufferSource();
        const flameBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 1.5, audioContext.sampleRate);
        const flameData = flameBuffer.getChannelData(0);
        for (let i = 0; i < flameData.length; i++) {
          flameData[i] = Math.random() * 2 - 1;
        }
        flameNoise.buffer = flameBuffer;
        
        flame.connect(flameGain);
        flameNoise.connect(flameGain);
        flameGain.connect(audioContext.destination);
        
        flame.frequency.setValueAtTime(200, audioContext.currentTime);
        flame.type = 'sawtooth';
        
        flameGain.gain.setValueAtTime(0.2, audioContext.currentTime);
        flameGain.gain.linearRampToValueAtTime(0.01, audioContext.currentTime + 1.5);
        
        flame.start(audioContext.currentTime);
        flameNoise.start(audioContext.currentTime);
        flame.stop(audioContext.currentTime + 1.5);
        flameNoise.stop(audioContext.currentTime + 1.5);
        break;

      case 'BAMBOLA VOODOO':
      case 'BAMBOLA-VOODOO':
        // Mystical/magical sound
        const mystical = audioContext.createOscillator();
        const mysticalGain = audioContext.createGain();
        
        mystical.connect(mysticalGain);
        mysticalGain.connect(audioContext.destination);
        
        mystical.frequency.setValueAtTime(440, audioContext.currentTime);
        mystical.frequency.linearRampToValueAtTime(880, audioContext.currentTime + 0.5);
        mystical.frequency.linearRampToValueAtTime(440, audioContext.currentTime + 1);
        mystical.frequency.linearRampToValueAtTime(660, audioContext.currentTime + 1.5);
        mystical.type = 'sine';
        
        mysticalGain.gain.setValueAtTime(0, audioContext.currentTime);
        mysticalGain.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.1);
        mysticalGain.gain.linearRampToValueAtTime(0.01, audioContext.currentTime + 1.5);
        
        mystical.start(audioContext.currentTime);
        mystical.stop(audioContext.currentTime + 1.5);
        break;

      case 'ONDA ENERGETICA':
        // Energy beam sound (like Kamehameha)
        const energy = audioContext.createOscillator();
        const energyGain = audioContext.createGain();
        
        energy.connect(energyGain);
        energyGain.connect(audioContext.destination);
        
        energy.frequency.setValueAtTime(200, audioContext.currentTime);
        energy.frequency.linearRampToValueAtTime(400, audioContext.currentTime + 1);
        energy.frequency.linearRampToValueAtTime(600, audioContext.currentTime + 2);
        energy.type = 'sine';
        
        energyGain.gain.setValueAtTime(0, audioContext.currentTime);
        energyGain.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.2);
        energyGain.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 1.5);
        energyGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 2);
        
        energy.start(audioContext.currentTime);
        energy.stop(audioContext.currentTime + 2);
        break;

      default:
        // Generic card sound
        const generic = audioContext.createOscillator();
        const genericGain = audioContext.createGain();
        
        generic.connect(genericGain);
        genericGain.connect(audioContext.destination);
        
        generic.frequency.setValueAtTime(523, audioContext.currentTime);
        generic.type = 'sine';
        
        genericGain.gain.setValueAtTime(0, audioContext.currentTime);
        genericGain.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1);
        genericGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        generic.start(audioContext.currentTime);
        generic.stop(audioContext.currentTime + 0.5);
        break;
    }
  },

  playAttackSound: () => {
    const { hitSound, isMuted } = get();
    if (isMuted) return;
    if (!get().soundSettings.attack) return;

    if (hitSound) {
      const soundClone = hitSound.cloneNode() as HTMLAudioElement;
      soundClone.volume = 0.5;
      soundClone.play().catch(error => {
        console.log("Attack sound play prevented:", error);
      });
    }
  },

  playDeathSound: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.death) return;

    const frequencies = [440, 370, 294, 220, 165, 110];
    frequencies.forEach((freq, index) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'sawtooth';
        
        gain.gain.setValueAtTime(0.15, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.4);
      }, index * 120);
    });

    setTimeout(() => {
      const noise = audioContext.createBufferSource();
      const noiseGain = audioContext.createGain();
      const bufferSize = audioContext.sampleRate * 0.5;
      const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      noise.buffer = buffer;
      
      const filter = audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(500, audioContext.currentTime);
      
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(audioContext.destination);
      
      noiseGain.gain.setValueAtTime(0.2, audioContext.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      noise.start(audioContext.currentTime);
      noise.stop(audioContext.currentTime + 0.5);
    }, 400);
  },

  playCardPickup: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.cardPlay) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.frequency.setValueAtTime(400, audioContext.currentTime);
    osc.frequency.linearRampToValueAtTime(800, audioContext.currentTime + 0.1);
    osc.type = 'triangle';
    
    gain.gain.setValueAtTime(0.1, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.15);
  },

  playCardPlay: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.cardPlay) return;

    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioContext.destination);
    
    osc1.frequency.setValueAtTime(523, audioContext.currentTime);
    osc1.type = 'sine';
    
    osc2.frequency.setValueAtTime(659, audioContext.currentTime);
    osc2.type = 'sine';
    
    gain.gain.setValueAtTime(0.1, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    osc1.start(audioContext.currentTime);
    osc2.start(audioContext.currentTime);
    osc1.stop(audioContext.currentTime + 0.2);
    osc2.stop(audioContext.currentTime + 0.2);
  },

  playTurnChange: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.turnChange) return;

    const frequencies = [392, 523, 659];
    frequencies.forEach((freq, index) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'sine';
        
        gain.gain.setValueAtTime(0.08, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.15);
      }, index * 80);
    });
  },

  playVictory: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    const melody = [523, 659, 784, 1047];
    melody.forEach((freq, index) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'square';
        
        gain.gain.setValueAtTime(0.15, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.3);
      }, index * 150);
    });
  },

  playDefeat: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    const melody = [392, 294, 220, 165];
    melody.forEach((freq, index) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'sawtooth';
        
        gain.gain.setValueAtTime(0.1, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.4);
      }, index * 200);
    });
  },

  playDefenseActivated: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.defense) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.frequency.setValueAtTime(600, audioContext.currentTime);
    osc.frequency.linearRampToValueAtTime(400, audioContext.currentTime + 0.2);
    osc.type = 'triangle';
    
    gain.gain.setValueAtTime(0.15, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.3);
  },

  playBonusActivated: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.bonus) return;

    const sparkle = [800, 1000, 1200, 1000, 800];
    sparkle.forEach((freq, index) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'sine';
        
        gain.gain.setValueAtTime(0.08, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.1);
      }, index * 50);
    });
  },

  playPersistentDamage: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.attack) return;

    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.setValueAtTime(200 - i * 30, audioContext.currentTime);
        osc.type = 'square';
        
        gain.gain.setValueAtTime(0.12, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.1);
      }, i * 100);
    }
  },

  playStarGain: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.bonus) return;

    const sparkle = [1047, 1319, 1568, 2093];
    sparkle.forEach((freq, index) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'sine';
        
        gain.gain.setValueAtTime(0.1, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.15);
      }, index * 60);
    });
  },

  playStarLoss: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.bonus) return;

    const descend = [784, 523, 392, 262];
    descend.forEach((freq, index) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'triangle';
        
        gain.gain.setValueAtTime(0.08, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.12);
        
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.12);
      }, index * 80);
    });
  },

  playPointGain: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.bonus) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.frequency.setValueAtTime(523, audioContext.currentTime);
    osc.frequency.linearRampToValueAtTime(784, audioContext.currentTime + 0.1);
    osc.type = 'sine';
    
    gain.gain.setValueAtTime(0.12, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.2);
  },

  playPointLoss: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.bonus) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.frequency.setValueAtTime(300, audioContext.currentTime);
    osc.frequency.linearRampToValueAtTime(150, audioContext.currentTime + 0.15);
    osc.type = 'sawtooth';
    
    gain.gain.setValueAtTime(0.1, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.2);
  },

  playAttackBlocked: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.defense) return;

    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioContext.destination);
    
    osc1.frequency.setValueAtTime(200, audioContext.currentTime);
    osc2.frequency.setValueAtTime(150, audioContext.currentTime);
    osc1.type = 'square';
    osc2.type = 'square';
    
    gain.gain.setValueAtTime(0.15, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    osc1.start(audioContext.currentTime);
    osc2.start(audioContext.currentTime);
    osc1.stop(audioContext.currentTime + 0.3);
    osc2.stop(audioContext.currentTime + 0.3);
  },

  playCardDraw: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.cardPlay) return;

    const notes = [392, 523, 659, 784];
    notes.forEach((freq, index) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'sine';
        
        gain.gain.setValueAtTime(0.1, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.2);
      }, index * 80);
    });
  },

  playClashTap: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.frequency.setValueAtTime(800 + Math.random() * 200, audioContext.currentTime);
    osc.type = 'square';
    
    gain.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);
    
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.05);
  },

  playClashBattleStart: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    const frequencies = [220, 330, 440, 550, 660, 880];
    frequencies.forEach((freq, index) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'sawtooth';
        
        gain.gain.setValueAtTime(0.15, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.2);
      }, index * 60);
    });
  },

  playClashVictory: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    const frequencies = [523, 659, 784, 1047];
    frequencies.forEach((freq, index) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'sine';
        
        gain.gain.setValueAtTime(0.2, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.4);
      }, index * 100);
    });
  },

  playMyTurn: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.myTurn) return;

    const fanfare = [523, 659, 784, 1047, 784, 1047];
    fanfare.forEach((freq, index) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'triangle';
        
        gain.gain.setValueAtTime(0.18, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
        
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.25);
      }, index * 80);
    });
  },

  playDeckShuffle: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.cardPlay) return;

    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        const freq = 200 + Math.random() * 400;
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'sawtooth';
        gain.gain.setValueAtTime(0.06, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.06);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.06);
      }, i * 60);
    }
  },

  playEffectActivate: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.bonus) return;

    const freqs = [440, 554, 659, 880];
    freqs.forEach((freq, i) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.15, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.2);
      }, i * 80);
    });
  },

  playHostageApplied: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.attack) return;

    const freqs = [200, 150, 100, 80];
    freqs.forEach((freq, i) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'square';
        gain.gain.setValueAtTime(0.12, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.3);
      }, i * 150);
    });
  },

  playHostageReleased: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.bonus) return;

    const freqs = [220, 330, 440, 660];
    freqs.forEach((freq, i) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'triangle';
        gain.gain.setValueAtTime(0.15, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.25);
      }, i * 100);
    });
  },

  playPersonaggioEnter: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.cardPlay) return;

    const freqs = [262, 330, 392, 523, 659];
    freqs.forEach((freq, i) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'triangle';
        gain.gain.setValueAtTime(0.12, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.3);
      }, i * 100);
    });
  },

  playCardReveal: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.cardPlay) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.setValueAtTime(400, audioContext.currentTime);
    osc.frequency.linearRampToValueAtTime(800, audioContext.currentTime + 0.15);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.12, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.3);
  },

  playErrorSound: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.attack) return;

    const freqs = [400, 300];
    freqs.forEach((freq, i) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'square';
        gain.gain.setValueAtTime(0.1, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.15);
      }, i * 120);
    });
  },

  playPlayerEliminated: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.death) return;

    const freqs = [523, 440, 349, 262, 196, 131];
    freqs.forEach((freq, i) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'sawtooth';
        gain.gain.setValueAtTime(0.1, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.4);
      }, i * 200);
    });
  },

  playSorosActivation: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.bonus) return;

    const freqs = [196, 262, 330, 392, 523, 659, 784];
    freqs.forEach((freq, i) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.15, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.35);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.35);
      }, i * 120);
    });
  },

  playFusionSound: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.cardPlay) return;

    const freqs = [262, 330, 392, 523];
    freqs.forEach((freq, i) => {
      setTimeout(() => {
        const osc1 = audioContext.createOscillator();
        const osc2 = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioContext.destination);
        osc1.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc2.frequency.setValueAtTime(freq * 1.5, audioContext.currentTime);
        osc1.type = 'triangle';
        osc2.type = 'sine';
        gain.gain.setValueAtTime(0.12, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        osc1.start(audioContext.currentTime);
        osc2.start(audioContext.currentTime);
        osc1.stop(audioContext.currentTime + 0.4);
        osc2.stop(audioContext.currentTime + 0.4);
      }, i * 150);
    });
  },

  playCardPlayedToField: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.cardPlay) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.setValueAtTime(500, audioContext.currentTime);
    osc.frequency.linearRampToValueAtTime(700, audioContext.currentTime + 0.08);
    osc.frequency.linearRampToValueAtTime(600, audioContext.currentTime + 0.15);
    osc.type = 'triangle';
    gain.gain.setValueAtTime(0.1, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.2);
  },

  playButtonClick: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.setValueAtTime(900, audioContext.currentTime);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, audioContext.currentTime + 0.005);
    gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.03);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.03);
  },

  playPanelOpen: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.setValueAtTime(300, audioContext.currentTime);
    osc.frequency.linearRampToValueAtTime(800, audioContext.currentTime + 0.15);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.15);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.15);
  },

  playPanelClose: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.setValueAtTime(600, audioContext.currentTime);
    osc.frequency.linearRampToValueAtTime(200, audioContext.currentTime + 0.12);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, audioContext.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.12);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.12);
  },

  playModalOpen: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioContext.destination);
    osc1.frequency.setValueAtTime(523, audioContext.currentTime);
    osc2.frequency.setValueAtTime(784, audioContext.currentTime);
    osc1.type = 'sine';
    osc2.type = 'sine';
    gain.gain.setValueAtTime(0, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
    osc1.start(audioContext.currentTime);
    osc2.start(audioContext.currentTime);
    osc1.stop(audioContext.currentTime + 0.2);
    osc2.stop(audioContext.currentTime + 0.2);
  },

  playModalClose: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.setValueAtTime(400, audioContext.currentTime);
    osc.frequency.linearRampToValueAtTime(200, audioContext.currentTime + 0.15);
    osc.type = 'triangle';
    gain.gain.setValueAtTime(0, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, audioContext.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.15);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.15);
  },

  playToggleOn: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.setValueAtTime(600, audioContext.currentTime);
    osc.frequency.linearRampToValueAtTime(1000, audioContext.currentTime + 0.08);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.005);
    gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.08);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.08);
  },

  playToggleOff: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.setValueAtTime(800, audioContext.currentTime);
    osc.frequency.linearRampToValueAtTime(400, audioContext.currentTime + 0.08);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, audioContext.currentTime + 0.005);
    gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.08);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.08);
  },

  playTabSwitch: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.setValueAtTime(700, audioContext.currentTime);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, audioContext.currentTime + 0.005);
    gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.04);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.04);
  },

  playNotification: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    const notes = [659, 880, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(0.12, audioContext.currentTime + 0.005);
        gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.08);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.08);
      }, i * 140);
    });
  },

  playConfirm: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    const notes = [523, 784];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.005);
        gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.1);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.1);
      }, i * 150);
    });
  },

  playCancel: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    const notes = [400, 300];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'triangle';
        gain.gain.setValueAtTime(0, audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(0.06, audioContext.currentTime + 0.005);
        gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.08);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.08);
      }, i * 120);
    });
  },

  playHoverTick: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.setValueAtTime(1200, audioContext.currentTime);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.03, audioContext.currentTime + 0.002);
    gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.015);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.015);
  },

  playPopupAppear: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.setValueAtTime(500, audioContext.currentTime);
    osc.frequency.linearRampToValueAtTime(800, audioContext.currentTime + 0.05);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.15);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.15);
  },

  playCountdown: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.setValueAtTime(880, audioContext.currentTime);
    osc.type = 'square';
    gain.gain.setValueAtTime(0, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.005);
    gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.05);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.05);
  },

  playLevelUp: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.type = 'triangle';
        gain.gain.setValueAtTime(0, audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.005);
        gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.08);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.08);
      }, i * 140);
    });
  }
}));
