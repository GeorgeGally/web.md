import { Readability } from '@mozilla/readability';

const JUNK_SELECTORS = [
  'script', 'style', 'noscript', 'svg', 'canvas',
  'nav', 'footer', 'header', 'aside',
  '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
  '[class*="cookie" i]', '[class*="consent" i]',
  '[class*="banner" i]', '[class*="popup" i]',
  '[class*="overlay" i]', '[class*="modal" i]',
  '[class*="newsletter" i]', '[class*="subscribe" i]',
  '[class*="promo" i]', '[class*="sidebar" i]',
  '[class*="related" i]', '[class*="recommend" i]',
  '[class*="ad-" i]', '[class*="-ad" i]', '[class*="advertising" i]',
  '[id*="sidebar" i]', '[id*="ad-" i]',
  '[class*="share" i]', '[class*="social" i]',
];

export function extractContent(document_) {
  const clone = cloneWithShadowDOM(document_);

  const body = clone.querySelector('body') || clone.documentElement || clone;
  if (!body) return null;

  stripJunk(body, JUNK_SELECTORS);

  const readabilityArticle = tryReadability(clone);

  if (readabilityArticle && readabilityArticle.content) {
    const commentHTML = findCommentSections(clone, readabilityArticle.content);
    if (commentHTML) {
      return {
        title: readabilityArticle.title,
        content: readabilityArticle.content + commentHTML,
        textContent: (readabilityArticle.textContent || '').trim(),
        length: (readabilityArticle.textContent || '').length,
      };
    }
    return readabilityArticle;
  }

  const fullText = (body.textContent || '').trim();
  if (fullText.length < 25) return null;

  const mainEl = body.querySelector('main') || body.querySelector('[role="main"]') || body;
  const title = (clone.querySelector('title') || {}).textContent?.trim()
    || (clone.querySelector('h1') || {}).textContent?.trim()
    || '';

  return {
    title,
    content: mainEl.innerHTML || body.innerHTML,
    textContent: fullText,
    length: fullText.length,
  };
}

function cloneWithShadowDOM(node) {
  const clone = node.cloneNode(false);

  if (node.nodeType === Node.ELEMENT_NODE && node.shadowRoot) {
    for (const child of node.shadowRoot.childNodes) {
      clone.appendChild(cloneWithShadowDOM(child));
    }
  }

  for (const child of node.childNodes) {
    clone.appendChild(cloneWithShadowDOM(child));
  }

  return clone;
}

function findCommentSections(clone, existingContent) {
  const candidates = clone.querySelectorAll(
    'shreddit-comment-tree, [id*="comments"], [id*="comment"], [class*="comments"], [role="feed"], [aria-label*="comment" i], [aria-label*="discussion" i], [data-testid="comments-section"], discourse-comments, .comment-tree, .post-comments, .thread'
  );

  let html = '';

  for (const el of candidates) {
    if (el.textContent.trim().length < 40) continue;
    if (existingContent.includes(el.textContent.trim().substring(0, 80))) continue;

    const tag = el.tagName.toLowerCase();
    if (tag === 'shreddit-comment-tree' || tag === 'discourse-comments' || el.matches('[role="feed"]')) {
      html += el.outerHTML;
      continue;
    }

    const innerEls = el.querySelectorAll('[class*="comment"], [class*="reply"], [class*="thread"], article');
    if (innerEls.length >= 2) {
      html += el.outerHTML;
    }
  }

  if (!html) {
    const articles = clone.querySelectorAll('article');
    let commentLike = '';
    for (const art of articles) {
      const text = art.textContent.trim();
      if (text.length > 40 && !existingContent.includes(text.substring(0, 60))) {
        commentLike += art.outerHTML;
      }
    }
    if (commentLike) return commentLike;
  }

  return html || null;
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
    const reader = new Readability(root);
    return reader.parse();
  } catch (e) {
    return null;
  }
}
