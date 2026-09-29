(async () => {
  try {
    const src = chrome.runtime.getURL('content.js');
    await import(src);
  } catch (err) {
    console.error('[Netflix Watch Party] Failed to load content script module:', err);
  }
})();
