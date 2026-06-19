chrome.webNavigation.onHistoryStateUpdated.addListener(
  (details) => {
    if (details.frameId === 0) {
      chrome.tabs.sendMessage(details.tabId, {
        type: 'NAVIGATION',
        url: details.url,
      }).catch(() => {});
    }
  },
  { url: [{ schemes: ['http', 'https'] }] }
);

chrome.webNavigation.onReferenceFragmentUpdated.addListener(
  (details) => {
    if (details.frameId === 0) {
      chrome.tabs.sendMessage(details.tabId, {
        type: 'NAVIGATION',
        url: details.url,
      }).catch(() => {});
    }
  },
  { url: [{ schemes: ['http', 'https'] }] }
);