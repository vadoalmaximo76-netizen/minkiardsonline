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
  playCardHover: () => void;
  playEpicExplosion: () => void;
  playEpicImpact: () => void;
  playPopupAppear: () => void;
  playCountdown: () => void;
  playLevelUp: () => void;
  playBattleMusic: () => { stop: () => void };
  playTennisHit: () => void;
  playSempafaagaraHit: () => void;
  stopBattleMusic: () => void;
  startAmbientSound: () => void;
  stopAmbientSound: () => void;
  setAmbientMood: (mood: 'calm' | 'tension' | 'myturn' | 'victory' | 'danger') => void;
  _ambientMood: 'calm' | 'tension' | 'myturn' | 'victory' | 'danger';
  _ambientNodes: {
    oscillators: OscillatorNode[];
    gains: GainNode[];
    masterGain: GainNode | null;
    filter: BiquadFilterNode | null;
    active: boolean;
    lfo: OscillatorNode | null;
    lfoGain: GainNode | null;
  } | null;
  _battleMusicNodes: { oscillators: OscillatorNode[]; gains: GainNode[]; tickInterval: ReturnType<typeof setInterval> | null; active: boolean } | null;
  registerLowHealthCard: (cardId: string) => void;
  unregisterLowHealthCard: (cardId: string) => void;
  _lowHealthAlarmNodes: { oscillators: OscillatorNode[]; gains: GainNode[]; lfo: OscillatorNode | null; active: boolean } | null;
  _lowHealthCardIds: Set<string>;
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
  isMuted: false,
  audioContext: null,
  _lowHealthAlarmNodes: null,
  _battleMusicNodes: null,
  _ambientMood: 'calm' as const,
  _ambientNodes: null,
  _lowHealthCardIds: new Set<string>(),
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
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.attack) return;
    const t = audioContext.currentTime;

    const bassOsc = audioContext.createOscillator();
    const bassGain = audioContext.createGain();
    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(80, t);
    bassOsc.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    bassOsc.connect(bassGain);
    bassGain.connect(audioContext.destination);
    bassGain.gain.setValueAtTime(0.25, t);
    bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    bassOsc.start(t);
    bassOsc.stop(t + 0.3);

    const crunchLen = audioContext.sampleRate * 0.15;
    const crunchBuf = audioContext.createBuffer(1, crunchLen, audioContext.sampleRate);
    const crunchData = crunchBuf.getChannelData(0);
    for (let i = 0; i < crunchLen; i++) crunchData[i] = Math.random() * 2 - 1;
    const crunchSrc = audioContext.createBufferSource();
    crunchSrc.buffer = crunchBuf;
    const crunchFilter = audioContext.createBiquadFilter();
    crunchFilter.type = 'bandpass';
    crunchFilter.frequency.setValueAtTime(400, t);
    crunchFilter.Q.setValueAtTime(2, t);
    const crunchGain = audioContext.createGain();
    crunchSrc.connect(crunchFilter);
    crunchFilter.connect(crunchGain);
    crunchGain.connect(audioContext.destination);
    crunchGain.gain.setValueAtTime(0.2, t);
    crunchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    crunchSrc.start(t);
    crunchSrc.stop(t + 0.15);

    const clangOsc = audioContext.createOscillator();
    const clangGain = audioContext.createGain();
    clangOsc.type = 'triangle';
    clangOsc.frequency.setValueAtTime(2000, t);
    clangOsc.frequency.exponentialRampToValueAtTime(500, t + 0.2);
    clangOsc.connect(clangGain);
    clangGain.connect(audioContext.destination);
    clangGain.gain.setValueAtTime(0.12, t);
    clangGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    clangOsc.start(t);
    clangOsc.stop(t + 0.25);

    const subOsc = audioContext.createOscillator();
    const subGain = audioContext.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(30, t);
    subOsc.connect(subGain);
    subGain.connect(audioContext.destination);
    subGain.gain.setValueAtTime(0.18, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    subOsc.start(t);
    subOsc.stop(t + 0.5);
  },

  playDeathSound: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.death) return;
    const t = audioContext.currentTime;

    const boomLen = audioContext.sampleRate * 1.0;
    const boomBuf = audioContext.createBuffer(1, boomLen, audioContext.sampleRate);
    const boomData = boomBuf.getChannelData(0);
    for (let i = 0; i < boomLen; i++) boomData[i] = Math.random() * 2 - 1;
    const boomSrc = audioContext.createBufferSource();
    boomSrc.buffer = boomBuf;
    const boomFilter = audioContext.createBiquadFilter();
    boomFilter.type = 'lowpass';
    boomFilter.frequency.setValueAtTime(200, t);
    boomFilter.Q.setValueAtTime(1, t);
    const boomGain = audioContext.createGain();
    boomSrc.connect(boomFilter);
    boomFilter.connect(boomGain);
    boomGain.connect(audioContext.destination);
    boomGain.gain.setValueAtTime(0.25, t);
    boomGain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    boomSrc.start(t);
    boomSrc.stop(t + 1.0);

    const choirFreqs = [440, 330, 220];
    choirFreqs.forEach(freq => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.linearRampToValueAtTime(freq * 0.5, t + 1.2);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
      osc.start(t);
      osc.stop(t + 1.2);
    });

    for (let i = 0; i < 15; i++) {
      setTimeout(() => {
        const clickOsc = audioContext.createOscillator();
        const clickGain = audioContext.createGain();
        clickOsc.type = 'square';
        clickOsc.frequency.setValueAtTime(500 + Math.random() * 2000, audioContext.currentTime);
        clickOsc.connect(clickGain);
        clickGain.connect(audioContext.destination);
        const vol = 0.08 * (1 - i / 15);
        clickGain.gain.setValueAtTime(vol, audioContext.currentTime);
        clickGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.03);
        clickOsc.start(audioContext.currentTime);
        clickOsc.stop(audioContext.currentTime + 0.03);
      }, i * 55);
    }

    const reverbOsc = audioContext.createOscillator();
    const reverbGain = audioContext.createGain();
    reverbOsc.type = 'sine';
    reverbOsc.frequency.setValueAtTime(55, t);
    reverbOsc.connect(reverbGain);
    reverbGain.connect(audioContext.destination);
    reverbGain.gain.setValueAtTime(0.15, t);
    reverbGain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    reverbOsc.start(t);
    reverbOsc.stop(t + 1.5);
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
    const t = audioContext.currentTime;

    const whooshLen = audioContext.sampleRate * 0.05;
    const whooshBuf = audioContext.createBuffer(1, whooshLen, audioContext.sampleRate);
    const whooshData = whooshBuf.getChannelData(0);
    for (let i = 0; i < whooshLen; i++) whooshData[i] = Math.random() * 2 - 1;
    const whooshSrc = audioContext.createBufferSource();
    whooshSrc.buffer = whooshBuf;
    const whooshGain = audioContext.createGain();
    whooshSrc.connect(whooshGain);
    whooshGain.connect(audioContext.destination);
    whooshGain.gain.setValueAtTime(0.15, t);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    whooshSrc.start(t);
    whooshSrc.stop(t + 0.05);

    const slapOsc = audioContext.createOscillator();
    const slapGain = audioContext.createGain();
    slapOsc.type = 'square';
    slapOsc.frequency.setValueAtTime(200, t);
    slapOsc.frequency.exponentialRampToValueAtTime(80, t + 0.08);
    slapOsc.connect(slapGain);
    slapGain.connect(audioContext.destination);
    slapGain.gain.setValueAtTime(0.12, t);
    slapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    slapOsc.start(t);
    slapOsc.stop(t + 0.08);

    const sparkleFreqs = [1000, 2000, 3000];
    sparkleFreqs.forEach((freq, i) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.connect(gain);
        gain.connect(audioContext.destination);
        gain.gain.setValueAtTime(0.08, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.08);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.08);
      }, 30 + i * 50);
    });
  },

  playTurnChange: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.turnChange) return;
    const t = audioContext.currentTime;

    const whooshOsc = audioContext.createOscillator();
    const whooshGain = audioContext.createGain();
    whooshOsc.type = 'sawtooth';
    whooshOsc.frequency.setValueAtTime(100, t);
    whooshOsc.frequency.exponentialRampToValueAtTime(400, t + 0.15);
    whooshOsc.frequency.exponentialRampToValueAtTime(80, t + 0.4);
    whooshOsc.connect(whooshGain);
    whooshGain.connect(audioContext.destination);
    whooshGain.gain.setValueAtTime(0.06, t);
    whooshGain.gain.linearRampToValueAtTime(0.1, t + 0.1);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    whooshOsc.start(t);
    whooshOsc.stop(t + 0.4);

    const drumOsc = audioContext.createOscillator();
    const drumGain = audioContext.createGain();
    drumOsc.type = 'sine';
    drumOsc.frequency.setValueAtTime(60, t + 0.08);
    drumOsc.frequency.exponentialRampToValueAtTime(30, t + 0.25);
    drumOsc.connect(drumGain);
    drumGain.connect(audioContext.destination);
    drumGain.gain.setValueAtTime(0.2, t + 0.08);
    drumGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    drumOsc.start(t + 0.08);
    drumOsc.stop(t + 0.3);

    const frequencies = [392, 523, 659, 784];
    frequencies.forEach((freq, index) => {
      setTimeout(() => {
        const ct = audioContext.currentTime;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(freq, ct);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.1, ct);
        gain.gain.exponentialRampToValueAtTime(0.001, ct + 0.2);
        osc.start(ct);
        osc.stop(ct + 0.2);

        if (index === 3) {
          const harmOsc = audioContext.createOscillator();
          const harmGain = audioContext.createGain();
          harmOsc.type = 'sine';
          harmOsc.frequency.setValueAtTime(freq * 1.5, ct);
          harmOsc.connect(harmGain);
          harmGain.connect(audioContext.destination);
          harmGain.gain.setValueAtTime(0.05, ct);
          harmGain.gain.exponentialRampToValueAtTime(0.001, ct + 0.3);
          harmOsc.start(ct);
          harmOsc.stop(ct + 0.3);
        }
      }, 120 + index * 70);
    });
  },

  playVictory: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    const t = audioContext.currentTime;

    const melodyNotes = [523, 659, 784, 1047];
    melodyNotes.forEach((freq, index) => {
      setTimeout(() => {
        const ct = audioContext.currentTime;
        const osc1 = audioContext.createOscillator();
        const osc2 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        const gain2 = audioContext.createGain();
        osc1.type = 'square';
        osc1.frequency.setValueAtTime(freq, ct);
        osc1.connect(gain1);
        gain1.connect(audioContext.destination);
        gain1.gain.setValueAtTime(0.15, ct);
        gain1.gain.exponentialRampToValueAtTime(0.001, ct + 0.35);
        osc1.start(ct);
        osc1.stop(ct + 0.35);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2, ct);
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        gain2.gain.setValueAtTime(0.05, ct);
        gain2.gain.exponentialRampToValueAtTime(0.001, ct + 0.3);
        osc2.start(ct);
        osc2.stop(ct + 0.3);
      }, index * 150);
    });

    setTimeout(() => {
      const ct = audioContext.currentTime;
      [523, 659, 784].forEach(freq => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ct);
        osc.connect(gain);
        gain.connect(audioContext.destination);
        gain.gain.setValueAtTime(0.1, ct);
        gain.gain.linearRampToValueAtTime(0.08, ct + 1.0);
        gain.gain.exponentialRampToValueAtTime(0.001, ct + 1.5);
        osc.start(ct);
        osc.stop(ct + 1.5);
      });
    }, 650);

    setTimeout(() => {
      for (let i = 0; i < 10; i++) {
        setTimeout(() => {
          const ct = audioContext.currentTime;
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(80 + Math.random() * 20, ct);
          osc.connect(gain);
          gain.connect(audioContext.destination);
          gain.gain.setValueAtTime(0.12, ct);
          gain.gain.exponentialRampToValueAtTime(0.001, ct + 0.06);
          osc.start(ct);
          osc.stop(ct + 0.06);
        }, i * 40);
      }
    }, 500);

    setTimeout(() => {
      const ct = audioContext.currentTime;
      const cymbalLen = audioContext.sampleRate * 0.8;
      const cymbalBuf = audioContext.createBuffer(1, cymbalLen, audioContext.sampleRate);
      const cymbalData = cymbalBuf.getChannelData(0);
      for (let i = 0; i < cymbalLen; i++) cymbalData[i] = Math.random() * 2 - 1;
      const cymbalSrc = audioContext.createBufferSource();
      cymbalSrc.buffer = cymbalBuf;
      const cymbalFilter = audioContext.createBiquadFilter();
      cymbalFilter.type = 'highpass';
      cymbalFilter.frequency.setValueAtTime(5000, ct);
      const cymbalGain = audioContext.createGain();
      cymbalSrc.connect(cymbalFilter);
      cymbalFilter.connect(cymbalGain);
      cymbalGain.connect(audioContext.destination);
      cymbalGain.gain.setValueAtTime(0.12, ct);
      cymbalGain.gain.exponentialRampToValueAtTime(0.001, ct + 0.8);
      cymbalSrc.start(ct);
      cymbalSrc.stop(ct + 0.8);
    }, 600);

    setTimeout(() => {
      const ct = audioContext.currentTime;
      const cheerLen = audioContext.sampleRate * 2.0;
      const cheerBuf = audioContext.createBuffer(1, cheerLen, audioContext.sampleRate);
      const cheerData = cheerBuf.getChannelData(0);
      for (let i = 0; i < cheerLen; i++) cheerData[i] = Math.random() * 2 - 1;
      const cheerSrc = audioContext.createBufferSource();
      cheerSrc.buffer = cheerBuf;
      const cheerBP = audioContext.createBiquadFilter();
      cheerBP.type = 'bandpass';
      cheerBP.frequency.setValueAtTime(2500, ct);
      cheerBP.Q.setValueAtTime(0.5, ct);
      const cheerGain = audioContext.createGain();
      cheerSrc.connect(cheerBP);
      cheerBP.connect(cheerGain);
      cheerGain.connect(audioContext.destination);
      cheerGain.gain.setValueAtTime(0.06, ct);
      cheerGain.gain.linearRampToValueAtTime(0.08, ct + 0.5);
      cheerGain.gain.exponentialRampToValueAtTime(0.001, ct + 2.0);
      cheerSrc.start(ct);
      cheerSrc.stop(ct + 2.0);
    }, 800);
  },

  playDefeat: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    const t = audioContext.currentTime;

    const brassOsc = audioContext.createOscillator();
    const brassGain = audioContext.createGain();
    brassOsc.type = 'sawtooth';
    brassOsc.frequency.setValueAtTime(300, t);
    brassOsc.frequency.linearRampToValueAtTime(80, t + 2.0);
    brassOsc.connect(brassGain);
    brassGain.connect(audioContext.destination);
    brassGain.gain.setValueAtTime(0.12, t);
    brassGain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
    brassOsc.start(t);
    brassOsc.stop(t + 2.0);

    const droneOsc = audioContext.createOscillator();
    const droneGain = audioContext.createGain();
    droneOsc.type = 'sine';
    droneOsc.frequency.setValueAtTime(55, t);
    droneOsc.connect(droneGain);
    droneGain.connect(audioContext.destination);
    droneGain.gain.setValueAtTime(0.15, t);
    droneGain.gain.linearRampToValueAtTime(0.12, t + 2.0);
    droneGain.gain.exponentialRampToValueAtTime(0.001, t + 3.0);
    droneOsc.start(t);
    droneOsc.stop(t + 3.0);

    setTimeout(() => {
      const ct = audioContext.currentTime;
      const glassLen = audioContext.sampleRate * 0.15;
      const glassBuf = audioContext.createBuffer(1, glassLen, audioContext.sampleRate);
      const glassData = glassBuf.getChannelData(0);
      for (let i = 0; i < glassLen; i++) glassData[i] = Math.random() * 2 - 1;
      const glassSrc = audioContext.createBufferSource();
      glassSrc.buffer = glassBuf;
      const glassFilter = audioContext.createBiquadFilter();
      glassFilter.type = 'bandpass';
      glassFilter.frequency.setValueAtTime(3000, ct);
      glassFilter.Q.setValueAtTime(3, ct);
      const glassGain = audioContext.createGain();
      glassSrc.connect(glassFilter);
      glassFilter.connect(glassGain);
      glassGain.connect(audioContext.destination);
      glassGain.gain.setValueAtTime(0.18, ct);
      glassGain.gain.exponentialRampToValueAtTime(0.001, ct + 0.15);
      glassSrc.start(ct);
      glassSrc.stop(ct + 0.15);
    }, 500);

    [1000, 1500].forEach((delay) => {
      setTimeout(() => {
        const ct = audioContext.currentTime;
        const beatOsc = audioContext.createOscillator();
        const beatGain = audioContext.createGain();
        beatOsc.type = 'sine';
        beatOsc.frequency.setValueAtTime(60, ct);
        beatOsc.connect(beatGain);
        beatGain.connect(audioContext.destination);
        beatGain.gain.setValueAtTime(0.2, ct);
        beatGain.gain.exponentialRampToValueAtTime(0.001, ct + 0.25);
        beatOsc.start(ct);
        beatOsc.stop(ct + 0.25);
      }, delay);
    });
  },

  playDefenseActivated: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.defense) return;

    const shield1 = audioContext.createOscillator();
    const shield1Gain = audioContext.createGain();
    shield1.connect(shield1Gain);
    shield1Gain.connect(audioContext.destination);
    shield1.frequency.setValueAtTime(300, audioContext.currentTime);
    shield1.frequency.linearRampToValueAtTime(600, audioContext.currentTime + 0.05);
    shield1.frequency.linearRampToValueAtTime(400, audioContext.currentTime + 0.15);
    shield1.type = 'triangle';
    shield1Gain.gain.setValueAtTime(0.15, audioContext.currentTime);
    shield1Gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
    shield1.start(audioContext.currentTime);
    shield1.stop(audioContext.currentTime + 0.25);

    const metallic = audioContext.createOscillator();
    const metallicGain = audioContext.createGain();
    metallic.connect(metallicGain);
    metallicGain.connect(audioContext.destination);
    metallic.frequency.setValueAtTime(2000, audioContext.currentTime);
    metallic.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.08);
    metallic.type = 'square';
    metallicGain.gain.setValueAtTime(0.06, audioContext.currentTime);
    metallicGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    metallic.start(audioContext.currentTime);
    metallic.stop(audioContext.currentTime + 0.1);

    setTimeout(() => {
      const shimmer = audioContext.createOscillator();
      const shimmerGain = audioContext.createGain();
      shimmer.connect(shimmerGain);
      shimmerGain.connect(audioContext.destination);
      shimmer.frequency.setValueAtTime(1200, audioContext.currentTime);
      shimmer.frequency.linearRampToValueAtTime(800, audioContext.currentTime + 0.2);
      shimmer.type = 'sine';
      shimmerGain.gain.setValueAtTime(0.05, audioContext.currentTime);
      shimmerGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      shimmer.start(audioContext.currentTime);
      shimmer.stop(audioContext.currentTime + 0.2);
    }, 80);
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

  playBattleMusic: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return { stop: () => {} };
    
    get().stopBattleMusic();
    
    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    
    const bassDrone = audioContext.createOscillator();
    const bassGain = audioContext.createGain();
    bassDrone.type = 'sawtooth';
    bassDrone.frequency.setValueAtTime(55, audioContext.currentTime);
    bassGain.gain.setValueAtTime(0.06, audioContext.currentTime);
    bassDrone.connect(bassGain);
    bassGain.connect(audioContext.destination);
    bassDrone.start();
    oscillators.push(bassDrone);
    gains.push(bassGain);
    
    const subBass = audioContext.createOscillator();
    const subGain = audioContext.createGain();
    subBass.type = 'sine';
    subBass.frequency.setValueAtTime(40, audioContext.currentTime);
    subGain.gain.setValueAtTime(0.08, audioContext.currentTime);
    subBass.connect(subGain);
    subGain.connect(audioContext.destination);
    subBass.start();
    oscillators.push(subBass);
    gains.push(subGain);
    
    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(2, audioContext.currentTime);
    lfoGain.gain.setValueAtTime(0.04, audioContext.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(bassGain.gain);
    lfo.start();
    oscillators.push(lfo);
    gains.push(lfoGain);
    
    const tension = audioContext.createOscillator();
    const tensionGain = audioContext.createGain();
    tension.type = 'triangle';
    tension.frequency.setValueAtTime(220, audioContext.currentTime);
    tensionGain.gain.setValueAtTime(0.03, audioContext.currentTime);
    tension.connect(tensionGain);
    tensionGain.connect(audioContext.destination);
    tension.start();
    oscillators.push(tension);
    gains.push(tensionGain);
    
    const tick = audioContext.createOscillator();
    const tickGain = audioContext.createGain();
    tick.type = 'square';
    tick.frequency.setValueAtTime(880, audioContext.currentTime);
    tickGain.gain.setValueAtTime(0, audioContext.currentTime);
    tick.connect(tickGain);
    tickGain.connect(audioContext.destination);
    tick.start();
    oscillators.push(tick);
    gains.push(tickGain);
    
    const tickInterval = setInterval(() => {
      const ctx = get().audioContext;
      if (!ctx || !get()._battleMusicNodes?.active) {
        clearInterval(tickInterval);
        return;
      }
      tickGain.gain.setValueAtTime(0.04, ctx.currentTime);
      tickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    }, 250);
    
    set({
      _battleMusicNodes: { oscillators, gains, tickInterval, active: true }
    });
    
    return {
      stop: () => {
        get().stopBattleMusic();
      }
    };
  },

  stopBattleMusic: () => {
    const nodes = get()._battleMusicNodes;
    if (nodes && nodes.active) {
      if (nodes.tickInterval) {
        clearInterval(nodes.tickInterval);
      }
      const ctx = get().audioContext;
      nodes.gains.forEach(g => {
        try {
          if (ctx) {
            g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          }
        } catch {}
      });
      setTimeout(() => {
        nodes.oscillators.forEach(o => {
          try { o.stop(); } catch {}
        });
      }, 400);
      set({ _battleMusicNodes: { ...nodes, tickInterval: null, active: false } });
    }
  },

  startAmbientSound: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    const existing = get()._ambientNodes;
    if (existing?.active) return;

    const mood = get()._ambientMood;
    const moodConfig = {
      calm:    { freqs: [130.81, 164.81, 196.00, 261.63], vol: 0.06, filterFreq: 600, lfoRate: 0.15, lfoDepth: 8 },
      tension: { freqs: [110.00, 146.83, 174.61, 220.00], vol: 0.07, filterFreq: 900, lfoRate: 0.4, lfoDepth: 15 },
      myturn:  { freqs: [164.81, 196.00, 246.94, 329.63], vol: 0.065, filterFreq: 1000, lfoRate: 0.25, lfoDepth: 12 },
      victory: { freqs: [196.00, 246.94, 293.66, 392.00], vol: 0.07, filterFreq: 1200, lfoRate: 0.2, lfoDepth: 10 },
      danger:  { freqs: [82.41, 110.00, 138.59, 164.81], vol: 0.07, filterFreq: 500, lfoRate: 0.6, lfoDepth: 20 },
    };
    const cfg = moodConfig[mood];
    const now = audioContext.currentTime;

    const masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(1, now + 2.5);

    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cfg.filterFreq, now);
    filter.Q.setValueAtTime(1.5, now);

    const lfo = audioContext.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(cfg.lfoRate, now);
    const lfoGain = audioContext.createGain();
    lfoGain.gain.setValueAtTime(cfg.lfoDepth, now);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(now);

    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];

    cfg.freqs.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      const detune = audioContext.createOscillator();
      detune.type = 'sine';
      detune.frequency.setValueAtTime(0.05 + i * 0.03, now);
      const detuneGain = audioContext.createGain();
      detuneGain.gain.setValueAtTime(2 + i, now);
      detune.connect(detuneGain);
      detuneGain.connect(osc.frequency);
      detune.start(now);

      const oscGain = audioContext.createGain();
      const vol = cfg.vol * (i === 0 ? 1.0 : i === 1 ? 0.7 : i === 2 ? 0.5 : 0.35);
      oscGain.gain.setValueAtTime(vol, now);

      osc.connect(oscGain);
      oscGain.connect(filter);

      osc.start(now + i * 0.3);
      oscillators.push(osc, detune);
      gains.push(oscGain, detuneGain);
    });

    filter.connect(masterGain);
    masterGain.connect(audioContext.destination);

    set({
      _ambientNodes: {
        oscillators,
        gains,
        masterGain,
        filter,
        active: true,
        lfo,
        lfoGain,
      },
    });
  },

  stopAmbientSound: () => {
    const nodes = get()._ambientNodes;
    if (nodes?.active && nodes.masterGain) {
      const ctx = get().audioContext;
      if (ctx) {
        try {
          nodes.masterGain.gain.setValueAtTime(nodes.masterGain.gain.value, ctx.currentTime);
          nodes.masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
        } catch {}
      }
      setTimeout(() => {
        try {
          nodes.oscillators.forEach(o => { try { o.stop(); } catch {} });
          if (nodes.lfo) nodes.lfo.stop();
        } catch {}
      }, 2000);
      set({ _ambientNodes: { oscillators: [], gains: [], masterGain: null, filter: null, active: false, lfo: null, lfoGain: null } });
    }
  },

  setAmbientMood: (mood: 'calm' | 'tension' | 'myturn' | 'victory' | 'danger') => {
    const prev = get()._ambientMood;
    if (mood === prev) return;
    set({ _ambientMood: mood });

    const nodes = get()._ambientNodes;
    if (!nodes?.active) return;
    const ctx = get().audioContext;
    if (!ctx) return;

    const moodConfig = {
      calm:    { freqs: [130.81, 164.81, 196.00, 261.63], vol: 0.06, filterFreq: 600, lfoRate: 0.15, lfoDepth: 8 },
      tension: { freqs: [110.00, 146.83, 174.61, 220.00], vol: 0.07, filterFreq: 900, lfoRate: 0.4, lfoDepth: 15 },
      myturn:  { freqs: [164.81, 196.00, 246.94, 329.63], vol: 0.065, filterFreq: 1000, lfoRate: 0.25, lfoDepth: 12 },
      victory: { freqs: [196.00, 246.94, 293.66, 392.00], vol: 0.07, filterFreq: 1200, lfoRate: 0.2, lfoDepth: 10 },
      danger:  { freqs: [82.41, 110.00, 138.59, 164.81], vol: 0.07, filterFreq: 500, lfoRate: 0.6, lfoDepth: 20 },
    };
    const cfg = moodConfig[mood];
    const now = ctx.currentTime;
    const ramp = 1.5;

    if (nodes.filter) {
      nodes.filter.frequency.cancelScheduledValues(now);
      nodes.filter.frequency.setValueAtTime(nodes.filter.frequency.value, now);
      nodes.filter.frequency.linearRampToValueAtTime(cfg.filterFreq, now + ramp);
    }
    if (nodes.lfo) {
      nodes.lfo.frequency.cancelScheduledValues(now);
      nodes.lfo.frequency.setValueAtTime(nodes.lfo.frequency.value, now);
      nodes.lfo.frequency.linearRampToValueAtTime(cfg.lfoRate, now + ramp);
    }
    if (nodes.lfoGain) {
      nodes.lfoGain.gain.cancelScheduledValues(now);
      nodes.lfoGain.gain.setValueAtTime(nodes.lfoGain.gain.value, now);
      nodes.lfoGain.gain.linearRampToValueAtTime(cfg.lfoDepth, now + ramp);
    }

    const mainOscs = nodes.oscillators.filter((_, i) => i % 2 === 0);
    mainOscs.forEach((osc, i) => {
      if (i < cfg.freqs.length) {
        osc.frequency.cancelScheduledValues(now);
        osc.frequency.setValueAtTime(osc.frequency.value, now);
        osc.frequency.linearRampToValueAtTime(cfg.freqs[i], now + ramp);
      }
    });

    const mainGains = nodes.gains.filter((_, i) => i % 2 === 0);
    mainGains.forEach((g, i) => {
      if (i < cfg.freqs.length) {
        const vol = cfg.vol * (i === 0 ? 1.0 : i === 1 ? 0.7 : i === 2 ? 0.5 : 0.35);
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.linearRampToValueAtTime(vol, now + ramp);
      }
    });
  },

  playTennisHit: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(1200, audioContext.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.08);
    gain1.gain.setValueAtTime(0.15, audioContext.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.start(audioContext.currentTime);
    osc1.stop(audioContext.currentTime + 0.1);
    
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(600, audioContext.currentTime + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.15);
    gain2.gain.setValueAtTime(0, audioContext.currentTime);
    gain2.gain.setValueAtTime(0.1, audioContext.currentTime + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.start(audioContext.currentTime);
    osc2.stop(audioContext.currentTime + 0.15);
    
    const bufferSize = audioContext.sampleRate * 0.05;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.12, audioContext.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.06);
    noiseSource.connect(noiseGain);
    noiseGain.connect(audioContext.destination);
    noiseSource.start(audioContext.currentTime);
  },

  playSempafaagaraHit: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(150, audioContext.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(80, audioContext.currentTime + 0.2);
    gain1.gain.setValueAtTime(0.12, audioContext.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.25);
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.start(audioContext.currentTime);
    osc1.stop(audioContext.currentTime + 0.25);
    
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(2000, audioContext.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.15);
    gain2.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.start(audioContext.currentTime);
    osc2.stop(audioContext.currentTime + 0.15);
    
    const osc3 = audioContext.createOscillator();
    const gain3 = audioContext.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(60, audioContext.currentTime);
    gain3.gain.setValueAtTime(0.15, audioContext.currentTime);
    gain3.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
    osc3.connect(gain3);
    gain3.connect(audioContext.destination);
    osc3.start(audioContext.currentTime);
    osc3.stop(audioContext.currentTime + 0.3);
    
    const bufferSize = audioContext.sampleRate * 0.08;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.4;
    }
    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.1, audioContext.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
    noiseSource.connect(noiseGain);
    noiseGain.connect(audioContext.destination);
    noiseSource.start(audioContext.currentTime);
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
    const t = audioContext.currentTime;

    const slamOsc = audioContext.createOscillator();
    const slamGain = audioContext.createGain();
    slamOsc.type = 'sine';
    slamOsc.frequency.setValueAtTime(40, t);
    slamOsc.frequency.exponentialRampToValueAtTime(25, t + 0.2);
    slamOsc.connect(slamGain);
    slamGain.connect(audioContext.destination);
    slamGain.gain.setValueAtTime(0.25, t);
    slamGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    slamOsc.start(t);
    slamOsc.stop(t + 0.25);

    const impactOsc = audioContext.createOscillator();
    const impactGain = audioContext.createGain();
    impactOsc.type = 'triangle';
    impactOsc.frequency.setValueAtTime(80, t);
    impactOsc.frequency.exponentialRampToValueAtTime(30, t + 0.15);
    impactOsc.connect(impactGain);
    impactGain.connect(audioContext.destination);
    impactGain.gain.setValueAtTime(0.18, t);
    impactGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    impactOsc.start(t);
    impactOsc.stop(t + 0.2);

    const bufferSize = audioContext.sampleRate * 0.08;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseGain = audioContext.createGain();
    const noiseFilter = audioContext.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(300, t);
    noiseFilter.Q.setValueAtTime(2, t);
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioContext.destination);
    noiseGain.gain.setValueAtTime(0.12, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    noiseSource.start(t);
    noiseSource.stop(t + 0.08);

    const whooshOsc = audioContext.createOscillator();
    const whooshGain = audioContext.createGain();
    whooshOsc.type = 'sawtooth';
    whooshOsc.frequency.setValueAtTime(150, t + 0.02);
    whooshOsc.frequency.exponentialRampToValueAtTime(600, t + 0.15);
    whooshOsc.frequency.exponentialRampToValueAtTime(100, t + 0.35);
    whooshOsc.connect(whooshGain);
    whooshGain.connect(audioContext.destination);
    whooshGain.gain.setValueAtTime(0.04, t + 0.02);
    whooshGain.gain.linearRampToValueAtTime(0.08, t + 0.1);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    whooshOsc.start(t + 0.02);
    whooshOsc.stop(t + 0.35);

    setTimeout(() => {
      const ct = audioContext.currentTime;
      [1100, 1400, 1760, 2200].forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ct + i * 0.02);
        osc.connect(gain);
        gain.connect(audioContext.destination);
        gain.gain.setValueAtTime(0.06, ct + i * 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ct + i * 0.02 + 0.25);
        osc.start(ct + i * 0.02);
        osc.stop(ct + i * 0.02 + 0.25);
      });

      const chimeOsc = audioContext.createOscillator();
      const chimeGain = audioContext.createGain();
      chimeOsc.type = 'sine';
      chimeOsc.frequency.setValueAtTime(880, ct + 0.08);
      chimeOsc.connect(chimeGain);
      chimeGain.connect(audioContext.destination);
      chimeGain.gain.setValueAtTime(0.07, ct + 0.08);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, ct + 0.5);
      chimeOsc.start(ct + 0.08);
      chimeOsc.stop(ct + 0.5);
    }, 60);
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

  playCardHover: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;

    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.frequency.setValueAtTime(1800, audioContext.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(2200, audioContext.currentTime + 0.03);
    osc1.type = 'sine';
    gain1.gain.setValueAtTime(0, audioContext.currentTime);
    gain1.gain.linearRampToValueAtTime(0.04, audioContext.currentTime + 0.005);
    gain1.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.06);
    osc1.start(audioContext.currentTime);
    osc1.stop(audioContext.currentTime + 0.06);

    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.frequency.setValueAtTime(3600, audioContext.currentTime);
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0, audioContext.currentTime);
    gain2.gain.linearRampToValueAtTime(0.015, audioContext.currentTime + 0.003);
    gain2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.04);
    osc2.start(audioContext.currentTime);
    osc2.stop(audioContext.currentTime + 0.04);
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
  },

  playEpicExplosion: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.attack) return;
    const t = audioContext.currentTime;

    const boomOsc = audioContext.createOscillator();
    const boomGain = audioContext.createGain();
    boomOsc.type = 'sine';
    boomOsc.frequency.setValueAtTime(25, t);
    boomOsc.connect(boomGain);
    boomGain.connect(audioContext.destination);
    boomGain.gain.setValueAtTime(0.25, t);
    boomGain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    boomOsc.start(t);
    boomOsc.stop(t + 1.0);

    const noiseLen = audioContext.sampleRate * 1.0;
    const noiseBuf = audioContext.createBuffer(1, noiseLen, audioContext.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) noiseData[i] = Math.random() * 2 - 1;

    const midSrc = audioContext.createBufferSource();
    midSrc.buffer = noiseBuf;
    const midFilter = audioContext.createBiquadFilter();
    midFilter.type = 'bandpass';
    midFilter.frequency.setValueAtTime(300, t);
    midFilter.Q.setValueAtTime(2, t);
    const midGain = audioContext.createGain();
    midSrc.connect(midFilter);
    midFilter.connect(midGain);
    midGain.connect(audioContext.destination);
    midGain.gain.setValueAtTime(0.22, t);
    midGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    midSrc.start(t);
    midSrc.stop(t + 0.6);

    const hiSrc = audioContext.createBufferSource();
    const hiBuf = audioContext.createBuffer(1, audioContext.sampleRate * 0.5, audioContext.sampleRate);
    const hiData = hiBuf.getChannelData(0);
    for (let i = 0; i < hiData.length; i++) hiData[i] = Math.random() * 2 - 1;
    hiSrc.buffer = hiBuf;
    const hiFilter = audioContext.createBiquadFilter();
    hiFilter.type = 'highpass';
    hiFilter.frequency.setValueAtTime(2000, t);
    const hiGain = audioContext.createGain();
    hiSrc.connect(hiFilter);
    hiFilter.connect(hiGain);
    hiGain.connect(audioContext.destination);
    hiGain.gain.setValueAtTime(0.1, t);
    hiGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    hiSrc.start(t);
    hiSrc.stop(t + 0.5);

    const lowSrc = audioContext.createBufferSource();
    const lowBuf = audioContext.createBuffer(1, audioContext.sampleRate * 0.8, audioContext.sampleRate);
    const lowData = lowBuf.getChannelData(0);
    for (let i = 0; i < lowData.length; i++) lowData[i] = Math.random() * 2 - 1;
    lowSrc.buffer = lowBuf;
    const lowFilter = audioContext.createBiquadFilter();
    lowFilter.type = 'lowpass';
    lowFilter.frequency.setValueAtTime(80, t);
    const lowGain = audioContext.createGain();
    lowSrc.connect(lowFilter);
    lowFilter.connect(lowGain);
    lowGain.connect(audioContext.destination);
    lowGain.gain.setValueAtTime(0.18, t);
    lowGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    lowSrc.start(t);
    lowSrc.stop(t + 0.8);

    const subOsc = audioContext.createOscillator();
    const subGain = audioContext.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(20, t);
    subOsc.connect(subGain);
    subGain.connect(audioContext.destination);
    subGain.gain.setValueAtTime(0.2, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
    subOsc.start(t);
    subOsc.stop(t + 2.0);
  },

  playEpicImpact: () => {
    const { audioContext, isMuted } = get();
    if (isMuted || !audioContext) return;
    if (!get().soundSettings.attack) return;
    const t = audioContext.currentTime;

    const clangOsc = audioContext.createOscillator();
    const clangGain = audioContext.createGain();
    clangOsc.type = 'square';
    clangOsc.frequency.setValueAtTime(1500, t);
    clangOsc.frequency.exponentialRampToValueAtTime(300, t + 0.2);
    clangOsc.connect(clangGain);
    clangGain.connect(audioContext.destination);
    clangGain.gain.setValueAtTime(0.18, t);
    clangGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    clangOsc.start(t);
    clangOsc.stop(t + 0.25);

    const bodyOsc = audioContext.createOscillator();
    const bodyGain = audioContext.createGain();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(80, t);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(audioContext.destination);
    bodyGain.gain.setValueAtTime(0.25, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    bodyOsc.start(t);
    bodyOsc.stop(t + 0.2);

    for (let i = 0; i < 12; i++) {
      setTimeout(() => {
        const ct = audioContext.currentTime;
        const sparkOsc = audioContext.createOscillator();
        const sparkGain = audioContext.createGain();
        sparkOsc.type = 'square';
        sparkOsc.frequency.setValueAtTime(3000 + Math.random() * 2000, ct);
        sparkOsc.connect(sparkGain);
        sparkGain.connect(audioContext.destination);
        const vol = 0.06 * (1 - i / 12);
        sparkGain.gain.setValueAtTime(vol, ct);
        sparkGain.gain.exponentialRampToValueAtTime(0.001, ct + 0.02);
        sparkOsc.start(ct);
        sparkOsc.stop(ct + 0.02);
      }, i * 25);
    }

    const impactLen = audioContext.sampleRate * 0.08;
    const impactBuf = audioContext.createBuffer(1, impactLen, audioContext.sampleRate);
    const impactData = impactBuf.getChannelData(0);
    for (let i = 0; i < impactLen; i++) impactData[i] = Math.random() * 2 - 1;
    const impactSrc = audioContext.createBufferSource();
    impactSrc.buffer = impactBuf;
    const impactGain = audioContext.createGain();
    impactSrc.connect(impactGain);
    impactGain.connect(audioContext.destination);
    impactGain.gain.setValueAtTime(0.15, t);
    impactGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    impactSrc.start(t);
    impactSrc.stop(t + 0.08);
  },

  registerLowHealthCard: (cardId: string) => {
    const { _lowHealthCardIds, _lowHealthAlarmNodes, isMuted, audioContext } = get();
    const newSet = new Set(_lowHealthCardIds);
    newSet.add(cardId);
    set({ _lowHealthCardIds: newSet });

    if (!_lowHealthAlarmNodes?.active && !isMuted && audioContext) {
      const masterGain = audioContext.createGain();
      masterGain.gain.setValueAtTime(0.06, audioContext.currentTime);
      masterGain.connect(audioContext.destination);

      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(660, audioContext.currentTime);
      gain1.gain.setValueAtTime(0.7, audioContext.currentTime);
      osc1.connect(gain1);
      gain1.connect(masterGain);

      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(550, audioContext.currentTime);
      gain2.gain.setValueAtTime(0.5, audioContext.currentTime);
      osc2.connect(gain2);
      gain2.connect(masterGain);

      const lfo = audioContext.createOscillator();
      const lfoGain = audioContext.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(1.8, audioContext.currentTime);
      lfoGain.gain.setValueAtTime(110, audioContext.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);

      const ampLfo = audioContext.createOscillator();
      const ampLfoGain = audioContext.createGain();
      ampLfo.type = 'sine';
      ampLfo.frequency.setValueAtTime(3.5, audioContext.currentTime);
      ampLfoGain.gain.setValueAtTime(0.03, audioContext.currentTime);
      ampLfo.connect(ampLfoGain);
      ampLfoGain.connect(masterGain.gain);

      osc1.start(audioContext.currentTime);
      osc2.start(audioContext.currentTime);
      lfo.start(audioContext.currentTime);
      ampLfo.start(audioContext.currentTime);

      set({ _lowHealthAlarmNodes: { oscillators: [osc1, osc2, ampLfo], gains: [gain1, gain2, masterGain, lfoGain, ampLfoGain], lfo, active: true } });
    }
  },

  unregisterLowHealthCard: (cardId: string) => {
    const { _lowHealthCardIds, _lowHealthAlarmNodes, audioContext } = get();
    const newSet = new Set(_lowHealthCardIds);
    newSet.delete(cardId);
    set({ _lowHealthCardIds: newSet });

    if (newSet.size === 0 && _lowHealthAlarmNodes?.active && audioContext) {
      const now = audioContext.currentTime;
      _lowHealthAlarmNodes.gains.forEach(g => {
        try { g.gain.cancelScheduledValues(now); g.gain.linearRampToValueAtTime(0, now + 0.3); } catch {}
      });

      setTimeout(() => {
        _lowHealthAlarmNodes.oscillators.forEach(o => { try { o.stop(); } catch {} });
        if (_lowHealthAlarmNodes.lfo) { try { _lowHealthAlarmNodes.lfo.stop(); } catch {} }
      }, 400);

      set({ _lowHealthAlarmNodes: { ..._lowHealthAlarmNodes, active: false } });
    }
  }
}));
