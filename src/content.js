import { waitForDOMSettled } from './extraction/settle-detector.js';
import { extractContent } from './extraction/readability-loader.js';
import { applyPuristPass } from './extraction/purist-pass.js';
import { renderMarkdownPage, renderLoadingState, renderThinContent } from './rendering/markdown-renderer.js';

let transformed = false;
let lastMarkdown = '';
let lastTitle = '';
let disabling = false;

async function getPrefs() {
  try {
    const result = await chrome.storage.local.get(['alwaysOn', 'formatted', 'theme', 'fontSize']);
    return {
      alwaysOn: result.alwaysOn === true,
      formatted: result.formatted === true,
      theme: result.theme || 'dark',
      fontSize: result.fontSize || 17,
    };
  } catch (e) {
    return { alwaysOn: false, formatted: false, theme: 'dark', fontSize: 17 };
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function extractRawText(doc) {
  const root = doc.body || doc.documentElement;
  if (!root) return '';
  return collectText(root).trim();
}

function extractMetadataMarkdown(doc) {
  const parts = [];
  const title = doc.querySelector('meta[property="og:title"]')?.content
    || doc.querySelector('meta[name="twitter:title"]')?.content
    || doc.querySelector('h1')?.textContent?.trim()
    || doc.title
    || '';
  const description = doc.querySelector('meta[property="og:description"]')?.content
    || doc.querySelector('meta[name="description"]')?.content
    || doc.querySelector('meta[name="twitter:description"]')?.content
    || '';

  if (title) parts.push(`# ${title}`);
  if (description && !title.includes(description)) parts.push(description);

  return parts.join('\n\n');
}

function extractStructuredLandingPage(doc) {
  const hero = doc.querySelector('.hero');
  const principles = doc.querySelector('.principles');
  const features = doc.querySelector('.features');
  if (!hero || !principles || !features) return null;

  const parts = [];
  appendText(parts, hero.querySelector('.eyebrow')?.textContent);
  appendHeading(parts, 1, hero.querySelector('h1')?.textContent);
  appendText(parts, hero.querySelector('.hero-copy')?.textContent);
  appendLinks(parts, hero.querySelectorAll('.actions a'));

  for (const principle of principles.querySelectorAll('.principle')) {
    appendHeading(parts, 2, principle.querySelector('h2')?.textContent);
  }

  const featureSection = features.closest('section');
  appendText(parts, featureSection?.querySelector('.section-label')?.textContent);
  appendHeading(parts, 2, featureSection?.querySelector('.section-heading h2')?.textContent);

  for (const feature of features.querySelectorAll('.feature')) {
    appendHeading(parts, 3, feature.querySelector('h3')?.textContent);
    appendText(parts, feature.querySelector('p')?.textContent);
  }

  const finalSection = doc.querySelector('.final');
  appendHeading(parts, 2, finalSection?.querySelector('h2')?.textContent);
  appendText(parts, finalSection?.querySelector('p')?.textContent);
  appendLinks(parts, finalSection?.querySelectorAll('.actions a'));

  const markdown = parts.filter(Boolean).join('\n\n');
  if (!markdown) return null;

  return {
    title: hero.querySelector('h1')?.textContent?.trim() || doc.title || '',
    markdown,
  };
}

function appendText(parts, text) {
  const value = text?.trim();
  if (value) parts.push(value);
}

function appendHeading(parts, level, text) {
  const value = text?.trim();
  if (value) parts.push(`${'#'.repeat(level)} ${value}`);
}

function appendLinks(parts, links) {
  const markdown = Array.from(links || [])
    .map((link) => {
      const text = link.textContent?.trim() || '';
      const href = link.getAttribute('href') || '';
      return text && href ? `[${text}](${href})` : '';
    })
    .filter(Boolean)
    .join(' ');
  if (markdown) parts.push(markdown);
}

function includesText(markdown, text) {
  const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const normalizedText = normalize(text);
  return normalizedText.length > 0 && normalize(markdown).includes(normalizedText);
}

function restoreMissingPrimaryHeading(markdown, doc, fallbackTitle) {
  const headingEl = doc.querySelector('main h1, h1');
  const heading = headingEl?.textContent?.trim() || fallbackTitle?.trim() || '';
  if (!heading || includesText(markdown, heading)) return markdown;

  const headingLink = headingEl?.querySelector('a[href]');
  const headingMarkdown = headingLink
    ? `# [${heading}](${headingLink.getAttribute('href')})`
    : `# ${heading}`;
  const previousText = headingEl?.previousElementSibling?.textContent?.trim() || '';
  if (!previousText) return `${headingMarkdown}\n\n${markdown}`.trim();

  const blocks = markdown.split(/\n{2,}/);
  const previousIndex = blocks.findIndex((block) => includesText(block, previousText));
  if (previousIndex === -1) return `${headingMarkdown}\n\n${markdown}`.trim();

  blocks.splice(previousIndex + 1, 0, headingMarkdown);
  return blocks.join('\n\n').trim();
}

function restoreMissingHeroLinks(markdown, doc) {
  const links = Array.from(doc.querySelectorAll('.hero .actions a'))
    .map((link) => {
      const text = link.textContent?.trim() || '';
      const href = link.getAttribute('href') || '';
      if (!text || !href || includesText(markdown, text)) return '';
      return `[${text}](${href})`;
    })
    .filter(Boolean);

  if (links.length === 0) return markdown;

  const heroCopy = doc.querySelector('.hero-copy')?.textContent?.trim() || '';
  const blocks = markdown.split(/\n{2,}/);
  const heroCopyIndex = blocks.findIndex((block) => includesText(block, heroCopy));
  if (heroCopyIndex === -1) return `${markdown}\n\n${links.join(' ')}`.trim();

  blocks.splice(heroCopyIndex + 1, 0, links.join(' '));
  return blocks.join('\n\n').trim();
}

function isGitHubProfileUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'github.com' &&
      /^\/[^/]+\/?$/.test(parsed.pathname) &&
      !parsed.pathname.startsWith('/orgs/');
  } catch (e) {
    return false;
  }
}

function extractGitHubProfile(doc) {
  const parts = [];

  const userName = doc.querySelector('.p-name')?.textContent?.trim() || '';
  const login = doc.querySelector('.p-nickname')?.textContent?.trim() || '';
  const bio = doc.querySelector('.p-note, [data-bio-text]')?.textContent?.trim() || '';
  const location = doc.querySelector('.p-label')?.textContent?.trim() || '';
  const website = doc.querySelector('.u-url')?.getAttribute('href') || '';

  const editableArea = doc.querySelector('.js-profile-editable-area');
  const followersEl = editableArea?.querySelector('a[href*="followers"]');
  const followingEl = editableArea?.querySelector('a[href*="following"]');
  const followers = followersEl?.textContent?.replace(/\s+/g, ' ').trim() || '';
  const following = followingEl?.textContent?.replace(/\s+/g, ' ').trim() || '';

  if (!userName && !login && !bio) return null;

  const profileLogin = login || (userName ? '' : '');

  if (userName) {
    const heading = profileLogin && profileLogin !== userName ? `# ${userName} (${profileLogin})` : `# ${userName}`;
    parts.push(heading);
  } else if (profileLogin) {
    parts.push(`# ${profileLogin}`);
  }

  if (bio) parts.push(bio);

  const meta = [];
  if (location) meta.push(location);
  if (website) meta.push(`[website](${website})`);
  if (followers) meta.push(followers);
  if (following) meta.push(following);
  if (meta.length > 0) parts.push(meta.join(' · '));

  const ownerLogin = profileLogin || userName;
  const repoAnchors = Array.from(doc.querySelectorAll('a'))
    .filter(a => {
      const href = a.getAttribute('href') || '';
      return href === `/${ownerLogin}/${href.split('/')[2]}` ||
        /^\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(href);
    })
    .filter(a => {
      const href = a.getAttribute('href') || '';
      const segments = href.split('/').filter(Boolean);
      return segments.length === 2 && segments[0].toLowerCase() === ownerLogin.toLowerCase();
    });

  const seenRepos = new Set();
  const repos = [];
  for (const a of repoAnchors) {
    const name = a.textContent?.trim();
    const href = a.getAttribute('href') || '';
    if (name && href && !seenRepos.has(name)) {
      seenRepos.add(name);
      repos.push(`- [${name}](https://github.com${href})`);
    }
  }
  if (repos.length > 0) {
    parts.push(`## Repositories\n${repos.join('\n')}`);
  }

  const markdown = parts.filter(Boolean).join('\n\n');
  if (!markdown) return null;

  return {
    title: userName || profileLogin || 'GitHub Profile',
    markdown,
  };
}

function isRedditThreadUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('reddit.com') && parsed.pathname.includes('/comments/');
  } catch (e) {
    return false;
  }
}

function isYouTubeWatchUrl(url) {
  try {
    const parsed = new URL(url);
    return (parsed.hostname === 'www.youtube.com' || parsed.hostname === 'youtube.com')
      && parsed.pathname === '/watch'
      && parsed.searchParams.has('v');
  } catch (e) {
    return false;
  }
}

async function prepareYouTubePage(url) {
  if (!isYouTubeWatchUrl(url)) return;

  try {
    document.querySelector('#description-inline-expander, ytd-text-inline-expander')?.click();
    document.querySelector('#expand, tp-yt-paper-button#expand')?.click();
  } catch (e) {}

  try {
    window.scrollTo({ top: Math.max(document.documentElement.scrollHeight * 0.65, 1200), behavior: 'instant' });
    await new Promise((resolve) => setTimeout(resolve, 2500));
    window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (e) {}
}

function extractYouTubeVideo(doc, url) {
  if (!isYouTubeWatchUrl(url)) return null;

  const playerResponse = parseYouTubePlayerResponse(doc);
  const structuredVideo = parseYouTubeStructuredVideo(doc);
  const details = playerResponse?.videoDetails || {};
  const title = details.title
    || structuredVideo?.name
    || doc.querySelector('meta[property="og:title"]')?.content
    || doc.querySelector('h1 yt-formatted-string, h1')?.textContent?.trim()
    || doc.title?.replace(/ - YouTube$/, '')
    || '';
  const author = details.author
    || structuredVideo?.author?.name
    || doc.querySelector('ytd-video-owner-renderer #channel-name a')?.textContent?.trim()
    || doc.querySelector('#owner #channel-name a')?.textContent?.trim()
    || '';
  const channelUrl = doc.querySelector('ytd-video-owner-renderer #channel-name a')?.href
    || doc.querySelector('link[itemprop="url"]')?.href
    || '';
  const description = details.shortDescription
    || structuredVideo?.description
    || collectText(doc.querySelector('ytd-watch-metadata #description-inline-expander'))
    || collectText(doc.querySelector('#description'))
    || doc.querySelector('meta[name="description"]')?.content
    || '';
  const views = doc.querySelector('meta[itemprop="interactionCount"]')?.content
    || structuredVideo?.interactionStatistic?.userInteractionCount
    || doc.querySelector('.view-count')?.textContent?.trim()
    || '';
  const published = doc.querySelector('meta[itemprop="datePublished"]')?.content
    || structuredVideo?.uploadDate
    || doc.querySelector('#info-strings yt-formatted-string')?.textContent?.trim()
    || '';

  if (!title && !description) return null;

  const parts = [];
  if (title) parts.push(`# ${title}`);

  const meta = [];
  if (author) meta.push(channelUrl ? `[${author}](${channelUrl})` : author);
  if (views) meta.push(formatYouTubeViews(views));
  if (published) meta.push(published);
  if (meta.length > 0) parts.push(meta.join(' · '));

  if (description) parts.push(description);

  const comments = extractYouTubeComments(doc);
  if (comments.length > 0) {
    parts.push('## Comments');
    parts.push(...comments);
  }

  return {
    title: title || 'YouTube video',
    markdown: parts.join('\n\n'),
  };
}

function formatYouTubeViews(views) {
  const raw = String(views).trim();
  const numeric = raw.replace(/[^0-9]/g, '');
  if (!numeric) return raw;
  return `${Number(numeric).toLocaleString()} views`;
}

function parseYouTubePlayerResponse(doc) {
  const markers = [
    'var ytInitialPlayerResponse =',
    'ytInitialPlayerResponse =',
    'window["ytInitialPlayerResponse"] =',
    'window.ytInitialPlayerResponse =',
  ];

  for (const script of doc.scripts) {
    const text = script.textContent || '';
    for (const marker of markers) {
      const start = text.indexOf(marker);
      if (start === -1) continue;

      const raw = extractJsonObject(text, start + marker.length);
      if (!raw) continue;

      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
  }
  return null;
}

function parseYouTubeStructuredVideo(doc) {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const parsed = JSON.parse(script.textContent || '{}');
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const video = items.find((item) => item?.['@type'] === 'VideoObject');
      if (video) return video;
    } catch (e) {}
  }
  return null;
}

function extractJsonObject(text, start) {
  const firstBrace = text.indexOf('{', start);
  if (firstBrace === -1) return '';

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let i = firstBrace; i < text.length; i++) {
    const ch = text[i];

    if (escaping) {
      escaping = false;
      continue;
    }
    if (ch === '\\') {
      escaping = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) return text.slice(firstBrace, i + 1);
  }

  return '';
}

function extractYouTubeComments(doc) {
  const comments = [];
  const seen = new Set();
  const nodes = doc.querySelectorAll('ytd-comment-thread-renderer, ytd-comment-view-model');

  for (const node of nodes) {
    const author = node.querySelector('#author-text, h3 a, a[href^="/@"]')?.textContent?.trim() || 'comment';
    const authorUrl = node.querySelector('#author-text, h3 a, a[href^="/@"]')?.href || '';
    const text = collectText(node.querySelector('#content-text, yt-attributed-string#content-text, [id="content-text"]')).trim();
    if (text.length < 5) continue;

    const key = `${author}:${text.slice(0, 120)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    comments.push(`### ${authorUrl ? `[${author}](${authorUrl})` : author}\n\n${text}`);
  }

  return comments;
}

async function extractRedditThread(url) {
  const parsed = new URL(url);
  if (!isRedditThreadUrl(url)) return null;

  const jsonUrl = new URL(parsed.href);
  jsonUrl.hash = '';
  jsonUrl.search = '';
  jsonUrl.pathname = jsonUrl.pathname.replace(/\/$/, '') + '.json';

  const response = await fetch(jsonUrl.href, {
    credentials: 'include',
    headers: { accept: 'application/json' },
  });

  if (!response.ok) return null;

  const data = await response.json();
  const post = data?.[0]?.data?.children?.[0]?.data;
  const comments = data?.[1]?.data?.children || [];
  if (!post?.title) return null;

  const parts = [`# ${post.title}`];
  const meta = redditMetaLine(post.subreddit_name_prefixed || `r/${post.subreddit}`, post.author);
  if (meta) parts.push(meta);
  if (post.selftext) parts.push(post.selftext);
  if (comments.length > 0) parts.push('## Comments');

  for (const comment of comments) {
    appendRedditComment(parts, comment, 3);
  }

  return {
    title: post.title,
    markdown: parts.join('\n\n'),
  };
}

function extractRedditThreadFromDOM(doc) {
  if (!isRedditThreadUrl(window.location.href)) return null;

  const post = doc.querySelector('shreddit-post')
    || doc.querySelector('[data-testid="post-container"]')
    || doc.querySelector('article');
  const title = post?.getAttribute?.('post-title')
    || post?.querySelector?.('h1')?.textContent?.trim()
    || doc.querySelector('h1')?.textContent?.trim()
    || doc.title;
  const subreddit = redditSubredditFromUrl(window.location.href);
  const author = post?.getAttribute?.('author')
    || post?.getAttribute?.('post-author')
    || post?.querySelector?.('[slot="authorName"], a[href^="/user/"], a[href^="/u/"]')?.textContent?.trim();

  const parts = [];
  if (title) parts.push(`# ${title}`);
  const meta = redditMetaLine(subreddit, author);
  if (meta) parts.push(meta);

  const postBody = post?.querySelector?.('[slot="text-body"], [data-testid="post-content"], [data-click-id="text"], div[id*="post-content"]')
    || post;
  const postText = postBody ? collectText(postBody).trim() : '';
  if (postText && !title?.includes(postText)) parts.push(postText);

  const comments = doc.querySelectorAll('shreddit-comment, [data-testid="comment"], [id^="t1_"], article[aria-label*="comment" i]');
  const seen = new Set();
  const commentParts = [];
  for (const comment of comments) {
    const text = collectText(comment).trim();
    if (text.length < 20) continue;
    const normalized = text.replace(/\s+/g, ' ').slice(0, 160);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const author = comment.getAttribute?.('author')
      || comment.querySelector?.('[slot="authorName"], a[href^="/user/"], a[href^="/u/"]')?.textContent?.trim()
      || 'comment';
    commentParts.push(`### ${redditUserMarkdown(author) || author}\n\n${text}`);
  }

  if (commentParts.length > 0) {
    parts.push('## Comments');
    parts.push(...commentParts);
  }

  if (parts.join('\n').trim().length < 20) return null;
  return {
    title: title || doc.title || 'Reddit thread',
    markdown: parts.join('\n\n'),
  };
}

function appendRedditComment(parts, node, depth) {
  if (!node || node.kind !== 't1') return;
  const comment = node.data;
  if (!comment?.body) return;

  const heading = '#'.repeat(Math.min(depth, 6));
  const author = redditUserMarkdown(comment.author) || 'comment';
  parts.push(`${heading} ${author}`);
  parts.push(comment.body);

  const replies = comment.replies?.data?.children || [];
  for (const reply of replies) {
    appendRedditComment(parts, reply, depth + 1);
  }
}

function redditMetaLine(subreddit, author) {
  const parts = [];
  const subredditLink = redditSubredditMarkdown(subreddit);
  const userLink = redditUserMarkdown(author);
  if (subredditLink) parts.push(subredditLink);
  if (userLink) parts.push(userLink);
  return parts.join(' · ');
}

function redditSubredditFromUrl(url) {
  try {
    const match = new URL(url).pathname.match(/\/r\/([^/]+)/i);
    return match ? `r/${match[1]}` : '';
  } catch (e) {
    return '';
  }
}

function redditSubredditMarkdown(subreddit) {
  const normalized = (subreddit || '').replace(/^\//, '').trim();
  if (!/^r\/[A-Za-z0-9_]+$/.test(normalized)) return '';
  return `[${normalized}](https://www.reddit.com/${normalized}/)`;
}

function redditUserMarkdown(author) {
  const normalized = (author || '').replace(/^u\//, '').replace(/^\/u\//, '').trim();
  if (!normalized || normalized === '[deleted]' || !/^[A-Za-z0-9_-]+$/.test(normalized)) return '';
  return `[u/${normalized}](https://www.reddit.com/user/${normalized}/)`;
}

function collectText(node) {
  if (!node) return '';
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_NODE) return '';

  if (node.nodeType === Node.ELEMENT_NODE) {
    const tagName = node.tagName;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'CANVAS'].includes(tagName)) return '';
    if (node.hidden || node.getAttribute('aria-hidden') === 'true') return '';
  }

  let text = '';
  if (node.nodeType === Node.ELEMENT_NODE && node.shadowRoot) {
    for (const child of node.shadowRoot.childNodes) {
      text += collectText(child) + '\n';
    }
  }

  for (const child of node.childNodes) {
    text += collectText(child) + '\n';
  }

  return text;
}

async function transformPage() {
  if (transformed) return;
  transformed = true;

  const prefs = await getPrefs();
  const originalTitle = document.title || '';
  const originalUrl = window.location.href;

  try {
    await withTimeout(
      waitForDOMSettled(document, {
        timeout: 8000,
        stabilityThreshold: 500,
      }),
      10000
    );
  } catch (e) {}

  try {
    await prepareYouTubePage(originalUrl);
  } catch (e) {}

  const rawText = extractRawText(document);
  const metadataMarkdown = extractMetadataMarkdown(document);
  lastMarkdown = '';
  lastTitle = originalTitle;

  try {
    const youtubeVideo = extractYouTubeVideo(document, originalUrl);
    if (youtubeVideo?.markdown) {
      lastMarkdown = youtubeVideo.markdown;
      lastTitle = youtubeVideo.title || originalTitle;
      renderLoadingState();
      renderMarkdownPage(lastMarkdown, lastTitle, prefs);
      return;
    }
  } catch (e) {}

  try {
    const githubProfile = extractGitHubProfile(document);
    if (githubProfile?.markdown && isGitHubProfileUrl(originalUrl)) {
      lastMarkdown = githubProfile.markdown;
      lastTitle = githubProfile.title || originalTitle;
      renderLoadingState();
      renderMarkdownPage(lastMarkdown, lastTitle, prefs);
      return;
    }
  } catch (e) {}

  try {
    const redditThread = await withTimeout(extractRedditThread(originalUrl), 6000);
    if (redditThread?.markdown) {
      lastMarkdown = redditThread.markdown;
      lastTitle = redditThread.title || originalTitle;
      renderLoadingState();
      renderMarkdownPage(lastMarkdown, lastTitle, prefs);
      return;
    }
  } catch (e) {}

  const isRedditThread = isRedditThreadUrl(originalUrl);

  try {
    const structuredLanding = extractStructuredLandingPage(document);
    if (structuredLanding?.markdown) {
      lastMarkdown = structuredLanding.markdown;
      lastTitle = structuredLanding.title || originalTitle;
      renderLoadingState();
      renderMarkdownPage(lastMarkdown, lastTitle, prefs);
      return;
    }
  } catch (e) {}

  try {
    const redditThread = extractRedditThreadFromDOM(document);
    if (redditThread?.markdown) {
      lastMarkdown = redditThread.markdown;
      lastTitle = redditThread.title || originalTitle;
      renderLoadingState();
      renderMarkdownPage(lastMarkdown, lastTitle, prefs);
      return;
    }
  } catch (e) {}

  let extracted;
  try {
    extracted = extractContent(document);
  } catch (e) {}

  renderLoadingState();

  if (extracted && extracted.content) {
    lastTitle = extracted.title || originalTitle;
    try {
      const turndownService = applyPuristPass();
      lastMarkdown = turndownService.turndown(extracted.content) || '';
      lastMarkdown = restoreMissingPrimaryHeading(lastMarkdown, document, extracted.title);
      lastMarkdown = restoreMissingHeroLinks(lastMarkdown, document);
    } catch (e) {}

    if (!lastMarkdown || lastMarkdown.trim().length === 0) {
      lastMarkdown = '';
    }
  }

  if (!lastMarkdown) {
    if (metadataMarkdown.length > 20) {
      lastMarkdown = metadataMarkdown;
      lastTitle = originalTitle;
      renderMarkdownPage(lastMarkdown, lastTitle, prefs);
      return;
    }

    if (isRedditThread) {
      renderThinContent(originalUrl, originalTitle, prefs);
      return;
    }

    if (rawText.length > 20) {
      const lines = rawText.split('\n').filter(l => l.trim()).join('\n\n');
      lastMarkdown = lines;
      lastTitle = originalTitle;
      renderMarkdownPage(lastMarkdown, lastTitle, prefs);
      return;
    }
    renderThinContent(originalUrl, originalTitle, prefs);
    return;
  }

  renderMarkdownPage(lastMarkdown, lastTitle, prefs);
}

function reRender() {
  if (!transformed || !lastMarkdown) return;
  getPrefs().then((prefs) => {
    renderMarkdownPage(lastMarkdown, lastTitle, prefs);
  });
}

function disable() {
  if (disabling) return;
  disabling = true;
  window.location.reload();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    if (message.type === 'STRIP' || message.type === 'ALWAYS_ON') {
      transformPage();
      sendResponse({ ok: true });
    } else if (message.type === 'ALWAYS_OFF') {
      disable();
      sendResponse({ ok: true });
    } else if (message.type === 'NAVIGATION') {
      sendResponse({ ok: true });
      getPrefs().then((prefs) => {
        if (prefs.alwaysOn) {
          transformed = false;
          transformPage();
        }
      });
    } else if (message.type === 'RERENDER') {
      reRender();
      sendResponse({ ok: true });
    }
  } catch (e) {
    sendResponse({ ok: false });
  }
  return true;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if ('alwaysOn' in changes) {
    if (changes.alwaysOn.newValue === true) {
      transformed = false;
      transformPage();
    } else {
      disable();
    }
  }
  if ('theme' in changes || 'fontSize' in changes) {
    reRender();
  }
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    getPrefs().then((prefs) => {
      if (prefs.alwaysOn) {
        transformed = false;
        transformPage();
      }
    });
  }
});

async function main() {
  const prefs = await getPrefs();
  if (prefs.alwaysOn) {
    transformPage();
  }
}

main();
