const enabledToggle = document.getElementById('always-on-toggle');
const enabledRow = document.getElementById('enabled-row');
const status = document.getElementById('webmd-status');
const themeBtns = document.querySelectorAll('.webmd-theme-btn');
const fontSizeSlider = document.getElementById('font-size-slider');
const fontSizeValue = document.getElementById('font-size-value');

function setStatus(text, isError) {
  status.textContent = text;
  status.className = 'webmd-status' + (isError ? ' unavailable' : '');
}

async function init() {
  const result = await chrome.storage.local.get(['alwaysOn', 'theme', 'fontSize']);
  enabledToggle.checked = result.alwaysOn === true;
  setStatus(enabledToggle.checked ? 'Enabled' : 'Disabled', false);

  const theme = result.theme || 'dark';
  themeBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });

  const size = result.fontSize || 17;
  fontSizeSlider.value = size;
  fontSizeValue.textContent = size;
}

async function handleEnabled(enabled) {
  await chrome.storage.local.set({ alwaysOn: enabled });
  setStatus(enabled ? 'Enabling...' : 'Disabling...', false);
  notifyTab(enabled ? 'ALWAYS_ON' : 'ALWAYS_OFF').then(() => {
    setStatus(enabled ? 'Enabled' : 'Disabled', false);
  });
}

async function handleTheme(theme) {
  await chrome.storage.local.set({ theme });
  themeBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
  notifyTab('RERENDER');
}

async function handleFontSize(size) {
  const val = parseInt(size, 10);
  await chrome.storage.local.set({ fontSize: val });
  fontSizeValue.textContent = val;
  notifyTab('RERENDER');
}

async function notifyTab(type) {
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
    await chrome.tabs.sendMessage(tab.id, { type });
  } catch (e) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
      await new Promise((r) => setTimeout(r, 500));
      await chrome.tabs.sendMessage(tab.id, { type });
    } catch (e2) {
      setStatus('Could not activate', true);
    }
  }
}

enabledToggle.addEventListener('change', () => {
  handleEnabled(enabledToggle.checked);
});

enabledRow.addEventListener('click', (e) => {
  if (e.target === enabledToggle) return;
  enabledToggle.checked = !enabledToggle.checked;
  handleEnabled(enabledToggle.checked);
});

themeBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    handleTheme(btn.dataset.theme);
  });
});

fontSizeSlider.addEventListener('input', () => {
  handleFontSize(fontSizeSlider.value);
});

init();