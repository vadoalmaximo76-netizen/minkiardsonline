import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

interface AnimatedNumberProps {
  value: number;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, className }) => {
  const [display, setDisplay] = useState(Math.round(value));
  const objRef = useRef({ val: value });
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    if (tweenRef.current) tweenRef.current.kill();
    tweenRef.current = gsap.to(objRef.current, {
      val: value,
      duration: 0.55,
      ease: "power2.out",
      onUpdate() {
        setDisplay(Math.round(objRef.current.val));
      },
    });
    return () => {
      tweenRef.current?.kill();
    };
  }, [value]);

  return <span className={className}>{display}</span>;
};
