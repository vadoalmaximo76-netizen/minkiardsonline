import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';
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

// Damage display framer-motion variants
const damageVariants = {
  hidden: { opacity: 0, scale: 2, y: -20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.1 } },
  exit: { opacity: 0, scale: 0.5, transition: { duration: 0.08 } },
};

export const RecursiveDamagePanel: React.FC = () => {
  const [event, setEvent] = useState<RecursiveDamageEvent | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [attackerPTI, setAttackerPTI] = useState<number>(0);
  const [defenderPTI, setDefenderPTI] = useState<number>(0);
  const [showDamage, setShowDamage] = useState<ShowDamage | null>(null);
  const [ballPosition, setBallPosition] = useState<'center' | 'attacker' | 'defender'>('center');
  const { playBattleMusic, playTennisHit, playSempafaagaraHit } = useAudio();
  const battleMusicRef = useRef<{ stop: () => void } | null>(null);

  // Refs for declarative step orchestration
  const stepIndexRef = useRef(0);
  const cancelledRef = useRef(false);
  const activeStepRef = useRef<ShowDamage | null>(null);
  const exitProcessedRef = useRef(-1); // guard: only process exit once per step index

  useEffect(() => {
    return () => { battleMusicRef.current?.stop(); };
  }, []);

  useEffect(() => {
    const handleRecursiveDamage = (data: RecursiveDamageEvent) => {
      console.log('🎮 RECURSIVE DAMAGE EVENT:', data);
      cancelledRef.current = true; // cancel any previous sequence
      setEvent(data);
      setCurrentStep(-1);
      setAttackerPTI(data.attackerCard.initialPTI);
      setDefenderPTI(data.defenderCard.initialPTI);
      setShowDamage(null);
      setBallPosition('center');
      battleMusicRef.current = playBattleMusic();
    };
    socket.on('recursive-damage-animation', handleRecursiveDamage);
    return () => { socket.off('recursive-damage-animation', handleRecursiveDamage); };
  }, []);

  // Start step sequence when event is set (replaces old setTimeout cascade)
  useEffect(() => {
    if (!event) return;
    stepIndexRef.current = 0;
    cancelledRef.current = false;
    exitProcessedRef.current = -1;
    const timer = setTimeout(() => advanceStep(event), 200);
    return () => { cancelledRef.current = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  // Present the current step's damage display
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

  // Called by motion.div onAnimationComplete (enter phase) — update PTI, then hide
  const onDamageEnterComplete = () => {
    if (cancelledRef.current || !activeStepRef.current) return;
    const step = activeStepRef.current.stepObj;
    if (step.target === 'attacker') setAttackerPTI(step.newPTI);
    else setDefenderPTI(step.newPTI);
    setCurrentStep(stepIndexRef.current);
    // Hide the damage display after a brief pause — triggers exit animation
    setTimeout(() => { if (!cancelledRef.current) setShowDamage(null); }, 80);
  };

  // Called by AnimatePresence onExitComplete — advance to next step or close
  const onDamageExitComplete = () => {
    if (cancelledRef.current || !event) return;
    // Guard: only process once per step
    if (exitProcessedRef.current === stepIndexRef.current) return;
    exitProcessedRef.current = stepIndexRef.current;
    const step = event.steps[stepIndexRef.current];
    if (step?.eliminated) {
      setTimeout(() => {
        if (!cancelledRef.current) { battleMusicRef.current?.stop(); setEvent(null); setCurrentStep(-1); }
      }, 800);
    } else {
      stepIndexRef.current++;
      setTimeout(() => advanceStep(event), 100);
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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className={`rounded-2xl p-8 max-w-4xl w-full mx-4 border-4 shadow-2xl relative overflow-hidden ${panelStyles}`}
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
            <motion.div
              className={`flex-1 text-center ${isAttackerEliminated ? 'opacity-50' : ''}`}
              animate={showDamage?.target === 'attacker' ? { scale: [1, 0.95, 1], x: [0, -10, 10, 0] } : {}}
              transition={{ duration: 0.3 }}
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
                <AnimatePresence onExitComplete={onDamageExitComplete}>
                  {showDamage?.target === 'attacker' && (
                    <motion.div
                      key={`atk-${stepIndexRef.current}`}
                      variants={damageVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      onAnimationComplete={(def) => { if (def === 'visible') onDamageEnterComplete(); }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <span className="text-6xl font-bold text-red-500 drop-shadow-lg">
                        -{showDamage.value}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
                {isAttackerEliminated && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <span className="text-6xl">💀</span>
                  </motion.div>
                )}
              </div>
              <div className="mt-4">
                <div className="text-sm text-white/80 mb-1 drop-shadow">{event.attackerCard.name}</div>
                <motion.div
                  key={attackerPTI}
                  initial={{ scale: 1.5, color: '#ef4444' }}
                  animate={{ scale: 1, color: attackerPTI > 0 ? '#22c55e' : '#ef4444' }}
                  className="text-4xl font-bold drop-shadow-lg"
                >
                  PTI: {attackerPTI}
                </motion.div>
              </div>
            </motion.div>

            <div className="flex flex-col items-center gap-4 relative">
              {isTennis ? (
                <div className="relative w-20 h-32 flex items-center justify-center">
                  <AnimatePresence>
                    <motion.div
                      key={ballPosition}
                      initial={{ 
                        x: ballPosition === 'attacker' ? 100 : ballPosition === 'defender' ? -100 : 0,
                        y: -50,
                        scale: 0.5
                      }}
                      animate={{ 
                        x: 0, 
                        y: 0,
                        scale: 1
                      }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 300, 
                        damping: 20 
                      }}
                      className="text-5xl"
                    >
                      🎾
                    </motion.div>
                  </AnimatePresence>
                </div>
              ) : (
                <Swords className="w-16 h-16 text-yellow-400" />
              )}
              <div className="text-white text-xl font-bold drop-shadow-lg">VS</div>
              {currentStep >= 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-white/80 text-center drop-shadow"
                >
                  Colpo {currentStep + 1} / {event.steps.length}
                </motion.div>
              )}
            </div>

            <motion.div
              className={`flex-1 text-center ${isDefenderEliminated ? 'opacity-50' : ''}`}
              animate={showDamage?.target === 'defender' ? { scale: [1, 0.95, 1], x: [0, 10, -10, 0] } : {}}
              transition={{ duration: 0.3 }}
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
                <AnimatePresence onExitComplete={onDamageExitComplete}>
                  {showDamage?.target === 'defender' && (
                    <motion.div
                      key={`def-${stepIndexRef.current}`}
                      variants={damageVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      onAnimationComplete={(def) => { if (def === 'visible') onDamageEnterComplete(); }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <span className="text-6xl font-bold text-red-500 drop-shadow-lg">
                        -{showDamage.value}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
                {isDefenderEliminated && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <span className="text-6xl">💀</span>
                  </motion.div>
                )}
              </div>
              <div className="mt-4">
                <div className="text-sm text-white/80 mb-1 drop-shadow">{event.defenderCard.name}</div>
                <motion.div
                  key={defenderPTI}
                  initial={{ scale: 1.5, color: '#ef4444' }}
                  animate={{ scale: 1, color: defenderPTI > 0 ? '#22c55e' : '#ef4444' }}
                  className="text-4xl font-bold drop-shadow-lg"
                >
                  PTI: {defenderPTI}
                </motion.div>
              </div>
            </motion.div>
          </div>

          {lastStep?.eliminated && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 text-center relative z-10"
            >
              <div className="text-2xl font-bold text-red-400 drop-shadow-lg">
                {lastStep.target === 'attacker' ? event.attackerCard.name : event.defenderCard.name} eliminato!
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
