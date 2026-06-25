import { describe, it, expect, beforeEach } from 'vitest';
import { applyPuristPass } from '../../src/extraction/purist-pass.js';

describe('applyPuristPass', () => {
  let turndownService;

  beforeEach(() => {
    turndownService = applyPuristPass();
  });

  it('converts a simple paragraph to markdown', () => {
    const html = '<p>Hello world</p>';
    const result = turndownService.turndown(html);
    expect(result).toContain('Hello world');
  });

  it('converts headings to atx-style markdown', () => {
    const html = '<h1>Title</h1><h2>Subtitle</h2>';
    const result = turndownService.turndown(html);
    expect(result).toContain('# Title');
    expect(result).toContain('## Subtitle');
  });

  it('converts links to inline markdown', () => {
    const html = '<a href="https://example.com">Click here</a>';
    const result = turndownService.turndown(html);
    expect(result).toContain('[Click here](https://example.com)');
  });

  it('strips img elements entirely', () => {
    const html = '<p>Text before</p><img src="photo.jpg" alt="A photo"><p>Text after</p>';
    const result = turndownService.turndown(html);
    expect(result).toContain('Text before');
    expect(result).toContain('Text after');
    expect(result).not.toContain('A photo');
    expect(result).not.toContain('photo.jpg');
  });

  it('strips figure and figcaption elements', () => {
    const html = '<p>Content</p><figure><img src="x.jpg"><figcaption>A caption</figcaption></figure><p>More</p>';
    const result = turndownService.turndown(html);
    expect(result).toContain('Content');
    expect(result).toContain('More');
    expect(result).not.toContain('A caption');
  });

  it('strips nav elements', () => {
    const html = '<nav><a href="/home">Home</a><a href="/about">About</a></nav><p>Main content here</p>';
    const result = turndownService.turndown(html);
    expect(result).toContain('Main content here');
    expect(result).not.toContain('Home');
  });

  it('strips footer elements', () => {
    const html = '<p>Article text</p><footer>Copyright 2026</footer>';
    const result = turndownService.turndown(html);
    expect(result).toContain('Article text');
    expect(result).not.toContain('Copyright');
  });

  it('strips aside elements', () => {
    const html = '<p>Article text</p><aside>Related sidebar content</aside>';
    const result = turndownService.turndown(html);
    expect(result).toContain('Article text');
    expect(result).not.toContain('Related sidebar');
  });

  it('strips cookie banner elements by class', () => {
    const html = '<p>Content</p><div class="cookie-notice">Accept cookies</div><p>More content</p>';
    const result = turndownService.turndown(html);
    expect(result).not.toContain('Accept cookies');
  });

  it('strips consent banner elements by class', () => {
    const html = '<p>Content</p><div class="consent-banner">We use cookies</div>';
    const result = turndownService.turndown(html);
    expect(result).not.toContain('We use cookies');
  });

  it('strips social sharing elements by class', () => {
    const html = '<p>Content</p><div class="share-buttons">Share on Twitter</div>';
    const result = turndownService.turndown(html);
    expect(result).not.toContain('Share on Twitter');
  });

  it('strips related/recommended sections by class', () => {
    const html = '<p>Article</p><div class="related-articles">More like this</div>';
    const result = turndownService.turndown(html);
    expect(result).not.toContain('More like this');
  });

  it('strips newsletter/subscribe elements by class', () => {
    const html = '<p>Article</p><div class="newsletter-signup">Subscribe!</div>';
    const result = turndownService.turndown(html);
    expect(result).not.toContain('Subscribe');
  });

  it('preserves code blocks', () => {
    const html = '<pre><code>const x = 1;</code></pre>';
    const result = turndownService.turndown(html);
    expect(result).toContain('const x = 1;');
  });

  it('preserves blockquotes', () => {
    const html = '<blockquote><p>A quote</p></blockquote>';
    const result = turndownService.turndown(html);
    expect(result).toContain('A quote');
  });

  it('strips form elements', () => {
    const html = '<p>Content</p><form><input type="text"><button>Submit</button></form>';
    const result = turndownService.turndown(html);
    expect(result).not.toContain('Submit');
  });

  it('skips empty links from image-wrapping anchors', () => {
    const html = '<p><a href="https://x.com/photo/1"><img src="x.jpg"></a></p>';
    const result = turndownService.turndown(html);
    expect(result).not.toContain('[](https://x.com/photo/1)');
    expect(result).not.toContain('[ ](https://x.com/photo/1)');
  });

  it('skips links with only whitespace content', () => {
    const html = '<p><a href="https://x.com/test"> </a></p>';
    const result = turndownService.turndown(html);
    expect(result).not.toContain('[](https://x.com/test)');
  });

  it('preserves normal text links', () => {
    const html = '<a href="https://x.com/user">@username</a>';
    const result = turndownService.turndown(html);
    expect(result).toContain('[@username](https://x.com/user)');
  });

  it('preserves links with title attribute', () => {
    const html = '<a href="https://example.com" title="Example Site">click here</a>';
    const result = turndownService.turndown(html);
    expect(result).toContain('[click here](https://example.com "Example Site")');
  });

  it('skips links with only zero-width space content', () => {
    const html = '<p><a href="https://x.com/photo/1">\u200B</a></p>';
    const result = turndownService.turndown(html);
    expect(result).not.toContain('[()');
    expect(result).not.toContain('x.com/photo/1');
  });

  it('skips links with zero-width chars between elements', () => {
    const html = '<p><a href="https://x.com/photo/1"><span>\u200B</span><span>\u200B</span></a></p>';
    const result = turndownService.turndown(html);
    expect(result).not.toContain('[()');
  });
});