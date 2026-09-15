/*!
 * 工具栏图标的浮窗。
 *
 * 注意：manifest 里一旦声明 default_popup，chrome.action.onClicked 就不再触发，
 * 所以「点图标直接导出」的老行为改由这里的按钮承担（发 runExport 给 bridge.js）。
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const POST_RE = /^https:\/\/(x|twitter)\.com\/[^/]+\/status\/\d+/;
  const X_RE = /^https:\/\/(x|twitter)\.com\//;

  const fmtBytes = (n) => {
    if (!n) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    return (n / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + u[i];
  };

  $('history').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  (async function init() {
    // 存档用量：popup 是扩展页面，和 viewer / options 同源，直接读同一个库
    try {
      const u = await XAEArchive.usage();
      $('count').textContent = u.count ? u.count + ' 篇' : '';
      $('foot').textContent = u.count
        ? `本地已存档 ${u.count} 篇 · ${fmtBytes(u.bytes)}`
        : '导出一次后，快照会存到本地，原帖被删也还看得到。';
    } catch (e) {
      $('foot').textContent = '存档库读取失败：' + ((e && e.message) || e);
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = (tab && tab.url) || '';
    const state = $('state');

    if (!POST_RE.test(url)) {
      state.textContent = X_RE.test(url)
        ? '请先打开一条具体的帖子'
        : '在 X 的帖子页使用';
      return;
    }

    state.textContent = '可以导出当前这篇';
    state.className = 'state ok';

    [['pdf', 'pdf'], ['md', 'md'], ['html', 'html']].forEach(([id, mode]) => {
      const btn = $(id);
      btn.disabled = false;
      btn.addEventListener('click', () => {
        chrome.tabs.sendMessage(tab.id, { cmd: 'runExport', mode }, () => {
          // 内容脚本不在（扩展刚重载、页面没刷新）时给一句人话，而不是静默失败
          if (chrome.runtime.lastError) {
            state.textContent = '请刷新这个标签页后重试';
            state.className = 'state';
            return;
          }
          window.close();
        });
      });
    });
  })();
})();
