import React, { useState, useEffect } from 'react';
import { Mic, MicOff, PhoneCall, PhoneOff, Radio, Users, Volume2, VolumeX, Sparkles, Sliders } from 'lucide-react';
import { Member } from '../../types';
import { Button } from '../../components/Button';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { voiceService } from '../../services/webrtc/voice-service';

interface VoiceTabProps {
  inVoice: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  members: Member[];
  onToggleVoice: () => void;
  onToggleMute: () => void;
}

export const VoiceTab: React.FC<VoiceTabProps> = ({
  inVoice,
  isMuted,
  isSpeaking,
  members,
  onToggleVoice,
  onToggleMute
}) => {
  const [masterVolume, setMasterVolume] = useState<number>(100);
  const [gateThreshold, setGateThreshold] = useState<number>(voiceService.getGateThreshold());
  const [liveLevel, setLiveLevel] = useState<number>(0);
  const [isAboveGate, setIsAboveGate] = useState<boolean>(false);
  const [aggressiveTyping, setAggressiveTyping] = useState<boolean>(voiceService.getAggressiveTypingFilter());
  const [pttMode, setPttMode] = useState<boolean>(voiceService.getPushToTalkMode());
  const [isPttHeld, setIsPttHeld] = useState<boolean>(false);
  const [peerVolumes, setPeerVolumes] = useState<{ [socketId: string]: number }>({});
  const voiceMembers = members.filter(m => m.inVoice);

  useEffect(() => {
    voiceService.setOnLiveLevel((level, above) => {
      setLiveLevel(level);
      setIsAboveGate(above);
    });
  }, []);

  // Keyboard shortcut listener for Push-to-Talk (Spacebar)
  useEffect(() => {
    if (!pttMode || !inVoice) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is not typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space' && !e.repeat && !isPttHeld) {
        e.preventDefault();
        setIsPttHeld(true);
        voiceService.setPushToTalkPressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space' && isPttHeld) {
        e.preventDefault();
        setIsPttHeld(false);
        voiceService.setPushToTalkPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [pttMode, inVoice, isPttHeld]);

  const handleMasterVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setMasterVolume(val);
    voiceService.setMasterVolume(val / 100);
  };

  const handleGateThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setGateThreshold(val);
    voiceService.setGateThreshold(val);
  };

  const handleToggleAggressiveTyping = () => {
    const newVal = !aggressiveTyping;
    setAggressiveTyping(newVal);
    voiceService.setAggressiveTypingFilter(newVal);
  };

  const handleTogglePttMode = () => {
    const newVal = !pttMode;
    setPttMode(newVal);
    voiceService.setPushToTalkMode(newVal);
  };

  const handlePttMouseDown = () => {
    if (!pttMode || !inVoice) return;
    setIsPttHeld(true);
    voiceService.setPushToTalkPressed(true);
  };

  const handlePttMouseUp = () => {
    if (!pttMode || !inVoice) return;
    setIsPttHeld(false);
    voiceService.setPushToTalkPressed(false);
  };

  const handlePeerVolumeChange = (socketId: string, val: number) => {
    setPeerVolumes(prev => ({ ...prev, [socketId]: val }));
    voiceService.setPeerVolume(socketId, val / 100);
  };

  // Convert threshold (5-60) to approximate percent (0-100) for UI marker
  const thresholdMarkerPct = Math.min(95, Math.max(5, Math.round(((gateThreshold - 5) / 55) * 100)));

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0d0e12] p-4 overflow-y-auto">
      {/* Voice Control Card */}
      <div className="bg-[#14161d] border border-[#272b3a] p-4 rounded-[4px] mb-4 flex flex-col gap-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${inVoice ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            <span className="text-xs font-semibold text-slate-200">
              Spatial Voice Room
            </span>
          </div>
          <Badge variant={inVoice ? 'success' : 'neutral'} size="sm" dot>
            {inVoice ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>

        {/* AI Isolation Active Banner */}
        <div className="flex items-center justify-between px-2 py-1.5 bg-[#0d0e12] border border-[#272b3a] rounded-[3px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[10px] text-slate-300 font-medium truncate">
              DSP 24dB Filter & Anti-Keystroke Engine
            </span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded-[2px] border border-emerald-800/50">
            Active
          </span>
        </div>

        {inVoice && (
          <div className="space-y-2.5">
            {/* Mode Switch: Voice Activity vs Push to Talk */}
            <div className="grid grid-cols-2 gap-1.5 bg-[#0d0e12] p-1 rounded-[4px] border border-[#272b3a]">
              <button
                type="button"
                onClick={() => pttMode && handleTogglePttMode()}
                className={`py-1 text-[11px] font-medium rounded-[3px] transition-colors ${
                  !pttMode ? 'bg-[#222634] text-white shadow-sm font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Auto Voice Gate
              </button>
              <button
                type="button"
                onClick={() => !pttMode && handleTogglePttMode()}
                className={`py-1 text-[11px] font-medium rounded-[3px] transition-colors ${
                  pttMode ? 'bg-[#E50914] text-white shadow-sm font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Push-to-Talk
              </button>
            </div>

            {/* If Push to Talk Mode: Big Hold Button */}
            {pttMode ? (
              <div className="flex flex-col gap-1.5 bg-[#0d0e12] p-3 rounded-[4px] border border-[#272b3a] items-center text-center">
                <button
                  type="button"
                  onMouseDown={handlePttMouseDown}
                  onMouseUp={handlePttMouseUp}
                  onTouchStart={handlePttMouseDown}
                  onTouchEnd={handlePttMouseUp}
                  className={`w-full py-3 text-xs font-bold uppercase tracking-wider rounded-[4px] transition-all select-none ${
                    isPttHeld
                      ? 'bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)] scale-[0.98]'
                      : 'bg-[#222634] hover:bg-[#2b3042] text-slate-200 border border-[#3b4157]'
                  }`}
                >
                  {isPttHeld ? '🎙️ Mic Open (Transmitting)' : 'Hold Spacebar or Press to Talk'}
                </button>
                <span className="text-[9px] text-slate-400">
                  Keeps mic 100% dead silent until you hold this button or Spacebar.
                </span>
              </div>
            ) : (
              /* Auto Voice Gate Controls */
              <div className="flex flex-col gap-2 bg-[#0d0e12] p-2.5 rounded-[4px] border border-[#272b3a]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mic Sensitivity Gate</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-[2px] ${
                    isAboveGate ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40' : 'bg-slate-800/80 text-slate-400'
                  }`}>
                    {isAboveGate ? 'Speaking (Open)' : 'Muted (Noise Cut)'}
                  </span>
                </div>

                {/* Live Visual Meter with Threshold Marker */}
                <div className="relative w-full h-2.5 bg-[#1b1e2a] rounded-[2px] overflow-hidden border border-[#2c3144]">
                  {/* Gate Threshold Cutoff Line Marker */}
                  <div
                    className="absolute top-0 bottom-0 w-[2px] bg-amber-400 z-10 shadow-[0_0_4px_#fbbf24]"
                    style={{ left: `${thresholdMarkerPct}%` }}
                    title={`Cutoff Threshold: ${gateThreshold}`}
                  />
                  {/* Active Audio Bar */}
                  <div
                    className={`h-full transition-all duration-75 ${
                      isAboveGate
                        ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                        : 'bg-slate-500/60'
                    }`}
                    style={{ width: `${Math.min(100, liveLevel)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[9px] text-slate-400">
                  <span>Mute Noise</span>
                  <span>Threshold: {gateThreshold}</span>
                  <span>Loud Only</span>
                </div>

                <input
                  type="range"
                  min="8"
                  max="50"
                  value={gateThreshold}
                  onChange={handleGateThresholdChange}
                  className="w-full h-1.5 bg-[#222634] rounded-[2px] appearance-none cursor-pointer accent-emerald-500"
                />

                {/* Aggressive Typing Filter Toggle */}
                <button
                  type="button"
                  onClick={handleToggleAggressiveTyping}
                  className="flex items-center justify-between pt-1 mt-0.5 border-t border-[#222634] text-left"
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] font-medium text-slate-300">
                      Aggressive Laptop Key Filter
                    </span>
                    <span className="text-[8.5px] text-slate-500">
                      Discards fast chassis clicks & button vibrations
                    </span>
                  </div>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-[2px] ${
                    aggressiveTyping ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {aggressiveTyping ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            )}

            {/* Master Room Volume */}
            <div className="flex flex-col gap-1.5 bg-[#0d0e12] p-2.5 rounded-[4px] border border-[#272b3a]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                  {masterVolume === 0 ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-[#E50914]" />
                  )}
                  <span>Room Output Volume</span>
                </div>
                <span className="text-[11px] font-mono font-semibold text-slate-300">
                  {masterVolume}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={masterVolume}
                onChange={handleMasterVolumeChange}
                className="w-full h-1.5 bg-[#222634] rounded-[2px] appearance-none cursor-pointer accent-[#E50914]"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 border-t border-[#272b3a]">
          <Button
            variant={inVoice ? 'danger' : 'primary'}
            size="sm"
            onClick={onToggleVoice}
            leftIcon={inVoice ? <PhoneOff className="w-3.5 h-3.5" /> : <PhoneCall className="w-3.5 h-3.5" />}
            className="flex-1"
          >
            {inVoice ? 'Leave Voice' : 'Join Voice Chat'}
          </Button>

          {inVoice && (
            <Button
              variant={isMuted ? 'danger' : 'secondary'}
              size="sm"
              onClick={onToggleMute}
              leftIcon={isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              className="flex-1"
            >
              {isMuted ? 'Unmute Mic' : 'Mute Mic'}
            </Button>
          )}
        </div>
      </div>

      {/* Voice Participants */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            In Voice ({voiceMembers.length})
          </span>
        </div>

        {voiceMembers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 border border-dashed border-[#272b3a] rounded-[4px]">
            <Users className="w-7 h-7 mb-2 text-slate-600 stroke-[1.5]" />
            <p className="text-xs font-medium text-slate-400">Nobody is in voice yet</p>
            <p className="text-[11px] text-slate-600 mt-0.5">Click "Join Voice Chat" to start talking.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {voiceMembers.map(member => {
              const peerVol = member.socketId ? (peerVolumes[member.socketId] ?? 100) : 100;

              return (
                <div
                  key={member.userId}
                  className="flex flex-col p-2.5 bg-[#14161d] border border-[#272b3a] rounded-[4px] gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        name={member.name}
                        size="md"
                        isSpeaking={member.isSpeaking}
                        isHost={member.isHost}
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-slate-200">{member.name}</span>
                        <span className="text-[10px] text-slate-500">
                          {member.isSpeaking ? 'Speaking...' : member.isMuted ? 'Muted' : 'Listening'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {member.isMuted ? (
                        <MicOff className="w-3.5 h-3.5 text-rose-400" />
                      ) : (
                        <Mic className={`w-3.5 h-3.5 ${member.isSpeaking ? 'text-emerald-400 animate-bounce' : 'text-slate-400'}`} />
                      )}
                    </div>
                  </div>

                  {member.socketId && inVoice && (
                    <div className="flex items-center gap-2 pt-1 border-t border-[#272b3a]/50">
                      <Volume2 className="w-3 h-3 text-slate-400 shrink-0" />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={peerVol}
                        onChange={(e) => handlePeerVolumeChange(member.socketId!, parseInt(e.target.value, 10))}
                        className="flex-1 h-1 bg-[#222634] rounded-[2px] appearance-none cursor-pointer accent-[#E50914]"
                      />
                      <span className="text-[10px] font-mono text-slate-400 w-7 text-right">
                        {peerVol}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
