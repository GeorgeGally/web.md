const toggle = document.getElementById('always-on-toggle');
const status = document.getElementById('webmd-status');
const toggleRow = document.getElementById('toggle-row');

function setStatus(text, isError) {
  status.textContent = text;
  status.className = 'webmd-status' + (isError ? ' unavailable' : '');
}

async function init() {
  const result = await chrome.storage.local.get('alwaysOn');
  toggle.checked = result.alwaysOn === true;
  setStatus(toggle.checked ? 'Enabled' : 'Disabled', false);
}

async function handleToggle(enabled) {
  await chrome.storage.local.set({ alwaysOn: enabled });
  setStatus(enabled ? 'Enabling...' : 'Disabling...', false);

  let tabs;
  try {
    tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (e) {
    setStatus('Error: ' + e.message, true);
    return;
  }

  const tab = tabs && tabs[0];
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
    await chrome.tabs.sendMessage(tab.id, { type: enabled ? 'ALWAYS_ON' : 'ALWAYS_OFF' });
    setStatus(enabled ? 'Enabled' : 'Disabled', false);
  } catch (e) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
      await new Promise(r => setTimeout(r, 500));
      await chrome.tabs.sendMessage(tab.id, { type: enabled ? 'ALWAYS_ON' : 'ALWAYS_OFF' });
      setStatus(enabled ? 'Enabled (injected)' : 'Disabled', false);
    } catch (e2) {
      setStatus('Could not activate: ' + (e2.message || e2), true);
    }
  }
}

toggle.addEventListener('change', () => {
  handleToggle(toggle.checked);
});

toggleRow.addEventListener('click', (e) => {
  if (e.target === toggle) return;
  toggle.checked = !toggle.checked;
  handleToggle(toggle.checked);
});

init();