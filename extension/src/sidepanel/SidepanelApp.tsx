import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Party, User, ChatMessage, ConnectionStatus, SyncEventPayload } from '../types';
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

  // Helper to send message to Netflix tab
  const sendToEngine = useCallback((message: any): Promise<any> => {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.tabs) {
        resolve({ success: false });
        return;
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
        const activeTab = activeTabs && activeTabs[0];
        if (activeTab && activeTab.id && activeTab.url && activeTab.url.includes('netflix.com')) {
          chrome.tabs.sendMessage(activeTab.id, message, (response) => {
            if (!chrome.runtime.lastError && response) {
              resolve(response);
              return;
            }
            // Fallback to searching all netflix tabs
            queryAllNetflixTabs(message, resolve);
          });
        } else {
          queryAllNetflixTabs(message, resolve);
        }
      });
    });
  }, []);

  const queryAllNetflixTabs = (message: any, resolve: (val: any) => void) => {
    chrome.tabs.query({ url: '*://*.netflix.com/*' }, (tabs) => {
      if (tabs && tabs.length > 0 && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
          if (chrome.runtime.lastError) resolve({ success: false });
          else resolve(response || { success: true });
        });
      } else {
        resolve({ success: false });
      }
    });
  };

  // 1. Initialize user, check active Netflix tab, and load active party state
  useEffect(() => {
    const init = async () => {
      let user = await StorageService.getUser();
      if (!user) {
        user = {
          userId: `usr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: `Watcher_${Math.floor(100 + Math.random() * 900)}`
        };
        await StorageService.setUser(user);
      }
      setCurrentUser(user);

      // Check Netflix active tab
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const url = tabs[0]?.url || '';
          setIsNetflixActive(url.includes('netflix.com'));
        });
      }

      // Check active party session
      const activeCode = await StorageService.getActivePartyCode();
      const savedSession = await StorageService.getPartySession();
      if (activeCode) {
        const party = savedSession?.party || {
          partyCode: activeCode,
          name: 'Watch Party',
          hostId: user.userId,
          hostName: user.name,
          members: [{
            userId: user.userId,
            name: user.name,
            isHost: true,
            isMuted: true,
            isSpeaking: false,
            inVoice: false
          }],
          mediaInfo: { title: 'Netflix Stream' },
          playbackState: { isPlaying: false, currentTime: 0, lastUpdated: Date.now() },
          settings: { onlyHostCanControl: false, isVoiceEnabled: true, maxMembers: 20 },
          isActive: true
        };

        setActiveParty(party);
        if (savedSession?.messages && savedSession.messages.length > 0) {
          setMessages(savedSession.messages);
        }
        if (savedSession?.inVoice !== undefined) setInVoice(savedSession.inVoice);
        if (savedSession?.isMuted !== undefined) setIsMuted(savedSession.isMuted);
        if (savedSession?.isSpeaking !== undefined) setIsSpeaking(savedSession.isSpeaking);
        setConnectionStatus(savedSession?.connectionStatus || 'connected');
        setViewMode('active');

        // 1. Re-join socket directly in Sidepanel for instant connection
        socketService.joinParty(activeCode, user).then((res) => {
          if (res && res.success && res.party) {
            setActiveParty(res.party);
            if (res.messages && res.messages.length > 0) {
              setMessages((prev) => {
                const map = new Map<string, ChatMessage>();
                prev.forEach(m => map.set(m.id, m));
                res.messages!.forEach((m: ChatMessage) => map.set(m.id, m));
                return Array.from(map.values());
              });
            }
          }
        }).catch(() => {});

        // 2. Also sync with live PartyEngine on Netflix tab
        sendToEngine({
          type: 'ENGINE_JOIN_PARTY',
          payload: { partyCode: activeCode, user }
        }).then(() => {
          sendToEngine({ type: 'GET_PARTY_ENGINE_STATE' }).then((resp) => {
            if (resp && resp.success && resp.state) {
              const st = resp.state;
              if (st.party) setActiveParty(st.party);
              if (st.messages && st.messages.length > 0) {
                setMessages((prev) => {
                  const map = new Map<string, ChatMessage>();
                  prev.forEach(m => map.set(m.id, m));
                  st.messages.forEach((m: ChatMessage) => map.set(m.id, m));
                  return Array.from(map.values());
                });
              }
              if (st.inVoice !== undefined) setInVoice(st.inVoice);
              if (st.isMuted !== undefined) setIsMuted(st.isMuted);
              if (st.isSpeaking !== undefined) setIsSpeaking(st.isSpeaking);
              setConnectionStatus(st.connectionStatus || 'connected');
            }
          });
        }).catch(() => {});
      }
    };

    init();
  }, [sendToEngine]);

  // 2. Real-time Socket.IO Subscriptions (Direct sidepanel events)
  useEffect(() => {
    const unsubStatus = socketService.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    const unsubChat = socketService.onChatMessage((msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    const unsubMemberJoined = socketService.onMemberJoined(({ member }) => {
      setActiveParty((prev) => {
        if (!prev) return null;
        const exists = prev.members.some((m) => m.userId === member.userId);
        if (exists) return prev;
        return { ...prev, members: [...prev.members, member] };
      });
      addToast('info', `${member.name} joined the watch party`);
    });

    const unsubMemberLeft = socketService.onMemberLeft(({ userId, name, newHostId }) => {
      setActiveParty((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          hostId: newHostId || prev.hostId,
          members: prev.members.filter((m) => m.userId !== userId)
        };
      });
      addToast('info', `${name} left the watch party`);
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

    const unsubPlay = socketService.onPlay((payload: SyncEventPayload) => {
      setActiveParty((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          playbackState: { ...prev.playbackState, isPlaying: true, currentTime: payload.position, lastUpdated: Date.now() }
        };
      });
      sendToEngine({ type: 'NETFLIX_EXECUTE_PLAY', payload });
    });

    const unsubPause = socketService.onPause((payload: SyncEventPayload) => {
      setActiveParty((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          playbackState: { ...prev.playbackState, isPlaying: false, currentTime: payload.position, lastUpdated: Date.now() }
        };
      });
      sendToEngine({ type: 'NETFLIX_EXECUTE_PAUSE', payload });
    });

    const unsubSeek = socketService.onSeek((payload: SyncEventPayload) => {
      setActiveParty((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          playbackState: { ...prev.playbackState, currentTime: payload.position, lastUpdated: Date.now() }
        };
      });
      sendToEngine({ type: 'NETFLIX_EXECUTE_SEEK', payload });
    });

    // 3. Listen to messages from Netflix tab content script
    const handleRuntimeMessage = (message: any) => {
      if (message.type === 'PARTY_ENGINE_STATE_CHANGED' && message.payload) {
        const session = message.payload;
        if (session.party) {
          setActiveParty(session.party);
          setViewMode('active');
        } else {
          setActiveParty(null);
          setViewMode('welcome');
        }
        if (session.messages !== undefined && session.messages.length > 0) {
          setMessages((prev) => {
            const map = new Map<string, ChatMessage>();
            prev.forEach(m => map.set(m.id, m));
            session.messages.forEach((m: ChatMessage) => map.set(m.id, m));
            return Array.from(map.values());
          });
        }
        if (session.inVoice !== undefined) setInVoice(session.inVoice);
        if (session.isMuted !== undefined) setIsMuted(session.isMuted);
        if (session.isSpeaking !== undefined) setIsSpeaking(session.isSpeaking);
        if (session.connectionStatus !== undefined) setConnectionStatus(session.connectionStatus);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    }

    return () => {
      unsubStatus();
      unsubChat();
      unsubMemberJoined();
      unsubMemberLeft();
      unsubVoiceJoined();
      unsubVoiceLeft();
      unsubVoiceSpeaking();
      unsubVoiceState();
      unsubPlay();
      unsubPause();
      unsubSeek();
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      }
    };
  }, [currentUser.userId, sendToEngine]);

  // Handlers
  const handleSaveUserName = async (name: string) => {
    const updated = { ...currentUser, name };
    setCurrentUser(updated);
    await StorageService.setUser(updated);
  };

  const handleCreateParty = async (name: string, description: string, onlyHost: boolean): Promise<Party | null> => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'WP-';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));

    const newParty: Party = {
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
      mediaInfo: { title: 'Netflix Stream' },
      playbackState: { isPlaying: false, currentTime: 0, lastUpdated: Date.now() },
      settings: { onlyHostCanControl: onlyHost, isVoiceEnabled: true, maxMembers: 20 },
      isActive: true
    };

    await StorageService.setActivePartyCode(code);
    await StorageService.setPartySession({ party: newParty, currentUser, messages: [] });
    setActiveParty(newParty);
    setViewMode('active');

    // Join on socket
    socketService.joinParty(code, currentUser).catch(() => {});

    // Notify Netflix tab engine to join the exact same party
    sendToEngine({
      type: 'ENGINE_JOIN_PARTY',
      payload: { partyCode: code, user: currentUser }
    });

    return newParty;
  };

  const handleEnterParty = async (party: Party) => {
    setActiveParty(party);
    setViewMode('active');
    await StorageService.setActivePartyCode(party.partyCode);
    await StorageService.setPartySession({ party, currentUser, messages, inVoice, isMuted });

    socketService.joinParty(party.partyCode, currentUser).catch(() => {});

    sendToEngine({
      type: 'ENGINE_JOIN_PARTY',
      payload: { partyCode: party.partyCode, user: currentUser }
    });
    addToast('success', `Joined party ${party.partyCode}`);
  };

  const handleJoinParty = async (code: string) => {
    const res = await socketService.joinParty(code, currentUser);

    const partyToUse = (res && res.success && res.party) ? res.party : {
      partyCode: code,
      name: 'Watch Party',
      hostId: currentUser.userId,
      hostName: currentUser.name,
      members: [{
        userId: currentUser.userId,
        name: currentUser.name,
        isHost: false,
        isMuted: true,
        isSpeaking: false,
        inVoice: false
      }],
      mediaInfo: { title: 'Netflix Stream' },
      playbackState: { isPlaying: false, currentTime: 0, lastUpdated: Date.now() },
      settings: { onlyHostCanControl: false, isVoiceEnabled: true, maxMembers: 20 },
      isActive: true
    };

    await StorageService.setActivePartyCode(code);
    await StorageService.setPartySession({ party: partyToUse, currentUser, messages: res?.messages || [] });
    setActiveParty(partyToUse);
    if (res?.messages) setMessages(res.messages);
    setViewMode('active');

    sendToEngine({
      type: 'ENGINE_JOIN_PARTY',
      payload: { partyCode: code, user: currentUser }
    });

    return { success: true, party: partyToUse };
  };

  const handleLeaveParty = async () => {
    socketService.leaveParty();
    await sendToEngine({ type: 'ENGINE_LEAVE_PARTY' });
    setActiveParty(null);
    setMessages([]);
    setInVoice(false);
    setIsMuted(true);
    setIsSpeaking(false);
    await StorageService.setActivePartyCode(null);
    await StorageService.setPartySession(null);
    setViewMode('welcome');
    addToast('info', 'Left the watch party');
  };

  const handleSendMessage = async (text: string, type: 'chat' | 'sticker' = 'chat', stickerUrl?: string) => {
    if (!text && !stickerUrl) return;

    if (activeParty && currentUser) {
      if (!socketService.getSocket()?.connected) {
        await socketService.joinParty(activeParty.partyCode, currentUser);
      }
    }

    // Direct socket send - server broadcasts to room and updates all tabs/sidepanels seamlessly
    await socketService.sendMessage(text, type, stickerUrl).catch(() => {});
  };

  const handleTogglePlay = () => {
    if (activeParty) {
      const pos = activeParty.playbackState.currentTime;
      if (activeParty.playbackState.isPlaying) {
        socketService.sendPause(pos);
      } else {
        socketService.sendPlay(pos);
      }
    }
    sendToEngine({ type: 'ENGINE_TOGGLE_PLAY' });
  };

  const handleForceSync = () => {
    if (activeParty) {
      socketService.sendSeek(activeParty.playbackState.currentTime);
    }
    sendToEngine({ type: 'ENGINE_FORCE_SYNC' });
    addToast('info', 'Resynced with watch party');
  };

  const handleToggleVoice = async () => {
    // Forward to persistent Netflix Tab Engine
    const engineRes = await sendToEngine({ type: 'ENGINE_TOGGLE_VOICE' });
    if (engineRes && engineRes.success) {
      if (engineRes.inVoice) {
        setInVoice(true);
        setIsMuted(false);
        addToast('success', 'Connected to voice chat');
      } else {
        setInVoice(false);
        setIsMuted(true);
        setIsSpeaking(false);
        addToast('info', 'Disconnected from voice chat');
      }
    } else {
      // Fallback if no Netflix tab is currently open
      if (inVoice) {
        voiceService.stopVoice();
        setInVoice(false);
        setIsMuted(true);
        setIsSpeaking(false);
        addToast('info', 'Disconnected from voice chat');
      } else {
        const localRes = await voiceService.startVoice();
        if (localRes.success) {
          setInVoice(true);
          setIsMuted(false);
          addToast('success', 'Connected to voice chat');
        } else if (localRes.requiresPermissionTab) {
          voiceService.openPermissionTab();
          addToast('info', 'Please click "Allow" on the opened tab to enable microphone.');
        } else {
          addToast('error', localRes.error || 'Failed to access microphone');
        }
      }
    }
  };

  const handleToggleMute = async () => {
    const engineRes = await sendToEngine({ type: 'ENGINE_TOGGLE_MUTE' });
    if (engineRes && engineRes.success) {
      setIsMuted(engineRes.isMuted);
    } else {
      const muted = voiceService.toggleMute();
      setIsMuted(muted);
    }
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
