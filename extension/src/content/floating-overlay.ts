import { Party, ChatMessage, User } from '../types';
import { partyEngine } from './party-engine';

export class FloatingOverlayManager {
  private static instance: FloatingOverlayManager;
  private container: HTMLDivElement | null = null;
  private dockElement: HTMLDivElement | null = null;
  private chatDrawerElement: HTMLDivElement | null = null;
  private isChatOpen: boolean = false;
  private isCollapsed: boolean = false;
  private unreadCount: number = 0;
  private party: Party | null = null;
  private inVoice: boolean = false;
  private isMuted: boolean = true;
  private isSpeaking: boolean = false;
  private messages: ChatMessage[] = [];
  private renderedMessageIds: Set<string> = new Set();
  private currentUser: User | null = null;
  private lastPartyCode: string = '';
  private hideTimeout: any = null;
  private isMouseInside: boolean = false;
  private lastRenderedMembersHash: string = '';

  private constructor() {
    this.injectStyles();
    this.setupFullscreenListeners();
    this.setupInactivityFade();
  }

  public static getInstance(): FloatingOverlayManager {
    if (!FloatingOverlayManager.instance) {
      FloatingOverlayManager.instance = new FloatingOverlayManager();
    }
    return FloatingOverlayManager.instance;
  }

  public init(): void {
    this.injectStyles();
    this.ensureDOMStructure();
    this.updateDOM();
  }

  public updateState(payload: {
    party: Party | null;
    inVoice?: boolean;
    isMuted?: boolean;
    isSpeaking?: boolean;
    messages?: ChatMessage[];
    currentUser?: User | null;
  }): void {
    if (payload.party !== undefined) this.party = payload.party;
    if (payload.inVoice !== undefined) this.inVoice = payload.inVoice;
    if (payload.isMuted !== undefined) this.isMuted = payload.isMuted;
    if (payload.isSpeaking !== undefined) this.isSpeaking = payload.isSpeaking;
    if (payload.currentUser !== undefined) this.currentUser = payload.currentUser;

    if (payload.messages !== undefined) {
      const prevLength = this.messages.length;
      this.messages = payload.messages;
      if (!this.isChatOpen && payload.messages.length > prevLength) {
        this.unreadCount += (payload.messages.length - prevLength);
      }
    }

    this.updateDOM();
  }

  private injectStyles(): void {
    if (document.getElementById('nwp-floating-styles')) return;
    const style = document.createElement('style');
    style.id = 'nwp-floating-styles';
    style.textContent = `
      #nwp-floating-root {
        position: fixed !important;
        left: 18px !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        z-index: 2147483647 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        user-select: none !important;
        transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        pointer-events: auto !important;
        line-height: normal !important;
      }

      #nwp-floating-root.nwp-dimmed {
        opacity: 0.35 !important;
      }

      #nwp-floating-root.nwp-dimmed:hover {
        opacity: 1 !important;
      }

      /* Vertical Dock */
      .nwp-dock {
        background: rgba(15, 17, 24, 0.94) !important;
        backdrop-filter: blur(24px) !important;
        -webkit-backdrop-filter: blur(24px) !important;
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(229, 9, 20, 0.25) !important;
        border-radius: 20px !important;
        padding: 10px 8px !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        gap: 10px !important;
        transition: transform 0.25s ease, opacity 0.25s ease !important;
      }

      .nwp-dock.nwp-collapsed {
        transform: translateX(-36px) !important;
        padding: 8px 4px !important;
        opacity: 0.75 !important;
      }

      .nwp-dock.nwp-collapsed:hover {
        transform: translateX(0) !important;
        opacity: 1 !important;
      }

      /* Buttons */
      .nwp-btn {
        position: relative !important;
        width: 42px !important;
        height: 42px !important;
        border-radius: 12px !important;
        background: rgba(255, 255, 255, 0.08) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        color: #f1f5f9 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        transition: background 0.2s ease, border-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease !important;
        outline: none !important;
        box-sizing: border-box !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      .nwp-btn:hover {
        background: rgba(255, 255, 255, 0.18) !important;
        border-color: rgba(255, 255, 255, 0.3) !important;
        transform: scale(1.06) !important;
      }

      .nwp-btn:active {
        transform: scale(0.96) !important;
      }

      .nwp-btn.nwp-logo-btn {
        background: linear-gradient(135deg, #e50914, #b20710) !important;
        border-color: rgba(229, 9, 20, 0.6) !important;
        box-shadow: 0 4px 14px rgba(229, 9, 20, 0.45) !important;
      }

      /* Mic Button States */
      .nwp-btn.nwp-mic-off {
        background: rgba(255, 255, 255, 0.08) !important;
        border-color: rgba(255, 255, 255, 0.1) !important;
        color: #94a3b8 !important;
      }

      .nwp-btn.nwp-mic-muted {
        background: rgba(239, 68, 68, 0.25) !important;
        border-color: rgba(239, 68, 68, 0.5) !important;
        color: #f87171 !important;
      }

      .nwp-btn.nwp-mic-active {
        background: rgba(16, 185, 129, 0.25) !important;
        border-color: rgba(16, 185, 129, 0.6) !important;
        color: #34d399 !important;
      }

      .nwp-btn.nwp-mic-speaking {
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.6), 0 0 16px rgba(16, 185, 129, 0.5) !important;
        border-color: #34d399 !important;
      }

      /* Badge Counter */
      .nwp-badge {
        position: absolute !important;
        top: -4px !important;
        right: -4px !important;
        background: #e50914 !important;
        color: #ffffff !important;
        font-size: 10px !important;
        font-weight: 700 !important;
        min-width: 18px !important;
        height: 18px !important;
        border-radius: 9px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0 4px !important;
        border: 2px solid #0f1118 !important;
      }

      /* Tooltip */
      .nwp-tooltip {
        position: absolute !important;
        left: calc(100% + 12px) !important;
        background: #181b24 !important;
        color: #f8fafc !important;
        padding: 6px 12px !important;
        border-radius: 8px !important;
        font-size: 11px !important;
        font-weight: 600 !important;
        white-space: nowrap !important;
        pointer-events: none !important;
        opacity: 0 !important;
        transform: translateX(-4px) !important;
        transition: opacity 0.15s ease, transform 0.15s ease !important;
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5) !important;
        z-index: 1000 !important;
      }

      .nwp-btn:hover .nwp-tooltip {
        opacity: 1 !important;
        transform: translateX(0) !important;
      }

      /* Chat Drawer */
      .nwp-chat-drawer {
        width: 330px !important;
        height: 440px !important;
        background: rgba(14, 16, 22, 0.96) !important;
        backdrop-filter: blur(24px) !important;
        -webkit-backdrop-filter: blur(24px) !important;
        border: 1px solid rgba(255, 255, 255, 0.16) !important;
        box-shadow: 0 20px 48px rgba(0, 0, 0, 0.8) !important;
        border-radius: 20px !important;
        display: none !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }

      .nwp-chat-drawer.nwp-open {
        display: flex !important;
      }

      .nwp-chat-header {
        padding: 14px 16px !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        background: rgba(255, 255, 255, 0.02) !important;
      }

      .nwp-chat-title {
        font-size: 13px !important;
        font-weight: 700 !important;
        color: #f8fafc !important;
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
      }

      .nwp-chat-code {
        font-size: 11px !important;
        padding: 2px 6px !important;
        background: rgba(229, 9, 20, 0.2) !important;
        color: #f87171 !important;
        border-radius: 4px !important;
        font-weight: 600 !important;
      }

      .nwp-chat-close {
        background: transparent !important;
        border: none !important;
        color: #94a3b8 !important;
        cursor: pointer !important;
        padding: 4px !important;
        border-radius: 6px !important;
        display: flex !important;
      }

      .nwp-chat-close:hover {
        background: rgba(255, 255, 255, 0.1) !important;
        color: #ffffff !important;
      }

      .nwp-chat-body {
        flex: 1 !important;
        overflow-y: auto !important;
        padding: 12px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
      }

      .nwp-msg-bubble {
        max-width: 85% !important;
        padding: 8px 12px !important;
        border-radius: 12px !important;
        font-size: 12px !important;
        line-height: 1.4 !important;
        word-break: break-word !important;
      }

      .nwp-msg-mine {
        align-self: flex-end !important;
        background: linear-gradient(135deg, #e50914, #c90711) !important;
        color: #ffffff !important;
        border-bottom-right-radius: 3px !important;
      }

      .nwp-msg-other {
        align-self: flex-start !important;
        background: rgba(255, 255, 255, 0.08) !important;
        color: #e2e8f0 !important;
        border-bottom-left-radius: 3px !important;
      }

      .nwp-msg-system {
        align-self: center !important;
        background: rgba(255, 255, 255, 0.05) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        color: #94a3b8 !important;
        font-size: 10px !important;
        padding: 4px 8px !important;
      }

      .nwp-msg-sender {
        font-size: 10px !important;
        font-weight: 600 !important;
        color: #94a3b8 !important;
        margin-bottom: 2px !important;
      }

      .nwp-reactions-bar {
        display: flex !important;
        gap: 4px !important;
        padding: 6px 12px !important;
        background: rgba(255, 255, 255, 0.03) !important;
        border-top: 1px solid rgba(255, 255, 255, 0.06) !important;
      }

      .nwp-reaction-btn {
        background: transparent !important;
        border: none !important;
        font-size: 15px !important;
        cursor: pointer !important;
        padding: 2px 5px !important;
        border-radius: 6px !important;
        transition: transform 0.15s !important;
      }

      .nwp-reaction-btn:hover {
        transform: scale(1.25) !important;
        background: rgba(255, 255, 255, 0.1) !important;
      }

      .nwp-chat-input-row {
        padding: 10px 12px !important;
        border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
      }

      .nwp-chat-input {
        flex: 1 !important;
        background: rgba(255, 255, 255, 0.07) !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
        color: #ffffff !important;
        border-radius: 10px !important;
        padding: 8px 12px !important;
        font-size: 12px !important;
        outline: none !important;
      }

      .nwp-chat-input:focus {
        border-color: #e50914 !important;
      }

      .nwp-send-btn {
        background: #e50914 !important;
        color: #ffffff !important;
        border: none !important;
        border-radius: 10px !important;
        width: 34px !important;
        height: 34px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        transition: background 0.15s !important;
      }

      .nwp-send-btn:hover {
        background: #b80710 !important;
      }

      /* Members Tooltip Card */
      .nwp-members-card {
        position: absolute !important;
        left: calc(100% + 12px) !important;
        top: 60px !important;
        background: rgba(14, 16, 22, 0.95) !important;
        backdrop-filter: blur(20px) !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
        box-shadow: 0 16px 36px rgba(0, 0, 0, 0.65) !important;
        border-radius: 14px !important;
        padding: 10px !important;
        width: 180px !important;
        display: none !important;
        flex-direction: column !important;
        gap: 6px !important;
        z-index: 1000 !important;
      }

      .nwp-members-btn:hover .nwp-members-card {
        display: flex !important;
      }

      .nwp-member-row {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        font-size: 11px !important;
        color: #e2e8f0 !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  private setupFullscreenListeners(): void {
    const handleFullscreen = () => {
      const fsElem = document.fullscreenElement || (document as any).webkitFullscreenElement;
      if (this.container) {
        if (fsElem && !fsElem.contains(this.container)) {
          fsElem.appendChild(this.container);
        } else if (!fsElem && document.body && !document.body.contains(this.container)) {
          document.body.appendChild(this.container);
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreen);
    document.addEventListener('webkitfullscreenchange', handleFullscreen);
  }

  private setupInactivityFade(): void {
    // Keep floating dock solid and stable without distracting auto-dimming
  }

  private ensureDOMStructure(): void {
    let root = document.getElementById('nwp-floating-root') as HTMLDivElement;
    if (!root) {
      root = document.createElement('div');
      root.id = 'nwp-floating-root';

      root.addEventListener('mouseenter', () => {
        this.isMouseInside = true;
        root.classList.remove('nwp-dimmed');
      });

      root.addEventListener('mouseleave', () => {
        this.isMouseInside = false;
      });

      const fsElem = document.fullscreenElement || (document as any).webkitFullscreenElement;
      if (fsElem) {
        fsElem.appendChild(root);
      } else if (document.body) {
        document.body.appendChild(root);
      } else {
        document.documentElement.appendChild(root);
      }
    }
    this.container = root;

    // Create Persistent Dock if not exists
    if (!this.dockElement || !root.contains(this.dockElement)) {
      const dock = document.createElement('div');
      dock.className = 'nwp-dock';
      dock.id = 'nwp-dock';
      dock.innerHTML = `
        <button class="nwp-btn nwp-logo-btn" id="nwp-btn-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 3h3l7 14V3h3v18h-3L7 7v14H4V3z"/>
          </svg>
          <span class="nwp-tooltip" id="nwp-logo-tooltip">Netflix Watch Party</span>
        </button>
        <button class="nwp-btn nwp-mic-off" id="nwp-btn-mic" style="display:none;">
          <svg class="nwp-icon-mic-on" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none;">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="22"></line>
          </svg>
          <svg class="nwp-icon-mic-off" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="2" y1="2" x2="22" y2="22"></line>
            <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"></path>
            <path d="M5 10v2a7 7 0 0 0 12 5"></path>
            <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"></path>
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12"></path>
            <line x1="12" y1="19" x2="12" y2="22"></line>
          </svg>
          <span class="nwp-tooltip" id="nwp-mic-tooltip">Join Voice Chat</span>
        </button>
        <button class="nwp-btn" id="nwp-btn-chat" style="display:none;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span class="nwp-badge" id="nwp-badge" style="display:none;">0</span>
          <span class="nwp-tooltip">Party Chat</span>
        </button>
        <button class="nwp-btn nwp-members-btn" id="nwp-btn-members" style="display:none;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span class="nwp-tooltip" id="nwp-members-tooltip">Members (1)</span>
          <div class="nwp-members-card" id="nwp-members-card"></div>
        </button>
        <button class="nwp-btn" id="nwp-btn-resync" style="display:none;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
          <span class="nwp-tooltip">Resync Stream</span>
        </button>
        <button class="nwp-btn" id="nwp-btn-sidepanel">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="15" y1="3" x2="15" y2="21"></line>
          </svg>
          <span class="nwp-tooltip">Open Sidebar</span>
        </button>
      `;

      // Event Bindings
      const logoBtn = dock.querySelector('#nwp-btn-logo') as HTMLButtonElement;
      logoBtn.onclick = (e) => {
        e.stopPropagation();
        if (this.party && this.party.partyCode) {
          this.isCollapsed = !this.isCollapsed;
          dock.className = `nwp-dock ${this.isCollapsed ? 'nwp-collapsed' : ''}`;
        } else {
          chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' }).catch(() => {});
        }
      };

      const micBtn = dock.querySelector('#nwp-btn-mic') as HTMLButtonElement;
      micBtn.onclick = (e) => {
        e.stopPropagation();
        if (this.inVoice) {
          partyEngine.toggleMute();
        } else {
          partyEngine.toggleVoice();
        }
      };

      const chatBtn = dock.querySelector('#nwp-btn-chat') as HTMLButtonElement;
      chatBtn.onclick = (e) => {
        e.stopPropagation();
        this.toggleChat();
      };

      const resyncBtn = dock.querySelector('#nwp-btn-resync') as HTMLButtonElement;
      resyncBtn.onclick = (e) => {
        e.stopPropagation();
        partyEngine.forceSync();
      };

      const sidepanelBtn = dock.querySelector('#nwp-btn-sidepanel') as HTMLButtonElement;
      sidepanelBtn.onclick = (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' }).catch(() => {});
      };

      root.appendChild(dock);
      this.dockElement = dock;
    }

    // Create Persistent Chat Drawer if not exists
    if (!this.chatDrawerElement || !root.contains(this.chatDrawerElement)) {
      const drawer = document.createElement('div');
      drawer.className = 'nwp-chat-drawer';
      drawer.id = 'nwp-chat-drawer';
      drawer.innerHTML = `
        <div class="nwp-chat-header">
          <div class="nwp-chat-title">
            <span>Party Chat</span>
            <span class="nwp-chat-code" id="nwp-drawer-code"></span>
          </div>
          <button class="nwp-chat-close" id="nwp-drawer-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="nwp-chat-body" id="nwp-chat-body"></div>
        <div class="nwp-reactions-bar" id="nwp-reactions-bar"></div>
        <div class="nwp-chat-input-row">
          <input type="text" class="nwp-chat-input" id="nwp-chat-input" placeholder="Message friends..." />
          <button class="nwp-send-btn" id="nwp-send-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      `;

      // Drawer Event Bindings
      const closeBtn = drawer.querySelector('#nwp-drawer-close') as HTMLButtonElement;
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        this.toggleChat(false);
      };

      const reactions = ['🔥', '❤️', '😂', '🍿', '😱', '🎉'];
      const reactionsBar = drawer.querySelector('#nwp-reactions-bar') as HTMLDivElement;
      reactions.forEach(emoji => {
        const rBtn = document.createElement('button');
        rBtn.className = 'nwp-reaction-btn';
        rBtn.innerText = emoji;
        rBtn.onclick = (e) => {
          e.stopPropagation();
          this.sendMessage(emoji, 'sticker', emoji);
        };
        reactionsBar.appendChild(rBtn);
      });

      const input = drawer.querySelector('#nwp-chat-input') as HTMLInputElement;
      const sendBtn = drawer.querySelector('#nwp-send-btn') as HTMLButtonElement;

      const submitMessage = () => {
        const text = input.value.trim();
        if (text) {
          this.sendMessage(text, 'chat');
          input.value = '';
          input.focus();
        }
      };

      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        (e as any).stopImmediatePropagation?.();
        if (e.key === 'Enter') {
          e.preventDefault();
          submitMessage();
        }
        if (e.key === 'Escape') {
          this.toggleChat(false);
        }
      });
      input.addEventListener('keyup', (e) => {
        e.stopPropagation();
        (e as any).stopImmediatePropagation?.();
      });
      input.addEventListener('keypress', (e) => {
        e.stopPropagation();
        (e as any).stopImmediatePropagation?.();
      });

      sendBtn.onclick = (e) => {
        e.stopPropagation();
        submitMessage();
      };

      root.appendChild(drawer);
      this.chatDrawerElement = drawer;
    }
  }

  private updateDOM(): void {
    this.ensureDOMStructure();
    const isPartyActive = !!(this.party && this.party.partyCode);

    // 1. Update Logo tooltip
    const logoTooltip = document.getElementById('nwp-logo-tooltip');
    if (logoTooltip) {
      const label = isPartyActive ? `Party: ${this.party?.partyCode}` : 'Netflix Watch Party (Open Sidebar)';
      if (logoTooltip.innerText !== label) {
        logoTooltip.innerText = label;
      }
    }

    // 2. Update In-Party Action Buttons Display
    const micBtn = document.getElementById('nwp-btn-mic') as HTMLButtonElement;
    const chatBtn = document.getElementById('nwp-btn-chat') as HTMLButtonElement;
    const membersBtn = document.getElementById('nwp-btn-members') as HTMLButtonElement;
    const resyncBtn = document.getElementById('nwp-btn-resync') as HTMLButtonElement;

    if (micBtn && chatBtn && membersBtn && resyncBtn) {
      const displayStyle = isPartyActive ? 'flex' : 'none';
      if (micBtn.style.display !== displayStyle) micBtn.style.display = displayStyle;
      if (chatBtn.style.display !== displayStyle) chatBtn.style.display = displayStyle;
      if (membersBtn.style.display !== displayStyle) membersBtn.style.display = displayStyle;
      if (resyncBtn.style.display !== displayStyle) resyncBtn.style.display = displayStyle;

      if (isPartyActive) {
        // Update Mic Button Class & SVGs without destroying DOM nodes
        let micClass = 'nwp-btn ';
        if (!this.inVoice) {
          micClass += 'nwp-mic-off';
        } else if (this.isMuted) {
          micClass += 'nwp-mic-muted';
        } else {
          micClass += 'nwp-mic-active' + (this.isSpeaking ? ' nwp-mic-speaking' : '');
        }
        if (micBtn.className !== micClass) {
          micBtn.className = micClass;
        }

        const micTooltip = document.getElementById('nwp-mic-tooltip');
        if (micTooltip) {
          const tooltipText = !this.inVoice ? 'Join Voice Chat' : (this.isMuted ? 'Unmute Microphone' : 'Mute Microphone');
          if (micTooltip.innerText !== tooltipText) {
            micTooltip.innerText = tooltipText;
          }
        }

        const micOnSvg = micBtn.querySelector('.nwp-icon-mic-on') as SVGElement;
        const micOffSvg = micBtn.querySelector('.nwp-icon-mic-off') as SVGElement;
        if (micOnSvg && micOffSvg) {
          const isMicOn = this.inVoice && !this.isMuted;
          micOnSvg.style.display = isMicOn ? 'block' : 'none';
          micOffSvg.style.display = isMicOn ? 'none' : 'block';
        }

        // Update Badge
        const badge = document.getElementById('nwp-badge');
        if (badge) {
          if (this.unreadCount > 0 && !this.isChatOpen) {
            badge.style.display = 'flex';
            const badgeText = this.unreadCount > 9 ? '9+' : `${this.unreadCount}`;
            if (badge.innerText !== badgeText) {
              badge.innerText = badgeText;
            }
          } else {
            badge.style.display = 'none';
          }
        }

        // Update Members Card
        const membersCount = this.party?.members?.length || 1;
        const membersTooltip = document.getElementById('nwp-members-tooltip');
        if (membersTooltip) {
          const mText = `Members (${membersCount})`;
          if (membersTooltip.innerText !== mText) {
            membersTooltip.innerText = mText;
          }
        }

        const membersCard = document.getElementById('nwp-members-card');
        if (membersCard && this.party?.members) {
          const membersHash = JSON.stringify(this.party.members.map(m => ({ id: m.userId, name: m.name, v: m.inVoice, m: m.isMuted, s: m.isSpeaking })));
          if (this.lastRenderedMembersHash !== membersHash) {
            this.lastRenderedMembersHash = membersHash;
            membersCard.innerHTML = `
              <div style="font-weight:700;font-size:11px;color:#94a3b8;margin-bottom:4px;">WATCHERS (${this.party.members.length})</div>
              ${this.party.members.map(m => `
                <div class="nwp-member-row">
                  <span>${m.name} ${m.isHost ? '👑' : ''}</span>
                  <span style="color:${m.inVoice ? (m.isMuted ? '#f87171' : '#34d399') : '#64748b'}">
                    ${m.inVoice ? (m.isMuted ? '🔇' : (m.isSpeaking ? '🗣️' : '🎙️')) : '•'}
                  </span>
                </div>
              `).join('')}
            `;
          }
        }
      }
    }

    // 3. Update Chat Drawer Content
    if (this.chatDrawerElement) {
      if (this.isChatOpen && isPartyActive) {
        if (!this.chatDrawerElement.classList.contains('nwp-open')) {
          this.chatDrawerElement.classList.add('nwp-open');
        }
      } else {
        if (this.chatDrawerElement.classList.contains('nwp-open')) {
          this.chatDrawerElement.classList.remove('nwp-open');
        }
      }

      const currentCode = this.party?.partyCode || '';
      const drawerCode = document.getElementById('nwp-drawer-code');
      if (drawerCode) {
        if (drawerCode.innerText !== currentCode) {
          drawerCode.innerText = currentCode;
        }
      }

      // Incrementally render messages without wiping existing nodes
      const chatBody = document.getElementById('nwp-chat-body');
      if (chatBody) {
        if (currentCode !== this.lastPartyCode) {
          this.lastPartyCode = currentCode;
          chatBody.innerHTML = '';
          this.renderedMessageIds.clear();
        }

        // If message list was cleared or restarted
        if (this.messages.length === 0 && chatBody.children.length > 0) {
          chatBody.innerHTML = '';
          this.renderedMessageIds.clear();
        }

        let hasAppended = false;
        this.messages.forEach(msg => {
          if (!this.renderedMessageIds.has(msg.id)) {
            this.renderedMessageIds.add(msg.id);
            hasAppended = true;

            const isMine = msg.senderId === this.currentUser?.userId;
            const isSystem = msg.type === 'system';
            const bubble = document.createElement('div');
            bubble.dataset.msgId = msg.id;

            if (isSystem) {
              bubble.className = 'nwp-msg-bubble nwp-msg-system';
              bubble.innerText = msg.text;
            } else {
              bubble.className = `nwp-msg-bubble ${isMine ? 'nwp-msg-mine' : 'nwp-msg-other'}`;
              if (msg.type === 'sticker' && msg.stickerUrl) {
                bubble.innerHTML = `
                  ${!isMine ? `<div class="nwp-msg-sender">${msg.senderName}</div>` : ''}
                  <div style="font-size:26px;">${msg.stickerUrl}</div>
                `;
              } else {
                bubble.innerHTML = `
                  ${!isMine ? `<div class="nwp-msg-sender">${msg.senderName}</div>` : ''}
                  <div>${msg.text}</div>
                `;
              }
            }
            chatBody.appendChild(bubble);
          }
        });

        if (hasAppended) {
          chatBody.scrollTop = chatBody.scrollHeight;
        }
      }
    }
  }

  public toggleChat(forceOpen?: boolean): void {
    if (forceOpen !== undefined) {
      this.isChatOpen = forceOpen;
    } else {
      this.isChatOpen = !this.isChatOpen;
    }

    if (this.isChatOpen) {
      this.unreadCount = 0;
    }

    this.updateDOM();

    if (this.isChatOpen) {
      const input = document.getElementById('nwp-chat-input') as HTMLInputElement;
      if (input) {
        setTimeout(() => input.focus(), 50);
      }
    }
  }

  private sendMessage(text: string, type: 'chat' | 'sticker' = 'chat', stickerUrl?: string): void {
    partyEngine.sendMessage(text, type, stickerUrl);
  }

  public destroy(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}

export const floatingOverlay = FloatingOverlayManager.getInstance();

