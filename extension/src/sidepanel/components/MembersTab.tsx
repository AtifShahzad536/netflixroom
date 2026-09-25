import React from 'react';
import { Crown, Mic, MicOff, Volume2, User as UserIcon } from 'lucide-react';
import { Member } from '../../types';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';

interface MembersTabProps {
  members: Member[];
  currentUserId: string;
  isHost: boolean;
}

export const MembersTab: React.FC<MembersTabProps> = ({
  members,
  currentUserId,
  isHost
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0d0e12] p-3.5 overflow-y-auto">
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Party Participants ({members.length})
        </span>
      </div>

      <div className="space-y-1.5">
        {members.map((member) => {
          const isMe = member.userId === currentUserId;

          return (
            <div
              key={member.userId}
              className={`flex items-center justify-between p-2.5 rounded-[4px] border ${
                isMe
                  ? 'bg-[#1b1e28] border-[#353b4f]'
                  : 'bg-[#14161d] border-[#272b3a]'
              } hover:border-[#353b4f] transition-all`}
            >
              <div className="flex items-center gap-2.5">
                <Avatar
                  name={member.name}
                  size="md"
                  isSpeaking={member.isSpeaking}
                  isHost={member.isHost}
                />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-100">
                      {member.name}
                    </span>
                    {isMe && (
                      <span className="text-[10px] text-slate-400 font-normal">
                        (You)
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {member.isHost ? 'Party Host' : 'Member'}
                  </span>
                </div>
              </div>

              {/* Status & Voice Indicators */}
              <div className="flex items-center gap-2">
                {member.isHost && (
                  <Badge variant="accent" size="sm" className="gap-1">
                    <Crown className="w-2.5 h-2.5" />
                    Host
                  </Badge>
                )}

                {member.inVoice ? (
                  <div
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] ${
                      member.isSpeaking
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : member.isMuted
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : 'bg-[#1b1e28] text-slate-300 border border-[#272b3a]'
                    }`}
                  >
                    {member.isSpeaking ? (
                      <Volume2 className="w-3 h-3 text-emerald-400 animate-pulse" />
                    ) : member.isMuted ? (
                      <MicOff className="w-3 h-3 text-rose-400" />
                    ) : (
                      <Mic className="w-3 h-3 text-slate-300" />
                    )}
                    <span>{member.isSpeaking ? 'Speaking' : member.isMuted ? 'Muted' : 'Voice'}</span>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-600">No voice</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
