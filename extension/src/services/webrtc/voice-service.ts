import { socketService } from '../websocket/socket-service';

export class VoiceService {
  private static instance: VoiceService;
  private rawStream: MediaStream | null = null;
  private processedStream: MediaStream | null = null;
  private isMuted: boolean = false;
  private isSpeaking: boolean = false;
  private masterVolume: number = 1.0;
  private gateThreshold: number = 24; // Formant vocal threshold
  private aggressiveTypingFilter: boolean = true; // Extra transient keystroke suppression
  private pushToTalkMode: boolean = false;
  private isPttPressed: boolean = false;
  private sustainedVoiceFrames: number = 0;
  private noiseFloor: number = 6;
  private peerVolumes: Map<string, number> = new Map();
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private noiseGateGain: GainNode | null = null;
  private volumeIntervalId: any = null;
  private speakingDebounceTimer: any = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private candidateQueues: Map<string, RTCIceCandidateInit[]> = new Map();
  private isConnected: boolean = false;
  private onPermissionGrantedCallback: (() => void) | null = null;
  private onSpeakingCallback: ((isSpeaking: boolean) => void) | null = null;
  private onLiveLevelCallback: ((level: number, isAboveThreshold: boolean) => void) | null = null;

  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  };

  private constructor() {
    this.setupSignalingListeners();
    this.setupPermissionMessageListener();
  }

  public static getInstance(): VoiceService {
    if (!VoiceService.instance) {
      VoiceService.instance = new VoiceService();
    }
    return VoiceService.instance;
  }

  private setupPermissionMessageListener(): void {
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'MIC_PERMISSION_GRANTED') {
          if (this.onPermissionGrantedCallback) {
            this.onPermissionGrantedCallback();
          }
        }
      });
    }
  }

  public setOnPermissionGranted(callback: () => void): void {
    this.onPermissionGrantedCallback = callback;
  }

  public setOnSpeakingChange(callback: (isSpeaking: boolean) => void): void {
    this.onSpeakingCallback = callback;
  }

  public setOnLiveLevel(callback: (level: number, isAboveThreshold: boolean) => void): void {
    this.onLiveLevelCallback = callback;
  }

  public setGateThreshold(threshold: number): void {
    this.gateThreshold = Math.max(5, Math.min(60, threshold));
  }

  public getGateThreshold(): number {
    return this.gateThreshold;
  }

  public setAggressiveTypingFilter(enabled: boolean): void {
    this.aggressiveTypingFilter = enabled;
  }

  public getAggressiveTypingFilter(): boolean {
    return this.aggressiveTypingFilter;
  }

  public setPushToTalkMode(enabled: boolean): void {
    this.pushToTalkMode = enabled;
    if (!enabled) {
      this.isPttPressed = false;
    } else {
      if (!this.isPttPressed && this.isSpeaking) {
        this.setSpeakingState(false);
        if (this.noiseGateGain && this.audioContext) {
          this.noiseGateGain.gain.setValueAtTime(0.0, this.audioContext.currentTime);
        }
      }
    }
  }

  public getPushToTalkMode(): boolean {
    return this.pushToTalkMode;
  }

  public setPushToTalkPressed(pressed: boolean): void {
    this.isPttPressed = pressed;
    if (!this.isConnected || this.isMuted) return;

    if (pressed) {
      this.setSpeakingState(true);
      if (this.noiseGateGain && this.audioContext) {
        this.noiseGateGain.gain.setTargetAtTime(1.0, this.audioContext.currentTime, 0.01);
      }
    } else {
      this.setSpeakingState(false);
      if (this.noiseGateGain && this.audioContext) {
        this.noiseGateGain.gain.setTargetAtTime(0.0, this.audioContext.currentTime, 0.03);
      }
    }
  }

  public setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1.0, vol));
    this.peerConnections.forEach((_, socketId) => {
      const userVol = this.peerVolumes.get(socketId) ?? 1.0;
      const audioEl = document.getElementById(`remote-audio-${socketId}`) as HTMLAudioElement;
      if (audioEl) {
        audioEl.volume = Math.max(0, Math.min(1.0, userVol * this.masterVolume));
      }
    });
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public setPeerVolume(socketId: string, vol: number): void {
    const clamped = Math.max(0, Math.min(1.0, vol));
    this.peerVolumes.set(socketId, clamped);
    const audioEl = document.getElementById(`remote-audio-${socketId}`) as HTMLAudioElement;
    if (audioEl) {
      audioEl.volume = Math.max(0, Math.min(1.0, clamped * this.masterVolume));
    }
  }

  public getPeerVolume(socketId: string): number {
    return this.peerVolumes.get(socketId) ?? 1.0;
  }

  private hasSignaledListeners: boolean = false;
  private setupSignalingListeners(): void {
    if (this.hasSignaledListeners) return;
    this.hasSignaledListeners = true;

    socketService.onVoiceParticipants(async ({ participants }) => {
      console.log('[WebRTC] Joining user received existing participants:', participants);
      if (this.isConnected && participants) {
        const mySocketId = socketService.getSocket()?.id;
        for (const p of participants) {
          if (p.socketId && p.socketId !== mySocketId) {
            await this.initiateCallToPeer(p.socketId);
          }
        }
      }
    });

    socketService.onVoiceJoined(({ socketId, userId }) => {
      console.log('[WebRTC] Peer joined voice, ready for offer:', socketId, userId);
      const mySocketId = socketService.getSocket()?.id;
      if (this.isConnected && socketId && socketId !== mySocketId) {
        this.getOrCreatePeerConnection(socketId);
      }
    });

    socketService.onVoiceOffer(async ({ fromSocketId, offer }) => {
      try {
        console.log('[WebRTC] 📞 Received offer from:', fromSocketId);
        const pc = this.getOrCreatePeerConnection(fromSocketId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        await this.drainCandidateQueue(fromSocketId, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socketService.sendVoiceAnswer(fromSocketId, answer);
      } catch (err) {
        console.error('[WebRTC] Error handling offer:', err);
      }
    });

    socketService.onVoiceAnswer(async ({ fromSocketId, answer }) => {
      try {
        console.log('[WebRTC] 📥 Received answer from:', fromSocketId);
        const pc = this.peerConnections.get(fromSocketId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await this.drainCandidateQueue(fromSocketId, pc);
        }
      } catch (err) {
        console.error('[WebRTC] Error handling answer:', err);
      }
    });

    socketService.onVoiceCandidate(async ({ fromSocketId, candidate }) => {
      try {
        const pc = this.peerConnections.get(fromSocketId);
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          if (!this.candidateQueues.has(fromSocketId)) {
            this.candidateQueues.set(fromSocketId, []);
          }
          this.candidateQueues.get(fromSocketId)!.push(candidate);
        }
      } catch (err) {
        console.error('[WebRTC] Error adding candidate:', err);
      }
    });

    socketService.onVoiceLeft(({ socketId }) => {
      if (socketId && this.peerConnections.has(socketId)) {
        this.closePeer(socketId);
      }
    });
  }

  private async drainCandidateQueue(socketId: string, pc: RTCPeerConnection): Promise<void> {
    const queue = this.candidateQueues.get(socketId);
    if (queue && queue.length > 0) {
      for (const candidate of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[WebRTC] Error adding buffered candidate:', e);
        }
      }
      this.candidateQueues.delete(socketId);
    }
  }

  private async initiateCallToPeer(socketId: string): Promise<void> {
    try {
      console.log('[WebRTC] 🚀 Initiating call to peer:', socketId);
      const pc = this.getOrCreatePeerConnection(socketId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true
      });
      await pc.setLocalDescription(offer);

      socketService.sendVoiceOffer(socketId, offer);
    } catch (err) {
      console.error('[WebRTC] Error creating offer for peer:', socketId, err);
    }
  }

  private getOrCreatePeerConnection(socketId: string): RTCPeerConnection {
    if (this.peerConnections.has(socketId)) {
      return this.peerConnections.get(socketId)!;
    }

    const pc = new RTCPeerConnection(this.rtcConfig);

    const streamToAttach = this.rawStream;
    if (streamToAttach) {
      streamToAttach.getAudioTracks().forEach(track => {
        track.enabled = !this.isMuted;
        pc.addTrack(track, streamToAttach);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.sendVoiceCandidate(socketId, event.candidate.toJSON());
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${socketId} connectionState:`, pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${socketId} iceConnectionState:`, pc.iceConnectionState);
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] 🔊 Playing incoming clean audio from peer:', socketId, event);
      if (event.streams && event.streams[0]) {
        this.playRemoteAudioStream(socketId, event.streams[0]);
      } else {
        const stream = new MediaStream([event.track]);
        this.playRemoteAudioStream(socketId, stream);
      }
    };

    this.peerConnections.set(socketId, pc);
    return pc;
  }

  private playbackAudioContext: AudioContext | null = null;
  private peerAudioSources: Map<string, { source: MediaStreamAudioSourceNode; gain: GainNode }> = new Map();

  private playRemoteAudioStream(socketId: string, stream: MediaStream): void {
    // 1. HTML5 Audio Element playback
    let container = document.getElementById('webrtc-audio-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'webrtc-audio-container';
      container.style.position = 'fixed';
      container.style.bottom = '0';
      container.style.right = '0';
      container.style.width = '1px';
      container.style.height = '1px';
      container.style.opacity = '0.01';
      container.style.pointerEvents = 'none';
      (document.body || document.documentElement).appendChild(container);
    }

    let audioEl = document.getElementById(`remote-audio-${socketId}`) as HTMLAudioElement;
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.id = `remote-audio-${socketId}`;
      audioEl.autoplay = true;
      (audioEl as any).playsInline = true;
      container.appendChild(audioEl);
    }

    if (audioEl.srcObject !== stream) {
      audioEl.srcObject = stream;
    }
    audioEl.muted = false;

    const userVol = this.peerVolumes.get(socketId) ?? 1.0;
    audioEl.volume = Math.max(0, Math.min(1.0, userVol * this.masterVolume));

    const playPromise = audioEl.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('[WebRTC] Autoplay waiting for interaction:', err);
        const playOnInteraction = () => {
          audioEl.play().catch(() => {});
          if (this.playbackAudioContext && this.playbackAudioContext.state === 'suspended') {
            this.playbackAudioContext.resume().catch(() => {});
          }
          window.removeEventListener('click', playOnInteraction);
          window.removeEventListener('keydown', playOnInteraction);
        };
        window.addEventListener('click', playOnInteraction);
        window.addEventListener('keydown', playOnInteraction);
      });
    }

    // 2. Direct Web Audio API routing to speakers
    try {
      if (!this.playbackAudioContext || this.playbackAudioContext.state === 'closed') {
        this.playbackAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (this.playbackAudioContext.state === 'suspended') {
        this.playbackAudioContext.resume().catch(() => {});
      }

      if (!this.peerAudioSources.has(socketId)) {
        const source = this.playbackAudioContext.createMediaStreamSource(stream);
        const gain = this.playbackAudioContext.createGain();
        gain.gain.value = Math.max(0, Math.min(1.0, userVol * this.masterVolume));
        source.connect(gain);
        gain.connect(this.playbackAudioContext.destination);
        this.peerAudioSources.set(socketId, { source, gain });
      }
    } catch (e) {
      console.warn('[WebRTC] WebAudio routing note:', e);
    }
  }

  private closePeer(socketId: string): void {
    const pc = this.peerConnections.get(socketId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(socketId);
    }
    const audioEl = document.getElementById(`remote-audio-${socketId}`);
    if (audioEl) {
      audioEl.remove();
    }
    if (this.peerAudioSources.has(socketId)) {
      try {
        const entry = this.peerAudioSources.get(socketId);
        entry?.source.disconnect();
        entry?.gain.disconnect();
      } catch (_) {}
      this.peerAudioSources.delete(socketId);
    }
    this.candidateQueues.delete(socketId);
  }

  public openPermissionTab(): void {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({
        url: chrome.runtime.getURL('permission.html'),
        active: true
      });
    } else if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'OPEN_PERMISSION_TAB' }).catch(() => {});
    } else if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      window.open(chrome.runtime.getURL('permission.html'), '_blank');
    }
  }

  public async startVoice(): Promise<{ success: boolean; error?: string; requiresPermissionTab?: boolean }> {
    try {
      this.setupSignalingListeners();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: false }, // Prevent AGC from artificially boosting laptop chassis taps
          channelCount: 1,
          sampleRate: 48000
        },
        video: false
      });

      this.rawStream = stream;
      this.isMuted = false;
      this.isConnected = true;

      this.setupAudioVAD(stream);

      this.peerConnections.forEach(pc => {
        stream.getAudioTracks().forEach(track => {
          track.enabled = !this.isMuted;
          pc.addTrack(track, stream);
        });
      });

      socketService.joinVoice();
      return { success: true };
    } catch (err: any) {
      console.log('[Voice] Microphone getUserMedia result:', err?.message || err);
      const errMsg = (err?.message || '').toLowerCase();
      
      if (errMsg.includes('dismissed') || errMsg.includes('notallowed') || errMsg.includes('permission') || err?.name === 'NotAllowedError') {
        if (window.location.protocol === 'chrome-extension:') {
          this.openPermissionTab();
          return {
            success: false,
            error: 'Please click "Allow" on the opened tab to enable microphone.',
            requiresPermissionTab: true
          };
        }
      }

      return { success: false, error: err?.message || 'Microphone access denied' };
    }
  }

  private setupAudioVAD(stream: MediaStream): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
      const source = this.audioContext.createMediaStreamSource(stream);

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.3;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      if (this.volumeIntervalId) {
        clearInterval(this.volumeIntervalId);
      }

      this.volumeIntervalId = setInterval(() => {
        if (!this.analyser || this.isMuted || !this.isConnected) {
          if (this.isSpeaking) {
            this.setSpeakingState(false);
          }
          this.onLiveLevelCallback?.(0, false);
          return;
        }

        if (this.audioContext && this.audioContext.state === 'suspended') {
          this.audioContext.resume().catch(() => {});
        }

        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalizedLevel = Math.min(100, Math.round((avg / 30) * 100));

        const effectiveThreshold = Math.min(this.gateThreshold, 14);
        const isSpeakingNow = avg >= effectiveThreshold;
        this.onLiveLevelCallback?.(normalizedLevel, isSpeakingNow);

        if (isSpeakingNow) {
          this.setSpeakingState(true);
          if (this.speakingDebounceTimer) clearTimeout(this.speakingDebounceTimer);
          this.speakingDebounceTimer = setTimeout(() => {
            this.setSpeakingState(false);
          }, 350);
        }
      }, 50);
    } catch (err) {
      console.warn('[Voice] Audio VAD setup warning:', err);
    }
  }

  private setSpeakingState(speaking: boolean): void {
    if (this.isSpeaking !== speaking) {
      this.isSpeaking = speaking;
      this.onSpeakingCallback?.(speaking);
      socketService.setVoiceSpeaking(speaking);
    }
  }

  public toggleMute(): boolean {
    if (!this.rawStream) return this.isMuted;

    this.isMuted = !this.isMuted;
    this.rawStream.getAudioTracks().forEach(track => {
      track.enabled = !this.isMuted;
    });
    if (this.processedStream) {
      this.processedStream.getAudioTracks().forEach(track => {
        track.enabled = !this.isMuted;
      });
    }

    // Explicitly update all RTCRtpSenders across all active peer connections
    this.peerConnections.forEach(pc => {
      pc.getSenders().forEach(sender => {
        if (sender.track) {
          sender.track.enabled = !this.isMuted;
        }
      });
    });

    if (this.isMuted && this.isSpeaking) {
      this.setSpeakingState(false);
      if (this.noiseGateGain && this.audioContext) {
        this.noiseGateGain.gain.setValueAtTime(0.0, this.audioContext.currentTime);
      }
    }

    socketService.setVoiceMute(this.isMuted);
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public stopVoice(): void {
    if (this.volumeIntervalId) {
      clearInterval(this.volumeIntervalId);
      this.volumeIntervalId = null;
    }
    if (this.speakingDebounceTimer) {
      clearTimeout(this.speakingDebounceTimer);
      this.speakingDebounceTimer = null;
    }

    if (this.rawStream) {
      this.rawStream.getTracks().forEach(track => track.stop());
      this.rawStream = null;
    }
    if (this.processedStream) {
      this.processedStream.getTracks().forEach(track => track.stop());
      this.processedStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.peerConnections.forEach((pc, socketId) => {
      pc.close();
      const audioEl = document.getElementById(`remote-audio-${socketId}`);
      if (audioEl) audioEl.remove();
    });
    this.peerConnections.clear();
    this.candidateQueues.clear();

    const container = document.getElementById('webrtc-audio-container');
    if (container) container.remove();

    this.isConnected = false;
    this.isMuted = true;
    this.isSpeaking = false;
    this.onSpeakingCallback?.(false);
    this.onLiveLevelCallback?.(0, false);

    socketService.leaveVoice();
  }
}

export const voiceService = VoiceService.getInstance();
