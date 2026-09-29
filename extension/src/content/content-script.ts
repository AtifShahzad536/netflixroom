import { NetflixAdapter } from '../services/netflix/netflix-adapter';
import { floatingOverlay } from './floating-overlay';
import { partyEngine } from './party-engine';
import { StorageService } from '../services/storage/storage-service';

const adapter = NetflixAdapter.getInstance();
let lastBroadcastTime = 0;
let lastKnownState: 'playing' | 'paused' = 'paused';

console.log('[Netflix Watch Party] Content script active with persistent Party Engine.');

// Initialize floating dock on Netflix
floatingOverlay.init();

// Restore floating dock if active session exists
StorageService.getPartySession().then((session) => {
  if (session && session.party) {
    floatingOverlay.updateState(session);
  }
}).catch(() => {});

// Listen for storage changes from Sidepanel to update floating dock and party engine in real-time
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes['netflix_wp_party_session']) {
      const newSession = changes['netflix_wp_party_session'].newValue;
      if (newSession && newSession.party) {
        floatingOverlay.updateState(newSession);
        const currentParty = partyEngine.getState().party;
        if (!currentParty || currentParty.partyCode !== newSession.party.partyCode) {
          partyEngine.joinParty(newSession.party.partyCode, newSession.currentUser).catch(() => {});
        }
      } else {
        floatingOverlay.updateState({ party: null, messages: [] });
        if (partyEngine.getState().party) {
          partyEngine.leaveParty();
        }
      }
    }
  });
}

function setupVideoListeners(video: HTMLVideoElement) {
  if ((video as any).__wp_attached) return;
  (video as any).__wp_attached = true;

  video.addEventListener('play', () => {
    if (adapter.isHandlingRemoteAction()) return;
    lastKnownState = 'playing';
    partyEngine.handleLocalPlay(video.currentTime);
  });

  video.addEventListener('pause', () => {
    if (adapter.isHandlingRemoteAction()) return;
    lastKnownState = 'paused';
    partyEngine.handleLocalPause(video.currentTime);
  });

  video.addEventListener('seeked', () => {
    if (adapter.isHandlingRemoteAction()) return;
    partyEngine.handleLocalSeek(video.currentTime);
  });

  video.addEventListener('timeupdate', () => {
    const now = Date.now();
    if (now - lastBroadcastTime > 1500) {
      lastBroadcastTime = now;
      partyEngine.handleMediaUpdate(adapter.getMediaInfo());
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

const initialVideo = adapter.detectVideoElement();
if (initialVideo) {
  setupVideoListeners(initialVideo);
}

// Handle all Extension runtime messages and Sidepanel commands
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Query live engine state
  if (message.type === 'GET_PARTY_ENGINE_STATE') {
    sendResponse({
      success: true,
      state: partyEngine.getState()
    });
    return true;
  }

  // 2. Engine Join Party
  if (message.type === 'ENGINE_JOIN_PARTY') {
    const { partyCode, user } = message.payload || {};
    partyEngine.joinParty(partyCode, user).then((res) => {
      sendResponse(res);
    });
    return true;
  }

  // 3. Engine Create Party
  if (message.type === 'ENGINE_CREATE_PARTY') {
    const { name, description, onlyHost } = message.payload || {};
    partyEngine.createParty(name, description, onlyHost).then((party) => {
      sendResponse({ success: !!party, party });
    });
    return true;
  }

  // 4. Engine Leave Party
  if (message.type === 'ENGINE_LEAVE_PARTY') {
    partyEngine.leaveParty();
    sendResponse({ success: true });
    return true;
  }

  // 5. Engine Voice Actions
  if (message.type === 'ENGINE_TOGGLE_VOICE' || message.type === 'FLOATING_ACTION_TOGGLE_VOICE') {
    const { inVoice } = message.payload || {};
    if (inVoice !== undefined) {
      partyEngine.setVoiceState(inVoice).then(() => {
        sendResponse({ success: true, inVoice: partyEngine.getState().inVoice });
      });
    } else {
      partyEngine.toggleVoice().then(() => {
        sendResponse({ success: true, inVoice: partyEngine.getState().inVoice });
      });
    }
    return true;
  }

  if (message.type === 'ENGINE_TOGGLE_MUTE' || message.type === 'FLOATING_ACTION_TOGGLE_MUTE') {
    const isMuted = partyEngine.toggleMute();
    sendResponse({ success: true, isMuted });
    return true;
  }

  // 6. Engine Chat Actions
  if (message.type === 'ENGINE_SEND_MESSAGE' || message.type === 'FLOATING_ACTION_SEND_CHAT') {
    const { text, type, stickerUrl } = message.payload || {};
    partyEngine.sendMessage(text, type, stickerUrl).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  // 7. Engine Playback Actions
  if (message.type === 'ENGINE_TOGGLE_PLAY') {
    partyEngine.togglePlay();
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'ENGINE_FORCE_SYNC' || message.type === 'FLOATING_ACTION_RESYNC') {
    partyEngine.forceSync();
    sendResponse({ success: true });
    return true;
  }

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
});
