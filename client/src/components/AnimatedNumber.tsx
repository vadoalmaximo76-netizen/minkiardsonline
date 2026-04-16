import React, { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, className }) => {
  const [display, setDisplay] = useState(Math.round(value));
  const currentRef = useRef(value);
  const velocityRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const stiffness = 80;
    const damping = 20;
    const mass = 1;
    const dt = 0.016;

    function step() {
      const delta = value - currentRef.current;
      const springForce = stiffness * delta;
      const damperForce = damping * velocityRef.current;
      const acceleration = (springForce - damperForce) / mass;
      velocityRef.current += acceleration * dt;
      currentRef.current += velocityRef.current * dt;
      setDisplay(Math.round(currentRef.current));
      if (Math.abs(delta) > 0.5 || Math.abs(velocityRef.current) > 0.5) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        currentRef.current = value;
        velocityRef.current = 0;
        setDisplay(Math.round(value));
      }
    }

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  return <span className={className}>{display}</span>;
};
