import { Readability, isProbablyReaderable } from '@mozilla/readability';

export function extractContent(document_) {
  const clone = document_.cloneNode(true);

  const stripSelectors = [
    'script', 'style', 'noscript',
  ];

  const body = clone.querySelector('body') || clone.documentElement || clone;
  for (const sel of stripSelectors) {
    body.querySelectorAll(sel).forEach(el => el.remove());
  }

  let article = tryReadability(clone);
  if (article && article.content) {
    return article;
  }

  article = tryReadability(body);
  if (article && article.content) {
    return article;
  }

  const fallback = extractFallback(body);
  if (fallback) {
    return fallback;
  }

  return null;
}

function tryReadability(root) {
  try {
    if (isProbablyReaderable(root)) {
      const reader = new Readability(root);
      return reader.parse();
    }

    const reader = new Readability(root);
    return reader.parse();
  } catch (e) {
    return null;
  }
}

function extractFallback(body) {
  const noiseSelectors = [
    'nav', 'footer', 'header', 'aside',
    '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
    '[class*="cookie" i]', '[class*="consent" i]',
    '[class*="banner" i]', '[class*="popup" i]',
    '[class*="overlay" i]', '[class*="modal" i]',
    '[class*="share" i]', '[class*="social" i]',
    '[class*="newsletter" i]', '[class*="subscribe" i]',
    '[class*="promo" i]', '[class*="sidebar" i]',
    '[class*="related" i]', '[class*="recommend" i]',
    '[class*="ad" i]',
  ];

  for (const selector of noiseSelectors) {
    try {
      body.querySelectorAll(selector).forEach(el => el.remove());
    } catch (e) {}
  }

  const mainEl = body.querySelector('main')
    || body.querySelector('[role="main"]')
    || body.querySelector('article')
    || body;

  const textContent = (mainEl.textContent || '').trim();

  if (textContent.length < 10) {
    return null;
  }

  const title = (body.querySelector('title') || {}).textContent?.trim()
    || (body.querySelector('h1') || {}).textContent?.trim()
    || '';

  const contentHTML = mainEl.innerHTML || body.innerHTML;

  return {
    title,
    content: contentHTML,
    textContent,
    length: textContent.length,
  };
}