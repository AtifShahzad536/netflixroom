export interface User {
  userId: string;
  name: string;
  avatar?: string;
}

export interface Member extends User {
  isHost: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  inVoice: boolean;
  socketId?: string;
  lastActive?: string;
}

export interface MediaInfo {
  title: string;
  episodeInfo?: string;
  videoUrl?: string;
  duration?: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  lastUpdated: string | number | Date;
  controlledBy?: string;
}

export interface PartySettings {
  onlyHostCanControl: boolean;
  isVoiceEnabled: boolean;
  maxMembers: number;
}

export interface Party {
  partyCode: string;
  name: string;
  description?: string;
  hostId: string;
  hostName: string;
  members: Member[];
  mediaInfo: MediaInfo;
  playbackState: PlaybackState;
  settings: PartySettings;
  isActive?: boolean;
}

export interface ChatMessage {
  id: string;
  partyCode: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  type: 'chat' | 'system' | 'action' | 'sticker';
  stickerUrl?: string;
  timestamp: string;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting' | 'offline';

export interface VoiceState {
  isConnected: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  participants: Map<string, { userId: string; isMuted: boolean; isSpeaking: boolean }>;
}

export interface SyncEventPayload {
  position: number;
  timestamp?: number;
  issuer?: string;
  origin: 'local' | 'remote';
}

// Chrome runtime extension message contracts
export type ExtensionAction =
  | { type: 'NETFLIX_GET_STATUS' }
  | { type: 'NETFLIX_STATUS_UPDATE'; payload: { isNetflix: boolean; isPlaying: boolean; currentTime: number; duration: number; mediaInfo: MediaInfo } }
  | { type: 'NETFLIX_EXECUTE_PLAY'; payload: { position: number } }
  | { type: 'NETFLIX_EXECUTE_PAUSE'; payload: { position: number } }
  | { type: 'NETFLIX_EXECUTE_SEEK'; payload: { position: number } }
  | { type: 'NETFLIX_LOCAL_PLAY'; payload: { position: number } }
  | { type: 'NETFLIX_LOCAL_PAUSE'; payload: { position: number } }
  | { type: 'NETFLIX_LOCAL_SEEK'; payload: { position: number } }
  | { type: 'OPEN_SIDEPANEL' };
