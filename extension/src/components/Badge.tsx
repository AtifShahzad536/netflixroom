import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'accent' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
  title?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className,
  dot = false,
  title
}) => {
  const variants = {
    default: 'bg-[#1b1e28] text-slate-300 border-[#272b3a]',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    danger: 'bg-red-500/10 text-red-400 border-red-500/30',
    accent: 'bg-[#E50914]/15 text-[#E50914] border-[#E50914]/30 font-semibold',
    neutral: 'bg-slate-800 text-slate-400 border-slate-700'
  };

  const sizes = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-0.5 gap-1.5'
  };

  const dotColors = {
    default: 'bg-slate-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-red-400',
    accent: 'bg-[#E50914]',
    neutral: 'bg-slate-400'
  };

  return (
    <span
      title={title}
      className={twMerge(
        clsx(
          'inline-flex items-center font-medium border rounded-[3px] select-none uppercase tracking-wider',
          variants[variant],
          sizes[size],
          className
        )
      )}
    >
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-[1px] shrink-0', dotColors[variant])} />}
      {children}
    </span>
  );
};
