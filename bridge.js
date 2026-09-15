// 隔离世界的中继。MAIN world 里的 extract.js 没有 chrome.* API，
// 所以走 window.postMessage 把请求转给后台，再把结果转回页面。

// 扩展被重新加载 / 更新后，仍留在已打开标签页里的旧内容脚本会「上下文失效」：
// chrome.runtime 变成 undefined，或调用时抛 "Extension context invalidated"。
// 这种状态下什么都做不了，只能提示用户刷新页面。
const alive = () => {
  try { return !!(chrome && chrome.runtime && chrome.runtime.id); } catch (e) { return false; }
};

const reply = (payload) => window.postMessage(Object.assign({ __xae: 'result' }, payload), '*');

window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data) return;

  if (e.data.__xae === 'openOptions') {
    if (alive()) { try { chrome.runtime.sendMessage({ cmd: 'openOptions' }); } catch (err) {} }
    return;
  }

  if (e.data.__xae !== 'export') return;
  const { format, doc, md, title, meta } = e.data;

  if (!alive()) {
    // 桥接层已失效：不发 alive，直接回失败，让页面侧退回本地下载。
    reply({ ok: false, error: 'extension reloaded — refresh the page', format });
    return;
  }

  // 即时握手：告诉页面「扩展后台在，别急着退回本地导出」。
  // 长文的渲染 + 内联 + printToPDF 要十几秒，页面侧的 2.5s 兜底
  // 不能等它跑完才确认。
  window.postMessage({ __xae: 'alive' }, '*');

  try {
    chrome.runtime.sendMessage({ cmd: 'export', format, doc, md, title, meta }, (resp) => {
      const err = chrome.runtime.lastError;
      // 回执也可能是后台主动推过来的（见下面的 push 分支）。两条路只会走一条：
      // 后台还攥着这个回调就原路返回，回调丢了才改推送。
      if (err && !resp) {
        // worker 被回收，回调被丢弃。这里不当失败处理——推送那条路还在，
        // 真出事有页面侧的静默超时兜底。
        return;
      }
      reply({
        ok: !!(resp && resp.ok),
        error: (err && err.message) || (resp && resp.error),
        archived: !!(resp && resp.archived),
        blocks: resp && resp.blocks,
        format,
      });
    });
  } catch (err) {
    reply({ ok: false, error: (err && err.message) || String(err), format });
  }
});

// 后台主动推过来的消息：工具栏点击、导出进度、以及回调丢失时的最终回执
try {
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;
    if (msg.cmd === 'runExport') {
      window.postMessage({ __xae: 'run', mode: msg.mode || 'pdf' }, '*');
      return;
    }
    if (msg.cmd !== 'push') return;
    if (msg.progress !== undefined) {
      window.postMessage({ __xae: 'progress', text: msg.progress }, '*');
      return;
    }
    reply({ ok: !!msg.ok, error: msg.error, archived: !!msg.archived, format: msg.format });
  });
} catch (e) {}
