import { Readability, isProbablyReaderable } from '@mozilla/readability';

const JUNK_SELECTORS = [
  'script', 'style', 'noscript', 'svg', 'canvas',
  'nav', 'footer', 'header', 'aside',
  '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
  '[class*="cookie" i]', '[class*="consent" i]',
  '[class*="banner" i]', '[class*="popup" i]',
  '[class*="overlay" i]', '[class*="modal" i]',
  '[class*="share" i]', '[class*="social" i]',
  '[class*="newsletter" i]', '[class*="subscribe" i]',
  '[class*="promo" i]', '[class*="sidebar" i]',
  '[class*="related" i]', '[class*="recommend" i]',
  '[class*="ad-" i]', '[class*="-ad" i]', '[class*="advertising" i]',
  '[id*="sidebar" i]', '[id*="ad-" i]',
];

export function extractContent(document_) {
  const clone = document_.cloneNode(true);

  const body = clone.querySelector('body') || clone.documentElement || clone;
  if (!body) return null;

  stripJunk(body, JUNK_SELECTORS);

  const readabilityArticle = tryReadability(clone);

  const fullPageText = (body.textContent || '').trim();
  const fullPageHTML = body.innerHTML || '';

  if (readabilityArticle && readabilityArticle.content) {
    const articleText = (readabilityArticle.textContent || '').trim();

    if (articleText.length >= fullPageText.length * 0.5) {
      return readabilityArticle;
    }

    const mergedHTML = readabilityArticle.content + fullPageHTML;
    return {
      title: readabilityArticle.title,
      content: mergedHTML,
      textContent: articleText + '\n' + fullPageText,
      length: articleText.length + fullPageText.length,
    };
  }

  if (fullPageText.length < 25) return null;

  const title = (clone.querySelector('title') || {}).textContent?.trim()
    || (clone.querySelector('h1') || {}).textContent?.trim()
    || '';

  return {
    title,
    content: fullPageHTML,
    textContent: fullPageText,
    length: fullPageText.length,
  };
}

function stripJunk(body, selectors) {
  for (const sel of selectors) {
    try {
      body.querySelectorAll(sel).forEach((el) => el.remove());
    } catch (e) {}
  }
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