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

// ---------- Grok Markdown ----------
// 在后台开一个 x.com/i/grok 标签，由那边的 grok.js 驱动 Grok 自己的输入框。
// 等待放在这里而不是 Grok 页里：那个标签在后台，页面定时器会被节流；
// 而这里每 3 秒一次 tabs.sendMessage 本身就会给 service worker 续命。
const GROK_LIMIT = 12 * 60 * 1000;   // 专家模式整理长串实测要好几分钟
let grokBusy = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function grokNote(st, secs, zh) {
  const t = secs >= 60
    ? Math.floor(secs / 60) + (zh ? ' 分 ' : 'm ') + (secs % 60) + (zh ? ' 秒' : 's')
    : secs + (zh ? ' 秒' : 's');
  switch (st.note) {
    case 'input': return zh ? 'Grok：等待输入框…' : 'Grok: waiting for the input box…';
    case 'mode': return zh ? 'Grok：选择模式（有专家模式就用专家）…' : 'Grok: picking a mode (Expert when available)…';
    case 'send': return zh ? 'Grok：正在提交…' : 'Grok: submitting…';
    case 'retry': return zh ? 'Grok 报错，已自动重试一次…' : 'Grok hiccupped — retrying once…';
    case 'writing':
      return zh ? 'Grok 正在写（已 ' + (st.len || 0) + ' 字，' + t + '）…'
                : 'Grok is writing (' + (st.len || 0) + ' chars, ' + t + ')…';
    default:
      return zh ? 'Grok 正在思考（' + t + '）…' : 'Grok is thinking (' + t + ')…';
  }
}

function downloadText(filename, text, mime) {
  return new Promise((resolve, reject) => {
    const url = 'data:' + mime + ';charset=utf-8,' + encodeURIComponent(text);
    chrome.downloads.download({ url, filename, saveAs: false, conflictAction: 'uniquify' }, (id) => {
      const err = chrome.runtime.lastError;
      if (err || id === undefined) reject(new Error((err && err.message) || 'download failed'));
      else resolve(id);
    });
  });
}

// MV3 的 service worker 随时可能被回收（实测在 Grok 还在写的时候就被换掉了），
// 内存里的轮询循环一死，Grok 写完了也没人去取。所以任务状态落到
// storage.session：worker 重启后（被 Grok 页的 grokWake 唤醒，或启动时自检）
// 从这里接着轮询。
const GROK_KEY = 'grokJob';
let grokLoop = false;   // 本 worker 实例里是否已有轮询在跑

const saveGrokJob = (job) => chrome.storage.session.set({ [GROK_KEY]: job });
const loadGrokJob = async () => (await chrome.storage.session.get(GROK_KEY))[GROK_KEY] || null;

function grokPush(job, o) {
  if (job && job.src) chrome.tabs.sendMessage(job.src, Object.assign({ cmd: 'grokPush' }, o)).catch(() => {});
}

async function endGrok(job, result) {
  grokPush(job, result);
  await chrome.storage.session.remove(GROK_KEY);
  if (job && job.tabId) chrome.tabs.remove(job.tabId).catch(() => {});
  grokBusy = false;
}

async function runGrok(srcTabId, req) {
  const zh = req.lang === 'zh';
  const job = { src: srcTabId, title: req.title, zh, tabId: null, stage: 'open', t0: Date.now() };
  try {
    grokPush(job, { progress: zh ? 'Grok：正在后台打开…' : 'Grok: opening in the background…' });
    const tab = await chrome.tabs.create({ url: 'https://x.com/i/grok', active: false });
    job.tabId = tab.id;
    await saveGrokJob(job);

    // 等 Grok 页上的内容脚本就位（bridge.js 回话，且 grok.js 已挂上）
    let ready = false;
    for (let i = 0; i < 60 && !ready; i++) {
      await sleep(1000);
      try {
        const r = await chrome.tabs.sendMessage(job.tabId, { cmd: 'grokPing' });
        ready = !!(r && r.main && (r.path || '').indexOf('/i/grok') === 0);
      } catch (e) { /* 页面还没加载出来 */ }
    }
    if (!ready) throw new Error(zh ? 'Grok 页面没有加载出来' : 'the Grok page did not load');

    await chrome.tabs.sendMessage(job.tabId, { cmd: 'grokDrive', prompt: req.prompt });
    job.stage = 'drive';
    job.t0 = Date.now();
    await saveGrokJob(job);
    await pollGrok(job);
  } catch (e) {
    await endGrok(job, { ok: false, error: (e && e.message) || String(e) });
  }
}

async function pollGrok(job) {
  if (grokLoop) return;
  grokLoop = true;
  grokBusy = true;
  const zh = job.zh;
  let last = '';
  try {
    while (Date.now() - job.t0 < GROK_LIMIT) {
      let st = null;
      try { st = await chrome.tabs.sendMessage(job.tabId, { cmd: 'grokPoll' }); } catch (e) {
        // 标签没了（用户关掉了）就别再等
        if (!(await chrome.tabs.get(job.tabId).catch(() => null))) {
          throw new Error(zh ? 'Grok 标签页被关掉了' : 'the Grok tab was closed');
        }
      }
      if (st && st.state === 'error') throw new Error(st.err || 'Grok error');
      if (st && st.state === 'done' && st.md) {
        await downloadText((job.title || 'grok') + ' (Grok).md', st.md, 'text/markdown');
        await endGrok(job, { ok: true, via: st.via });
        return;
      }
      if (st) {
        const note = grokNote(st, Math.round((Date.now() - job.t0) / 1000), zh);
        if (note !== last) { last = note; grokPush(job, { progress: note }); }
      }
      await sleep(3000);
    }
    throw new Error(zh ? '等了 12 分钟 Grok 还没写完' : 'Grok did not finish within 12 minutes');
  } catch (e) {
    await endGrok(job, { ok: false, error: (e && e.message) || String(e) });
  } finally {
    grokLoop = false;
  }
}

// worker 重启后接着干：只接「已经提交给 Grok」的任务，打开阶段断掉的直接判失败。
async function resumeGrok() {
  if (grokLoop) return;
  const job = await loadGrokJob();
  if (!job) return;
  if (job.stage !== 'drive' || Date.now() - job.t0 > GROK_LIMIT) {
    await endGrok(job, { ok: false, error: job.zh ? '后台被浏览器中断了，请重试' : 'the background worker was interrupted, please retry' });
    return;
  }
  pollGrok(job);
}
resumeGrok();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  // Grok 页的状态一变就来敲门：worker 若是刚被重启，借这个机会把轮询接上
  if (msg.cmd === 'grokWake') {
    resumeGrok();
    return false;
  }

  if (msg.cmd === 'grok') {
    const src = (sender.tab && sender.tab.id) || null;
    if (grokBusy) {
      if (src) chrome.tabs.sendMessage(src, {
        cmd: 'grokPush', ok: false,
        error: msg.lang === 'zh' ? '上一篇还在整理中' : 'another Grok rewrite is still running',
      }).catch(() => {});
    } else {
      grokBusy = true;
      runGrok(src, msg);
    }
    sendResponse({ ok: true });
    return false;
  }

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
