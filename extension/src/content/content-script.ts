import { NetflixAdapter } from '../services/netflix/netflix-adapter';

const adapter = NetflixAdapter.getInstance();
let lastBroadcastTime = 0;
let lastKnownState: 'playing' | 'paused' = 'paused';

console.log('[Netflix Watch Party] Content script active on Netflix.');

function setupVideoListeners(video: HTMLVideoElement) {
  // Prevent duplicate listeners
  if ((video as any).__wp_attached) return;
  (video as any).__wp_attached = true;

  video.addEventListener('play', () => {
    if (adapter.isHandlingRemoteAction()) return;
    lastKnownState = 'playing';
    chrome.runtime.sendMessage({
      type: 'NETFLIX_LOCAL_PLAY',
      payload: { position: video.currentTime }
    }).catch(() => {});
  });

  video.addEventListener('pause', () => {
    if (adapter.isHandlingRemoteAction()) return;
    lastKnownState = 'paused';
    chrome.runtime.sendMessage({
      type: 'NETFLIX_LOCAL_PAUSE',
      payload: { position: video.currentTime }
    }).catch(() => {});
  });

  video.addEventListener('seeked', () => {
    if (adapter.isHandlingRemoteAction()) return;
    chrome.runtime.sendMessage({
      type: 'NETFLIX_LOCAL_SEEK',
      payload: { position: video.currentTime }
    }).catch(() => {});
  });

  video.addEventListener('timeupdate', () => {
    const now = Date.now();
    // Throttle status updates to once every 1.5 seconds
    if (now - lastBroadcastTime > 1500) {
      lastBroadcastTime = now;
      chrome.runtime.sendMessage({
        type: 'NETFLIX_STATUS_UPDATE',
        payload: {
          isNetflix: true,
          isPlaying: !video.paused,
          currentTime: video.currentTime,
          duration: video.duration || 0,
          mediaInfo: adapter.getMediaInfo()
        }
      }).catch(() => {});
    }
  });
}

// Watch DOM for dynamically injected Netflix video tag
const observer = new MutationObserver(() => {
  const video = adapter.detectVideoElement();
  if (video) {
    setupVideoListeners(video);
  }
});

observer.observe(document.body || document.documentElement, {
  childList: true,
  subtree: true
});

// Initial probe
const initialVideo = adapter.detectVideoElement();
if (initialVideo) {
  setupVideoListeners(initialVideo);
}

// Listen for execution commands from the Extension Side Panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NETFLIX_GET_STATUS') {
    const isNetflix = window.location.hostname.includes('netflix.com');
    const video = adapter.detectVideoElement();
    sendResponse({
      isNetflix,
      isPlaying: adapter.isPlaying(),
      currentTime: adapter.getCurrentTime(),
      duration: adapter.getDuration(),
      mediaInfo: adapter.getMediaInfo(),
      hasVideo: !!video
    });
    return true;
  }

  if (message.type === 'NETFLIX_EXECUTE_PLAY') {
    const { position } = message.payload || {};
    if (typeof position === 'number') {
      adapter.seek(position);
    }
    adapter.play();
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'NETFLIX_EXECUTE_PAUSE') {
    const { position } = message.payload || {};
    if (typeof position === 'number') {
      adapter.seek(position);
    }
    adapter.pause();
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'NETFLIX_EXECUTE_SEEK') {
    const { position } = message.payload || {};
    if (typeof position === 'number') {
      adapter.seek(position);
    }
    sendResponse({ success: true });
    return true;
  }
});
