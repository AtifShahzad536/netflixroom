import { Party, User, ChatMessage, ConnectionStatus, Member, SyncEventPayload } from '../types';
import { socketService } from '../services/websocket/socket-service';
import { voiceService } from '../services/webrtc/voice-service';
import { StorageService } from '../services/storage/storage-service';
import { NetflixAdapter } from '../services/netflix/netflix-adapter';
import { floatingOverlay } from './floating-overlay';

export class PartyEngine {
  private static instance: PartyEngine;
  private adapter: NetflixAdapter;
  private currentUser: User | null = null;
  private activeParty: Party | null = null;
  private messages: ChatMessage[] = [];
  private inVoice: boolean = false;
  private isMuted: boolean = true;
  private isSpeaking: boolean = false;
  private connectionStatus: ConnectionStatus = 'disconnected';

  private constructor() {
    this.adapter = NetflixAdapter.getInstance();
    this.init();
  }

  public static getInstance(): PartyEngine {
    if (!PartyEngine.instance) {
      PartyEngine.instance = new PartyEngine();
    }
    return PartyEngine.instance;
  }

  private async init(): Promise<void> {
    // 1. Load user
    const savedUser = await StorageService.getUser();
    if (savedUser) {
      this.currentUser = savedUser;
    } else {
      const defaultUser: User = {
        userId: `usr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: `Watcher_${Math.floor(100 + Math.random() * 900)}`
      };
      this.currentUser = defaultUser;
      await StorageService.setUser(defaultUser);
    }

    // 2. Setup WebRTC voice callbacks
    voiceService.setOnSpeakingChange((speaking) => {
      this.isSpeaking = speaking;
      if (this.activeParty && this.currentUser) {
        this.activeParty.members = this.activeParty.members.map((m) =>
          m.userId === this.currentUser?.userId ? { ...m, isSpeaking: speaking } : m
        );
      }
      this.syncState(false);
    });

    voiceService.setOnPermissionGranted(async () => {
      const res = await voiceService.startVoice();
      if (res.success) {
        this.inVoice = true;
        this.isMuted = false;
        if (this.activeParty && this.currentUser) {
          this.activeParty.members = this.activeParty.members.map((m) =>
            m.userId === this.currentUser?.userId ? { ...m, inVoice: true, isMuted: false } : m
          );
        }
        this.syncState(true);
      }
    });

    // 3. Setup Socket.IO signaling & event subscriptions
    this.setupSocketListeners();

    // 4. Setup Chrome storage listener to react to Sidepanel actions
    this.setupStorageListeners();

    // 5. Auto-restore active party session from storage if present
    const activeCode = await StorageService.getActivePartyCode();
    const savedSession = await StorageService.getPartySession();
    if (activeCode && this.currentUser) {
      if (savedSession && savedSession.party && savedSession.party.partyCode === activeCode) {
        this.activeParty = savedSession.party;
        this.messages = savedSession.messages || [];
        this.inVoice = !!savedSession.inVoice;
        this.isMuted = savedSession.isMuted !== undefined ? savedSession.isMuted : true;
        this.syncState();
      }

      // Reconnect socket to keep fresh sync in Netflix tab
      this.joinParty(activeCode, this.currentUser).then(() => {
        if (savedSession?.inVoice && !this.inVoice) {
          this.toggleVoice().catch(() => {});
        }
      }).catch(() => {});
    } else {
      this.syncState();
    }
  }

  private setupStorageListeners(): void {
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(async (changes, area) => {
        if (area === 'local') {
          if (changes['netflix_wp_user']?.newValue) {
            this.currentUser = changes['netflix_wp_user'].newValue;
          }

          if (changes['netflix_wp_active_party'] || changes['netflix_wp_active_party_code']) {
            const newCode = changes['netflix_wp_active_party']?.newValue || changes['netflix_wp_active_party_code']?.newValue;
            if (!newCode && this.activeParty) {
              this.leaveParty();
            } else if (newCode && (!this.activeParty || this.activeParty.partyCode !== newCode)) {
              if (this.currentUser) {
                await this.joinParty(newCode, this.currentUser);
              }
            }
          }

          if (changes['netflix_wp_party_session']) {
            const newSession = changes['netflix_wp_party_session'].newValue;
            if (newSession && newSession.party) {
              if (!this.currentUser && newSession.currentUser) {
                this.currentUser = newSession.currentUser;
              }
              if (!this.activeParty || this.activeParty.partyCode !== newSession.party.partyCode) {
                const targetUser = this.currentUser || newSession.currentUser;
                if (targetUser) {
                  await this.joinParty(newSession.party.partyCode, targetUser);
                }
              }
            } else if (!newSession && this.activeParty) {
              this.leaveParty();
            }
          }
        }
      });
    }
  }

  private setupSocketListeners(): void {
    socketService.onStatusChange((status) => {
      this.connectionStatus = status;
      this.syncState();
    });

    socketService.onPlay((payload: SyncEventPayload) => {
      if (this.activeParty) {
        this.activeParty.playbackState = {
          ...this.activeParty.playbackState,
          isPlaying: true,
          currentTime: payload.position,
          lastUpdated: Date.now()
        };
      }
      if (typeof payload.position === 'number') {
        this.adapter.seek(payload.position);
      }
      this.adapter.play();
      this.syncState();
    });

    socketService.onPause((payload: SyncEventPayload) => {
      if (this.activeParty) {
        this.activeParty.playbackState = {
          ...this.activeParty.playbackState,
          isPlaying: false,
          currentTime: payload.position,
          lastUpdated: Date.now()
        };
      }
      if (typeof payload.position === 'number') {
        this.adapter.seek(payload.position);
      }
      this.adapter.pause();
      this.syncState();
    });

    socketService.onSeek((payload: SyncEventPayload) => {
      if (this.activeParty) {
        this.activeParty.playbackState = {
          ...this.activeParty.playbackState,
          currentTime: payload.position,
          lastUpdated: Date.now()
        };
      }
      if (typeof payload.position === 'number') {
        this.adapter.seek(payload.position);
      }
      this.syncState();
    });

    socketService.onChatMessage((msg: ChatMessage) => {
      if (!this.messages.some(m => m.id === msg.id)) {
        this.messages = [...this.messages, msg];
        this.syncState();
      }
    });

    socketService.onMemberJoined(({ member }) => {
      if (this.activeParty) {
        const exists = this.activeParty.members.some((m) => m.userId === member.userId);
        if (!exists) {
          this.activeParty.members = [...this.activeParty.members, member];
        }
      }
      this.syncState();
    });

    socketService.onMemberLeft(({ userId, newHostId }) => {
      if (this.activeParty) {
        this.activeParty.members = this.activeParty.members.filter((m) => m.userId !== userId);
        if (newHostId) {
          this.activeParty.hostId = newHostId;
        }
      }
      this.syncState();
    });

    socketService.onVoiceJoined(({ userId }) => {
      if (this.activeParty) {
        this.activeParty.members = this.activeParty.members.map((m) =>
          m.userId === userId ? { ...m, inVoice: true, isMuted: false } : m
        );
      }
      this.syncState();
    });

    socketService.onVoiceLeft(({ userId }) => {
      if (this.activeParty) {
        this.activeParty.members = this.activeParty.members.map((m) =>
          m.userId === userId ? { ...m, inVoice: false, isSpeaking: false } : m
        );
      }
      this.syncState();
    });

    socketService.onVoiceSpeaking(({ userId, isSpeaking: speaking }) => {
      if (this.activeParty) {
        this.activeParty.members = this.activeParty.members.map((m) =>
          m.userId === userId ? { ...m, isSpeaking: speaking } : m
        );
      }
      if (userId === this.currentUser?.userId) {
        this.isSpeaking = speaking;
      }
      this.syncState(false);
    });

    socketService.onVoiceStateChange(({ userId, isMuted: muted }) => {
      if (this.activeParty) {
        this.activeParty.members = this.activeParty.members.map((m) =>
          m.userId === userId ? { ...m, isMuted: muted } : m
        );
      }
      this.syncState(true);
    });

    socketService.onMediaUpdate((mediaInfo) => {
      if (this.activeParty) {
        this.activeParty.mediaInfo = mediaInfo;
      }
      this.syncState(true);
    });
  }

  public syncState(persistToStorage: boolean = true): void {
    const session = {
      party: this.activeParty,
      inVoice: this.inVoice,
      isMuted: this.isMuted,
      isSpeaking: this.isSpeaking,
      messages: this.messages,
      currentUser: this.currentUser,
      connectionStatus: this.connectionStatus
    };

    // Update Storage for non-transient state
    if (persistToStorage) {
      StorageService.setPartySession(session).catch(() => {});
    }

    // Update Floating Overlay on Netflix
    floatingOverlay.updateState(session);

    // Notify Extension Runtime (Sidepanel)
    chrome.runtime.sendMessage({
      type: 'PARTY_ENGINE_STATE_CHANGED',
      payload: session
    }).catch(() => {});
  }

  public getState() {
    return {
      party: this.activeParty,
      inVoice: this.inVoice,
      isMuted: this.isMuted,
      isSpeaking: this.isSpeaking,
      messages: this.messages,
      currentUser: this.currentUser,
      connectionStatus: this.connectionStatus
    };
  }

  public async joinParty(partyCode: string, user?: User): Promise<{ success: boolean; party?: Party; messages?: ChatMessage[]; error?: string }> {
    const targetUser = user || this.currentUser!;
    this.currentUser = targetUser;
    await StorageService.setUser(targetUser);

    const res = await socketService.joinParty(partyCode, targetUser);
    if (res.success && res.party) {
      this.activeParty = res.party;
      if (res.messages) this.messages = res.messages;
      await StorageService.setActivePartyCode(res.party.partyCode);
      this.syncState();
      return res;
    } else {
      // Fallback offline party
      const fallbackParty: Party = {
        partyCode,
        name: 'Watch Party',
        hostId: targetUser.userId,
        hostName: targetUser.name,
        members: [{
          userId: targetUser.userId,
          name: targetUser.name,
          isHost: true,
          isMuted: true,
          isSpeaking: false,
          inVoice: false
        }],
        mediaInfo: this.adapter.getMediaInfo() || { title: 'Netflix Stream' },
        playbackState: { isPlaying: this.adapter.isPlaying(), currentTime: this.adapter.getCurrentTime(), lastUpdated: Date.now() },
        settings: { onlyHostCanControl: false, isVoiceEnabled: true, maxMembers: 20 },
        isActive: true
      };
      this.activeParty = fallbackParty;
      await StorageService.setActivePartyCode(partyCode);
      this.syncState();
      return { success: true, party: fallbackParty, messages: [] };
    }
  }

  public async createParty(name: string, description: string, onlyHost: boolean): Promise<Party | null> {
    try {
      const apiUrl = (import.meta as any).env?.VITE_API_URL || 'https://netflixroom.vercel.app/api';
      const response = await fetch(`${apiUrl}/party/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          hostId: this.currentUser?.userId,
          hostName: this.currentUser?.name,
          settings: {
            onlyHostCanControl: onlyHost,
            isVoiceEnabled: true,
            maxMembers: 20
          }
        })
      });

      const data = await response.json();
      if (data.success && data.party) {
        await this.joinParty(data.party.partyCode, this.currentUser!);
        return data.party;
      }
      throw new Error('API failed');
    } catch {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = 'WP-';
      for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));

      const party: Party = {
        partyCode: code,
        name,
        description,
        hostId: this.currentUser!.userId,
        hostName: this.currentUser!.name,
        members: [{
          userId: this.currentUser!.userId,
          name: this.currentUser!.name,
          isHost: true,
          isMuted: true,
          isSpeaking: false,
          inVoice: false
        }],
        mediaInfo: this.adapter.getMediaInfo() || { title: 'Netflix Stream' },
        playbackState: { isPlaying: this.adapter.isPlaying(), currentTime: this.adapter.getCurrentTime(), lastUpdated: Date.now() },
        settings: { onlyHostCanControl: onlyHost, isVoiceEnabled: true, maxMembers: 20 },
        isActive: true
      };

      await this.joinParty(code, this.currentUser!);
      return party;
    }
  }

  public leaveParty(): void {
    if (this.inVoice) {
      voiceService.stopVoice();
      this.inVoice = false;
      this.isMuted = true;
      this.isSpeaking = false;
    }
    socketService.leaveParty();
    this.activeParty = null;
    this.messages = [];
    StorageService.setActivePartyCode(null).catch(() => {});
    this.syncState();
  }

  public async toggleVoice(): Promise<void> {
    if (this.inVoice) {
      voiceService.stopVoice();
      this.inVoice = false;
      this.isMuted = true;
      this.isSpeaking = false;
      if (this.activeParty && this.currentUser) {
        this.activeParty.members = this.activeParty.members.map((m) =>
          m.userId === this.currentUser?.userId ? { ...m, inVoice: false, isSpeaking: false } : m
        );
      }
      this.syncState();
    } else {
      const res = await voiceService.startVoice();
      if (res.success) {
        this.inVoice = true;
        this.isMuted = false;
        if (this.activeParty && this.currentUser) {
          this.activeParty.members = this.activeParty.members.map((m) =>
            m.userId === this.currentUser?.userId ? { ...m, inVoice: true, isMuted: false } : m
          );
        }
        this.syncState();
      } else {
        if (res.requiresPermissionTab) {
          voiceService.openPermissionTab();
        }
      }
    }
  }

  public async setVoiceState(inVoice: boolean, isMuted?: boolean): Promise<void> {
    this.inVoice = inVoice;
    if (isMuted !== undefined) {
      this.isMuted = isMuted;
    }
    if (inVoice && !voiceService.getIsConnected()) {
      await voiceService.startVoice();
    } else if (!inVoice && voiceService.getIsConnected()) {
      voiceService.stopVoice();
    }
    if (this.activeParty && this.currentUser) {
      this.activeParty.members = this.activeParty.members.map((m) =>
        m.userId === this.currentUser?.userId ? { ...m, inVoice, isMuted: this.isMuted } : m
      );
    }
    this.syncState();
  }

  public toggleMute(): boolean {
    const muted = voiceService.toggleMute();
    this.isMuted = muted;
    if (this.activeParty && this.currentUser) {
      this.activeParty.members = this.activeParty.members.map((m) =>
        m.userId === this.currentUser?.userId ? { ...m, isMuted: muted } : m
      );
    }
    this.syncState();
    return muted;
  }

  public async sendMessage(text: string, type: 'chat' | 'sticker' = 'chat', stickerUrl?: string): Promise<void> {
    if (!text && !stickerUrl) return;

    if (!this.currentUser) {
      this.currentUser = await StorageService.getUser();
    }
    if (!this.activeParty) {
      const activeCode = await StorageService.getActivePartyCode();
      const savedSession = await StorageService.getPartySession();
      if (savedSession?.party) {
        this.activeParty = savedSession.party;
      } else if (activeCode && this.currentUser) {
        await this.joinParty(activeCode, this.currentUser);
      }
    }

    if (this.activeParty && this.currentUser) {
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        await socketService.joinParty(this.activeParty.partyCode, this.currentUser);
      }
    }

    await socketService.sendMessage(text, type, stickerUrl);
  }

  public togglePlay(): void {
    if (!this.activeParty) return;
    const targetState = !this.activeParty.playbackState.isPlaying;
    const currentTime = this.adapter.getCurrentTime();

    if (targetState) {
      socketService.sendPlay(currentTime);
      this.adapter.play();
    } else {
      socketService.sendPause(currentTime);
      this.adapter.pause();
    }
  }

  public forceSync(): void {
    if (!this.activeParty) return;
    this.adapter.seek(this.activeParty.playbackState.currentTime);
  }

  public handleLocalPlay(position: number): void {
    if (!this.activeParty) return;
    const canControl = !this.activeParty.settings.onlyHostCanControl || this.activeParty.hostId === this.currentUser?.userId;
    if (canControl) {
      socketService.sendPlay(position);
    }
  }

  public handleLocalPause(position: number): void {
    if (!this.activeParty) return;
    const canControl = !this.activeParty.settings.onlyHostCanControl || this.activeParty.hostId === this.currentUser?.userId;
    if (canControl) {
      socketService.sendPause(position);
    }
  }

  public handleLocalSeek(position: number): void {
    if (!this.activeParty) return;
    const canControl = !this.activeParty.settings.onlyHostCanControl || this.activeParty.hostId === this.currentUser?.userId;
    if (canControl) {
      socketService.sendSeek(position);
    }
  }

  public handleMediaUpdate(mediaInfo: any): void {
    if (!this.activeParty) return;
    if (mediaInfo?.title && (!this.activeParty.mediaInfo.title || this.activeParty.mediaInfo.title === 'Netflix Stream')) {
      socketService.sendMediaUpdate(mediaInfo);
    }
  }
}

export const partyEngine = PartyEngine.getInstance();
