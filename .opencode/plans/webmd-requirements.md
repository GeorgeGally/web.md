---
date: 2026-06-19
topic: web-md
---

# web/md

## Summary

A Chrome extension (Manifest V3) that replaces web pages with pure semantic markdown — headings, paragraphs, links, lists, code blocks, blockquotes, nothing else. Uses Readability for content extraction plus a custom purist pass. Two modes: one-click to strip the current page, and an always-on toggle that keeps every link followed in markdown mode until toggled off.

---

## Problem Frame

The modern web buries content under layers of styling, ads, trackers, popups, nav bars, and visual noise. What bots see — the raw semantic content — is a cleaner, quieter experience than what humans get. web/md is an art project that makes that bot-perspective visible: you browse the web and see only content. It doubles as a functional tool for anyone fatigued by web fluff who just wants the words.

---

## Actors

- A1. **Reader**: A person browsing the web who toggles web/md on to see pages as pure semantic markdown. They navigate the entire web in this mode, following links that stay in markdown until they toggle off.

---

## Key Flows

- F1. **One-click strip**
  - **Trigger:** Reader clicks the web/md extension icon on a page
  - **Actors:** A1
  - **Steps:**
    1. Reader clicks extension icon
    2. Page blanks, pulsing "Loading web.md..." appears
    3. Content script waits for DOM to settle (MutationObserver, up to 8s max)
    4. Readability extracts main content, purist pass strips remaining noise
    5. Page content is replaced with rendered markdown
    6. Links in the markdown are clickable and stay in markdown mode
  - **Outcome:** Reader sees the current page as pure semantic markdown
  - **Covered by:** R1, R2, R3, R4, R5

- F2. **Always-on mode**
  - **Trigger:** Reader toggles web/md on from extension popup
  - **Actors:** A1
  - **Steps:**
    1. Reader toggles always-on mode
    2. Current page enters the strip flow (F1)
    3. Every subsequent navigation (link click, URL bar, back/forward) triggers the strip flow automatically
    4. Reader toggles off to return to normal web browsing
  - **Outcome:** The entire browsing session stays in markdown mode until the reader chooses to leave
  - **Covered by:** R1, R2, R3, R4, R5, R6

- F3. **SPA / slow-loading page**
  - **Trigger:** Reader navigates to a JS-heavy page (Gmail, Twitter, etc.)
  - **Actors:** A1
  - **Steps:**
    1. Page blanks, pulsing "Loading web.md..." appears
    2. Content script runs at document_idle + MutationObserver
    3. Scrolling triggers lazy-loaded content
    4. After 8 seconds max (or DOM settles earlier), extract whatever content is available
    5. If extractable content exists, render as markdown
    6. If no meaningful content exists, show a minimal message with the page URL
  - **Outcome:** Reader sees whatever content bots could extract — honest, even if thin
  - **Covered by:** R4, R5, R7

---

## Requirements

**Content extraction**

- R1. The extension uses Readability (Mozilla's readability library) as the primary content extraction engine to identify and extract the main semantic content of a web page.
- R2. After Readability extraction, a purist pass strips remaining non-semantic elements that Readability leaves behind — promotional content, related articles, social sharing widgets, cookie notices, and any HTML that doesn't map to semantic markdown elements.
- R3. The output contains only semantic markdown: headings, paragraphs, links (preserving URLs as clickable), lists, code blocks, and blockquotes. No images, no metadata, no author/date/reading-time, no strip report, no sidebars, no footers, no nav.

**Page replacement and rendering**

- R4. When activated, the extension replaces the entire page content with the rendered markdown. The original page is not visible — full replacement mode.
- R5. While content extraction is in progress, the reader sees a blank page with a pulsing "Loading web.md..." message. Maximum wait time is 8 seconds before extracting whatever DOM content is available.

**Navigation and modes**

- R6. In always-on mode, every link click within the browser tab stays in markdown mode. The reader never leaves the markdown experience until they toggle the extension off. Internal and external links are both handled — clicking any link renders the destination as markdown.
- R7. Pages that yield thin or no extractable content (SPAs, dashboards, JS-heavy apps) show an honest rendering of what's available. The extension never blocks navigation — links always remain clickable even on thin pages.

**Extension controls**

- R8. The extension provides two controls: a one-click action to strip the current page, and an always-on toggle that keeps all subsequent navigations in markdown mode until toggled off.
- R9. When toggled off, the original page is restored or the page reloads normally, returning the reader to the standard web experience.

---

## Acceptance Examples

- AE1. **Covers R2, R3.** Given a news article page with Readability-extracted content that still contains a "Related Stories" section and a cookie consent banner, when the purist pass runs, the output markdown contains only the article headings, paragraphs, and links — no related stories, no cookie banner, no promotional content.
- AE2. **Covers R5, R7.** Given a Gmail inbox page (SPA with continuous DOM mutations), when web/md is activated, the "Loading web.md..." pulsing text appears for up to 8 seconds, then whatever navigation links and text content exist in the DOM are rendered as markdown — even if that output is thin (just nav items, no email bodies).
- AE3. **Covers R6.** Given always-on mode is active and the reader is viewing a markdown-rendered article on example.com, when they click an external link to another-site.com, that page also renders as markdown — the reader stays in the markdown experience across sites.
- AE4. **Covers R4, R8.** Given a full news article page with images, sidebar, footer, and ads, when the reader clicks the extension icon for a one-click strip, the entire original page is replaced with pure markdown text containing only the article's headings, paragraphs, and links.
- AE5. **Covers R9.** Given always-on mode is active and the reader is viewing a page in markdown mode, when they toggle the extension off, the page reloads or restores to its original rendered form with all styling, images, and layout intact.

---

## Success Criteria

- A reader can install web/md, toggle it on, and browse the entire web seeing only pure semantic text content — the experience should feel like discovering a parallel, quieter version of the internet.
- On well-structured content pages (articles, blog posts, documentation), the markdown output reads naturally with no residual noise — headings are headings, paragraphs are paragraphs, links are clickable.
- SPA and JS-heavy pages produce honest (possibly thin) output rather than breaking or showing errors — thin output is the product working correctly, not a bug.
- A downstream implementer can read this requirements doc and implement without inventing product behavior — all extraction logic, modes, and edge cases are specified.

---

## Scope Boundaries

- No Firefox or Safari support — Chrome first
- No file download/export — the .md experience is in-browser only
- No metadata extraction — no author, date, reading time, word count in output
- No image handling — images are stripped entirely, not converted to alt text
- No API interception or JSON reconstruction from network requests — extraction is DOM-based only
- No offline mode or caching of markdown output

---

## Key Decisions

- **Readability + purist pass over custom DOM walker**: Reliable content extraction (Readability handles the hard problem of identifying main content), with artistic control over the final output (the purist pass). The art is in how clean the output looks, not in how the content is found.
- **DOM-settle extraction over API interception**: Shows what's actually renderable, not reverse-engineered payloads. Thin output on SPAs is honest — that's what bots see.
- **Full page replacement over side-by-side**: The experience IS the product — the original page disappears entirely.
- **Pure semantic content only, no metadata**: The artistic statement is in the absence. No author, date, or strip report — just the words.
- **8-second max wait for DOM settling**: Gives SPAs adequate time to render while not leaving the reader staring at a loader indefinitely.

---

## Dependencies / Assumptions

- Mozilla's Readability library (or a maintained fork) is available for Manifest V3 content script use.
- Chrome Manifest V3 content scripts can inject into pages at `document_idle` and manipulate the full DOM.
- MutationObserver is available in content scripts to detect DOM settling.
- The extension will not handle PDFs, images, or non-HTML content types — only HTML pages.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R2][Technical] What specific HTML elements and patterns does the purist pass strip after Readability extraction? The purist pass rules need design during planning.
- [Affects R3][Technical] How should the markdown be rendered in the page? Raw monospaced markdown text, or styled HTML that looks like rendered markdown (monospace font, good typography, comfortable reading)?
- [Affects R5][Needs research] What DOM-settling heuristic works best? Options include: no mutations for N milliseconds, specific selector appearing, or hybrid. Research needed during planning.
- [Affects R6][Technical] How does the extension intercept navigation (link clicks, URL bar, back/forward) to apply markdown rendering to each new page in always-on mode — content script injection on every page load, or webNavigation API listeners?