/*!
 * 导出流水线的执行页 —— 扩展自己的页面，独立于 x.com 的渲染进程，
 * 大文档在这里渲染不会冻住原页面。
 *
 * 三件事在这里做完：
 *  1. 渲染正文（PDF 需要，图片内联也需要先把图加载出来）
 *  2. 把图片抓成 data URI，得到「自包含快照」——原帖被删后唯一还能看的东西
 *  3. 产出目标格式的文件，交给后台走 chrome.downloads 落盘（拿得到完整路径）
 *
 * 为什么内联放在这里而不是内容脚本：几 MB 的字符串塞进 sendMessage 又慢又占内存，
 * 而这个页面是扩展同源的，能直接写 IndexedDB，省掉一整趟消息传递。
 *
 * 三条铁律，都是被真实的「一直转圈」教出来的：
 *  - 每个 await 都要有上限。任何一步悬着不回，页面侧就永远停在「正在生成…」，
 *    用户既等不到文件也等不到报错。
 *  - 任何退出路径都必须发 finish。以前 getJob 拿空就直接 return，于是后台的
 *    sendResponse 永远挂着、viewer 标签页永远留着、提示永远转圈。
 *  - 存档排在下载之后。存档是锦上添花，它慢或它坏都不该拖住用户真正要的那个文件。
 */
(function () {
  'use strict';

  // document.write 会清空文档，先把要用的东西抓进闭包
  const Archive = self.XAEArchive;
  const send = (msg) => chrome.runtime.sendMessage(msg);

  const MIME = { pdf: 'application/pdf', html: 'text/html', md: 'text/markdown' };

  const ID = new URLSearchParams(location.search).get('id');

  // 进度回传：页面侧靠它更新提示，后台靠它确认这边还活着（顺便重置 SW 的空闲计时）。
  const step = (text) => {
    try { send({ cmd: 'progress', id: ID, text }); } catch (e) {}
  };

  // 给任何 await 套一个上限。超时不抛「失败」，而是返回 fallback，
  // 让流水线带着残缺继续往下走——半份存档也比卡死强。
  function withTimeout(promise, ms, fallback) {
    let to;
    return Promise.race([
      Promise.resolve(promise).catch(() => fallback),
      new Promise((res) => { to = setTimeout(() => res(fallback), ms); }),
    ]).finally(() => clearTimeout(to));
  }

  // 并发上限。X 图床对同源并发有限流，一把梭反而更慢。
  async function pool(items, limit, fn) {
    const it = items[Symbol.iterator]();
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const n = it.next();
        if (n.done) return;
        await fn(n.value);
      }
    });
    await Promise.all(workers);
  }

  // 把 html 里的远程图片抓成 data URI。失败的保留原链接，不阻塞整体。
  //
  // 这里确实要重新请求一次：扩展页和 x.com 不同源，而 Chrome 的 HTTP 缓存按顶层
  // 站点分区，x.com 那边缓存的图对这个页面不算命中。所以先用 force-cache 尽量走
  // 本地缓存，真拿不到再退回画布——画布用的是本页已经解码好的那张图，零网络流量。
  async function inlineImages(html, onProgress) {
    const urls = [...new Set([...html.matchAll(/src="(https?:[^"]+)"/g)].map((m) => m[1]))];
    const map = {};
    let done = 0;

    // 本页已经渲染出来的图片，按原始 src 建索引，画布兜底时直接复用
    const painted = new Map();
    for (const img of document.images) {
      if (img.naturalWidth) painted.set(img.getAttribute('src'), img);
    }

    const fromCanvas = (img) => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        return c.toDataURL('image/jpeg', 0.88);
      } catch (e) {
        return null; // 跨源未授权时画布被污染，toDataURL 会抛
      }
    };

    await pool(urls, 6, async (u) => {
      try {
        // HTML 里的 URL 是转义过的，fetch 前要把 &amp; 还原成 &，
        // 否则 X 图床返回空响应且不报错，内联出来是一堆空图。
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 20000); // 单张封顶 20s
        try {
          const resp = await fetch(u.replace(/&amp;/g, '&'), { cache: 'force-cache', signal: ctrl.signal });
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          const blob = await resp.blob();
          if (!blob.size) throw new Error('empty');
          map[u] = await new Promise((res, rej) => {
            const f = new FileReader();
            f.onload = () => res(f.result);
            f.onerror = rej;
            f.readAsDataURL(blob);
          });
        } finally {
          clearTimeout(to);
        }
      } catch (e) {
        const img = painted.get(u);
        const d = img && fromCanvas(img);
        if (d) map[u] = d; // 网络拿不到，就用屏幕上那张
      } finally {
        onProgress && onProgress(++done, urls.length);
      }
    });

    return {
      html: html.replace(/src="(https?:[^"]+)"/g, (m, u) => (map[u] ? 'src="' + map[u] + '"' : m)),
      total: urls.length,
      inlined: Object.keys(map).length,
    };
  }

  // 取第一张图缩到 320px 宽做封面。data URI 是同源的，canvas 不会被污染。
  async function makeThumb(html) {
    const m = html.match(/<img[^>]+src="(data:image\/[^"]+)"/);
    if (!m) return null;
    try {
      const img = new Image();
      img.src = m[1];
      await withTimeout(img.decode(), 5000, null);
      if (!img.naturalWidth) return null;
      const w = 320;
      const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = Math.min(h, 240); // 高图只取顶部，避免封面过长
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      return c.toDataURL('image/jpeg', 0.7);
    } catch (e) {
      return null;
    }
  }

  let finished = false;
  function finish(payload) {
    if (finished) return;
    finished = true;
    send(Object.assign({ cmd: 'finish', id: ID }, payload));
  }

  // 总闸。上面每步都有超时，这条只防「谁都没想到的那种卡」。
  setTimeout(() => finish({ ok: false, error: '导出超时（4 分钟）' }), 240000);

  (async function main() {
    if (!ID) { finish({ ok: false, error: '缺少任务号' }); return; }

    const job = await withTimeout(send({ cmd: 'getJob', id: ID }), 15000, null);
    if (!job || !job.doc) {
      finish({ ok: false, error: '任务数据丢失（后台可能被回收，请重试）' });
      return;
    }

    const format = job.format || 'pdf';
    const meta = job.meta || {};

    step('正在排版…');
    document.open();
    document.write(job.doc);
    document.close();

    // 等图片真正解码完，否则 printToPDF 会出一份缺图的 PDF。
    // 整体封顶 30s——以前是「每张 15s」，十几张图各自超时能叠到分钟级。
    const imgs = [...document.images];
    const waiting = imgs.filter((i) => !(i.complete && i.naturalWidth));
    if (waiting.length) {
      let n = 0;
      step('正在加载图片 0/' + waiting.length + ' …');
      await withTimeout(
        Promise.all(
          waiting.map(
            (i) =>
              new Promise((res) => {
                const hit = () => { step('正在加载图片 ' + ++n + '/' + waiting.length + ' …'); res(); };
                i.addEventListener('load', hit, { once: true });
                i.addEventListener('error', hit, { once: true });
              })
          )
        ),
        30000,
        null
      );
    }
    await new Promise((r) => setTimeout(r, 300)); // 留一点布局稳定时间

    // ---- 产出目标文件 ----
    let blob = null;
    let ok = false;
    let error = null;

    if (format === 'pdf') {
      step('正在生成 PDF…');
      const res = await withTimeout(send({ cmd: 'print', id: ID, images: imgs.length }), 90000, null);
      if (res && res.pdf) {
        blob = new Blob([Uint8Array.from(atob(res.pdf), (c) => c.charCodeAt(0))], { type: MIME.pdf });
      } else {
        error = 'printToPDF 无结果';
      }
      // 没拿到 PDF 也继续往下存档——存档本身是独立的价值
    } else if (format === 'md') {
      blob = new Blob([job.md || ''], { type: MIME.md + ';charset=utf-8' });
    }

    // ---- 先落盘。用户要的就是这个文件，别让存档挡在它前面 ----
    const saveFile = async (b, ext) => {
      const url = URL.createObjectURL(b);
      const r = await withTimeout(
        send({
          cmd: 'download',
          id: ID,
          postId: meta.id || '',
          url,
          filename: (job.title || 'x-export') + '.' + ext,
          format,
        }),
        30000,
        null
      );
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      if (r && r.ok) { ok = true; error = null; }
      else error = (r && r.error) || '下载未启动';
    };

    if (blob) {
      step('正在保存文件…');
      await saveFile(blob, format);
    }

    // ---- 自包含快照：存档用，html 格式的下载也用它 ----
    let snap = null;
    try {
      step('正在内联图片…');
      snap = await withTimeout(
        inlineImages(job.doc, (d, n) => { if (n) step('正在内联图片 ' + d + '/' + n + ' …'); }),
        120000,
        null
      );
      if (format === 'html' && snap) {
        step('正在保存文件…');
        await saveFile(new Blob([snap.html], { type: MIME.html + ';charset=utf-8' }), 'html');
      }
      if (snap && meta.id && Archive) {
        step('正在写入存档…');
        await withTimeout(
          Archive.put(
            {
              id: meta.id,
              url: meta.url || '',
              handle: meta.handle || '',
              name: meta.name || '',
              title: job.title || meta.title || '',
              textPreview: (meta.textPreview || '').slice(0, 300),
              kind: meta.kind || '',
              blocks: meta.blocks || 0,
              images: { total: snap.total, inlined: snap.inlined },
              thumb: await makeThumb(snap.html),
            },
            snap.html
          ),
          20000,
          null
        );
      }
    } catch (e) {
      console.error('[x-article-exporter] archive failed', e);
    }

    if (!blob && format !== 'html') error = error || '没有可下载的内容';
    finish({ ok, error, format, archived: !!(snap && meta.id) });
  })().catch((e) => {
    console.error('[x-article-exporter] viewer', e);
    finish({ ok: false, error: (e && e.message) || String(e) });
  });
})();
