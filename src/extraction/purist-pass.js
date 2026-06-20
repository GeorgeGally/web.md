import TurndownService from 'turndown';

const REMOVED_ELEMENTS = [
  'figure',
  'figcaption',
  'svg',
  'canvas',
  'video',
  'audio',
  'iframe',
  'object',
  'embed',
];

const REMOVED_SELECTORS = [
  '[class*="cookie" i]',
  '[class*="consent" i]',
  '[class*="banner" i]',
  '[class*="popup" i]',
  '[class*="overlay" i]',
  '[class*="modal" i]',
  '[class*="share" i]',
  '[class*="social" i]',
  '[id*="cookie" i]',
  '[id*="consent" i]',
  '[id*="banner" i]',
  '[class*="related" i]',
  '[class*="recommend" i]',
  '[class*="sidebar" i]',
  '[class*="newsletter" i]',
  '[class*="subscribe" i]',
  '[class*="promo" i]',
];

export function applyPuristPass() {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  });

  turndownService.remove(REMOVED_ELEMENTS);

  turndownService.addRule('stripImages', {
    filter: 'img',
    replacement: function () {
      return '';
    },
  });

turndownService.addRule('linkWrappingBlock', {
    filter: function (node) {
      if (node.nodeName !== 'A' || !node.getAttribute('href')) return false;

      for (const child of node.childNodes) {
        if (child.nodeType === Node.ELEMENT_NODE && /^H[1-6]$/.test(child.tagName)) {
          return true;
        }
      }
      return false;
    },
    replacement: function (content, node) {
      const href = node.getAttribute('href');
      const headingChild = Array.from(node.childNodes).find(
        (c) => c.nodeType === Node.ELEMENT_NODE && /^H[1-6]$/.test(c.tagName)
      );
      if (!headingChild || !href) return content;

      const level = parseInt(headingChild.tagName[1]);
      const hashes = '#'.repeat(level);
      const text = headingChild.textContent.trim();

      return `\n\n${hashes} [${text}](${href})\n\n`;
    },
  });

  const puristRule = {
    filter: function (node) {
      if (node.nodeType !== Node.ELEMENT_NODE) return false;

      if (node.tagName === 'NAV' || node.tagName === 'FOOTER' || node.tagName === 'ASIDE') {
        return true;
      }

      if (node.tagName === 'FORM') return true;

      for (const selector of REMOVED_SELECTORS) {
        if (node.matches && node.matches(selector)) {
          return true;
        }
      }

      return false;
    },
    replacement: function () {
      return '';
    },
  };

  turndownService.addRule('puristPass', puristRule);

  return turndownService;
}