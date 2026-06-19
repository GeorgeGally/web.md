import { Readability, isProbablyReaderable } from '@mozilla/readability';

export function extractContent(document_) {
  const clone = document_.cloneNode(true);

  if (isProbablyReaderable(clone)) {
    const reader = new Readability(clone);
    const article = reader.parse();

    if (article && article.content) {
      return article;
    }
  }

  const fallback = extractFallback(clone);
  if (fallback) {
    return fallback;
  }

  return null;
}

function extractFallback(clone) {
  const body = clone.querySelector('body');
  if (!body) return null;

  const unwantedSelectors = [
    'nav', 'footer', 'header',
    '[role="navigation"]', '[role="banner"]',
    '[class*="cookie" i]', '[class*="consent" i]',
    '[class*="banner" i]', '[class*="popup" i]',
    '[class*="overlay" i]', '[class*="modal" i]',
    '[class*="share" i]', '[class*="social" i]',
    '[class*="newsletter" i]', '[class*="subscribe" i]',
    '[id*="cookie" i]', '[id*="consent" i]',
    '[class*="sidebar" i]',
  ];

  for (const selector of unwantedSelectors) {
    const elements = body.querySelectorAll(selector);
    for (const el of elements) {
      el.remove();
    }
  }

  const textContent = body.textContent?.trim() || '';

  if (textContent.length < 50) {
    return null;
  }

  const title = clone.querySelector('title')?.textContent?.trim() || '';
  const mainEl = clone.querySelector('main') || clone.querySelector('[role="main"]') || clone.querySelector('article') || body;
  const contentHTML = mainEl.innerHTML || body.innerHTML;

  return {
    title,
    content: contentHTML,
    textContent,
    length: textContent.length,
  };
}