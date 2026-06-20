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

  let markdown = '';
  let title = originalTitle;

  if (clone) {
    let extracted;
    try {
      extracted = extractContent(clone);
    } catch (e) {}

    if (extracted && extracted.content) {
      title = extracted.title || originalTitle;
      try {
        const turndownService = applyPuristPass();
        markdown = turndownService.turndown(extracted.content) || '';
      } catch (e) {}

      if (!markdown || markdown.trim().length === 0) {
        markdown = '';
      }
    }
  }

  if (!markdown) {
    if (rawText.length > 20) {
      const lines = rawText.split('\n').filter(l => l.trim()).join('\n\n');
      renderMarkdownPage(lines, originalTitle);
      return;
    }
    renderThinContent(originalUrl, originalTitle);
    return;
  }

  renderMarkdownPage(markdown, title);
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
    sendResponse({ ok: false });
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