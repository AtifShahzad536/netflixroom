import { MediaInfo } from '../../types';

export class NetflixAdapter {
  private static instance: NetflixAdapter;
  private videoElement: HTMLVideoElement | null = null;
  private isApplyingRemoteAction: boolean = false;
  private remoteActionTimeout: number | null = null;

  private constructor() {
    this.detectVideoElement();
  }

  public static getInstance(): NetflixAdapter {
    if (!NetflixAdapter.instance) {
      NetflixAdapter.instance = new NetflixAdapter();
    }
    return NetflixAdapter.instance;
  }

  public detectVideoElement(): HTMLVideoElement | null {
    if (this.videoElement && document.contains(this.videoElement)) {
      return this.videoElement;
    }

    // Try common Netflix player video selectors
    const video = document.querySelector('video') ||
      document.querySelector('.watch-video--player-view video') ||
      document.querySelector('.nf-player-container video');

    if (video instanceof HTMLVideoElement) {
      this.videoElement = video;
      return video;
    }

    this.videoElement = null;
    return null;
  }

  public isAvailable(): boolean {
    return !!this.detectVideoElement();
  }

  public getCurrentTime(): number {
    const video = this.detectVideoElement();
    return video ? video.currentTime : 0;
  }

  public getDuration(): number {
    const video = this.detectVideoElement();
    return video ? video.duration || 0 : 0;
  }

  public isPlaying(): boolean {
    const video = this.detectVideoElement();
    return video ? !video.paused && !video.ended && video.readyState > 2 : false;
  }

  public setRemoteActionFlag(durationMs: number = 800): void {
    this.isApplyingRemoteAction = true;
    if (this.remoteActionTimeout) {
      clearTimeout(this.remoteActionTimeout);
    }
    this.remoteActionTimeout = window.setTimeout(() => {
      this.isApplyingRemoteAction = false;
      this.remoteActionTimeout = null;
    }, durationMs);
  }

  public isHandlingRemoteAction(): boolean {
    return this.isApplyingRemoteAction;
  }

  public async play(): Promise<void> {
    const video = this.detectVideoElement();
    if (!video) return;

    this.setRemoteActionFlag();
    try {
      if (video.paused) {
        await video.play();
      }
    } catch (e) {
      console.warn('[NetflixAdapter] Play failed:', e);
    }
  }

  public pause(): void {
    const video = this.detectVideoElement();
    if (!video) return;

    this.setRemoteActionFlag();
    try {
      if (!video.paused) {
        video.pause();
      }
    } catch (e) {
      console.warn('[NetflixAdapter] Pause failed:', e);
    }
  }

  public seek(targetTime: number, toleranceSeconds: number = 0.3): void {
    const video = this.detectVideoElement();
    if (!video) return;

    const diff = Math.abs(video.currentTime - targetTime);
    // Drift correction: ignore if within tolerance (e.g. < 300ms)
    if (diff < toleranceSeconds) {
      return;
    }

    this.setRemoteActionFlag();
    try {
      video.currentTime = targetTime;
    } catch (e) {
      console.warn('[NetflixAdapter] Seek failed:', e);
    }
  }

  public getMediaInfo(): MediaInfo {
    let title = 'Netflix Stream';
    let episodeInfo = '';

    try {
      // Extract title from Netflix DOM overlay if available
      const titleElem = document.querySelector('[data-uia="video-title"]') ||
        document.querySelector('.video-title h4') ||
        document.querySelector('.ellipsize-text');

      if (titleElem && titleElem.textContent) {
        title = titleElem.textContent.trim();
      } else {
        // Fallback to page title
        const docTitle = document.title.replace(' - Netflix', '').trim();
        if (docTitle && docTitle !== 'Netflix') {
          title = docTitle;
        }
      }

      // Check episode/season indicators
      const epElem = document.querySelector('.video-title span');
      if (epElem && epElem.textContent) {
        episodeInfo = epElem.textContent.trim();
      }
    } catch {
      // Safe fallback
    }

    return {
      title,
      episodeInfo,
      videoUrl: window.location.href,
      duration: this.getDuration()
    };
  }
}
