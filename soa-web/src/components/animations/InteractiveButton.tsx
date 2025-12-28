'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface InteractiveButtonProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export function InteractiveButton({
  children,
  className = '',
  onClick,
  href,
  variant = 'primary',
  size = 'md'
}: InteractiveButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-300 relative overflow-hidden';
  
  const variantClasses = {
    primary: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/25',
    secondary: 'bg-soa-primary text-white hover:bg-soa-dark shadow-lg shadow-soa-primary/25',
    outline: 'bg-transparent border-2 border-gray-200 text-gray-700 hover:border-soa-primary hover:text-soa-primary',
  };

  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  const buttonContent = (
    <>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0"
        initial={{ x: '-100%' }}
        whileHover={{ x: '100%' }}
        transition={{ duration: 0.6 }}
      />
      <span className="relative z-10">{children}</span>
    </>
  );

  const motionProps = {
    whileHover: { scale: 1.05, y: -2 },
    whileTap: { scale: 0.95 },
    className: `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`,
  };

  if (href) {
    return (
      <motion.a
        href={href}
        {...motionProps}
      >
        {buttonContent}
      </motion.a>
    );
  }

  return (
    <motion.button
      onClick={onClick}
      {...motionProps}
    >
      {buttonContent}
    </motion.button>
  );
}


