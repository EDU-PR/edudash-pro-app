'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { ReactNode, useRef } from 'react';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  delay?: number;
}

export function ScrollReveal({ 
  children, 
  className = '',
  direction = 'up',
  distance = 50,
  delay = 0
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start']
  });

  const directions = {
    up: { y: distance, x: 0 },
    down: { y: -distance, x: 0 },
    left: { y: 0, x: distance },
    right: { y: 0, x: -distance },
  };

  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 1, 1]);
  const translateY = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [directions[direction].y, 0, 0]
  );
  const translateX = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [directions[direction].x, 0, 0]
  );

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        opacity,
        y: translateY,
        x: translateX,
      }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}


