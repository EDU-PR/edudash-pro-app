'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface FloatingElementProps {
  children: ReactNode;
  duration?: number;
  distance?: number;
  className?: string;
}

export function FloatingElement({ 
  children, 
  duration = 3, 
  distance = 10,
  className = '' 
}: FloatingElementProps) {
  return (
    <motion.div
      animate={{ 
        y: [-distance, distance, -distance] 
      }}
      transition={{ 
        duration, 
        repeat: Infinity, 
        ease: 'easeInOut' 
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
