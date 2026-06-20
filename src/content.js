import { waitForDOMSettled } from './extraction/settle-detector.js';
import { extractContent } from './extraction/readability-loader.js';
import { applyPuristPass } from './extraction/purist-pass.js';
import { renderMarkdownPage, renderLoadingState, renderThinContent } from './rendering/markdown-renderer.js';

let transformed = false;
let lastMarkdown = '';
let lastTitle = '';
let disabling = false;

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
  const root = doc.body || doc.documentElement;
  if (!root) return '';
  return collectText(root).trim();
}

async function extractRedditThread(url) {
  const parsed = new URL(url);
  if (!parsed.hostname.endsWith('reddit.com') || !parsed.pathname.includes('/comments/')) return null;

  const jsonUrl = new URL(parsed.href);
  jsonUrl.hash = '';
  jsonUrl.search = '';
  jsonUrl.pathname = jsonUrl.pathname.replace(/\/$/, '') + '.json';

  const response = await fetch(jsonUrl.href, {
    credentials: 'include',
    headers: { accept: 'application/json' },
  });

  if (!response.ok) return null;

  const data = await response.json();
  const post = data?.[0]?.data?.children?.[0]?.data;
  const comments = data?.[1]?.data?.children || [];
  if (!post?.title) return null;

  const parts = [`# ${post.title}`];
  if (post.selftext) parts.push(post.selftext);
  if (comments.length > 0) parts.push('## Comments');

  for (const comment of comments) {
    appendRedditComment(parts, comment, 3);
  }

  return {
    title: post.title,
    markdown: parts.join('\n\n'),
  };
}

function appendRedditComment(parts, node, depth) {
  if (!node || node.kind !== 't1') return;
  const comment = node.data;
  if (!comment?.body) return;

  const heading = '#'.repeat(Math.min(depth, 6));
  const author = comment.author ? `u/${comment.author}` : 'comment';
  parts.push(`${heading} ${author}`);
  parts.push(comment.body);

  const replies = comment.replies?.data?.children || [];
  for (const reply of replies) {
    appendRedditComment(parts, reply, depth + 1);
  }
}

function collectText(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_NODE) return '';

  let text = '';
  if (node.nodeType === Node.ELEMENT_NODE && node.shadowRoot) {
    for (const child of node.shadowRoot.childNodes) {
      text += collectText(child) + '\n';
    }
  }

  for (const child of node.childNodes) {
    text += collectText(child) + '\n';
  }

  return text;
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
  lastMarkdown = '';
  lastTitle = originalTitle;

  try {
    const redditThread = await withTimeout(extractRedditThread(originalUrl), 6000);
    if (redditThread?.markdown) {
      lastMarkdown = redditThread.markdown;
      lastTitle = redditThread.title || originalTitle;
      renderLoadingState();
      renderMarkdownPage(lastMarkdown, lastTitle, prefs);
      return;
    }
  } catch (e) {}

  let extracted;
  try {
    extracted = extractContent(document);
  } catch (e) {}

  renderLoadingState();

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

  if (!lastMarkdown) {
    if (rawText.length > 20) {
      const lines = rawText.split('\n').filter(l => l.trim()).join('\n\n');
      lastMarkdown = lines;
      lastTitle = originalTitle;
      renderMarkdownPage(lastMarkdown, lastTitle, prefs);
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
  if (disabling) return;
  disabling = true;
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
