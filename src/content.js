import { waitForDOMSettled } from './extraction/settle-detector.js';
import { extractContent } from './extraction/readability-loader.js';
import { applyPuristPass } from './extraction/purist-pass.js';
import { renderMarkdownPage, renderLoadingState, renderThinContent } from './rendering/markdown-renderer.js';

let transformed = false;

async function shouldAutoRun() {
  try {
    const result = await chrome.storage.local.get('alwaysOn');
    return result.alwaysOn === true;
  } catch (e) {
    return false;
  }
}

async function transformPage() {
  if (transformed) return;
  transformed = true;

  const originalTitle = document.title;
  const originalUrl = window.location.href;

  try {
    renderLoadingState();
  } catch (e) {}

  try {
    await waitForDOMSettled(document, {
      timeout: 8000,
      stabilityThreshold: 500,
    });

    const clone = document.cloneNode(true);

    let extracted;
    try {
      extracted = extractContent(clone);
    } catch (e) {
      console.warn('web/md: extraction failed, trying raw fallback', e);
    }

    if (!extracted || !extracted.content) {
      const rawText = document.body?.innerText?.trim() || '';
      if (rawText.length > 20) {
        const title = document.title || '';
        const lines = rawText.split('\n').filter(l => l.trim()).join('\n\n');
        renderMarkdownPage(lines, title);
        return;
      }
      renderThinContent(originalUrl, originalTitle);
      return;
    }

    const turndownService = applyPuristPass();
    const markdown = turndownService.turndown(extracted.content);

    if (!markdown || markdown.trim().length === 0) {
      const rawText = document.body?.innerText?.trim() || '';
      if (rawText.length > 20) {
        const lines = rawText.split('\n').filter(l => l.trim()).join('\n\n');
        renderMarkdownPage(lines, document.title || '');
        return;
      }
      renderThinContent(originalUrl, originalTitle);
      return;
    }

    renderMarkdownPage(markdown, extracted.title || originalTitle);
  } catch (e) {
    console.error('web/md: transform error', e);
    const rawText = document.body?.innerText?.trim() || '';
    if (rawText.length > 20) {
      const lines = rawText.split('\n').filter(l => l.trim()).join('\n\n');
      renderMarkdownPage(lines, document.title || originalTitle);
    } else {
      renderThinContent(originalUrl, originalTitle);
    }
  }
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
    }
  } catch (e) {
    sendResponse({ ok: false, error: e.message });
  }
  return true;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'alwaysOn' in changes) {
    if (changes.alwaysOn.newValue === true) {
      transformed = false;
      transformPage();
    } else {
      disable();
    }
  }
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    shouldAutoRun().then((autoRun) => {
      if (autoRun) {
        transformed = false;
        transformPage();
      }
    });
  }
});

async function main() {
  const autoRun = await shouldAutoRun();
  if (autoRun) {
    transformPage();
  }
}

main();