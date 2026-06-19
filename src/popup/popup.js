async function getEnabledState() {
  const result = await chrome.storage.local.get('alwaysOn');
  return result.alwaysOn === true;
}

async function setEnabledState(enabled) {
  await chrome.storage.local.set({ alwaysOn: enabled });
}

function setStatus(text, isError) {
  const status = document.getElementById('webmd-status');
  status.textContent = text;
  status.className = 'webmd-status' + (isError ? ' unavailable' : '');
}

async function sendMessageToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus('No active tab', true);
    return;
  }

  const url = tab.url || '';
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('file://') || url.startsWith('about:')) {
    setStatus('Not available on this page', true);
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, message);
    setStatus(message.type === 'ALWAYS_ON' ? 'Enabled' : 'Disabled', false);
  } catch (e) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
      await new Promise((r) => setTimeout(r, 500));
      await chrome.tabs.sendMessage(tab.id, message);
      setStatus(message.type === 'ALWAYS_ON' ? 'Enabled (injected)' : 'Disabled', false);
    } catch (e2) {
      setStatus('Could not activate on this page', true);
    }
  }
}

async function updateUI() {
  const enabled = await getEnabledState();
  const toggle = document.getElementById('always-on-toggle');
  toggle.checked = enabled;
  setStatus(enabled ? 'Enabled' : 'Disabled', false);
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