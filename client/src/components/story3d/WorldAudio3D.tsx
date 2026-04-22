import React, { useRef, useEffect } from 'react';
import { useFrame }                 from '@react-three/fiber';
import { useAudio }                 from '../../lib/stores/useAudio';

const LAKE_X = -80;
const LAKE_Z  = 60;

/* ── White-noise looping source ──────────────────────────────────── */
function makeLoopingNoise(ctx: AudioContext): AudioBufferSourceNode {
  const len = Math.ceil(ctx.sampleRate * 1.5);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch  = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop   = true;
  return src;
}

/* ── One-shot helpers ────────────────────────────────────────────── */
function playBirds(ctx: AudioContext, dest: AudioNode) {
  const n = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type   = 'sine';
      const f0   = 820 + Math.random() * 480;
      osc.frequency.setValueAtTime(f0, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(f0 + 80 + Math.random() * 120, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
      osc.connect(gain); gain.connect(dest);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.13);
    }, i * (80 + Math.random() * 60));
  }
}

function playThunder(ctx: AudioContext, dest: AudioNode) {
  const len = Math.ceil(ctx.sampleRate * 2.2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch  = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const src    = ctx.createBufferSource();
  src.buffer   = buf;
  const filter = ctx.createBiquadFilter();
  filter.type  = 'lowpass';
  filter.frequency.setValueAtTime(180, ctx.currentTime);
  const gain   = ctx.createGain();
  const now    = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.13, now + 0.04);
  gain.gain.setValueAtTime(0.13, now + 0.28);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.90);
  src.connect(filter); filter.connect(gain); gain.connect(dest);
  src.start(now); src.stop(now + 2.2);
}

function playJingle(ctx: AudioContext, dest: AudioNode, kind: 'dawn' | 'dusk') {
  const DAWN = [261.63, 329.63, 392.00, 523.25];
  const DUSK = [392.00, 329.63, 261.63];
  const notes = kind === 'dawn' ? DAWN : DUSK;
  const vol   = kind === 'dawn' ? 0.07 : 0.06;
  notes.forEach((freq, i) => {
    setTimeout(() => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type   = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      const now  = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.02);
      gain.gain.setValueAtTime(vol, now + 0.10);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(gain); gain.connect(dest);
      osc.start(now); osc.stop(now + 0.42);
    }, i * 95);
  });
}

function playFootstep(ctx: AudioContext, dest: AudioNode, onAsphalt: boolean) {
  const osc   = ctx.createOscillator();
  const gain  = ctx.createGain();
  osc.type    = onAsphalt ? 'square' : 'triangle';
  osc.frequency.setValueAtTime(onAsphalt ? 130 : 85, ctx.currentTime);
  const vol   = onAsphalt ? 0.050 : 0.038;
  const decay = onAsphalt ? 0.070 : 0.055;
  const now   = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, now + decay);
  osc.connect(gain); gain.connect(dest);
  osc.start(now); osc.stop(now + decay + 0.01);
}

/* ── Node bag ────────────────────────────────────────────────────── */
interface Nodes {
  ctx:         AudioContext;
  master:      GainNode;
  windSrc:     AudioBufferSourceNode;
  rainSrc:     AudioBufferSourceNode;
  lakeSrc:     AudioBufferSourceNode;
  windGain:    GainNode;
  rainGain:    GainNode;
  lakeGain:    GainNode;
  lakeLfo:     OscillatorNode;
  arenaOsc1:   OscillatorNode;
  arenaOsc2:   OscillatorNode;
  arenaGain:   GainNode;
  arenaLfo:    OscillatorNode;
  cricketOsc:  OscillatorNode;
  cricketLfo:  OscillatorNode;
  cricketGain: GainNode;
}

/* ── Component ───────────────────────────────────────────────────── */
export function WorldAudio3D({
  dayTimeRef,
  playerRef,
  arenaPositions,
  weatherIntensityRef,
}: {
  dayTimeRef:          React.MutableRefObject<number>;
  playerRef:           React.MutableRefObject<{ x: number; z: number }>;
  arenaPositions:      [number, number][];
  weatherIntensityRef: React.MutableRefObject<number>;
}) {
  const isMuted           = useAudio(s => s.isMuted);
  const audioCtxFromStore = useAudio(s => s.audioContext);
  const initAudioContext  = useAudio(s => s.initAudioContext);

  const nodesRef     = useRef<Nodes | null>(null);
  const isMutedRef   = useRef(isMuted);

  const birdTimerRef    = useRef(6 + Math.random() * 8);
  const thunderTimerRef = useRef(20 + Math.random() * 35);

  const footDistRef  = useRef(0);
  const idleTimeRef  = useRef(0);
  const lastPosRef   = useRef({ x: 0, z: 0 });

  const dawnPlayedRef = useRef(false);
  const duskPlayedRef = useRef(false);
  const prevTRef      = useRef(dayTimeRef.current);

  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { initAudioContext(); }, [initAudioContext]);

  useEffect(() => {
    const ctx = audioCtxFromStore;
    if (!ctx || nodesRef.current) return;

    try {
      const now    = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(isMuted ? 0 : 0.60, now);
      master.connect(ctx.destination);

      /* Wind — bandpass noise */
      const windSrc    = makeLoopingNoise(ctx);
      const windFilter = ctx.createBiquadFilter();
      windFilter.type  = 'bandpass';
      windFilter.frequency.setValueAtTime(320, now);
      windFilter.Q.setValueAtTime(0.7, now);
      const windGain   = ctx.createGain();
      windGain.gain.setValueAtTime(0.025, now);
      windSrc.connect(windFilter); windFilter.connect(windGain); windGain.connect(master);
      windSrc.start();

      /* Rain — lowpass noise */
      const rainSrc    = makeLoopingNoise(ctx);
      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type  = 'lowpass';
      rainFilter.frequency.setValueAtTime(1200, now);
      const rainGain   = ctx.createGain();
      rainGain.gain.setValueAtTime(0, now);
      rainSrc.connect(rainFilter); rainFilter.connect(rainGain); rainGain.connect(master);
      rainSrc.start();

      /* Lake — lowpass noise with 0.3 Hz amplitude LFO */
      const lakeSrc     = makeLoopingNoise(ctx);
      const lakeFilter  = ctx.createBiquadFilter();
      lakeFilter.type   = 'lowpass';
      lakeFilter.frequency.setValueAtTime(400, now);
      const lakeGain    = ctx.createGain();         // proximity-controlled
      lakeGain.gain.setValueAtTime(0, now);
      const lakeModGain = ctx.createGain();         // LFO modulation layer
      lakeModGain.gain.setValueAtTime(1.0, now);
      const lakeLfo     = ctx.createOscillator();
      lakeLfo.type      = 'sine';
      lakeLfo.frequency.setValueAtTime(0.3, now);
      const lakeLfoGain = ctx.createGain();
      lakeLfoGain.gain.setValueAtTime(0.12, now);
      lakeLfo.connect(lakeLfoGain); lakeLfoGain.connect(lakeModGain.gain);
      lakeSrc.connect(lakeFilter); lakeFilter.connect(lakeGain);
      lakeGain.connect(lakeModGain); lakeModGain.connect(master);
      lakeSrc.start(); lakeLfo.start();

      /* Arena hum — 55 Hz + 110 Hz with 1.8 Hz pulse LFO */
      const arenaOsc1    = ctx.createOscillator();
      arenaOsc1.type     = 'sine';
      arenaOsc1.frequency.setValueAtTime(55, now);
      const arenaOsc2    = ctx.createOscillator();
      arenaOsc2.type     = 'sine';
      arenaOsc2.frequency.setValueAtTime(110, now);
      const arenaGain    = ctx.createGain();        // proximity-controlled
      arenaGain.gain.setValueAtTime(0, now);
      const arenaModGain = ctx.createGain();        // pulse modulation layer
      arenaModGain.gain.setValueAtTime(1.0, now);
      const arenaLfo     = ctx.createOscillator();
      arenaLfo.type      = 'sine';
      arenaLfo.frequency.setValueAtTime(1.8, now);
      const arenaLfoGain = ctx.createGain();
      arenaLfoGain.gain.setValueAtTime(0.35, now);
      arenaLfo.connect(arenaLfoGain); arenaLfoGain.connect(arenaModGain.gain);
      arenaOsc1.connect(arenaGain); arenaOsc2.connect(arenaGain);
      arenaGain.connect(arenaModGain); arenaModGain.connect(master);
      arenaOsc1.start(); arenaOsc2.start(); arenaLfo.start();

      /* Crickets — triangle FM */
      const cricketOsc     = ctx.createOscillator();
      cricketOsc.type      = 'triangle';
      cricketOsc.frequency.setValueAtTime(3800, now);
      const cricketLfo     = ctx.createOscillator();
      cricketLfo.type      = 'sine';
      cricketLfo.frequency.setValueAtTime(18, now);
      const cricketLfoGain = ctx.createGain();
      cricketLfoGain.gain.setValueAtTime(90, now);
      cricketLfo.connect(cricketLfoGain); cricketLfoGain.connect(cricketOsc.frequency);
      const cricketGain    = ctx.createGain();
      cricketGain.gain.setValueAtTime(0, now);
      cricketOsc.connect(cricketGain); cricketGain.connect(master);
      cricketOsc.start(); cricketLfo.start();

      lastPosRef.current = { x: playerRef.current.x, z: playerRef.current.z };

      nodesRef.current = {
        ctx, master,
        windSrc, rainSrc, lakeSrc,
        windGain, rainGain, lakeGain, lakeLfo,
        arenaOsc1, arenaOsc2, arenaGain, arenaLfo,
        cricketOsc, cricketLfo, cricketGain,
      };
    } catch (err) {
      console.warn('[WorldAudio3D] init error', err);
    }

    return () => {
      const n = nodesRef.current;
      if (!n) return;
      [n.windSrc, n.rainSrc, n.lakeSrc, n.lakeLfo,
       n.arenaOsc1, n.arenaOsc2, n.arenaLfo,
       n.cricketOsc, n.cricketLfo].forEach(nd => { try { nd.stop(); } catch {} });
      try { n.master.disconnect(); } catch {}
      nodesRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioCtxFromStore]);

  useEffect(() => {
    const n = nodesRef.current;
    if (!n) return;
    n.master.gain.setTargetAtTime(isMuted ? 0 : 0.60, n.ctx.currentTime, 0.12);
  }, [isMuted]);

  useFrame((_, delta) => {
    const n = nodesRef.current;
    if (!n) return;

    const ctx   = n.ctx;
    const now   = ctx.currentTime;
    const t     = dayTimeRef.current;
    const rain  = weatherIntensityRef.current;
    const muted = isMutedRef.current;
    const px    = playerRef.current.x;
    const pz    = playerRef.current.z;

    n.windGain.gain.setTargetAtTime(0.025 + rain * 0.030, now, 0.6);
    n.rainGain.gain.setTargetAtTime(rain > 0.05 ? rain * 0.055 : 0, now, 1.0);

    /* Lake — proximity within 40 units */
    const ldx        = px - LAKE_X;
    const ldz        = pz - LAKE_Z;
    const lakeFactor = Math.max(0, 1 - Math.sqrt(ldx * ldx + ldz * ldz) / 40);
    n.lakeGain.gain.setTargetAtTime(lakeFactor * 0.030, now, 1.2);

    /* Arena hum — closest within 15 units */
    let minArena = 9999;
    for (const [ax, az] of arenaPositions) {
      const d = Math.sqrt((px - ax) ** 2 + (pz - az) ** 2);
      if (d < minArena) minArena = d;
    }
    const arenaFactor = minArena < 15 ? (15 - minArena) / 15 : 0;
    n.arenaGain.gain.setTargetAtTime(arenaFactor * 0.040, now, 0.6);

    /* Crickets — night only, 3 s fade */
    const isNight = t > 0.78 || t < 0.22;
    n.cricketGain.gain.setTargetAtTime(isNight ? 0.035 : 0, now, 3.0);

    /* Birds — daytime random bursts */
    birdTimerRef.current -= delta;
    if (birdTimerRef.current <= 0 && t > 0.26 && t < 0.74 && !muted) {
      playBirds(ctx, n.master);
      birdTimerRef.current = 8 + Math.random() * 17;
    }

    /* Thunder — during heavy rain */
    if (rain > 0.60) {
      thunderTimerRef.current -= delta;
      if (thunderTimerRef.current <= 0 && !muted) {
        playThunder(ctx, n.master);
        thunderTimerRef.current = 15 + Math.random() * 45;
      }
    } else if (thunderTimerRef.current < 15) {
      thunderTimerRef.current = 15 + Math.random() * 20;
    }

    /* Dawn / dusk jingles — once per cycle */
    const prevT = prevTRef.current;
    if (!dawnPlayedRef.current && prevT < 0.25 && t >= 0.25 && !muted) {
      playJingle(ctx, n.master, 'dawn');
      dawnPlayedRef.current = true;
    }
    if (!duskPlayedRef.current && prevT < 0.73 && t >= 0.73 && !muted) {
      playJingle(ctx, n.master, 'dusk');
      duskPlayedRef.current = true;
    }
    if (prevT > 0.90 && t < 0.10) {
      dawnPlayedRef.current = false;
      duskPlayedRef.current = false;
    }
    prevTRef.current = t;

    /* Footsteps — 1.5 m interval, idle > 200 ms suppresses trigger */
    const dx   = px - lastPosRef.current.x;
    const dz   = pz - lastPosRef.current.z;
    const dist = Math.abs(dx) + Math.abs(dz);

    if (dist > 0.005) {
      if (idleTimeRef.current <= 0.2) {
        footDistRef.current += dist;
        if (footDistRef.current >= 1.5 && !muted) {
          const onAsphalt = Math.abs(px) < 120 && Math.abs(pz) < 200;
          playFootstep(ctx, n.master, onAsphalt);
          footDistRef.current = 0;
        }
      } else {
        footDistRef.current = 0;
      }
      idleTimeRef.current = 0;
    } else {
      idleTimeRef.current += delta;
    }
    lastPosRef.current = { x: px, z: pz };
  });

  return null;
}
