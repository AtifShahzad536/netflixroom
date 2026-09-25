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
      { urls: 'stun:stun3.l.google.com:19302' }
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
      // In PTT mode, ensure gate is closed initially
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

  private setupSignalingListeners(): void {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.on('voice:existing-participants', async ({ participants }: { participants: Array<{ socketId: string; userId: string; name: string }> }) => {
      console.log('[WebRTC] Joining user received existing participants:', participants);
      if (this.isConnected && participants) {
        for (const p of participants) {
          if (p.socketId && p.socketId !== socket.id) {
            await this.initiateCallToPeer(p.socketId);
          }
        }
      }
    });

    socket.on('voice:user-joined', ({ socketId, userId }: { socketId: string; userId: string }) => {
      console.log('[WebRTC] Peer joined voice, ready for offer:', socketId, userId);
      if (this.isConnected && socketId && socketId !== socket.id) {
        this.getOrCreatePeerConnection(socketId);
      }
    });

    socket.on('voice:signal:offer', async ({ fromSocketId, offer }: { fromSocketId: string; offer: RTCSessionDescriptionInit }) => {
      try {
        console.log('[WebRTC] 📞 Received offer from:', fromSocketId);
        const pc = this.getOrCreatePeerConnection(fromSocketId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        await this.drainCandidateQueue(fromSocketId, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('voice:signal:answer', {
          toSocketId: fromSocketId,
          answer
        });
      } catch (err) {
        console.error('[WebRTC] Error handling offer:', err);
      }
    });

    socket.on('voice:signal:answer', async ({ fromSocketId, answer }: { fromSocketId: string; answer: RTCSessionDescriptionInit }) => {
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

    socket.on('voice:signal:candidate', async ({ fromSocketId, candidate }: { fromSocketId: string; candidate: RTCIceCandidateInit }) => {
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

    socket.on('voice:user-left', ({ socketId }: { socketId?: string }) => {
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

      const socket = socketService.getSocket();
      socket?.emit('voice:signal:offer', {
        toSocketId: socketId,
        offer
      });
    } catch (err) {
      console.error('[WebRTC] Error creating offer for peer:', socketId, err);
    }
  }

  private getOrCreatePeerConnection(socketId: string): RTCPeerConnection {
    if (this.peerConnections.has(socketId)) {
      return this.peerConnections.get(socketId)!;
    }

    const pc = new RTCPeerConnection(this.rtcConfig);

    const streamToAttach = this.processedStream || this.rawStream;
    if (streamToAttach) {
      streamToAttach.getAudioTracks().forEach(track => {
        pc.addTrack(track, streamToAttach);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.getSocket()?.emit('voice:signal:candidate', {
          toSocketId: socketId,
          candidate: event.candidate.toJSON()
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] 🔊 Playing incoming clean audio from peer:', socketId);
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

  private playRemoteAudioStream(socketId: string, stream: MediaStream): void {
    let container = document.getElementById('webrtc-audio-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'webrtc-audio-container';
      document.body.appendChild(container);
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
        console.warn('[WebRTC] Browser blocked autoplay, listening for interaction:', err);
        const playOnInteraction = () => {
          audioEl.play().catch(() => {});
          window.removeEventListener('click', playOnInteraction);
          window.removeEventListener('keydown', playOnInteraction);
        };
        window.addEventListener('click', playOnInteraction);
        window.addEventListener('keydown', playOnInteraction);
      });
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
    this.candidateQueues.delete(socketId);
  }

  public openPermissionTab(): void {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({
        url: chrome.runtime.getURL('permission.html'),
        active: true
      });
    } else {
      window.open('/permission.html', '_blank');
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
          sampleRate: 48000,
          googEchoCancellation: true,
          googNoiseSuppression: true,
          googAutoGainControl: false,
          googHighpassFilter: true,
          googTypingNoiseDetection: true,
          googNoiseReduction: true
        } as any,
        video: false
      });

      this.rawStream = stream;
      this.isMuted = false;
      this.isConnected = true;

      this.setupAudioDSP(stream);

      const streamToAttach = this.processedStream || this.rawStream;
      this.peerConnections.forEach(pc => {
        streamToAttach.getAudioTracks().forEach(track => {
          pc.addTrack(track, streamToAttach);
        });
      });

      socketService.joinVoice();
      return { success: true };
    } catch (err: any) {
      console.warn('[Voice] getUserMedia error in sidepanel:', err);
      const errMsg = (err.message || '').toLowerCase();
      
      if (errMsg.includes('dismissed') || errMsg.includes('notallowed') || errMsg.includes('permission') || err.name === 'NotAllowedError') {
        this.openPermissionTab();
        return {
          success: false,
          error: 'Please click "Allow" on the opened tab to enable microphone.',
          requiresPermissionTab: true
        };
      }

      return { success: false, error: err.message || 'Microphone access denied' };
    }
  }

  private setupAudioDSP(stream: MediaStream): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(stream);

      // 1. Cascaded 24dB/octave Steep High-Pass Filter (260 Hz)
      // Eliminates laptop chassis mechanical vibration from keyboard typing and trackpad clicks
      const highPass1 = this.audioContext.createBiquadFilter();
      highPass1.type = 'highpass';
      highPass1.frequency.value = 260;
      highPass1.Q.value = 0.707;

      const highPass2 = this.audioContext.createBiquadFilter();
      highPass2.type = 'highpass';
      highPass2.frequency.value = 260;
      highPass2.Q.value = 0.707;

      // 2. Cascaded 24dB/octave Low-Pass Filter (3200 Hz)
      // Cuts high-frequency plastic switch clacks and mouse click transients
      const lowPass1 = this.audioContext.createBiquadFilter();
      lowPass1.type = 'lowpass';
      lowPass1.frequency.value = 3200;
      lowPass1.Q.value = 0.707;

      const lowPass2 = this.audioContext.createBiquadFilter();
      lowPass2.type = 'lowpass';
      lowPass2.frequency.value = 3200;
      lowPass2.Q.value = 0.707;

      // 3. Human Vocal Formant Enhancer (1800 Hz)
      const vocalFocus = this.audioContext.createBiquadFilter();
      vocalFocus.type = 'peaking';
      vocalFocus.frequency.value = 1800;
      vocalFocus.Q.value = 1.0;
      vocalFocus.gain.value = 3.0;

      // 4. Smart Noise Gate Gain Node
      this.noiseGateGain = this.audioContext.createGain();
      this.noiseGateGain.gain.setValueAtTime(0.0, this.audioContext.currentTime);

      // 5. Analyser for Formant-Based Voice Activity Detection
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512; // 256 frequency bins (93.75 Hz / bin)
      this.analyser.smoothingTimeConstant = 0.25;

      // Audio Graph Connection
      source.connect(highPass1);
      highPass1.connect(highPass2);
      highPass2.connect(lowPass1);
      lowPass1.connect(lowPass2);
      lowPass2.connect(vocalFocus);
      vocalFocus.connect(this.analyser);
      vocalFocus.connect(this.noiseGateGain);

      const destination = this.audioContext.createMediaStreamDestination();
      this.noiseGateGain.connect(destination);
      this.processedStream = destination.stream;

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      this.sustainedVoiceFrames = 0;
      this.noiseFloor = 6;

      if (this.volumeIntervalId) {
        clearInterval(this.volumeIntervalId);
      }

      this.volumeIntervalId = setInterval(() => {
        if (!this.analyser || this.isMuted || !this.isConnected) {
          if (this.isSpeaking) {
            this.setSpeakingState(false);
          }
          if (this.noiseGateGain && this.audioContext) {
            this.noiseGateGain.gain.setTargetAtTime(0.0, this.audioContext.currentTime, 0.03);
          }
          this.onLiveLevelCallback?.(0, false);
          return;
        }

        this.analyser.getByteFrequencyData(dataArray);

        // Analyze specific spectral bands:
        // Vocal Formant Band (Bins 3 to 28 = ~280Hz to ~2600Hz)
        let vocalSum = 0;
        let vocalPeak = 0;
        const vocalStart = 3;
        const vocalEnd = 28;
        for (let i = vocalStart; i <= vocalEnd; i++) {
          const val = dataArray[i];
          vocalSum += val;
          if (val > vocalPeak) vocalPeak = val;
        }
        const vocalAvg = vocalSum / (vocalEnd - vocalStart + 1);

        // High Click / Mechanical Transient Band (Bins 40 to 100 = ~3750Hz to ~9400Hz)
        let highSum = 0;
        const highStart = 40;
        const highEnd = 100;
        for (let i = highStart; i <= highEnd; i++) {
          highSum += dataArray[i];
        }
        const highAvg = highSum / (highEnd - highStart + 1);

        // Dynamic noise floor calibration during quiet moments
        if (vocalAvg < this.gateThreshold) {
          this.noiseFloor = Math.max(3, this.noiseFloor * 0.98 + vocalAvg * 0.02);
        }

        // Live level calculation (normalized 0-100)
        const liveLevelPct = Math.min(100, Math.round((vocalAvg / 50) * 100));
        const isAboveThreshold = vocalAvg >= this.gateThreshold;
        this.onLiveLevelCallback?.(liveLevelPct, isAboveThreshold);

        // Push to Talk mode handling
        if (this.pushToTalkMode) {
          return; // Handled directly in setPushToTalkPressed
        }

        // Smart Voice Activity & Keystroke Rejection Logic:
        // 1. Vocal energy must exceed user's gate threshold
        // 2. Vocal energy must exceed ambient noise floor
        // 3. Vocal energy must dominate over high click noise (keystroke clicks have high click energy)
        // 4. Must sustain for >= 2 consecutive frames (~80ms) to reject single-click button taps
        const requiredConsecutiveFrames = this.aggressiveTypingFilter ? 3 : 2;
        const clickRatio = this.aggressiveTypingFilter ? 1.4 : 1.1;

        const isVocalEnergy = vocalAvg >= this.gateThreshold && vocalAvg > (this.noiseFloor + 5);
        const isNotClick = vocalAvg > (highAvg * clickRatio);

        if (isVocalEnergy && isNotClick) {
          this.sustainedVoiceFrames++;
        } else {
          this.sustainedVoiceFrames = Math.max(0, this.sustainedVoiceFrames - 1);
        }

        const isHumanSpeech = this.sustainedVoiceFrames >= requiredConsecutiveFrames;

        if (isHumanSpeech) {
          this.setSpeakingState(true);
          if (this.noiseGateGain && this.audioContext) {
            this.noiseGateGain.gain.setTargetAtTime(1.0, this.audioContext.currentTime, 0.015);
          }

          if (this.speakingDebounceTimer) clearTimeout(this.speakingDebounceTimer);
          this.speakingDebounceTimer = setTimeout(() => {
            if (this.isSpeaking && (vocalAvg < this.gateThreshold || this.sustainedVoiceFrames === 0)) {
              this.setSpeakingState(false);
              if (this.noiseGateGain && this.audioContext) {
                this.noiseGateGain.gain.setTargetAtTime(0.0, this.audioContext.currentTime, 0.04);
              }
            }
          }, 200);
        }
      }, 40);

    } catch (err) {
      console.warn('[Voice] Audio DSP setup error, falling back to raw stream:', err);
      this.processedStream = stream;
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
