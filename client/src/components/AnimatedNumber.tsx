import React, { useEffect, useState } from "react";
import { useMotionValue, useSpring } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, className }) => {
  const count = useMotionValue(value);
  const spring = useSpring(count, { stiffness: 80, damping: 20 });
  const [display, setDisplay] = useState(Math.round(value));

  useEffect(() => {
    count.set(value);
  }, [value, count]);

  useEffect(() => {
    return spring.on("change", (v) => setDisplay(Math.round(v)));
  }, [spring]);

  return <span className={className}>{display}</span>;
};
