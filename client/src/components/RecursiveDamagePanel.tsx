import React, { useState, useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { socket } from '../lib/socket';
import { Swords, Zap } from 'lucide-react';
import { useAudio } from '../lib/stores/useAudio';

interface DamageStep {
  target: 'attacker' | 'defender';
  damage: number;
  newPTI: number;
  eliminated: boolean;
}

interface RecursiveDamageEvent {
  type: 'SEMPAFAAGARA' | 'PARTITA_DI_TENNIS';
  attackerName: string;
  defenderName: string;
  attackerCard: {
    id: string;
    frontImage: string;
    name: string;
    initialPTI: number;
  };
  defenderCard: {
    id: string;
    frontImage: string;
    name: string;
    initialPTI: number;
  };
  steps: DamageStep[];
}

export const RecursiveDamagePanel: React.FC = () => {
  const [event, setEvent] = useState<RecursiveDamageEvent | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [attackerPTI, setAttackerPTI] = useState<number>(0);
  const [defenderPTI, setDefenderPTI] = useState<number>(0);
  const [attackerDamageValue, setAttackerDamageValue] = useState<number>(0);
  const [defenderDamageValue, setDefenderDamageValue] = useState<number>(0);
  const [eliminatedSide, setEliminatedSide] = useState<'attacker' | 'defender' | null>(null);

  const { playBattleMusic, playTennisHit, playSempafaagaraHit } = useAudio();
  const battleMusicRef = useRef<{ stop: () => void } | null>(null);

  const attackerCardRef = useRef<HTMLDivElement>(null);
  const defenderCardRef = useRef<HTMLDivElement>(null);
  const attackerDamageRef = useRef<HTMLDivElement>(null);
  const defenderDamageRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLSpanElement>(null);

  const cancelledRef = useRef(false);
  const masterTlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    return () => {
      battleMusicRef.current?.stop();
      masterTlRef.current?.kill();
    };
  }, []);

  const dismiss = useCallback(() => {
    cancelledRef.current = true;
    masterTlRef.current?.kill();
    masterTlRef.current = null;
    battleMusicRef.current?.stop();
    setEvent(null);
    setCurrentStep(-1);
    setEliminatedSide(null);
  }, []);

  const runStep = useCallback((ev: RecursiveDamageEvent, idx: number, masterTl: gsap.core.Timeline) => {
    if (cancelledRef.current) return;

    if (idx >= ev.steps.length) {
      masterTl.to({}, { duration: 0.8, onComplete: () => { if (!cancelledRef.current) dismiss(); } });
      return;
    }

    const step = ev.steps[idx];
    const isAttacker = step.target === 'attacker';
    const isTennis = ev.type === 'PARTITA_DI_TENNIS';

    const cardEl = isAttacker ? attackerCardRef.current : defenderCardRef.current;
    const damageEl = isAttacker ? attackerDamageRef.current : defenderDamageRef.current;

    // Pre-set the damage value so it renders when we show it
    if (isAttacker) setAttackerDamageValue(step.damage);
    else setDefenderDamageValue(step.damage);

    // Build a sub-timeline for this step and append it to the master
    const stepTl = gsap.timeline();

    // 1. Ball movement for tennis
    if (isTennis && ballRef.current) {
      stepTl.to(ballRef.current, {
        x: isAttacker ? -80 : 80,
        duration: 0.35,
        ease: 'power1.inOut',
      });
    }

    // 2. Audio callback at impact moment
    stepTl.add(() => {
      if (cancelledRef.current) return;
      isTennis ? playTennisHit() : playSempafaagaraHit();
    });

    // 3. Card shake (overlaps with ball movement end)
    if (cardEl) {
      const shakeAmp = step.damage <= 30 ? 4 : step.damage <= 80 ? 8 : 16;
      const shakeDur = step.damage <= 30 ? 0.35 : step.damage <= 80 ? 0.45 : 0.65;
      const sign = isAttacker ? -1 : 1;

      stepTl.to(cardEl, { x: sign * shakeAmp, rotation: sign * -2, duration: shakeDur * 0.25, ease: 'power1.out' }, '<')
        .to(cardEl, { x: -sign * shakeAmp * 0.75, rotation: sign * 1.5, duration: shakeDur * 0.25 })
        .to(cardEl, { x: sign * shakeAmp * 0.5, rotation: -sign * 1, duration: shakeDur * 0.25 })
        .to(cardEl, { x: 0, rotation: 0, duration: shakeDur * 0.25 });
    }

    // 4. Damage number enter
    if (damageEl) {
      gsap.set(damageEl, { display: 'flex', opacity: 0, scale: 0.45, y: -18 });
      stepTl.to(damageEl, { opacity: 1, scale: 1, y: 0, duration: 0.42, ease: 'back.out(1.5)' }, '<0.1');
    }

    // 5. Hold
    stepTl.to({}, { duration: 0.5 });

    // 6. Update PTI values via GSAP callback (no setTimeout)
    stepTl.add(() => {
      if (cancelledRef.current) return;
      if (step.target === 'attacker') setAttackerPTI(step.newPTI);
      else setDefenderPTI(step.newPTI);
      setCurrentStep(idx);
    });

    // 7. Damage number exit
    if (damageEl) {
      stepTl.to(damageEl, { opacity: 0, scale: 0.65, y: 10, duration: 0.28, ease: 'power1.in' });
      stepTl.add(() => {
        if (damageEl) gsap.set(damageEl, { display: 'none' });
      });
    }

    // 8. Brief pause before next step
    stepTl.to({}, { duration: 0.12 });

    // 9. Handle elimination or advance
    if (step.eliminated) {
      stepTl.add(() => {
        if (cancelledRef.current) return;
        setEliminatedSide(step.target);
      });
      stepTl.to({}, {
        duration: 1.2,
        onComplete: () => { if (!cancelledRef.current) dismiss(); },
      });
    } else {
      stepTl.add(() => {
        if (!cancelledRef.current) runStep(ev, idx + 1, masterTl);
      });
    }

    masterTl.add(stepTl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playTennisHit, playSempafaagaraHit, dismiss]);

  useEffect(() => {
    const handleRecursiveDamage = (data: RecursiveDamageEvent) => {
      console.log('🎮 RECURSIVE DAMAGE EVENT:', data);

      // Cancel and kill everything from any previous event
      cancelledRef.current = true;
      masterTlRef.current?.kill();
      masterTlRef.current = null;
      battleMusicRef.current?.stop();

      // Reset DOM refs immediately
      if (attackerDamageRef.current) gsap.set(attackerDamageRef.current, { display: 'none', opacity: 0 });
      if (defenderDamageRef.current) gsap.set(defenderDamageRef.current, { display: 'none', opacity: 0 });
      if (attackerCardRef.current) gsap.set(attackerCardRef.current, { x: 0, rotation: 0 });
      if (defenderCardRef.current) gsap.set(defenderCardRef.current, { x: 0, rotation: 0 });
      if (ballRef.current) gsap.set(ballRef.current, { x: 0 });

      // Reset state
      setEvent(data);
      setCurrentStep(-1);
      setAttackerPTI(data.attackerCard.initialPTI);
      setDefenderPTI(data.defenderCard.initialPTI);
      setEliminatedSide(null);
      battleMusicRef.current = playBattleMusic();

      cancelledRef.current = false;

      // Create master timeline with initial delay via GSAP (no setTimeout)
      const masterTl = gsap.timeline();
      masterTlRef.current = masterTl;

      // 200ms initial delay before first step, fully GSAP-controlled
      masterTl.to({}, {
        duration: 0.2,
        onComplete: () => { if (!cancelledRef.current) runStep(data, 0, masterTl); },
      });
    };

    socket.on('recursive-damage-animation', handleRecursiveDamage);
    return () => { socket.off('recursive-damage-animation', handleRecursiveDamage); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runStep]);

  if (!event) return null;

  const isTennis = event.type === 'PARTITA_DI_TENNIS';
  const isAttackerEliminated = eliminatedSide === 'attacker';
  const isDefenderEliminated = eliminatedSide === 'defender';

  const panelStyles = isTennis
    ? 'bg-gradient-to-br from-green-800 via-green-600 to-green-800 border-white'
    : 'bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 border-purple-500';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      style={{ animation: 'rdp-overlay-in 0.3s ease-out' }}
    >
      <div
        className={`rounded-2xl p-8 max-w-4xl w-full mx-4 border-4 shadow-2xl relative overflow-hidden ${panelStyles}`}
        style={{ animation: 'rdp-panel-in 0.42s cubic-bezier(0.34,1.56,0.64,1)' }}
      >
        {isTennis && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-white/40 transform -translate-y-1/2" />
            <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-white/40 transform -translate-x-1/2" />
            <div className="absolute top-4 bottom-4 left-4 right-4 border-2 border-white/30 rounded-lg" />
          </div>
        )}

        <div className="flex items-center justify-center gap-4 mb-8 relative z-10">
          {isTennis ? (
            <span className="text-4xl">🎾</span>
          ) : (
            <Zap className="w-8 h-8 text-yellow-400" />
          )}
          <h2 className="text-3xl font-bold text-white text-center drop-shadow-lg">
            {isTennis ? 'PARTITA DI TENNIS' : 'SEMPAFAAGARA'}
          </h2>
          {isTennis ? (
            <span className="text-4xl">🎾</span>
          ) : (
            <Zap className="w-8 h-8 text-yellow-400" />
          )}
        </div>

        <div className="flex items-center justify-between gap-8 relative z-10">
          {/* Attacker column */}
          <div className={`flex-1 text-center ${isAttackerEliminated ? 'opacity-50' : ''}`}>
            <div className="text-lg font-semibold text-white mb-2 drop-shadow-lg">
              {event.attackerName}
            </div>
            {isTennis && (
              <div className="text-4xl mb-2">🏸</div>
            )}
            <div ref={attackerCardRef} className="relative inline-block">
              <img
                src={event.attackerCard.frontImage}
                alt={event.attackerCard.name}
                className={`w-48 h-auto rounded-lg shadow-xl border-4 ${isAttackerEliminated ? 'border-red-600 grayscale' : isTennis ? 'border-white' : 'border-blue-500'}`}
              />
              <div
                ref={attackerDamageRef}
                style={{ display: 'none', position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}
              >
                <span className="text-6xl font-bold text-red-500 drop-shadow-lg">
                  -{attackerDamageValue}
                </span>
              </div>
              {isAttackerEliminated && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ animation: 'rdp-skull-in 0.4s ease-out' }}
                >
                  <span className="text-6xl">💀</span>
                </div>
              )}
            </div>
            <div className="mt-4">
              <div className="text-sm text-white/80 mb-1 drop-shadow">{event.attackerCard.name}</div>
              <div
                key={attackerPTI}
                className="text-4xl font-bold drop-shadow-lg rdp-pti-pop"
                style={{ color: attackerPTI > 0 ? '#22c55e' : '#ef4444' }}
              >
                PTI: {attackerPTI}
              </div>
            </div>
          </div>

          {/* Center column */}
          <div className="flex flex-col items-center gap-4 relative">
            {isTennis ? (
              <div className="relative w-20 h-32 flex items-center justify-center overflow-visible">
                <span ref={ballRef} className="text-5xl" style={{ display: 'inline-block' }}>
                  🎾
                </span>
              </div>
            ) : (
              <Swords className="w-16 h-16 text-yellow-400" />
            )}
            <div className="text-white text-xl font-bold drop-shadow-lg">VS</div>
            {currentStep >= 0 && (
              <div
                className="text-sm text-white/80 text-center drop-shadow"
                style={{ animation: 'rdp-fade-in 0.3s ease-out' }}
              >
                Colpo {currentStep + 1} / {event.steps.length}
              </div>
            )}
          </div>

          {/* Defender column */}
          <div className={`flex-1 text-center ${isDefenderEliminated ? 'opacity-50' : ''}`}>
            <div className="text-lg font-semibold text-white mb-2 drop-shadow-lg">
              {event.defenderName}
            </div>
            {isTennis && (
              <div className="text-4xl mb-2">🏸</div>
            )}
            <div ref={defenderCardRef} className="relative inline-block">
              <img
                src={event.defenderCard.frontImage}
                alt={event.defenderCard.name}
                className={`w-48 h-auto rounded-lg shadow-xl border-4 ${isDefenderEliminated ? 'border-red-600 grayscale' : isTennis ? 'border-white' : 'border-red-500'}`}
              />
              <div
                ref={defenderDamageRef}
                style={{ display: 'none', position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}
              >
                <span className="text-6xl font-bold text-red-500 drop-shadow-lg">
                  -{defenderDamageValue}
                </span>
              </div>
              {isDefenderEliminated && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ animation: 'rdp-skull-in 0.4s ease-out' }}
                >
                  <span className="text-6xl">💀</span>
                </div>
              )}
            </div>
            <div className="mt-4">
              <div className="text-sm text-white/80 mb-1 drop-shadow">{event.defenderCard.name}</div>
              <div
                key={defenderPTI}
                className="text-4xl font-bold drop-shadow-lg rdp-pti-pop"
                style={{ color: defenderPTI > 0 ? '#22c55e' : '#ef4444' }}
              >
                PTI: {defenderPTI}
              </div>
            </div>
          </div>
        </div>

        {eliminatedSide && (
          <div
            className="mt-8 text-center relative z-10"
            style={{ animation: 'rdp-slide-up 0.4s ease-out' }}
          >
            <div className="text-2xl font-bold text-red-400 drop-shadow-lg">
              {eliminatedSide === 'attacker' ? event.attackerCard.name : event.defenderCard.name} eliminato!
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
