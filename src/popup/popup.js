async function getEnabledState() {
  const result = await chrome.storage.local.get('alwaysOn');
  return result.alwaysOn === true;
}

async function setEnabledState(enabled) {
  await chrome.storage.local.set({ alwaysOn: enabled });
}

async function sendToTab(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (e) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });
      await new Promise((r) => setTimeout(r, 300));
      await chrome.tabs.sendMessage(tabId, message);
    } catch (e2) {
      showNotAvailable();
    }
  }
}

async function sendMessageToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const url = tab.url || '';
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('file://') || url.startsWith('about:')) {
    showNotAvailable();
    return;
  }

  await sendToTab(tab.id, message);
}

function showNotAvailable() {
  const status = document.getElementById('webmd-status');
  status.textContent = 'Not available on this page';
  status.className = 'webmd-status unavailable';
}

async function updateUI() {
  const enabled = await getEnabledState();
  const toggle = document.getElementById('always-on-toggle');
  toggle.checked = enabled;
}

document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('always-on-toggle');

  await updateUI();

  toggle.addEventListener('change', async () => {
    const enabled = toggle.checked;
    await setEnabledState(enabled);

    if (enabled) {
      sendMessageToActiveTab({ type: 'ALWAYS_ON' });
    } else {
      sendMessageToActiveTab({ type: 'ALWAYS_OFF' });
    }
  });
});