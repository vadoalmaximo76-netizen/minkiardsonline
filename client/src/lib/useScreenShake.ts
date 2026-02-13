import { useCallback, useRef } from 'react';

type ShakeIntensity = 'light' | 'medium' | 'heavy' | 'extreme';

const SHAKE_CONFIG: Record<ShakeIntensity, { amplitude: number; duration: number; frequency: number }> = {
  light: { amplitude: 3, duration: 300, frequency: 30 },
  medium: { amplitude: 6, duration: 400, frequency: 25 },
  heavy: { amplitude: 12, duration: 600, frequency: 20 },
  extreme: { amplitude: 20, duration: 800, frequency: 15 },
};

export function useScreenShake() {
  const animationRef = useRef<number | null>(null);
  const isShakingRef = useRef(false);

  const shake = useCallback((intensity: ShakeIntensity = 'medium') => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      const gameContainer = document.getElementById('game-root') || document.body;
      gameContainer.style.transform = '';
    }
    isShakingRef.current = true;

    const config = SHAKE_CONFIG[intensity];
    const startTime = performance.now();
    const gameContainer = document.getElementById('game-root') || document.body;

    const doShake = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = elapsed / config.duration;

      if (progress >= 1) {
        gameContainer.style.transform = '';
        isShakingRef.current = false;
        return;
      }

      const decay = 1 - progress;
      const amp = config.amplitude * decay;
      const offsetX = (Math.random() * 2 - 1) * amp;
      const offsetY = (Math.random() * 2 - 1) * amp;
      const rotation = (Math.random() * 2 - 1) * (amp * 0.1);

      gameContainer.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg)`;

      animationRef.current = requestAnimationFrame(doShake);
    };

    animationRef.current = requestAnimationFrame(doShake);
  }, []);

  return { shake };
}
