# web.md

web.md is a Chrome Manifest V3 extension that replaces web pages with a stripped-down markdown reading view.

It is meant to feel like browsing the web as semantic text: headings, paragraphs, links, lists, blockquotes, and code. No images, no sidebars, no visual clutter.

## Features

- Full-page markdown replacement for the current tab
- Always-on mode that persists across page reloads and navigations
- Dark and light reading themes
- Font size slider, persisted locally
- DOM settle detection for slow and SPA-heavy pages
- Readability extraction with Turndown markdown conversion
- Purist pass to remove common noise like nav, footers, cookie banners, social widgets, related content, and ads
- Reddit thread support via Reddit JSON + DOM fallbacks for post, author, subreddit, and comments
- YouTube watch-page support for title, channel, full description, metadata, and loaded comments
- Honest fallback for pages with little extractable content

## Install For Development

```sh
npm install
npm run build
```

Then load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/` directory

After rebuilding, click the extension reload button in `chrome://extensions`. Existing tabs may also need a page refresh.

## Usage

Click the extension icon to open the popup.

- **Enabled** toggles markdown mode on or off
- **Theme** switches between dark and light rendered pages
- **Size** changes the markdown reading font size

When enabled, the current page is transformed and future matching page loads are transformed automatically. Turning it off reloads the page back to the normal site.

## How It Works

The content script waits for the page DOM to settle, snapshots the current page, extracts meaningful content, converts it to markdown, and replaces the entire document with a rendered markdown view.

Extraction path:

1. Site-specific extractors for known difficult pages, currently Reddit threads and YouTube watch pages
2. Mozilla Readability for article-like pages
3. Comment/thread-aware DOM extraction for discussion pages
4. Metadata and raw-text fallbacks when no clean content is available

## Commands

```sh
npm run build       # Build dist/ for Chrome
npm run dev         # Watch-build content script
npm test            # Run tests
npm run test:watch  # Watch tests
```

## Project Structure

```text
manifest.json
build.js
src/
  background.js
  content.js
  extraction/
    readability-loader.js
    purist-pass.js
    settle-detector.js
  popup/
    popup.html
    popup.css
    popup.js
  rendering/
    markdown-renderer.js
  styles/
    webmd.css
tests/
  extraction/
```

## Notes And Limitations

- Chrome only for now
- Requires broad host permissions because always-on mode needs to run across sites
- Reddit and YouTube are handled specially because their rendered DOM is not article-like
- YouTube comments only appear if YouTube loads them before extraction finishes
- The extension does not export or download markdown files
- Images are intentionally removed rather than converted to alt text
- Some app-like pages will still produce thin output; that is preferred over inventing hidden content

## Development Notes

`dist/` is generated and ignored by git. Source files live under `src/`.

The extension uses:

- `@mozilla/readability` for primary content extraction
- `turndown` for HTML-to-markdown conversion
- `marked` for rendering markdown back into styled HTML
- `vitest` + `jsdom` for tests
