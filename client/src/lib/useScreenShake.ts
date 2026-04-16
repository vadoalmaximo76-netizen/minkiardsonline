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
      // Use margins to avoid creating a containing block that breaks position:fixed
      document.body.style.marginLeft = '';
      document.body.style.marginTop = '';
    }
    isShakingRef.current = true;

    const config = SHAKE_CONFIG[intensity];
    const startTime = performance.now();

    const doShake = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = elapsed / config.duration;

      if (progress >= 1) {
        document.body.style.marginLeft = '';
        document.body.style.marginTop = '';
        isShakingRef.current = false;
        return;
      }

      const decay = 1 - progress;
      const amp = config.amplitude * decay;
      const offsetX = (Math.random() * 2 - 1) * amp;
      const offsetY = (Math.random() * 2 - 1) * amp;

      // Margin-based shake: does NOT create a containing block, so position:fixed elements
      // remain viewport-anchored throughout the shake.
      document.body.style.marginLeft = `${offsetX}px`;
      document.body.style.marginTop = `${offsetY}px`;

      animationRef.current = requestAnimationFrame(doShake);
    };

    animationRef.current = requestAnimationFrame(doShake);
  }, []);

  return { shake };
}
