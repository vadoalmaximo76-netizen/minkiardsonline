import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../lib/socket';
import { useGameState } from '../lib/stores/useGameState';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Zap } from 'lucide-react';

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
  const [showDamage, setShowDamage] = useState<{ target: 'attacker' | 'defender'; value: number } | null>(null);
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleRecursiveDamage = (data: RecursiveDamageEvent) => {
      console.log('🎮 RECURSIVE DAMAGE EVENT:', data);
      setEvent(data);
      setCurrentStep(-1);
      setAttackerPTI(data.attackerCard.initialPTI);
      setDefenderPTI(data.defenderCard.initialPTI);
      setShowDamage(null);
    };

    socket.on('recursive-damage-animation', handleRecursiveDamage);

    return () => {
      socket.off('recursive-damage-animation', handleRecursiveDamage);
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!event || currentStep >= event.steps.length) return;

    const runNextStep = () => {
      const nextStep = currentStep + 1;
      if (nextStep >= event.steps.length) {
        animationRef.current = setTimeout(() => {
          setEvent(null);
          setCurrentStep(-1);
        }, 2000);
        return;
      }

      const step = event.steps[nextStep];
      
      setShowDamage({ target: step.target, value: step.damage });
      
      animationRef.current = setTimeout(() => {
        if (step.target === 'attacker') {
          setAttackerPTI(step.newPTI);
        } else {
          setDefenderPTI(step.newPTI);
        }
        setCurrentStep(nextStep);
        
        animationRef.current = setTimeout(() => {
          setShowDamage(null);
          if (!step.eliminated) {
            animationRef.current = setTimeout(runNextStep, 500);
          } else {
            animationRef.current = setTimeout(() => {
              setEvent(null);
              setCurrentStep(-1);
            }, 2000);
          }
        }, 800);
      }, 600);
    };

    if (currentStep === -1) {
      animationRef.current = setTimeout(runNextStep, 1000);
    }
  }, [event, currentStep]);

  if (!event) return null;

  const getTypeLabel = () => {
    if (event.type === 'SEMPAFAAGARA') return 'SEMPAFAAGARA';
    return 'PARTITA DI TENNIS';
  };

  const getTypeIcon = () => {
    if (event.type === 'SEMPAFAAGARA') return <Zap className="w-8 h-8 text-yellow-400" />;
    return <span className="text-4xl">🎾</span>;
  };

  const lastStep = currentStep >= 0 ? event.steps[currentStep] : null;
  const isAttackerEliminated = lastStep?.eliminated && lastStep?.target === 'attacker';
  const isDefenderEliminated = lastStep?.eliminated && lastStep?.target === 'defender';

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
          className="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 rounded-2xl p-8 max-w-4xl w-full mx-4 border-2 border-purple-500 shadow-2xl"
        >
          <div className="flex items-center justify-center gap-4 mb-8">
            {getTypeIcon()}
            <h2 className="text-3xl font-bold text-white text-center">
              {getTypeLabel()}
            </h2>
            {getTypeIcon()}
          </div>

          <div className="flex items-center justify-between gap-8">
            <motion.div
              className={`flex-1 text-center ${isAttackerEliminated ? 'opacity-50' : ''}`}
              animate={showDamage?.target === 'attacker' ? { scale: [1, 0.95, 1], x: [0, -10, 10, 0] } : {}}
              transition={{ duration: 0.3 }}
            >
              <div className="text-lg font-semibold text-blue-300 mb-2">
                {event.attackerName}
              </div>
              <div className="relative inline-block">
                <img
                  src={event.attackerCard.frontImage}
                  alt={event.attackerCard.name}
                  className={`w-48 h-auto rounded-lg shadow-xl border-4 ${isAttackerEliminated ? 'border-red-600 grayscale' : 'border-blue-500'}`}
                />
                <AnimatePresence>
                  {showDamage?.target === 'attacker' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 2, y: -20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.5 }}
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
                <div className="text-sm text-gray-400 mb-1">{event.attackerCard.name}</div>
                <motion.div
                  key={attackerPTI}
                  initial={{ scale: 1.5, color: '#ef4444' }}
                  animate={{ scale: 1, color: attackerPTI > 0 ? '#22c55e' : '#ef4444' }}
                  className="text-4xl font-bold"
                >
                  PTI: {attackerPTI}
                </motion.div>
              </div>
            </motion.div>

            <div className="flex flex-col items-center gap-4">
              <Swords className="w-16 h-16 text-yellow-400" />
              <div className="text-white text-xl font-bold">VS</div>
              {currentStep >= 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-gray-400 text-center"
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
              <div className="text-lg font-semibold text-red-300 mb-2">
                {event.defenderName}
              </div>
              <div className="relative inline-block">
                <img
                  src={event.defenderCard.frontImage}
                  alt={event.defenderCard.name}
                  className={`w-48 h-auto rounded-lg shadow-xl border-4 ${isDefenderEliminated ? 'border-red-600 grayscale' : 'border-red-500'}`}
                />
                <AnimatePresence>
                  {showDamage?.target === 'defender' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 2, y: -20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.5 }}
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
                <div className="text-sm text-gray-400 mb-1">{event.defenderCard.name}</div>
                <motion.div
                  key={defenderPTI}
                  initial={{ scale: 1.5, color: '#ef4444' }}
                  animate={{ scale: 1, color: defenderPTI > 0 ? '#22c55e' : '#ef4444' }}
                  className="text-4xl font-bold"
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
              className="mt-8 text-center"
            >
              <div className="text-2xl font-bold text-red-400">
                {lastStep.target === 'attacker' ? event.attackerCard.name : event.defenderCard.name} eliminato!
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
