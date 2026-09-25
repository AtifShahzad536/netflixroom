const allowBtn = document.getElementById('allowBtn') as HTMLButtonElement;
const statusMsg = document.getElementById('statusMsg') as HTMLDivElement;
const errorMsg = document.getElementById('errorMsg') as HTMLDivElement;

async function requestMic() {
  try {
    errorMsg.style.display = 'none';
    allowBtn.disabled = true;
    allowBtn.innerText = 'Requesting...';

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop tracks immediately after granting
    stream.getTracks().forEach(t => t.stop());

    statusMsg.style.display = 'block';
    allowBtn.innerText = 'Permission Granted!';
    allowBtn.style.backgroundColor = '#10B981';

    // Notify side panel
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'MIC_PERMISSION_GRANTED' }).catch(() => {});
    }

    setTimeout(() => {
      window.close();
    }, 1200);
  } catch (err: any) {
    console.error('Permission error:', err);
    allowBtn.disabled = false;
    allowBtn.innerText = 'Try Again';
    errorMsg.style.display = 'block';
    errorMsg.innerText = err.message || 'Microphone access was denied. Please check your browser settings.';
  }
}

allowBtn?.addEventListener('click', requestMic);

// Also try automatically requesting on page load
window.addEventListener('DOMContentLoaded', () => {
  requestMic();
});
