const enabledToggle = document.getElementById('always-on-toggle');
const enabledControl = document.getElementById('enabled-control');
const extrasEl = document.getElementById('webmd-extras');
const statusEl = document.getElementById('webmd-status');
const formattedToggle = document.getElementById('formatted-toggle');
const themeToggle = document.getElementById('theme-toggle');
const fontSizeSlider = document.getElementById('font-size-slider');
const fontSizeValue = document.getElementById('font-size-value');

function paintSlider() {
  const { min, max, value } = fontSizeSlider;
  const pct = ((value - min) / (max - min)) * 100;
  fontSizeSlider.style.background =
    `linear-gradient(to right, var(--accent) ${pct}%, var(--rail) ${pct}%)`;
}

function setStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.className = 'webmd-status' + (isError ? ' error' : '');
}

function updateExtras(enabled) {
  extrasEl.classList.toggle('is-hidden', !enabled);
}

function applyPopupTheme(isDark) {
  document.documentElement.classList.toggle('dark', isDark);
  document.body.classList.toggle('dark', isDark);
}

async function init() {
  const result = await chrome.storage.local.get(['alwaysOn', 'formatted', 'theme', 'fontSize']);
  enabledToggle.checked = result.alwaysOn === true;
  updateExtras(enabledToggle.checked);
  formattedToggle.checked = result.formatted === true;

  const theme = result.theme || 'dark';
  themeToggle.checked = theme === 'dark';
  applyPopupTheme(themeToggle.checked);

  const size = result.fontSize || 17;
  fontSizeSlider.value = size;
  fontSizeValue.textContent = size;
  paintSlider();
}

async function handleEnabled(enabled) {
  await chrome.storage.local.set({ alwaysOn: enabled });
  updateExtras(enabled);
  notifyTab(enabled ? 'ALWAYS_ON' : 'ALWAYS_OFF');
}

async function handleTheme(isDark) {
  const theme = isDark ? 'dark' : 'light';
  applyPopupTheme(isDark);
  await chrome.storage.local.set({ theme });
  notifyTab('RERENDER');
}

async function handleFormatted(formatted) {
  await chrome.storage.local.set({ formatted });
  notifyTab('RERENDER');
}

async function handleFontSize(size) {
  const val = parseInt(size, 10);
  await chrome.storage.local.set({ fontSize: val });
  fontSizeValue.textContent = val;
  paintSlider();
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
    setStatus('Not available', true);
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
      setStatus('Unavailable', true);
    }
  }
}

enabledToggle.addEventListener('change', () => {
  handleEnabled(enabledToggle.checked);
});

enabledControl.addEventListener('click', (e) => {
  if (e.target === enabledToggle) return;
  enabledToggle.checked = !enabledToggle.checked;
  handleEnabled(enabledToggle.checked);
});

themeToggle.addEventListener('change', () => {
  handleTheme(themeToggle.checked);
});

formattedToggle.addEventListener('change', () => {
  handleFormatted(formattedToggle.checked);
});

fontSizeSlider.addEventListener('input', () => {
  handleFontSize(fontSizeSlider.value);
});

init();
