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

  try {
    const originalTitle = document.title;
    const originalUrl = window.location.href;

    renderLoadingState();

    await waitForDOMSettled(document, {
      timeout: 8000,
      stabilityThreshold: 500,
    });

    const originalClone = document.cloneNode(true);

    const extracted = extractContent(originalClone);

    if (!extracted || !extracted.content) {
      renderThinContent(originalUrl, originalTitle);
      transformed = true;
      return;
    }

    const turndownService = applyPuristPass();
    const markdown = turndownService.turndown(extracted.content);

    renderMarkdownPage(markdown, originalTitle);
    transformed = true;
  } catch (e) {
    console.error('web/md transform error:', e);
  }
}

function disable() {
  if (transformed) {
    window.location.reload();
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'STRIP') {
    transformPage();
    sendResponse({ ok: true });
  } else if (message.type === 'ALWAYS_ON') {
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

  return true;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'alwaysOn' in changes) {
    if (changes.alwaysOn.newValue === true) {
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