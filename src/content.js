import { waitForDOMSettled } from './extraction/settle-detector.js';
import { extractContent } from './extraction/readability-loader.js';
import { applyPuristPass } from './extraction/purist-pass.js';
import { renderMarkdownPage, renderLoadingState, renderThinContent } from './rendering/markdown-renderer.js';

let transformed = false;
let lastMarkdown = '';
let lastTitle = '';

async function getPrefs() {
  try {
    const result = await chrome.storage.local.get(['alwaysOn', 'theme', 'fontSize']);
    return {
      alwaysOn: result.alwaysOn === true,
      theme: result.theme || 'dark',
      fontSize: result.fontSize || 17,
    };
  } catch (e) {
    return { alwaysOn: false, theme: 'dark', fontSize: 17 };
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function extractRawText(doc) {
  const body = doc.body || doc.documentElement;
  if (!body) return '';
  return (body.innerText || body.textContent || '').trim();
}

async function transformPage() {
  if (transformed) return;
  transformed = true;

  const prefs = await getPrefs();
  const originalTitle = document.title || '';
  const originalUrl = window.location.href;

  try {
    await withTimeout(
      waitForDOMSettled(document, {
        timeout: 8000,
        stabilityThreshold: 500,
      }),
      10000
    );
  } catch (e) {}

  const rawText = extractRawText(document);
  let clone;
  try {
    clone = document.cloneNode(true);
  } catch (e) {}

  renderLoadingState();

  lastMarkdown = '';
  lastTitle = originalTitle;

  if (clone) {
    let extracted;
    try {
      extracted = extractContent(clone);
    } catch (e) {}

    if (extracted && extracted.content) {
      lastTitle = extracted.title || originalTitle;
      try {
        const turndownService = applyPuristPass();
        lastMarkdown = turndownService.turndown(extracted.content) || '';
      } catch (e) {}

      if (!lastMarkdown || lastMarkdown.trim().length === 0) {
        lastMarkdown = '';
      }
    }
  }

  if (!lastMarkdown) {
    if (rawText.length > 20) {
      const lines = rawText.split('\n').filter(l => l.trim()).join('\n\n');
      renderMarkdownPage(lines, originalTitle, prefs);
      return;
    }
    renderThinContent(originalUrl, originalTitle, prefs);
    return;
  }

  renderMarkdownPage(lastMarkdown, lastTitle, prefs);
}

function reRender() {
  if (!transformed || !lastMarkdown) return;
  getPrefs().then((prefs) => {
    renderMarkdownPage(lastMarkdown, lastTitle, prefs);
  });
}

function disable() {
  window.location.reload();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    if (message.type === 'STRIP' || message.type === 'ALWAYS_ON') {
      transformPage();
      sendResponse({ ok: true });
    } else if (message.type === 'ALWAYS_OFF') {
      disable();
      sendResponse({ ok: true });
    } else if (message.type === 'NAVIGATION') {
      transformed = false;
      transformPage();
      sendResponse({ ok: true });
    } else if (message.type === 'RERENDER') {
      reRender();
      sendResponse({ ok: true });
    }
  } catch (e) {
    sendResponse({ ok: false });
  }
  return true;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if ('alwaysOn' in changes) {
    if (changes.alwaysOn.newValue === true) {
      transformed = false;
      transformPage();
    } else {
      disable();
    }
  }
  if ('theme' in changes || 'fontSize' in changes) {
    reRender();
  }
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    getPrefs().then((prefs) => {
      if (prefs.alwaysOn) {
        transformed = false;
        transformPage();
      }
    });
  }
});

async function main() {
  const prefs = await getPrefs();
  if (prefs.alwaysOn) {
    transformPage();
  }
}

main();