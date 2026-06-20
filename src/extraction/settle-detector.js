export function waitForDOMSettled(document_, options = {}) {
  const {
    timeout = 8000,
    stabilityThreshold = 500,
  } = options;

  return new Promise((resolve) => {
    let debounceTimer = null;
    let timeoutTimer = null;
    let mutationCount = 0;
    let settled = false;

    const observer = new MutationObserver((mutations) => {
      if (settled) return;

      const significant = mutations.filter((m) => {
        const target = m.target;
        if (!target || !target.closest) return false;

        if (target.closest('.webmd-loading, .webmd-body, .webmd-content')) return false;

        if (m.type === 'attributes' && m.attributeName === 'style') return false;
        if (m.type === 'attributes' && m.attributeName === 'class') {
          if (target.closest('[class*="animate" i], [class*="transition" i]')) return false;
          return true;
        }
        return true;
      });

      if (significant.length === 0) return;

      mutationCount += significant.length;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        settled = true;
        cleanup();
        resolve({ settled: true, mutationCount, timedOut: false });
      }, stabilityThreshold);
    });

    timeoutTimer = setTimeout(() => {
      settled = true;
      cleanup();
      resolve({ settled: false, mutationCount, timedOut: true });
    }, timeout);

    function cleanup() {
      observer.disconnect();
      clearTimeout(debounceTimer);
      clearTimeout(timeoutTimer);
    }

    try {
      observer.observe(document_.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
    } catch (e) {
      settled = true;
      cleanup();
      resolve({ settled: true, mutationCount: 0, timedOut: false });
    }

    debounceTimer = setTimeout(() => {
      settled = true;
      cleanup();
      resolve({ settled: true, mutationCount: 0, timedOut: false });
    }, stabilityThreshold);
  });
}