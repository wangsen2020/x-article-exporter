chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !/^https:\/\/(x|twitter)\.com\//.test(tab.url || '')) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['extract.js'] });
  } catch (e) {
    console.error('[x-article-exporter] inject failed', e);
  }
});
