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

export function renderMarkdownPage(markdown, originalTitle, { theme = 'dark', fontSize = 17 } = {}) {
  applyDocumentPrefs(theme, fontSize);
  const htmlBody = marked.parse(markdown);

  const html = `<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(originalTitle)} — web/md</title>
  <style>${WEBMD_CSS}</style>
</head>
<body class="webmd-body">
  <div class="webmd-content">
    ${htmlBody}
  </div>
</body>`;

  document.documentElement.innerHTML = html;
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
