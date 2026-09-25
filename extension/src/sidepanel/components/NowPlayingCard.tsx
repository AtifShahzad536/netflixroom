import React from 'react';
import { Film, Play, Pause, RotateCcw, ShieldCheck } from 'lucide-react';
import { MediaInfo, PlaybackState } from '../../types';
import { IconButton } from '../../components/IconButton';
import { Badge } from '../../components/Badge';

interface NowPlayingCardProps {
  mediaInfo: MediaInfo;
  playbackState: PlaybackState;
  isHost: boolean;
  onlyHostControl: boolean;
  onTogglePlay: () => void;
  onForceSync: () => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

export const NowPlayingCard: React.FC<NowPlayingCardProps> = ({
  mediaInfo,
  playbackState,
  isHost,
  onlyHostControl,
  onTogglePlay,
  onForceSync
}) => {
  const canControl = !onlyHostControl || isHost;

  return (
    <div className="bg-[#14161d] border-b border-[#272b3a] p-3.5 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-[4px] bg-[#1b1e28] border border-[#272b3a] flex items-center justify-center shrink-0 text-[#E50914]">
            <Film className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <h4 className="text-xs font-semibold text-slate-100 truncate">
              {mediaInfo.title || 'Netflix Stream'}
            </h4>
            <span className="text-[11px] text-slate-400 truncate">
              {mediaInfo.episodeInfo || 'Synchronized Watch Party'}
            </span>
          </div>
        </div>

        {onlyHostControl && (
          <Badge variant="warning" size="sm" title="Only Host has Play/Pause Control">
            Host Lock
          </Badge>
        )}
      </div>

      {/* Playback Controls & Timestamp */}
      <div className="flex items-center justify-between bg-[#0d0e12] border border-[#272b3a] px-3 py-2 rounded-[4px]">
        <div className="flex items-center gap-2">
          <IconButton
            size="sm"
            variant={playbackState.isPlaying ? 'secondary' : 'primary'}
            onClick={onTogglePlay}
            disabled={!canControl}
            tooltip={
              !canControl
                ? 'Only the host can control playback'
                : playbackState.isPlaying
                ? 'Pause Video'
                : 'Play Video'
            }
          >
            {playbackState.isPlaying ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
          </IconButton>

          <div className="flex flex-col">
            <span className="text-xs font-mono font-semibold text-slate-200">
              {formatTime(playbackState.currentTime)}
            </span>
            <span className="text-[10px] text-slate-500">
              {playbackState.isPlaying ? 'Playing in sync' : 'Paused'}
            </span>
          </div>
        </div>

        <button
          onClick={onForceSync}
          className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-100 hover:bg-[#1b1e28] px-2 py-1 rounded-[3px] border border-transparent hover:border-[#272b3a] transition-all"
          title="Resynchronize player position"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Resync</span>
        </button>
      </div>
    </div>
  );
};
