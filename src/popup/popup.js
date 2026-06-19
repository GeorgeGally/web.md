async function getAlwaysOnState() {
  const result = await chrome.storage.local.get('alwaysOn');
  return result.alwaysOn === true;
}

async function setAlwaysOnState(enabled) {
  await chrome.storage.local.set({ alwaysOn: enabled });
}

async function sendMessageToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const url = tab.url || '';
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('file://')) {
    showNotAvailable();
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    showNotAvailable();
  }
}

function showNotAvailable() {
  const status = document.getElementById('webmd-status');
  status.textContent = 'Not available on this page';
  status.className = 'webmd-status unavailable';
}

async function updateUI() {
  const alwaysOn = await getAlwaysOnState();
  const toggle = document.getElementById('always-on-toggle');
  toggle.checked = alwaysOn;
}

document.addEventListener('DOMContentLoaded', async () => {
  const stripBtn = document.getElementById('strip-btn');
  const toggle = document.getElementById('always-on-toggle');

  await updateUI();

  stripBtn.addEventListener('click', () => {
    sendMessageToActiveTab({ type: 'STRIP' });
    window.close();
  });

  toggle.addEventListener('change', async () => {
    const enabled = toggle.checked;
    await setAlwaysOnState(enabled);

    if (enabled) {
      sendMessageToActiveTab({ type: 'ALWAYS_ON' });
    } else {
      sendMessageToActiveTab({ type: 'ALWAYS_OFF' });
    }
  });
});