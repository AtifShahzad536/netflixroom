import { User } from '../../types';

const STORAGE_KEYS = {
  USER: 'netflix_wp_user',
  ACTIVE_PARTY: 'netflix_wp_active_party',
  SETTINGS: 'netflix_wp_settings'
};

export const StorageService = {
  async getUser(): Promise<User | null> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await chrome.storage.local.get(STORAGE_KEYS.USER);
        if (result[STORAGE_KEYS.USER]) return result[STORAGE_KEYS.USER];
      }
      const raw = localStorage.getItem(STORAGE_KEYS.USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async setUser(user: User): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [STORAGE_KEYS.USER]: user });
      }
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } catch (e) {
      console.error('Failed to save user:', e);
    }
  },

  async getActivePartyCode(): Promise<string | null> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_PARTY);
        if (result[STORAGE_KEYS.ACTIVE_PARTY]) return result[STORAGE_KEYS.ACTIVE_PARTY];
      }
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_PARTY);
    } catch {
      return null;
    }
  },

  async setActivePartyCode(code: string | null): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        if (code) {
          await chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_PARTY]: code });
        } else {
          await chrome.storage.local.remove(STORAGE_KEYS.ACTIVE_PARTY);
        }
      }
      if (code) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_PARTY, code);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_PARTY);
      }
    } catch (e) {
      console.error('Failed to save active party code:', e);
    }
  }
};
