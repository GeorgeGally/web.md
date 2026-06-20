import { marked } from 'marked';
import WEBMD_CSS from '../styles/webmd.css?raw';

export function renderLoadingState() {
  resetDocumentElement();

  const html = `<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>>> loading web.md</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #fafafa;
    }
    .webmd-loading {
      font-size: 18px;
      color: #999;
      letter-spacing: -0.3px;
      animation: webmd-pulse 1.5s ease-in-out infinite;
    }
    @keyframes webmd-pulse {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 1; }
    }
  </style>
</head>
<body>
  <div class="webmd-loading">>>loading web.md</div>
</body>`;

  document.documentElement.innerHTML = html;
}

export function renderThinContent(url, title, { theme = 'dark', fontSize = 17 } = {}) {
  applyDocumentPrefs(theme, fontSize);

  const html = `<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} — web/md</title>
  <style>${WEBMD_CSS}</style>
</head>
<body class="webmd-body">
  <div class="webmd-content">
    <p class="webmd-thin">No extractable content on this page.</p>
    <p class="webmd-url">${esc(url)}</p>
  </div>
</body>`;

  document.documentElement.innerHTML = html;
}

export function renderMarkdownPage(markdown, originalTitle, { formatted = false, theme = 'dark', fontSize = 17 } = {}) {
  applyDocumentPrefs(theme, fontSize);
  const htmlBody = formatted ? marked.parse(markdown) : renderBareMarkdown(markdown);
  const contentClass = formatted ? 'webmd-content' : 'webmd-content webmd-content-bare';

  const html = `<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(originalTitle)} — web/md</title>
  <style>${WEBMD_CSS}</style>
</head>
<body class="webmd-body">
  <div class="${contentClass}">
    ${htmlBody}
  </div>
</body>`;

  document.documentElement.innerHTML = html;
}

function renderBareMarkdown(markdown) {
  const html = esc(markdown || '')
    .split('\n')
    .map(highlightMarkdownLine)
    .join('\n');

  return `<pre class="webmd-bare" aria-label="Raw markdown">${html}</pre>`;
}

function highlightMarkdownLine(line) {
  let highlighted = highlightInlineMarkdown(line);

  highlighted = highlighted.replace(/^(\s*)(#{1,6})(\s+)(.*)$/, (_match, indent, marks, space, text) =>
    `${indent}<span class="webmd-md-token">${marks}</span>${space}<span class="webmd-md-heading">${text}</span>`
  );
  highlighted = highlighted.replace(/^(\s*)(&gt;)(\s?)/, '$1<span class="webmd-md-token">$2</span>$3');
  highlighted = highlighted.replace(/^(\s*)([-*+]|\d+\.)(\s+)/, '$1<span class="webmd-md-token">$2</span>$3');
  highlighted = highlighted.replace(/^(\s*)(`{3,}.*)$/, '$1<span class="webmd-md-token">$2</span>');
  highlighted = highlighted.replace(/^(\s*)(-{3,}|\*{3,}|_{3,})(\s*)$/, '$1<span class="webmd-md-token">$2</span>$3');

  return highlighted;
}

function highlightInlineMarkdown(line) {
  return line
    .replace(/(`+)([^`]+)(`+)/g, '<span class="webmd-md-token">$1</span><span class="webmd-md-code">$2</span><span class="webmd-md-token">$3</span>')
    .replace(/(\*\*|__)(.+?)(\1)/g, '<span class="webmd-md-token">$1</span><span class="webmd-md-strong">$2</span><span class="webmd-md-token">$3</span>')
    .replace(/(\*|_)([^*_\n]+?)(\1)/g, '<span class="webmd-md-token">$1</span><span class="webmd-md-em">$2</span><span class="webmd-md-token">$3</span>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="webmd-md-token">[</span><span class="webmd-md-link-text">$1</span><span class="webmd-md-token">](</span><span class="webmd-md-link-url">$2</span><span class="webmd-md-token">)</span>');
}

function applyDocumentPrefs(theme, fontSize) {
  document.documentElement.lang = 'en';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty('--font-size', `${fontSize}px`);
}

function resetDocumentElement() {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.removeProperty('--font-size');
}

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
