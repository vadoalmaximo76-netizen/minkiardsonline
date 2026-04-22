/**
 * WorldAudio3D — Ambient + interactive audio layer for the 3D Story Mode map.
 *
 * Architecture:
 *   All sounds are synthesised via Web Audio API (AudioContext).
 *   Zero external audio files, zero new dependencies.
 *   Master gain caps all story-mode audio at 0.60 so it never
 *   competes with game battle music.
 *
 * Volume budget per channel (relative to master = 0.60):
 *   Wind       0.025 – 0.055  (grows with rain intensity)
 *   Rain       0.000 – 0.055  (tracks weatherIntensityRef)
 *   Lake       0.000 – 0.030  (proximity to lake zone)
 *   Arena hum  0.000 – 0.040  (proximity to nearest arena)
 *   Crickets   0.035           (night only, 3 s fade in/out)
 *   Birds      0.040           (one-shot, daytime only)
 *   Thunder    0.130           (one-shot, during heavy rain)
 *   Dawn jingle 0.070          (one-shot at sunrise)
 *   Dusk chord  0.060          (one-shot at sunset)
 *   Footstep   0.038 – 0.052   (per step, 1.5 m interval)
 */

import React, { useRef, useEffect } from 'react';
import { useFrame }                 from '@react-three/fiber';
import { useAudio }                 from '../../lib/stores/useAudio';

/* Lake centre in world space (matches WaterPlane3D position) */
const LAKE_X = -80;
const LAKE_Z = 60;

/* ── White-noise buffer (1 s, mono) ────────────────────────────── */
function makeNoiseBuffer(ctx: AudioContext, seconds = 1.5): AudioBuffer {
  const len = Math.ceil(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch  = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  return buf;
}

function makeLoopingNoise(ctx: AudioContext): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx);
  src.loop   = true;
  return src;
}

/* ── Bird chirp sequence ────────────────────────────────────────── */
function playBirds(ctx: AudioContext, dest: AudioNode) {
  const count = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const delay = i * (0.08 + Math.random() * 0.06);
    setTimeout(() => {
      try {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const f0 = 820 + Math.random() * 480;
        osc.frequency.setValueAtTime(f0, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(f0 + 80 + Math.random() * 120, ctx.currentTime + 0.06);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.040, ctx.currentTime + 0.010);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.110);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.13);
      } catch {}
    }, delay * 1000);
  }
}

/* ── Thunder boom ────────────────────────────────────────────────── */
function playThunder(ctx: AudioContext, dest: AudioNode) {
  try {
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
    gain.gain.linearRampToValueAtTime(0.130, now + 0.04);
    gain.gain.setValueAtTime(0.130, now + 0.28);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.90);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(now);
    src.stop(now + 2.2);
  } catch {}
}

/* ── Dawn / Dusk jingle ─────────────────────────────────────────── */
function playJingle(ctx: AudioContext, dest: AudioNode, kind: 'dawn' | 'dusk') {
  const DAWN = [261.63, 329.63, 392.00, 523.25]; // C4 E4 G4 C5
  const DUSK = [392.00, 329.63, 261.63];          // G4 E4 C4
  const notes = kind === 'dawn' ? DAWN : DUSK;
  const vol   = kind === 'dawn' ? 0.070 : 0.060;

  notes.forEach((freq, i) => {
    setTimeout(() => {
      try {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(vol, now + 0.020);
        gain.gain.setValueAtTime(vol, now + 0.100);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.380);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.42);
      } catch {}
    }, i * 95);
  });
}

/* ── Footstep ────────────────────────────────────────────────────── */
function playFootstep(
  ctx: AudioContext,
  dest: AudioNode,
  onAsphalt: boolean,
) {
  try {
    const osc   = ctx.createOscillator();
    const gain  = ctx.createGain();
    osc.type    = onAsphalt ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(onAsphalt ? 130 : 85, ctx.currentTime);
    const vol   = onAsphalt ? 0.052 : 0.038;
    const decay = onAsphalt ? 0.070 : 0.055;
    const now   = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + decay);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + decay + 0.01);
  } catch {}
}

/* ── Internal node bag ───────────────────────────────────────────── */
interface AudioNodes {
  ctx:           AudioContext;
  master:        GainNode;
  /* looped sources */
  windSrc:       AudioBufferSourceNode;
  rainSrc:       AudioBufferSourceNode;
  lakeSrc:       AudioBufferSourceNode;
  windGain:      GainNode;
  rainGain:      GainNode;
  lakeGain:      GainNode;
  /* arena hum oscillators */
  arenaOsc1:     OscillatorNode;
  arenaOsc2:     OscillatorNode;
  arenaGain:     GainNode;
  /* crickets */
  cricketOsc:    OscillatorNode;
  cricketLfo:    OscillatorNode;
  cricketGain:   GainNode;
}

/* ── Main component ──────────────────────────────────────────────── */
export function WorldAudio3D({
  dayTimeRef,
  playerRef,
  arenaPositions,
  weatherIntensityRef,
}: {
  dayTimeRef:           React.MutableRefObject<number>;
  playerRef:            React.MutableRefObject<{ x: number; z: number }>;
  arenaPositions:       [number, number][];
  weatherIntensityRef:  React.MutableRefObject<number>;
}) {
  const isMuted          = useAudio(s => s.isMuted);
  const audioCtxFromStore = useAudio(s => s.audioContext);
  const initAudioContext = useAudio(s => s.initAudioContext);

  const nodesRef         = useRef<AudioNodes | null>(null);
  const isMutedRef       = useRef(isMuted);

  /* Periodic timers */
  const birdTimerRef    = useRef(6 + Math.random() * 8);
  const thunderTimerRef = useRef(20 + Math.random() * 35);

  /* Footstep state */
  const footDistRef     = useRef(0);
  const leftFootRef     = useRef(true);
  const lastPosRef      = useRef({ x: 0, z: 0 });

  /* Dawn/dusk jingle flags */
  const dawnPlayedRef   = useRef(false);
  const duskPlayedRef   = useRef(false);
  const prevTRef        = useRef(dayTimeRef.current);

  /* Keep isMutedRef in sync */
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  /* Ensure AudioContext exists */
  useEffect(() => { initAudioContext(); }, [initAudioContext]);

  /* Build all audio nodes once we have a context */
  useEffect(() => {
    const ctx = audioCtxFromStore;
    if (!ctx || nodesRef.current) return;

    try {
      const master = ctx.createGain();
      master.gain.setValueAtTime(isMuted ? 0 : 0.60, ctx.currentTime);
      master.connect(ctx.destination);

      /* Wind — bandpass noise */
      const windSrc    = makeLoopingNoise(ctx);
      const windFilter = ctx.createBiquadFilter();
      windFilter.type  = 'bandpass';
      windFilter.frequency.setValueAtTime(320, ctx.currentTime);
      windFilter.Q.setValueAtTime(0.7, ctx.currentTime);
      const windGain   = ctx.createGain();
      windGain.gain.setValueAtTime(0.025, ctx.currentTime);
      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      windSrc.start();

      /* Rain — lowpass noise */
      const rainSrc    = makeLoopingNoise(ctx);
      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type  = 'lowpass';
      rainFilter.frequency.setValueAtTime(1200, ctx.currentTime);
      const rainGain   = ctx.createGain();
      rainGain.gain.setValueAtTime(0, ctx.currentTime);
      rainSrc.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(master);
      rainSrc.start();

      /* Lake — very low-pass noise */
      const lakeSrc    = makeLoopingNoise(ctx);
      const lakeFilter = ctx.createBiquadFilter();
      lakeFilter.type  = 'lowpass';
      lakeFilter.frequency.setValueAtTime(420, ctx.currentTime);
      const lakeGain   = ctx.createGain();
      lakeGain.gain.setValueAtTime(0, ctx.currentTime);
      lakeSrc.connect(lakeFilter);
      lakeFilter.connect(lakeGain);
      lakeGain.connect(master);
      lakeSrc.start();

      /* Arena hum — 55 Hz + 110 Hz sine */
      const arenaOsc1  = ctx.createOscillator();
      arenaOsc1.type   = 'sine';
      arenaOsc1.frequency.setValueAtTime(55, ctx.currentTime);
      const arenaOsc2  = ctx.createOscillator();
      arenaOsc2.type   = 'sine';
      arenaOsc2.frequency.setValueAtTime(110, ctx.currentTime);
      const arenaGain  = ctx.createGain();
      arenaGain.gain.setValueAtTime(0, ctx.currentTime);
      arenaOsc1.connect(arenaGain);
      arenaOsc2.connect(arenaGain);
      arenaGain.connect(master);
      arenaOsc1.start();
      arenaOsc2.start();

      /* Crickets — triangle wave FM */
      const cricketOsc      = ctx.createOscillator();
      cricketOsc.type       = 'triangle';
      cricketOsc.frequency.setValueAtTime(3800, ctx.currentTime);
      const cricketLfo      = ctx.createOscillator();
      cricketLfo.type       = 'sine';
      cricketLfo.frequency.setValueAtTime(18, ctx.currentTime);
      const cricketLfoGain  = ctx.createGain();
      cricketLfoGain.gain.setValueAtTime(90, ctx.currentTime);
      cricketLfo.connect(cricketLfoGain);
      cricketLfoGain.connect(cricketOsc.frequency);
      const cricketGain     = ctx.createGain();
      cricketGain.gain.setValueAtTime(0, ctx.currentTime);
      cricketOsc.connect(cricketGain);
      cricketGain.connect(master);
      cricketOsc.start();
      cricketLfo.start();

      nodesRef.current = {
        ctx, master,
        windSrc, rainSrc, lakeSrc,
        windGain, rainGain, lakeGain,
        arenaOsc1, arenaOsc2, arenaGain,
        cricketOsc, cricketLfo, cricketGain,
      };

      /* Initialise lastPos from player */
      lastPosRef.current = { x: playerRef.current.x, z: playerRef.current.z };

    } catch (err) {
      console.warn('[WorldAudio3D] setup error', err);
    }

    return () => {
      const n = nodesRef.current;
      if (!n) return;
      const stopSafe = (node: { stop: () => void }) => { try { node.stop(); } catch {} };
      stopSafe(n.windSrc);
      stopSafe(n.rainSrc);
      stopSafe(n.lakeSrc);
      stopSafe(n.arenaOsc1);
      stopSafe(n.arenaOsc2);
      stopSafe(n.cricketOsc);
      stopSafe(n.cricketLfo);
      try { n.master.disconnect(); } catch {}
      nodesRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioCtxFromStore]);

  /* Sync master gain when mute toggles */
  useEffect(() => {
    const n = nodesRef.current;
    if (!n) return;
    n.master.gain.setTargetAtTime(isMuted ? 0 : 0.60, n.ctx.currentTime, 0.12);
  }, [isMuted]);

  /* ── Per-frame updates ─────────────────────────────────────────── */
  useFrame((_, delta) => {
    const n = nodesRef.current;
    if (!n) return;

    const ctx   = n.ctx;
    const now   = ctx.currentTime;
    const t     = dayTimeRef.current;
    const rain  = weatherIntensityRef.current;
    const muted = isMutedRef.current;

    const px = playerRef.current.x;
    const pz = playerRef.current.z;

    /* Wind: base + rain boost */
    n.windGain.gain.setTargetAtTime(0.025 + rain * 0.030, now, 0.6);

    /* Rain volume follows weather intensity */
    n.rainGain.gain.setTargetAtTime(rain > 0.05 ? rain * 0.055 : 0, now, 1.0);

    /* Lake proximity (within 40 units) */
    const ldx = px - LAKE_X;
    const ldz = pz - LAKE_Z;
    const lakeFactor = Math.max(0, 1 - Math.sqrt(ldx * ldx + ldz * ldz) / 40);
    n.lakeGain.gain.setTargetAtTime(lakeFactor * 0.030, now, 1.2);

    /* Arena hum — closest arena within 15 units */
    let minArena = 9999;
    for (const [ax, az] of arenaPositions) {
      const adx = px - ax;
      const adz = pz - az;
      const d   = Math.sqrt(adx * adx + adz * adz);
      if (d < minArena) minArena = d;
    }
    const arenaFactor = minArena < 15 ? Math.max(0, (15 - minArena) / 15) : 0;
    n.arenaGain.gain.setTargetAtTime(arenaFactor * 0.040, now, 0.6);

    /* Crickets — fade in at night (t > 0.78 or t < 0.22) */
    const isNight = t > 0.78 || t < 0.22;
    n.cricketGain.gain.setTargetAtTime(isNight ? 0.035 : 0, now, 3.0);

    /* Birds — random one-shot bursts during daytime */
    const isDay = t > 0.26 && t < 0.74;
    birdTimerRef.current -= delta;
    if (birdTimerRef.current <= 0 && isDay && !muted) {
      playBirds(ctx, n.master);
      birdTimerRef.current = 8 + Math.random() * 17;
    }

    /* Thunder — during heavy rain (intensity > 0.6) */
    if (rain > 0.60) {
      thunderTimerRef.current -= delta;
      if (thunderTimerRef.current <= 0 && !muted) {
        playThunder(ctx, n.master);
        thunderTimerRef.current = 15 + Math.random() * 45;
      }
    } else if (thunderTimerRef.current < 15) {
      /* Reset timer so thunder fires with slight delay after rain resumes */
      thunderTimerRef.current = 15 + Math.random() * 20;
    }

    /* Dawn / Dusk jingles — once per day cycle */
    const prevT = prevTRef.current;
    if (!dawnPlayedRef.current && prevT < 0.25 && t >= 0.25 && !muted) {
      playJingle(ctx, n.master, 'dawn');
      dawnPlayedRef.current = true;
    }
    if (!duskPlayedRef.current && prevT < 0.73 && t >= 0.73 && !muted) {
      playJingle(ctx, n.master, 'dusk');
      duskPlayedRef.current = true;
    }
    /* Reset flags when cycle wraps around midnight */
    if (prevT > 0.90 && t < 0.10) {
      dawnPlayedRef.current = false;
      duskPlayedRef.current = false;
    }
    prevTRef.current = t;

    /* Footsteps — trigger every 1.5 world-units moved */
    const dx   = px - lastPosRef.current.x;
    const dz   = pz - lastPosRef.current.z;
    const dist = Math.abs(dx) + Math.abs(dz);   // cheaper than sqrt

    if (dist > 0.005) {
      footDistRef.current += dist;
      if (footDistRef.current >= 1.5 && !muted) {
        /* Simple heuristic: if player is inside the road grid, use asphalt */
        const onAsphalt = Math.abs(px) < 130 && pz > -200 && pz < 200;
        playFootstep(ctx, n.master, onAsphalt);
        leftFootRef.current = !leftFootRef.current;
        footDistRef.current = 0;
      }
    }
    lastPosRef.current = { x: px, z: pz };
  });

  return null;
}
