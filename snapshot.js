/*!
 * 存档快照的查看页。
 *
 * 快照正文是从 x.com 抽出来的第三方内容，不在扩展页面里直接渲染，
 * 而是塞进一个 sandbox iframe。只给 allow-same-origin（父页面要能调它的
 * print()），**不给 allow-scripts**——两者同时给等于没有沙箱。
 * 不给 allow-scripts 时框内脚本一律不执行，内联图片（data URI）照常显示。
 */
(function () {
  'use strict';

  const id = new URLSearchParams(location.search).get('id');
  const msg = document.getElementById('msg');
  const titleEl = document.getElementById('title');
  let frame = null;
  let blobUrl = null;
  let rec = null;

  const safeName = (s) => (s || 'x-snapshot').replace(/[\\/:*?"<>|\n\r\t]/g, '_').slice(0, 80).trim();

  document.getElementById('print').addEventListener('click', () => {
    if (frame && frame.contentWindow) frame.contentWindow.print();
  });

  document.getElementById('save').addEventListener('click', () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = safeName(rec && rec.title) + '.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  (async function main() {
    if (!id) { msg.textContent = '缺少存档 id'; return; }
    rec = await XAEArchive.get(id);
    const html = await XAEArchive.snapshot(id);
    if (!html) { msg.textContent = '这条存档已不存在'; return; }

    const t = (rec && rec.title) || '存档快照';
    document.title = t;
    titleEl.textContent = rec
      ? `${t}　·　存档于 ${new Date(rec.savedAt).toLocaleString('zh-CN', { hour12: false })}`
      : t;

    // 用 blob 而不是 srcdoc：快照动辄几 MB，srcdoc 要整段做 HTML 转义，又慢又占内存
    blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-same-origin'); // 故意不给 allow-scripts
    frame.src = blobUrl;
    frame.addEventListener('load', () => msg.remove());
    document.body.appendChild(frame);
  })().catch((e) => {
    msg.textContent = '载入失败：' + ((e && e.message) || e);
  });
})();
