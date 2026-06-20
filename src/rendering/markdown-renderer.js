import { marked } from 'marked';
import WEBMD_CSS from '../styles/webmd.css?raw';

export function renderLoadingState() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
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
</body>
</html>`;

  document.documentElement.innerHTML = html;
}

export function renderThinContent(url, title) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — web/md</title>
  <style>${WEBMD_CSS}</style>
</head>
<body class="webmd-body">
  <div class="webmd-content">
    <p class="webmd-thin">No extractable content on this page.</p>
    <p class="webmd-url">${escapeHtml(url)}</p>
  </div>
</body>
</html>`;

  document.documentElement.innerHTML = html;
}

export function renderMarkdownPage(markdown, originalTitle) {
  const htmlBody = marked.parse(markdown);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(originalTitle)} — web/md</title>
  <style>${WEBMD_CSS}</style>
</head>
<body class="webmd-body">
  <div class="webmd-content">
    ${htmlBody}
  </div>
</body>
</html>`;

  document.documentElement.innerHTML = html;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}