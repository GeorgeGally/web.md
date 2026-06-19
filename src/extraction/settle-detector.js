export function waitForDOMSettled(document_, options = {}) {
  const {
    timeout = 8000,
    stabilityThreshold = 500,
  } = options;

  return new Promise((resolve) => {
    let debounceTimer = null;
    let timeoutTimer = null;
    let mutationCount = 0;

    const observer = new MutationObserver((mutations) => {
      const significant = mutations.filter((m) => {
        if (m.type === 'attributes' && m.attributeName === 'style') return false;
        if (m.type === 'attributes' && m.attributeName === 'class') {
          const target = m.target;
          if (target.nodeType === Node.ELEMENT_NODE) {
            return !target.closest('[class*="animate" i], [class*="transition" i]');
          }
          return false;
        }
        return true;
      });

      if (significant.length === 0) return;

      mutationCount += significant.length;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        cleanup();
        resolve({ settled: true, mutationCount, timedOut: false });
      }, stabilityThreshold);
    });

    timeoutTimer = setTimeout(() => {
      cleanup();
      resolve({ settled: false, mutationCount, timedOut: true });
    }, timeout);

    function cleanup() {
      observer.disconnect();
      clearTimeout(debounceTimer);
      clearTimeout(timeoutTimer);
    }

    observer.observe(document_.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    debounceTimer = setTimeout(() => {
      cleanup();
      resolve({ settled: true, mutationCount: 0, timedOut: false });
    }, stabilityThreshold);
  });
}