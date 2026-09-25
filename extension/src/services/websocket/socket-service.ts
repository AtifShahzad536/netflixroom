import { io, Socket } from 'socket.io-client';
import { Party, ChatMessage, ConnectionStatus, Member, User, SyncEventPayload } from '../../types';

type EventHandler<T> = (data: T) => void;

class SocketService {
  private socket: Socket | null = null;
  private url: string;
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private playListeners: Set<EventHandler<SyncEventPayload>> = new Set();
  private pauseListeners: Set<EventHandler<SyncEventPayload>> = new Set();
  private seekListeners: Set<EventHandler<SyncEventPayload>> = new Set();
  private chatListeners: Set<EventHandler<ChatMessage>> = new Set();
  private memberJoinedListeners: Set<EventHandler<{ member: Member; totalMembers: number }>> = new Set();
  private memberLeftListeners: Set<EventHandler<{ userId: string; name: string; newHostId?: string; totalMembers: number }>> = new Set();
  private voiceJoinedListeners: Set<EventHandler<{ userId: string; name: string; socketId: string }>> = new Set();
  private voiceLeftListeners: Set<EventHandler<{ userId: string }>> = new Set();
  private voiceSpeakingListeners: Set<EventHandler<{ userId: string; isSpeaking: boolean }>> = new Set();
  private voiceStateListeners: Set<EventHandler<{ userId: string; isMuted: boolean; isSpeaking: boolean }>> = new Set();
  private mediaUpdateListeners: Set<EventHandler<any>> = new Set();

  constructor() {
    this.url = (import.meta as any).env?.VITE_WS_URL || 'https://netflixroom.vercel.app';
  }

  public connect(): Socket {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    this.notifyStatus('connecting');

    this.socket = io(this.url, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    this.socket.on('connect', () => {
      this.notifyStatus('connected');
    });

    this.socket.on('connect_error', () => {
      this.notifyStatus('offline');
    });

    this.socket.on('disconnect', () => {
      this.notifyStatus('disconnected');
    });

    this.socket.io.on('reconnect_attempt', () => {
      this.notifyStatus('reconnecting');
    });

    // Real-time Event Subscriptions
    this.socket.on('sync:play', (data: SyncEventPayload) => {
      this.playListeners.forEach(cb => cb(data));
    });

    this.socket.on('sync:pause', (data: SyncEventPayload) => {
      this.pauseListeners.forEach(cb => cb(data));
    });

    this.socket.on('sync:seek', (data: SyncEventPayload) => {
      this.seekListeners.forEach(cb => cb(data));
    });

    this.socket.on('sync:media-update', (data: any) => {
      this.mediaUpdateListeners.forEach(cb => cb(data));
    });

    this.socket.on('chat:message', (message: ChatMessage) => {
      this.chatListeners.forEach(cb => cb(message));
    });

    this.socket.on('party:member-joined', (data) => {
      this.memberJoinedListeners.forEach(cb => cb(data));
    });

    this.socket.on('party:member-left', (data) => {
      this.memberLeftListeners.forEach(cb => cb(data));
    });

    this.socket.on('voice:user-joined', (data) => {
      this.voiceJoinedListeners.forEach(cb => cb(data));
    });

    this.socket.on('voice:user-left', (data) => {
      this.voiceLeftListeners.forEach(cb => cb(data));
    });

    this.socket.on('voice:speaking', (data) => {
      this.voiceSpeakingListeners.forEach(cb => cb(data));
    });

    this.socket.on('voice:state-change', (data) => {
      this.voiceStateListeners.forEach(cb => cb(data));
    });

    return this.socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public joinParty(partyCode: string, user: User): Promise<{ success: boolean; party?: Party; messages?: ChatMessage[]; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket || !this.socket.connected) {
        this.connect();
      }

      this.socket?.emit('party:join', { partyCode, user }, (response: any) => {
        resolve(response || { success: false, error: 'No response from server' });
      });
    });
  }

  public leaveParty(): void {
    if (this.socket) {
      this.socket.emit('party:leave');
    }
  }

  public sendPlay(position: number): void {
    this.socket?.emit('sync:play', { position });
  }

  public sendPause(position: number): void {
    this.socket?.emit('sync:pause', { position });
  }

  public sendSeek(position: number): void {
    this.socket?.emit('sync:seek', { position });
  }

  public sendMediaUpdate(mediaInfo: any): void {
    this.socket?.emit('sync:media-update', mediaInfo);
  }

  public sendMessage(text: string, type: 'chat' | 'sticker' = 'chat', stickerUrl?: string): Promise<{ success: boolean; message?: ChatMessage }> {
    return new Promise((resolve) => {
      this.socket?.emit('chat:message', { text, type, stickerUrl }, (res: any) => {
        resolve(res || { success: false });
      });
    });
  }

  public joinVoice(): void {
    this.socket?.emit('voice:join');
  }

  public leaveVoice(): void {
    this.socket?.emit('voice:leave');
  }

  public setVoiceMute(isMuted: boolean): void {
    this.socket?.emit('voice:mute', isMuted);
  }

  public setVoiceSpeaking(isSpeaking: boolean): void {
    this.socket?.emit('voice:speaking', isSpeaking);
  }

  // Listener registrations
  public onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  public onPlay(callback: EventHandler<SyncEventPayload>): () => void {
    this.playListeners.add(callback);
    return () => this.playListeners.delete(callback);
  }

  public onPause(callback: EventHandler<SyncEventPayload>): () => void {
    this.pauseListeners.add(callback);
    return () => this.pauseListeners.delete(callback);
  }

  public onSeek(callback: EventHandler<SyncEventPayload>): () => void {
    this.seekListeners.add(callback);
    return () => this.seekListeners.delete(callback);
  }

  public onChatMessage(callback: EventHandler<ChatMessage>): () => void {
    this.chatListeners.add(callback);
    return () => this.chatListeners.delete(callback);
  }

  public onMemberJoined(callback: EventHandler<{ member: Member; totalMembers: number }>): () => void {
    this.memberJoinedListeners.add(callback);
    return () => this.memberJoinedListeners.delete(callback);
  }

  public onMemberLeft(callback: EventHandler<{ userId: string; name: string; newHostId?: string; totalMembers: number }>): () => void {
    this.memberLeftListeners.add(callback);
    return () => this.memberLeftListeners.delete(callback);
  }

  public onVoiceJoined(callback: EventHandler<{ userId: string; name: string; socketId: string }>): () => void {
    this.voiceJoinedListeners.add(callback);
    return () => this.voiceJoinedListeners.delete(callback);
  }

  public onVoiceLeft(callback: EventHandler<{ userId: string }>): () => void {
    this.voiceLeftListeners.add(callback);
    return () => this.voiceLeftListeners.delete(callback);
  }

  public onVoiceSpeaking(callback: EventHandler<{ userId: string; isSpeaking: boolean }>): () => void {
    this.voiceSpeakingListeners.add(callback);
    return () => this.voiceSpeakingListeners.delete(callback);
  }

  public onVoiceStateChange(callback: EventHandler<{ userId: string; isMuted: boolean; isSpeaking: boolean }>): () => void {
    this.voiceStateListeners.add(callback);
    return () => this.voiceStateListeners.delete(callback);
  }

  public onMediaUpdate(callback: EventHandler<any>): () => void {
    this.mediaUpdateListeners.add(callback);
    return () => this.mediaUpdateListeners.delete(callback);
  }

  private notifyStatus(status: ConnectionStatus): void {
    this.statusListeners.forEach(cb => cb(status));
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
