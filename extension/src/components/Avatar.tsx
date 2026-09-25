import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  isSpeaking?: boolean;
  isMuted?: boolean;
  isHost?: boolean;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = 'md',
  isSpeaking = false,
  isMuted,
  isHost,
  className
}) => {
  const initials = name
    ? name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  const sizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm font-semibold'
  };

  // Consistent background color based on name hash
  const colors = [
    'bg-blue-600',
    'bg-purple-600',
    'bg-emerald-600',
    'bg-amber-600',
    'bg-rose-600',
    'bg-indigo-600',
    'bg-cyan-600'
  ];
  const charCode = name ? name.charCodeAt(0) : 0;
  const colorClass = colors[charCode % colors.length];

  return (
    <div className="relative inline-block shrink-0">
      <div
        className={twMerge(
          clsx(
            'flex items-center justify-center rounded-[4px] border border-[#272b3a] font-medium text-white transition-all overflow-hidden select-none',
            sizes[size],
            src ? 'bg-transparent' : colorClass,
            isSpeaking && 'voice-speaking-glow border-emerald-500',
            className
          )
        )}
      >
        {src ? (
          <img src={src} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {isHost && (
        <span
          title="Host"
          className="absolute -top-1 -right-1 bg-amber-500 text-black text-[9px] font-bold px-1 rounded-[2px] border border-[#14161d]"
        >
          H
        </span>
      )}

      {isMuted !== undefined && (
        <span
          className={clsx(
            'absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-[2px] border border-[#14161d]',
            isMuted ? 'bg-rose-500' : 'bg-emerald-500'
          )}
          title={isMuted ? 'Muted' : 'Mic active'}
        />
      )}
    </div>
  );
};
