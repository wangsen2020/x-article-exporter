// 导出流水线的调度中心。
//
// PDF 生成：chrome.debugger + Page.printToPDF。这是扩展里唯一能拿到
// 「真 PDF、矢量文字、无打印对话框」的途径；代价是 Chrome 会显示
// 一条「正在调试此浏览器」的横幅。
//
// 所有格式都统一走 viewer.html：它渲染正文、内联图片存档、产出文件，
// 再由这里用 chrome.downloads 落盘——这样才拿得到完整的保存路径。

importScripts('archive.js');

// jobs 只存「回调」这种活不过重启的东西；任务负载放 chrome.storage.session。
// MV3 的 service worker 会在空闲约 30s 后被回收，万字长文导出远超这个时间——
// 全放内存的话 worker 一死，viewer 再来要 getJob 就拿到空，整条链断在半路，
// 表现正是「没有 PDF、没有存档，只掉一个本地 HTML」。
const jobs = new Map();
const jobKey = (id) => 'job:' + id;

// 工具栏图标现在挂的是 popup.html，chrome.action.onClicked 不会再触发，
// 导出入口改由 popup 里的按钮发 runExport 给 bridge.js。

// 回执有两条路：
//  1) 还攥着 sendResponse（同一个 worker 生命周期内）就原路返回；
//  2) worker 中途被回收过，回调早没了 —— 直接给发起页推一条消息。
// 只走第 1 条时，worker 一被回收，页面侧就永远等不到结果、永远转圈。
async function tell(id, tabId, payload) {
  const j = jobs.get(id);
  if (j && j.reply) {
    try { j.reply(payload); } catch (e) {}
    j.reply = null;
    return;
  }
  const tid = tabId || (j && j.srcTabId) || (await srcTabOf(id));
  if (tid) {
    try { await chrome.tabs.sendMessage(tid, Object.assign({ cmd: 'push' }, payload)); } catch (e) {}
  }
}

async function srcTabOf(id) {
  try {
    const o = await chrome.storage.session.get(jobKey(id));
    return (o[jobKey(id)] || {}).srcTabId || null;
  } catch (e) {
    return null;
  }
}

async function printToPdf(tabId) {
  const target = { tabId };
  await chrome.debugger.attach(target, '1.3');
  try {
    const r = await chrome.debugger.sendCommand(target, 'Page.printToPDF', {
      printBackground: true,
      preferCSSPageSize: true,
      paperWidth: 8.27, // A4
      paperHeight: 11.69,
      marginTop: 0.63,
      marginBottom: 0.63,
      marginLeft: 0.55,
      marginRight: 0.55,
    });
    return r && r.data;
  } finally {
    try { await chrome.debugger.detach(target); } catch (e) {}
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  // 内容脚本发起一次导出
  if (msg.cmd === 'export') {
    const id = String(Date.now()) + Math.random().toString(36).slice(2, 8);
    const payload = {
      doc: msg.doc,
      md: msg.md,
      title: msg.title,
      format: msg.format || 'pdf',
      meta: msg.meta || {},
      // 发起页的 tabId 也存进 session：worker 被回收后，回执还得找得到人
      srcTabId: (sender.tab && sender.tab.id) || null,
    };
    jobs.set(id, { reply: sendResponse, srcTabId: payload.srcTabId });
    const openViewer = () =>
      chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html?id=' + id), active: false }, (tab) => {
        const j = jobs.get(id);
        if (j) j.tabId = tab.id;
        chrome.storage.session.get(jobKey(id)).then((o) => {
          const p = o[jobKey(id)];
          if (p) chrome.storage.session.set({ [jobKey(id)]: Object.assign(p, { tabId: tab.id }) });
        });
      });
    // storage 写失败（超配额等）时也要回报，否则页面侧只能干等到超时
    chrome.storage.session.set({ [jobKey(id)]: payload }).then(openViewer, (e) => {
      tell(id, payload.srcTabId, { ok: false, error: 'session storage: ' + ((e && e.message) || e) });
      jobs.delete(id);
    });
    return true; // 异步回复
  }

  if (msg.cmd === 'getJob') {
    chrome.storage.session.get(jobKey(msg.id)).then((o) => sendResponse(o[jobKey(msg.id)] || {}));
    return true;
  }

  // viewer 每完成一步就报一次。两个用途：页面侧的提示能动起来（用户看得见
  // 卡在哪一步），以及每条消息都会重置 worker 的空闲计时，顺带续命。
  if (msg.cmd === 'progress') {
    srcTabOf(msg.id).then((tid) => {
      const t = (jobs.get(msg.id) || {}).srcTabId || tid;
      if (t) chrome.tabs.sendMessage(t, { cmd: 'push', progress: msg.text }).catch(() => {});
    });
    sendResponse({});
    return false;
  }

  if (msg.cmd === 'print') {
    const j = jobs.get(msg.id) || {};
    const tabId = (sender.tab && sender.tab.id) || j.tabId;
    if (!tabId) { sendResponse({}); return false; }
    printToPdf(tabId)
      .then((pdf) => sendResponse({ pdf: pdf || null }))
      .catch((err) => {
        // debugger 拿不到（DevTools 已打开 / 用户拒绝 / 策略限制）时不弹打印对话框，
        // 交回 viewer，它会继续把存档做完，再由内容脚本改走下载 HTML。
        j.printError = (err && err.message) || 'debugger unavailable';
        sendResponse({});
      });
    return true;
  }

  if (msg.cmd === 'download') {
    chrome.downloads.download({ url: msg.url, filename: msg.filename, saveAs: false }, (downloadId) => {
      const err = chrome.runtime.lastError;
      if (err || downloadId === undefined) {
        sendResponse({ ok: false, error: (err && err.message) || 'download failed' });
        return;
      }
      // 完整落盘路径要等下载结束才知道，但**绝不能在这里等**：
      // MV3 的 service worker 空闲约 30s 就被回收，一等就把 jobs 里那个
      // sendResponse 弄丢，内容脚本永远收不到结果——表现就是一直卡在
      // 「正在生成 PDF…」。这里立刻回执，路径交给常驻的 onChanged 补录。
      if (msg.postId) {
        chrome.storage.session.get('dl').then((o) => {
          const map = o.dl || {};
          map[downloadId] = { postId: msg.postId, format: msg.format };
          return chrome.storage.session.set({ dl: map });
        }).catch(() => {});
      }
      sendResponse({ ok: true, downloadId });
    });
    return true;
  }

  if (msg.cmd === 'finish') {
    const j = jobs.get(msg.id) || {};
    const viewerTab = (sender.tab && sender.tab.id) || j.tabId;
    sendResponse({});
    (async () => {
      const p = (await chrome.storage.session.get(jobKey(msg.id)))[jobKey(msg.id)] || {};
      await tell(msg.id, j.srcTabId || p.srcTabId, {
        ok: !!msg.ok,
        error: msg.error || j.printError,
        archived: !!msg.archived,
        format: msg.format || p.format,
      });
      const t = viewerTab || p.tabId;
      if (t) chrome.tabs.remove(t).catch(() => {});
      jobs.delete(msg.id);
      chrome.storage.session.remove(jobKey(msg.id));
    })();
    return false;
  }

  if (msg.cmd === 'openOptions') {
    chrome.runtime.openOptionsPage();
    return false;
  }

  // options 页请求打开某个已存档快照
  if (msg.cmd === 'openSnapshot') {
    self.XAEArchive.snapshot(msg.id).then((html) => {
      sendResponse({ html: html || null });
    });
    return true;
  }
});

// 下载落盘后补录真实路径。独立于导出流程，worker 被回收再唤醒也能继续。
chrome.downloads.onChanged.addListener(async (delta) => {
  if (!delta.state || delta.state.current !== 'complete') return;
  try {
    const { dl } = await chrome.storage.session.get('dl');
    const rec = dl && dl[delta.id];
    if (!rec) return;
    const items = await chrome.downloads.search({ id: delta.id });
    await self.XAEArchive.addFile(rec.postId, {
      format: rec.format,
      filename: (items && items[0] && items[0].filename) || '',
      downloadId: delta.id,
      at: Date.now(),
    });
    delete dl[delta.id];
    await chrome.storage.session.set({ dl });
  } catch (e) {}
});
