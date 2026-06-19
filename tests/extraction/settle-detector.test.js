import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('waitForDOMSettled', () => {
  let waitForDOMSettled;

  beforeEach(async () => {
    const module = await import('../../src/extraction/settle-detector.js');
    waitForDOMSettled = module.waitForDOMSettled;
  });

  it('resolves immediately when DOM is already stable', async () => {
    const result = await waitForDOMSettled(document, {
      timeout: 2000,
      stabilityThreshold: 100,
    });

    expect(result.settled).toBe(true);
    expect(result.timedOut).toBe(false);
  }, 5000);

  it('resolves after DOM mutations settle', async () => {
    const resultPromise = waitForDOMSettled(document, {
      timeout: 3000,
      stabilityThreshold: 200,
    });

    const div = document.createElement('div');
    document.body.appendChild(div);

    await new Promise((resolve) => setTimeout(resolve, 100));
    div.textContent = 'changed';

    const result = await resultPromise;

    expect(result.settled).toBe(true);
    expect(result.mutationCount).toBeGreaterThan(0);

    document.body.removeChild(div);
  }, 5000);

  it('times out when DOM never settles', async () => {
    const resultPromise = waitForDOMSettled(document, {
      timeout: 1000,
      stabilityThreshold: 500,
    });

    const div = document.createElement('div');
    document.body.appendChild(div);

    const interval = setInterval(() => {
      div.textContent = `tick ${Date.now()}`;
    }, 100);

    const result = await resultPromise;

    expect(result.settled).toBe(false);
    expect(result.timedOut).toBe(true);

    clearInterval(interval);
    document.body.removeChild(div);
  }, 3000);

  it('returns mutation count', async () => {
    const resultPromise = waitForDOMSettled(document, {
      timeout: 3000,
      stabilityThreshold: 100,
    });

    const div = document.createElement('div');
    document.body.appendChild(div);
    div.textContent = 'hello';

    const result = await resultPromise;

    expect(result.mutationCount).toBeGreaterThan(0);

    document.body.removeChild(div);
  }, 5000);
});