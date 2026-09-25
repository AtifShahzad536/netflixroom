import React, { useState } from 'react';
import { MessageSquare, Users, Mic, PhoneOff, MicOff } from 'lucide-react';
import { Party, ChatMessage, ConnectionStatus, Member } from '../../types';
import { Header } from '../components/Header';
import { NowPlayingCard } from '../components/NowPlayingCard';
import { ChatTab } from '../components/ChatTab';
import { MembersTab } from '../components/MembersTab';
import { VoiceTab } from '../components/VoiceTab';
import { Button } from '../../components/Button';
import { IconButton } from '../../components/IconButton';

interface ActivePartyViewProps {
  party: Party;
  currentUserId: string;
  connectionStatus: ConnectionStatus;
  messages: ChatMessage[];
  inVoice: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  onLeaveParty: () => void;
  onSendMessage: (text: string, type?: 'chat' | 'sticker', stickerUrl?: string) => void;
  onTogglePlay: () => void;
  onForceSync: () => void;
  onToggleVoice: () => void;
  onToggleMute: () => void;
}

type TabType = 'chat' | 'members' | 'voice';

export const ActivePartyView: React.FC<ActivePartyViewProps> = ({
  party,
  currentUserId,
  connectionStatus,
  messages,
  inVoice,
  isMuted,
  isSpeaking,
  onLeaveParty,
  onSendMessage,
  onTogglePlay,
  onForceSync,
  onToggleVoice,
  onToggleMute
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [isCopiedCode, setIsCopiedCode] = useState(false);

  const isHost = party.hostId === currentUserId;
  const voiceMembersCount = party.members.filter(m => m.inVoice).length;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(party.partyCode);
    setIsCopiedCode(true);
    setTimeout(() => setIsCopiedCode(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d0e12] overflow-hidden">
      {/* Top Header */}
      <Header
        partyName={party.name}
        partyCode={party.partyCode}
        connectionStatus={connectionStatus}
        memberCount={party.members.length}
        onLeave={onLeaveParty}
        onCopyCode={handleCopyCode}
        isCopied={isCopiedCode}
      />

      {/* Netflix Now Playing & Sync Card */}
      <NowPlayingCard
        mediaInfo={party.mediaInfo}
        playbackState={party.playbackState}
        isHost={isHost}
        onlyHostControl={party.settings.onlyHostCanControl}
        onTogglePlay={onTogglePlay}
        onForceSync={onForceSync}
      />

      {/* Tab Navigation */}
      <div className="flex items-center border-b border-[#272b3a] bg-[#14161d] px-2 shrink-0">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition-all select-none ${
            activeTab === 'chat'
              ? 'border-[#E50914] text-[#E50914]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chat</span>
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition-all select-none ${
            activeTab === 'members'
              ? 'border-[#E50914] text-[#E50914]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Members ({party.members.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('voice')}
          className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition-all select-none ${
            activeTab === 'voice'
              ? 'border-[#E50914] text-[#E50914]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Mic className={`w-3.5 h-3.5 ${inVoice ? 'text-emerald-400' : ''}`} />
          <span>Voice {voiceMembersCount > 0 && `(${voiceMembersCount})`}</span>
        </button>
      </div>

      {/* Active Tab View */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === 'chat' && (
          <ChatTab
            messages={messages}
            currentUserId={currentUserId}
            onSendMessage={onSendMessage}
          />
        )}

        {activeTab === 'members' && (
          <MembersTab
            members={party.members}
            currentUserId={currentUserId}
            isHost={isHost}
          />
        )}

        {activeTab === 'voice' && (
          <VoiceTab
            inVoice={inVoice}
            isMuted={isMuted}
            isSpeaking={isSpeaking}
            members={party.members}
            onToggleVoice={onToggleVoice}
            onToggleMute={onToggleMute}
          />
        )}
      </div>

      {/* Persistent Mini Voice Bar (Visible on Chat/Members tabs when in voice) */}
      {inVoice && activeTab !== 'voice' && (
        <div className="h-10 bg-[#14161d] border-t border-[#272b3a] px-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-[1px] bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-medium text-slate-300">
              Voice Connected {isSpeaking ? '• Speaking' : isMuted ? '• Muted' : ''}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <IconButton
              size="sm"
              variant={isMuted ? 'danger' : 'secondary'}
              onClick={onToggleMute}
              tooltip={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </IconButton>

            <IconButton
              size="sm"
              variant="danger"
              onClick={onToggleVoice}
              tooltip="Leave voice"
            >
              <PhoneOff className="w-3.5 h-3.5" />
            </IconButton>
          </div>
        </div>
      )}
    </div>
  );
};
