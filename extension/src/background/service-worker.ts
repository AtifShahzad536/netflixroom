// Background Service Worker for Netflix Watch Party Extension (Manifest V3)

// Configure side panel to open on action click
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Netflix Watch Party] Extension installed.');
  
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.warn('[Background] Failed to set side panel behavior:', err);
    });
  }
});

// Listen for messages from popup or sidepanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_SIDEPANEL') {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.sidePanel.open({ tabId: tabs[0].id }).then(() => {
            sendResponse({ success: true });
          }).catch((err) => {
            sendResponse({ success: false, error: err.message });
          });
        }
      });
      return true; // Keep message channel open for async response
    }
  }

  if (message.type === 'CHECK_NETFLIX_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      const isNetflix = !!(activeTab?.url && activeTab.url.includes('netflix.com'));
      const isWatching = !!(isNetflix && activeTab?.url?.includes('/watch/'));
      sendResponse({ isNetflix, isWatching, tab: activeTab });
    });
    return true;
  }
});
