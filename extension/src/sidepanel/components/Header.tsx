import React from 'react';
import { LogOut, Copy, Check, Users } from 'lucide-react';
import { ConnectionStatus } from '../../types';
import { Badge } from '../../components/Badge';
import { IconButton } from '../../components/IconButton';

interface HeaderProps {
  partyName?: string;
  partyCode?: string;
  connectionStatus: ConnectionStatus;
  memberCount?: number;
  onLeave?: () => void;
  onCopyCode?: () => void;
  isCopied?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  partyName,
  partyCode,
  connectionStatus,
  memberCount,
  onLeave,
  onCopyCode,
  isCopied
}) => {
  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Badge variant="success" size="sm" dot>Online</Badge>;
      case 'connecting':
      case 'reconnecting':
        return <Badge variant="warning" size="sm" dot>Syncing</Badge>;
      case 'disconnected':
      case 'offline':
      default:
        return <Badge variant="danger" size="sm" dot>Offline</Badge>;
    }
  };

  return (
    <header className="bg-[#14161d] border-b border-[#272b3a] px-3.5 py-2.5 flex flex-col gap-2 shrink-0 select-none">
      {/* Top Main Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <img
            src="/logo.png"
            alt="Logo"
            className="w-6 h-6 object-contain rounded-[2px] shrink-0 shadow-sm"
          />
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-xs text-slate-100 truncate">
              {partyName || 'Watch Together'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onLeave && (
            <IconButton
              size="sm"
              variant="ghost"
              onClick={onLeave}
              tooltip="Leave Party"
              className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 h-7 w-7"
            >
              <LogOut className="w-3.5 h-3.5" />
            </IconButton>
          )}
        </div>
      </div>

      {/* Responsive Meta Info Bar */}
      <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-[#272b3a]/60">
        <div className="flex items-center gap-1.5 overflow-hidden">
          {partyCode && (
            <button
              onClick={onCopyCode}
              className="flex items-center gap-1 text-[11px] font-mono font-semibold text-slate-300 hover:text-white bg-[#0d0e12] px-2 py-0.5 rounded-[3px] border border-[#272b3a] hover:border-[#353b4f] transition-all"
              title="Click to copy Party Code"
            >
              <span className="text-[#E50914]">{partyCode}</span>
              {isCopied ? (
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
              ) : (
                <Copy className="w-3 h-3 text-slate-400 shrink-0" />
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {getStatusBadge()}
          {memberCount !== undefined && (
            <Badge variant="default" size="sm" className="gap-1">
              <Users className="w-2.5 h-2.5 text-slate-400" />
              {memberCount}
            </Badge>
          )}
        </div>
      </div>
    </header>
  );
};
