import React, { useState, useEffect, useRef } from 'react';
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

interface ShowDamage {
  target: 'attacker' | 'defender';
  value: number;
  stepObj: DamageStep;
}

export const RecursiveDamagePanel: React.FC = () => {
  const [event, setEvent] = useState<RecursiveDamageEvent | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [attackerPTI, setAttackerPTI] = useState<number>(0);
  const [defenderPTI, setDefenderPTI] = useState<number>(0);
  const [showDamage, setShowDamage] = useState<ShowDamage | null>(null);
  const [ballPosition, setBallPosition] = useState<'center' | 'attacker' | 'defender'>('center');
  const { playBattleMusic, playTennisHit, playSempafaagaraHit } = useAudio();
  const battleMusicRef = useRef<{ stop: () => void } | null>(null);

  const stepIndexRef = useRef(0);
  const cancelledRef = useRef(false);
  const activeStepRef = useRef<ShowDamage | null>(null);
  const exitProcessedRef = useRef(-1);

  // Damage animation phase tracking
  const [damagePhase, setDamagePhase] = useState<'entering' | 'exiting' | 'none'>('none');

  useEffect(() => {
    return () => { battleMusicRef.current?.stop(); };
  }, []);

  useEffect(() => {
    const handleRecursiveDamage = (data: RecursiveDamageEvent) => {
      console.log('🎮 RECURSIVE DAMAGE EVENT:', data);
      cancelledRef.current = true;
      setEvent(data);
      setCurrentStep(-1);
      setAttackerPTI(data.attackerCard.initialPTI);
      setDefenderPTI(data.defenderCard.initialPTI);
      setShowDamage(null);
      setDamagePhase('none');
      setBallPosition('center');
      battleMusicRef.current = playBattleMusic();
    };
    socket.on('recursive-damage-animation', handleRecursiveDamage);
    return () => { socket.off('recursive-damage-animation', handleRecursiveDamage); };
  }, []);

  useEffect(() => {
    if (!event) return;
    stepIndexRef.current = 0;
    cancelledRef.current = false;
    exitProcessedRef.current = -1;
    const timer = setTimeout(() => advanceStep(event), 200);
    return () => { cancelledRef.current = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  // When showDamage is set, start entering animation
  useEffect(() => {
    if (showDamage) {
      setDamagePhase('entering');
    }
  }, [showDamage]);

  const advanceStep = (ev: RecursiveDamageEvent) => {
    if (cancelledRef.current) return;
    const idx = stepIndexRef.current;
    if (idx >= ev.steps.length) {
      setTimeout(() => {
        if (!cancelledRef.current) { battleMusicRef.current?.stop(); setEvent(null); setCurrentStep(-1); }
      }, 800);
      return;
    }
    const step = ev.steps[idx];
    if (ev.type === 'PARTITA_DI_TENNIS') setBallPosition(step.target);
    const sd: ShowDamage = { target: step.target, value: step.damage, stepObj: step };
    activeStepRef.current = sd;
    setShowDamage(sd);
    if (ev.type === 'PARTITA_DI_TENNIS') playTennisHit(); else playSempafaagaraHit();
  };

  const handleDamageAnimEnd = () => {
    if (damagePhase === 'entering') {
      // Enter animation done - update PTI and trigger exit
      if (cancelledRef.current || !activeStepRef.current) return;
      const step = activeStepRef.current.stepObj;
      if (step.target === 'attacker') setAttackerPTI(step.newPTI);
      else setDefenderPTI(step.newPTI);
      setCurrentStep(stepIndexRef.current);
      setDamagePhase('exiting');
    } else if (damagePhase === 'exiting') {
      // Exit animation done - advance to next step
      if (cancelledRef.current || !event) return;
      if (exitProcessedRef.current === stepIndexRef.current) return;
      exitProcessedRef.current = stepIndexRef.current;
      setShowDamage(null);
      setDamagePhase('none');
      const step = event.steps[stepIndexRef.current];
      if (step?.eliminated) {
        setTimeout(() => {
          if (!cancelledRef.current) { battleMusicRef.current?.stop(); setEvent(null); setCurrentStep(-1); }
        }, 800);
      } else {
        stepIndexRef.current++;
        advanceStep(event);
      }
    }
  };

  if (!event) return null;

  const isTennis = event.type === 'PARTITA_DI_TENNIS';
  const lastStep = currentStep >= 0 ? event.steps[currentStep] : null;
  const isAttackerEliminated = lastStep?.eliminated && lastStep?.target === 'attacker';
  const isDefenderEliminated = lastStep?.eliminated && lastStep?.target === 'defender';

  const panelStyles = isTennis
    ? "bg-gradient-to-br from-green-800 via-green-600 to-green-800 border-white"
    : "bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 border-purple-500";

  const damageAnimClass = damagePhase === 'entering'
    ? 'rdp-damage-enter'
    : damagePhase === 'exiting'
      ? 'rdp-damage-exit'
      : '';

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
          <>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-white/40 transform -translate-y-1/2" />
              <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-white/40 transform -translate-x-1/2" />
              <div className="absolute top-4 bottom-4 left-4 right-4 border-2 border-white/30 rounded-lg" />
            </div>
          </>
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
          <div
            className={`flex-1 text-center ${isAttackerEliminated ? 'opacity-50' : ''} ${showDamage?.target === 'attacker' ? 'rdp-card-shake-left' : ''}`}
          >
            <div className="text-lg font-semibold text-white mb-2 drop-shadow-lg">
              {event.attackerName}
            </div>
            {isTennis && (
              <div className="text-4xl mb-2">🏸</div>
            )}
            <div className="relative inline-block">
              <img
                src={event.attackerCard.frontImage}
                alt={event.attackerCard.name}
                className={`w-48 h-auto rounded-lg shadow-xl border-4 ${isAttackerEliminated ? 'border-red-600 grayscale' : isTennis ? 'border-white' : 'border-blue-500'}`}
              />
              {showDamage?.target === 'attacker' && (
                <div
                  key={`atk-${stepIndexRef.current}`}
                  className={`absolute inset-0 flex items-center justify-center ${damageAnimClass}`}
                  onAnimationEnd={handleDamageAnimEnd}
                >
                  <span className="text-6xl font-bold text-red-500 drop-shadow-lg">
                    -{showDamage.value}
                  </span>
                </div>
              )}
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
              <div className="relative w-20 h-32 flex items-center justify-center">
                <span
                  key={ballPosition}
                  className="text-5xl rdp-ball-bounce"
                >
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
          <div
            className={`flex-1 text-center ${isDefenderEliminated ? 'opacity-50' : ''} ${showDamage?.target === 'defender' ? 'rdp-card-shake-right' : ''}`}
          >
            <div className="text-lg font-semibold text-white mb-2 drop-shadow-lg">
              {event.defenderName}
            </div>
            {isTennis && (
              <div className="text-4xl mb-2">🏸</div>
            )}
            <div className="relative inline-block">
              <img
                src={event.defenderCard.frontImage}
                alt={event.defenderCard.name}
                className={`w-48 h-auto rounded-lg shadow-xl border-4 ${isDefenderEliminated ? 'border-red-600 grayscale' : isTennis ? 'border-white' : 'border-red-500'}`}
              />
              {showDamage?.target === 'defender' && (
                <div
                  key={`def-${stepIndexRef.current}`}
                  className={`absolute inset-0 flex items-center justify-center ${damageAnimClass}`}
                  onAnimationEnd={handleDamageAnimEnd}
                >
                  <span className="text-6xl font-bold text-red-500 drop-shadow-lg">
                    -{showDamage.value}
                  </span>
                </div>
              )}
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

        {lastStep?.eliminated && (
          <div
            className="mt-8 text-center relative z-10"
            style={{ animation: 'rdp-slide-up 0.4s ease-out' }}
          >
            <div className="text-2xl font-bold text-red-400 drop-shadow-lg">
              {lastStep.target === 'attacker' ? event.attackerCard.name : event.defenderCard.name} eliminato!
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
