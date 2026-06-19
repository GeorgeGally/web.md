import { waitForDOMSettled } from './extraction/settle-detector.js';
import { extractContent } from './extraction/readability-loader.js';
import { applyPuristPass } from './extraction/purist-pass.js';
import { renderMarkdownPage, renderLoadingState, renderThinContent } from './rendering/markdown-renderer.js';

const STRIP_MESSAGES = ['STRIP', 'ALWAYS_ON', 'NAVIGATION'];

async function shouldAutoRun() {
  const result = await chrome.storage.local.get('alwaysOn');
  return result.alwaysOn === true;
}

async function transformPage() {
  const originalTitle = document.title;
  const originalUrl = window.location.href;

  renderLoadingState();

  const settled = await waitForDOMSettled(document, {
    timeout: 8000,
    stabilityThreshold: 500,
  });

  const extracted = extractContent(document);

  if (!extracted || !extracted.content) {
    renderThinContent(originalUrl, originalTitle);
    return;
  }

  const turndownService = applyPuristPass();
  const markdown = turndownService.turndown(extracted.content);

  renderMarkdownPage(markdown, originalTitle);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'STRIP') {
    transformPage();
    sendResponse({ ok: true });
  } else if (message.type === 'ALWAYS_ON') {
    transformPage();
    sendResponse({ ok: true });
  } else if (message.type === 'ALWAYS_OFF') {
    window.location.reload();
  } else if (message.type === 'NAVIGATION') {
    transformPage();
    sendResponse({ ok: true });
  }

  return true;
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    shouldAutoRun().then((autoRun) => {
      if (autoRun) {
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