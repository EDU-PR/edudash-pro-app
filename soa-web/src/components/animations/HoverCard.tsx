'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface HoverCardProps {
  children: ReactNode;
  className?: string;
  scale?: number;
  rotate?: number;
  glow?: boolean;
  glowColor?: string;
}

export function HoverCard({ 
  children, 
  className = '', 
  scale = 1.05,
  rotate = 0,
  glow = false,
  glowColor = 'rgba(217, 119, 6, 0.3)'
}: HoverCardProps) {
  return (
    <motion.div
      className={className}
      whileHover={{ 
        scale, 
        rotate,
        boxShadow: glow ? `0 20px 40px ${glowColor}` : undefined
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ 
        type: 'spring', 
        stiffness: 300, 
        damping: 20 
      }}
    >
      {children}
    </motion.div>
  );
}


