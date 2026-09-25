import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Party, User, ChatMessage, ConnectionStatus, Member, SyncEventPayload } from '../types';
import { socketService } from '../services/websocket/socket-service';
import { voiceService } from '../services/webrtc/voice-service';
import { StorageService } from '../services/storage/storage-service';
import { WelcomeView } from './pages/WelcomeView';
import { CreatePartyView } from './pages/CreatePartyView';
import { JoinPartyView } from './pages/JoinPartyView';
import { ActivePartyView } from './pages/ActivePartyView';
import { ToastContainer, ToastMessage } from '../components/Toast';

type ViewMode = 'welcome' | 'create' | 'join' | 'active';

export const SidepanelApp: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('welcome');
  const [currentUser, setCurrentUser] = useState<User>({
    userId: uuidv4(),
    name: 'Party Guest'
  });
  const [activeParty, setActiveParty] = useState<Party | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inVoice, setInVoice] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isNetflixActive, setIsNetflixActive] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: ToastMessage['type'], message: string) => {
    const newToast: ToastMessage = {
      id: `toast-${Date.now()}-${Math.random()}`,
      type,
      message
    };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 1. Initialize user & check Netflix tab
  useEffect(() => {
    const init = async () => {
      const savedUser = await StorageService.getUser();
      if (savedUser) {
        setCurrentUser(savedUser);
      } else {
        const defaultUser: User = {
          userId: `usr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: `Watcher_${Math.floor(100 + Math.random() * 900)}`
        };
        setCurrentUser(defaultUser);
        await StorageService.setUser(defaultUser);
      }

      // Check for Netflix active tab
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const url = tabs[0]?.url || '';
          setIsNetflixActive(url.includes('netflix.com'));
        });
      }
    };
    init();
  }, []);

  // 2. Setup Socket.IO real-time event subscriptions
  useEffect(() => {
    const unsubStatus = socketService.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    const unsubPlay = socketService.onPlay((payload: SyncEventPayload) => {
      setActiveParty((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          playbackState: {
            ...prev.playbackState,
            isPlaying: true,
            currentTime: payload.position,
            lastUpdated: Date.now()
          }
        };
      });

      // Send execution to content script
      sendToActiveNetflixTab({
        type: 'NETFLIX_EXECUTE_PLAY',
        payload: { position: payload.position }
      });
    });

    const unsubPause = socketService.onPause((payload: SyncEventPayload) => {
      setActiveParty((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          playbackState: {
            ...prev.playbackState,
            isPlaying: false,
            currentTime: payload.position,
            lastUpdated: Date.now()
          }
        };
      });

      sendToActiveNetflixTab({
        type: 'NETFLIX_EXECUTE_PAUSE',
        payload: { position: payload.position }
      });
    });

    const unsubSeek = socketService.onSeek((payload: SyncEventPayload) => {
      setActiveParty((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          playbackState: {
            ...prev.playbackState,
            currentTime: payload.position,
            lastUpdated: Date.now()
          }
        };
      });

      sendToActiveNetflixTab({
        type: 'NETFLIX_EXECUTE_SEEK',
        payload: { position: payload.position }
      });
    });

    const unsubChat = socketService.onChatMessage((msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    const unsubMemberJoined = socketService.onMemberJoined(({ member }) => {
      setActiveParty((prev) => {
        if (!prev) return null;
        const exists = prev.members.some((m) => m.userId === member.userId);
        if (exists) return prev;
        return {
          ...prev,
          members: [...prev.members, member]
        };
      });
      addToast('info', `${member.name} joined the party`);
    });

    const unsubMemberLeft = socketService.onMemberLeft(({ userId, name, newHostId }) => {
      setActiveParty((prev) => {
        if (!prev) return null;
        const updated = prev.members.filter((m) => m.userId !== userId);
        return {
          ...prev,
          hostId: newHostId || prev.hostId,
          members: updated
        };
      });
      addToast('info', `${name} left the party`);
    });

    const unsubVoiceJoined = socketService.onVoiceJoined(({ userId }) => {
      setActiveParty((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          members: prev.members.map((m) => (m.userId === userId ? { ...m, inVoice: true, isMuted: false } : m))
        };
      });
    });

    const unsubVoiceLeft = socketService.onVoiceLeft(({ userId }) => {
      setActiveParty((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          members: prev.members.map((m) => (m.userId === userId ? { ...m, inVoice: false, isSpeaking: false } : m))
        };
      });
    });

    const unsubVoiceSpeaking = socketService.onVoiceSpeaking(({ userId, isSpeaking: speaking }) => {
      setActiveParty((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          members: prev.members.map((m) => (m.userId === userId ? { ...m, isSpeaking: speaking } : m))
        };
      });
      if (userId === currentUser.userId) {
        setIsSpeaking(speaking);
      }
    });

    const unsubVoiceState = socketService.onVoiceStateChange(({ userId, isMuted: muted }) => {
      setActiveParty((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          members: prev.members.map((m) => (m.userId === userId ? { ...m, isMuted: muted } : m))
        };
      });
    });

    const unsubMediaUpdate = socketService.onMediaUpdate((mediaInfo) => {
      setActiveParty((prev) => {
        if (!prev) return null;
        return { ...prev, mediaInfo };
      });
    });

    return () => {
      unsubStatus();
      unsubPlay();
      unsubPause();
      unsubSeek();
      unsubChat();
      unsubMemberJoined();
      unsubMemberLeft();
      unsubVoiceJoined();
      unsubVoiceLeft();
      unsubVoiceSpeaking();
      unsubVoiceState();
      unsubMediaUpdate();
    };
  }, [currentUser.userId]);

  // 3. Listen to local Netflix events from content script
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime) return;

    const messageListener = (message: any) => {
      if (!activeParty) return;

      if (message.type === 'NETFLIX_LOCAL_PLAY') {
        const canControl = !activeParty.settings.onlyHostCanControl || activeParty.hostId === currentUser.userId;
        if (canControl) {
          socketService.sendPlay(message.payload.position);
        }
      }

      if (message.type === 'NETFLIX_LOCAL_PAUSE') {
        const canControl = !activeParty.settings.onlyHostCanControl || activeParty.hostId === currentUser.userId;
        if (canControl) {
          socketService.sendPause(message.payload.position);
        }
      }

      if (message.type === 'NETFLIX_LOCAL_SEEK') {
        const canControl = !activeParty.settings.onlyHostCanControl || activeParty.hostId === currentUser.userId;
        if (canControl) {
          socketService.sendSeek(message.payload.position);
        }
      }

      if (message.type === 'NETFLIX_STATUS_UPDATE') {
        const { mediaInfo, isPlaying, currentTime } = message.payload;
        if (mediaInfo?.title && (!activeParty.mediaInfo.title || activeParty.mediaInfo.title === 'Netflix Stream')) {
          socketService.sendMediaUpdate(mediaInfo);
        }
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [activeParty, currentUser.userId]);

  // Helper to send command to Netflix tab
  const sendToActiveNetflixTab = (message: any) => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {});
      }
    });
  };

  // Handlers
  const handleSaveUserName = async (name: string) => {
    const updated = { ...currentUser, name };
    setCurrentUser(updated);
    await StorageService.setUser(updated);
  };

  const handleCreateParty = async (name: string, description: string, onlyHost: boolean): Promise<Party | null> => {
    try {
      const apiUrl = (import.meta as any).env?.VITE_API_URL || 'https://netflixroom.vercel.app/api';
      const response = await fetch(`${apiUrl}/party/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          hostId: currentUser.userId,
          hostName: currentUser.name,
          settings: {
            onlyHostCanControl: onlyHost,
            isVoiceEnabled: true,
            maxMembers: 20
          }
        })
      });

      const data = await response.json();
      if (data.success && data.party) {
        return data.party;
      }
      return null;
    } catch {
      // Offline fallback: generate instant party object
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = 'WP-';
      for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));

      return {
        partyCode: code,
        name,
        description,
        hostId: currentUser.userId,
        hostName: currentUser.name,
        members: [{
          userId: currentUser.userId,
          name: currentUser.name,
          isHost: true,
          isMuted: true,
          isSpeaking: false,
          inVoice: false
        }],
        mediaInfo: { title: 'Netflix Stream', episodeInfo: '' },
        playbackState: { isPlaying: false, currentTime: 0, lastUpdated: Date.now() },
        settings: { onlyHostCanControl: onlyHost, isVoiceEnabled: true, maxMembers: 20 },
        isActive: true
      };
    }
  };

  const handleEnterParty = async (party: Party) => {
    const res = await socketService.joinParty(party.partyCode, currentUser);
    if (res.success && res.party) {
      setActiveParty(res.party);
      if (res.messages) setMessages(res.messages);
      setViewMode('active');
      await StorageService.setActivePartyCode(party.partyCode);
      addToast('success', `Joined party ${party.partyCode}`);
    } else {
      setActiveParty(party);
      setViewMode('active');
      await StorageService.setActivePartyCode(party.partyCode);
    }
  };

  const handleJoinParty = async (code: string) => {
    return await socketService.joinParty(code, currentUser);
  };

  const handleLeaveParty = async () => {
    if (inVoice) {
      voiceService.stopVoice();
      setInVoice(false);
    }
    socketService.leaveParty();
    setActiveParty(null);
    setMessages([]);
    await StorageService.setActivePartyCode(null);
    setViewMode('welcome');
    addToast('info', 'Left the watch party');
  };

  const handleSendMessage = async (text: string, type: 'chat' | 'sticker' = 'chat', stickerUrl?: string) => {
    await socketService.sendMessage(text, type, stickerUrl);
  };

  const handleTogglePlay = () => {
    if (!activeParty) return;
    const targetState = !activeParty.playbackState.isPlaying;
    const currentTime = activeParty.playbackState.currentTime;

    if (targetState) {
      socketService.sendPlay(currentTime);
    } else {
      socketService.sendPause(currentTime);
    }
  };

  const handleForceSync = () => {
    if (!activeParty) return;
    sendToActiveNetflixTab({
      type: 'NETFLIX_EXECUTE_SEEK',
      payload: { position: activeParty.playbackState.currentTime }
    });
    addToast('info', 'Resynced with watch party');
  };

  // Voice permission & speaking listener
  useEffect(() => {
    voiceService.setOnPermissionGranted(async () => {
      const res = await voiceService.startVoice();
      if (res.success) {
        setInVoice(true);
        setIsMuted(false);
        setActiveParty(prev => {
          if (!prev) return null;
          return {
            ...prev,
            members: prev.members.map(m => m.userId === currentUser.userId ? { ...m, inVoice: true, isMuted: false } : m)
          };
        });
        addToast('success', 'Microphone enabled! Connected to voice chat.');
      }
    });

    voiceService.setOnSpeakingChange((speaking) => {
      setIsSpeaking(speaking);
      setActiveParty(prev => {
        if (!prev) return null;
        return {
          ...prev,
          members: prev.members.map(m => m.userId === currentUser.userId ? { ...m, isSpeaking: speaking } : m)
        };
      });
    });
  }, [currentUser.userId]);

  const handleToggleVoice = async () => {
    if (inVoice) {
      voiceService.stopVoice();
      setInVoice(false);
      setIsMuted(true);
      setIsSpeaking(false);
      setActiveParty(prev => {
        if (!prev) return null;
        return {
          ...prev,
          members: prev.members.map(m => m.userId === currentUser.userId ? { ...m, inVoice: false, isSpeaking: false } : m)
        };
      });
      addToast('info', 'Disconnected from voice chat');
    } else {
      const res = await voiceService.startVoice();
      if (res.success) {
        setInVoice(true);
        setIsMuted(false);
        setActiveParty(prev => {
          if (!prev) return null;
          return {
            ...prev,
            members: prev.members.map(m => m.userId === currentUser.userId ? { ...m, inVoice: true, isMuted: false } : m)
          };
        });
        addToast('success', 'Connected to voice chat');
      } else {
        if (res.requiresPermissionTab) {
          addToast('info', 'Please click "Allow" on the opened tab to enable microphone.');
        } else {
          addToast('error', res.error || 'Failed to access microphone');
        }
      }
    }
  };

  const handleToggleMute = () => {
    const muted = voiceService.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="w-full h-screen bg-[#0d0e12] flex flex-col text-slate-100 overflow-hidden select-none">
      {viewMode === 'welcome' && (
        <WelcomeView
          userName={currentUser.name}
          onSaveUserName={handleSaveUserName}
          onCreateClick={() => setViewMode('create')}
          onJoinClick={() => setViewMode('join')}
          isNetflixActive={isNetflixActive}
        />
      )}

      {viewMode === 'create' && (
        <CreatePartyView
          userName={currentUser.name}
          onBack={() => setViewMode('welcome')}
          onCreateParty={handleCreateParty}
          onEnterParty={handleEnterParty}
        />
      )}

      {viewMode === 'join' && (
        <JoinPartyView
          onBack={() => setViewMode('welcome')}
          onJoinParty={handleJoinParty}
          onPartyJoined={handleEnterParty}
        />
      )}

      {viewMode === 'active' && activeParty && (
        <ActivePartyView
          party={activeParty}
          currentUserId={currentUser.userId}
          connectionStatus={connectionStatus}
          messages={messages}
          inVoice={inVoice}
          isMuted={isMuted}
          isSpeaking={isSpeaking}
          onLeaveParty={handleLeaveParty}
          onSendMessage={handleSendMessage}
          onTogglePlay={handleTogglePlay}
          onForceSync={handleForceSync}
          onToggleVoice={handleToggleVoice}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Toast alert system */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
