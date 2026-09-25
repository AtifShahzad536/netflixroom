import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftElement,
  rightElement,
  className,
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-slate-300">
          {label}
        </label>
      )}
      <div className="relative flex items-center w-full">
        {leftElement && (
          <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
            {leftElement}
          </div>
        )}
        <input
          id={inputId}
          className={twMerge(
            clsx(
              'w-full bg-[#14161d] border border-[#272b3a] text-slate-100 placeholder-slate-500 text-sm rounded-[4px] px-3 py-2 transition-all duration-150',
              'focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]/40',
              'disabled:opacity-50 disabled:bg-[#0d0e12]',
              leftElement && 'pl-9',
              rightElement && 'pr-9',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500/40',
              className
            )
          )}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-3 flex items-center text-slate-400">
            {rightElement}
          </div>
        )}
      </div>
      {error ? (
        <span className="text-xs text-red-400 mt-0.5">{error}</span>
      ) : helperText ? (
        <span className="text-xs text-slate-500 mt-0.5">{helperText}</span>
      ) : null}
    </div>
  );
};
