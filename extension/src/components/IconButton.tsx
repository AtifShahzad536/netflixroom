import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  tooltip?: string;
  active?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  children,
  variant = 'ghost',
  size = 'md',
  tooltip,
  active = false,
  className,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center transition-all duration-150 rounded-[4px] border focus:outline-none select-none active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-[#E50914] hover:bg-[#b80710] text-white border-transparent',
    secondary: 'bg-[#1b1e28] hover:bg-[#222634] text-slate-200 border-[#272b3a]',
    ghost: 'bg-transparent hover:bg-[#1b1e28] text-slate-300 hover:text-white border-transparent',
    danger: 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border-red-500/30',
    success: 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/30'
  };

  const sizes = {
    sm: 'w-7 h-7 p-1 text-xs',
    md: 'w-8 h-8 p-1.5 text-sm',
    lg: 'w-10 h-10 p-2 text-base'
  };

  return (
    <button
      className={twMerge(clsx(baseStyles, variants[variant], sizes[size], active && 'bg-[#222634] text-white border-[#353b4f]', className))}
      title={tooltip}
      {...props}
    >
      {children}
    </button>
  );
};
