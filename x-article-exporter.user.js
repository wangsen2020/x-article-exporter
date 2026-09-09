// ==UserScript==
// @name         X Article → PDF
// @namespace    https://x.com/
// @version      1.1.0
// @description  把 X (Twitter) 的 Article 长文或推文串导出为保留排版、图片内联的可打印 HTML / PDF
// @match        https://x.com/*/status/*
// @match        https://twitter.com/*/status/*
// @match        https://x.com/i/articles/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';
  function run() {
    /*!
     * X Article / Thread -> 可打印 HTML -> PDF
     * 在 x.com 的 Article 长文页或推文串页运行，抽取正文结构，
     * 生成自包含（图片内联为 data URI）的干净 HTML，并调起打印。
     *
     * 已验证：X Article 模式的正文一次性全在 DOM 中（无虚拟化），
     * 使用 .longform-* class 作为稳定锚点。
     */
    (function () {
      'use strict';
    
      // ---------- 工具 ----------
      const esc = (s) =>
        String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const unesc = (s) => String(s).replace(/&amp;/g, '&');
      // X 图床：把缩略图规格升到原图
      const toOrig = (u) =>
        u ? u.replace(/name=(small|medium|large|tiny|900x900|360x360|240x240|4096x4096)/, 'name=orig') : u;
      const weight = (n) => parseInt(getComputedStyle(n).fontWeight, 10) || 400;
    
      function toast(msg, ms) {
        let t = document.getElementById('__xae_toast');
        if (!t) {
          t = document.createElement('div');
          t.id = '__xae_toast';
          t.style.cssText =
            'position:fixed;z-index:2147483647;left:50%;top:24px;transform:translateX(-50%);' +
            'background:#0f1419;color:#fff;padding:10px 18px;border-radius:999px;font:14px/1.4 system-ui,sans-serif;' +
            'box-shadow:0 6px 24px rgba(0,0,0,.28);pointer-events:none';
          document.body.appendChild(t);
        }
        t.textContent = msg;
        t.style.display = 'block';
        if (ms) setTimeout(() => t && (t.style.display = 'none'), ms);
      }
    
      // ---------- 行内序列化（保留 加粗 / 斜体 / 等宽 / 链接 / 换行） ----------
      // X 不用 <strong>/<b>，加粗是 CSS class 做的，所以必须走 computed style；
      // 且 font-weight 会继承，需与父元素比较，否则会产生嵌套重复的 <strong>。
      function inline(node) {
        let out = '';
        for (const n of node.childNodes) {
          if (n.nodeType === 3) { out += esc(n.nodeValue); continue; }
          if (n.nodeType !== 1) continue;
          if (n.tagName === 'BR') { out += '<br>'; continue; }
          if (n.tagName === 'IMG') { out += `<img src="${esc(toOrig(n.src))}" alt="">`; continue; }
          if (n.tagName === 'A') {
            const inner = inline(n) || esc(n.innerText);
            out += `<a href="${esc(n.href)}">${inner}</a>`;
            continue;
          }
          const cs = getComputedStyle(n);
          const p = n.parentElement;
          const isMono = (el) => el && /mono|consolas|courier|menlo/i.test(getComputedStyle(el).fontFamily);
          const bold = weight(n) >= 600 && (!p || weight(p) < 600);
          const ital = cs.fontStyle === 'italic' && (!p || getComputedStyle(p).fontStyle !== 'italic');
          const mono = isMono(n) && !isMono(p);
          let inner = inline(n);
          if (mono) inner = `<code>${inner}</code>`;
          if (ital) inner = `<em>${inner}</em>`;
          if (bold) inner = `<strong>${inner}</strong>`;
          out += inner;
        }
        return out;
      }
    
      // ---------- 抽取 A：Article 长文模式 ----------
      const ART_SEL = [
        '.longform-unstyled',
        '.longform-header-one',
        '.longform-header-two',
        '.longform-header-three',
        '.longform-blockquote',
        '.longform-ordered-list-item',
        '.longform-unordered-list-item',
        '.longform-code-block',
        '[data-testid="tweetPhoto"]',
      ].join(',');
    
      function extractArticle() {
        let nodes = [...document.querySelectorAll(ART_SEL)];
        if (!nodes.some((n) => /longform-/.test((n.className || '').toString()))) return null;
    
        // 去掉被其他块包住的嵌套节点，避免内容重复
        const set = new Set(nodes);
        nodes = nodes.filter((n) => {
          for (let p = n.parentElement; p; p = p.parentElement) if (set.has(p)) return false;
          return true;
        });
    
        const parts = [];
        let list = [], listTag = 'ol';
        const flush = () => { if (list.length) { parts.push(`<${listTag}>${list.join('')}</${listTag}>`); list = []; } };
    
        for (const el of nodes) {
          const c = (el.className || '').toString();
          if (el.getAttribute && el.getAttribute('data-testid') === 'tweetPhoto') {
            flush();
            const im = [...el.querySelectorAll('img')].map((i) => toOrig(i.src)).filter(Boolean);
            if (im.length) parts.push('<figure>' + im.map((s) => `<img src="${esc(s)}">`).join('') + '</figure>');
            continue;
          }
          if (/list-item/.test(c)) { listTag = /unordered/.test(c) ? 'ul' : 'ol'; list.push(`<li>${inline(el).trim()}</li>`); continue; }
          flush();
          if (/code-block/.test(c)) { parts.push(`<pre><code>${esc(el.innerText)}</code></pre>`); continue; }
          const html = inline(el).trim();
          if (!html) continue;
          if (/header-one/.test(c)) parts.push(`<h2>${html}</h2>`);
          else if (/header-two/.test(c)) parts.push(`<h3>${html}</h3>`);
          else if (/header-three/.test(c)) parts.push(`<h4>${html}</h4>`);
          else if (/blockquote/.test(c)) parts.push(`<blockquote>${html}</blockquote>`);
          else parts.push(`<p>${html}</p>`);
        }
        flush();
    
        const title =
          (document.title.match(/^.*? on X: "([\s\S]*?)"\s*\/ X$/) || [])[1] || document.title.replace(/\s*\/ X$/, '');
        return { kind: 'article', title, blocks: parts };
      }
    
      // ---------- 抽取 B：普通推文串（降级方案） ----------
      function extractThread() {
        const tweets = [...document.querySelectorAll('article[data-testid="tweet"]')];
        if (!tweets.length) return null;
    
        // 主贴作者 = URL 里的 handle，只保留其自串
        const owner = (location.pathname.match(/^\/([^/]+)\/status\//) || [])[1] || '';
        const parts = [];
        const seen = new Set();
    
        for (const t of tweets) {
          const link = t.querySelector('a[href*="/status/"]');
          const id = link ? (link.getAttribute('href').match(/status\/(\d+)/) || [])[1] : null;
          if (id && seen.has(id)) continue;
          if (id) seen.add(id);
    
          const nameEl = t.querySelector('[data-testid="User-Name"]');
          const handle = nameEl ? (nameEl.innerText.match(/@([A-Za-z0-9_]+)/) || [])[1] : '';
          if (owner && handle && handle.toLowerCase() !== owner.toLowerCase()) continue;
    
          const textEl = t.querySelector('[data-testid="tweetText"]');
          const time = t.querySelector('time');
          const body = textEl ? inline(textEl).trim() : '';
          const im = [...t.querySelectorAll('[data-testid="tweetPhoto"] img')].map((i) => toOrig(i.src)).filter(Boolean);
          if (!body && !im.length) continue;
    
          parts.push(
            `<section class="tw">` +
              (time ? `<div class="tw-meta">${esc(time.getAttribute('datetime') || time.innerText)}</div>` : '') +
              (body ? `<p>${body}</p>` : '') +
              (im.length ? '<figure>' + im.map((s) => `<img src="${esc(s)}">`).join('') + '</figure>' : '') +
            `</section>`
          );
        }
        if (!parts.length) return null;
        const title = document.title.replace(/\s*\/ X$/, '');
        return { kind: 'thread', title, blocks: parts };
      }
    
      // ---------- 图片内联为 data URI ----------
      async function inlineImages(html, onProgress) {
        const urls = [...new Set([...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]))];
        const map = {};
        let done = 0, failed = 0;
        await Promise.all(
          urls.map(async (u) => {
            try {
              // 注意：html 里的 URL 已被 HTML 转义，fetch 前必须把 &amp; 还原回 &，
              // 否则 X 图床会返回空响应，内联出来是空图。
              const resp = await fetch(unesc(u), { mode: 'cors' });
              if (!resp.ok) throw new Error('HTTP ' + resp.status);
              const blob = await resp.blob();
              if (!blob.size) throw new Error('empty');
              map[u] = await new Promise((res, rej) => {
                const f = new FileReader();
                f.onload = () => res(f.result);
                f.onerror = rej;
                f.readAsDataURL(blob);
              });
            } catch (e) {
              failed++;
            } finally {
              done++;
              onProgress && onProgress(done, urls.length);
            }
          })
        );
        return { html: html.replace(/src="([^"]+)"/g, (m, u) => (map[u] ? `src="${map[u]}"` : m)), total: urls.length, failed };
      }
    
      // ---------- 页面模板 ----------
      const CSS = `
    :root{--fg:#0f1419;--mut:#536471;--line:#e1e8ed;--acc:#1d9bf0;--bq:#f7f9fa}
    *{box-sizing:border-box}
    body{margin:0;font:17px/1.75 -apple-system,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif;color:var(--fg);background:#fff}
    .wrap{max-width:720px;margin:0 auto;padding:48px 28px 80px}
    h1{font-size:2em;line-height:1.3;margin:0 0 .3em;letter-spacing:-.01em}
    .meta{color:var(--mut);font-size:.9em;margin-bottom:2.2em;padding-bottom:1.2em;border-bottom:1px solid var(--line)}
    .meta a{color:var(--mut)}
    h2{font-size:1.45em;margin:1.9em 0 .6em;line-height:1.35;border-bottom:1px solid var(--line);padding-bottom:.3em}
    h3{font-size:1.18em;margin:1.6em 0 .5em}
    h4{font-size:1.03em;margin:1.4em 0 .4em}
    p{margin:0 0 1.15em;overflow-wrap:break-word}
    strong{font-weight:700}
    a{color:var(--acc);text-decoration:none;overflow-wrap:anywhere}
    blockquote{margin:1.4em 0;padding:.7em 1.1em;border-left:3px solid var(--acc);background:var(--bq);border-radius:0 6px 6px 0}
    blockquote p:last-child{margin:0}
    figure{margin:1.6em 0;text-align:center}
    figure img{max-width:100%;height:auto;border-radius:10px;border:1px solid var(--line)}
    ol,ul{margin:0 0 1.15em;padding-left:1.6em}
    li{margin:.35em 0}
    pre{background:var(--bq);border:1px solid var(--line);border-radius:8px;padding:1em;overflow-x:auto}
    code{font:.9em/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;background:#f0f3f5;padding:.15em .35em;border-radius:4px}
    pre code{background:none;padding:0}
    .tw{margin:0 0 1.6em;padding-bottom:1.2em;border-bottom:1px solid var(--line)}
    .tw-meta{color:var(--mut);font-size:.8em;margin-bottom:.4em}
    .bar{position:fixed;top:0;left:0;right:0;background:#0f1419;color:#fff;padding:8px 14px;font:13px system-ui,sans-serif;display:flex;gap:10px;align-items:center;z-index:9}
    .bar button{font:inherit;padding:5px 12px;border-radius:999px;border:0;background:#1d9bf0;color:#fff;cursor:pointer}
    .bar button.g{background:#2f3b45}
    .bar+.wrap{padding-top:72px}
    @page{size:A4;margin:16mm 14mm}
    @media print{
      body{font-size:11.5pt}
      .bar{display:none!important}
      .bar+.wrap,.wrap{max-width:none;padding:0}
      a{color:#0b62a4}
      a[href^="http"]::after{content:" (" attr(href) ")";font-size:.72em;color:#8a97a3;word-break:break-all}
      .meta a::after,h1 a::after{content:none}
      h1,h2,h3,h4{break-after:avoid;page-break-after:avoid}
      figure,blockquote,pre,li,img,.tw{break-inside:avoid;page-break-inside:avoid}
      figure img{border:none;max-height:88vh;object-fit:contain}
      p{orphans:3;widows:3}
    }`;
    
      function buildDoc(data, bodyHtml, sameTab) {
        const stamp = new Date().toLocaleString('zh-CN');
        const back = sameTab
          ? '<button class="g" onclick="history.back()">返回原文</button>'
          : '';
        return (
          '<!doctype html><html lang="zh"><head><meta charset="utf-8">' +
          '<meta name="viewport" content="width=device-width,initial-scale=1">' +
          `<title>${esc(data.title)}</title><style>${CSS}</style></head><body>` +
          '<div class="bar"><button onclick="print()">打印 / 存为 PDF</button>' + back +
          '<button class="g" onclick="(function(){var b=new Blob([document.documentElement.outerHTML],{type:\'text/html\'});' +
          'var a=document.createElement(\'a\');a.href=URL.createObjectURL(b);a.download=document.title.replace(/[\\\\/:*?\"<>|]/g,\'_\')+\'.html\';a.click()})()">' +
          '下载 HTML</button><span style="opacity:.6">已内联全部图片，可离线保存</span></div>' +
          `<div class="wrap"><h1>${esc(data.title)}</h1><div class="meta">来源：<a href="${esc(location.href)}">${esc(location.href)}</a><br>存档于 ${esc(stamp)}</div>` +
          bodyHtml +
          '</div></body></html>'
        );
      }
    
      // ---------- 预滚动：强制加载懒加载内容 ----------
      // X Article 的正文一次性全在 DOM，但配图是懒加载的：不预滚动就会抽到一堆空 figure。
      // 推文串则是虚拟列表，同样需要滚到底。图片一旦挂载不会被卸载，所以滚完回到顶部即可。
      // 标签页在后台时 Chrome 会节流定时器且不加载懒加载图片，
      // 导致导出结果整篇没有图。所以先等页面回到前台。
      async function waitVisible(onWait) {
        if (!document.hidden) return true;
        onWait && onWait();
        return await new Promise((res) => {
          const to = setTimeout(() => { cleanup(); res(false); }, 120000);
          const cleanup = () => { clearTimeout(to); document.removeEventListener('visibilitychange', h); };
          const h = () => { if (!document.hidden) { cleanup(); res(true); } };
          document.addEventListener('visibilitychange', h);
        });
      }
    
      async function forceLoad(onTick) {
        const imgCount = () => document.querySelectorAll('main img, article img').length;
        const H = () => document.documentElement.scrollHeight;
        const step = Math.max(300, Math.round(window.innerHeight * 0.7));
        const t0 = Date.now();
        const BUDGET = 60000; // 最多 60s，避免超长页面卡死
        let y = 0, stable = 0, lastSig = '';
    
        while (Date.now() - t0 < BUDGET) {
          y += step;
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 420));
          const sig = H() + ':' + imgCount();
          if (y >= H()) {
            // 到底了，再等一轮看还有没有新内容/新图进来
            await new Promise((r) => setTimeout(r, 900));
            if (sig === lastSig && H() <= y) { if (++stable >= 2) break; } else { stable = 0; }
            y = Math.min(y, H());
          }
          lastSig = sig;
          onTick && onTick(Math.min(99, Math.round((y / Math.max(H(), 1)) * 100)), imgCount());
        }
    
        // 等图片真正解码完成，未完成的不阻塞
        const imgs = [...document.querySelectorAll('main img, article img')];
        await Promise.all(
          imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()))
        );
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 400));
        return imgs.length;
      }
    
      // ---------- 主流程 ----------
      // 注意：window.open 必须在任何 await 之前同步调用，否则用户手势的
      // transient activation 已过期，新窗口会被弹窗拦截器静默拦掉。
      let win = null;
      try { win = window.open('', '_blank'); } catch (e) { win = null; }
      if (win) {
        try {
          win.document.write(
            '<!doctype html><meta charset="utf-8"><title>正在导出…</title>' +
              '<body style="font:16px system-ui,sans-serif;color:#536471;display:flex;' +
              'align-items:center;justify-content:center;height:100vh;margin:0">正在抓取正文与图片，请稍候…</body>'
          );
        } catch (e) {}
      }
    
      (async function main() {
        try {
          if (!document.querySelector(ART_SEL) && !document.querySelector('article[data-testid="tweet"]')) {
            toast('没有识别到 X 长文或推文串内容，请在具体推文页运行', 4000);
            if (win) win.close();
            return;
          }
    
          const visible = await waitVisible(() => toast('请把本标签页切回前台，导出才能加载图片…'));
          if (!visible) {
            toast('页面长时间处于后台，已取消导出', 5000);
            if (win && !win.closed) win.close();
            return;
          }
    
          toast('正在滚动加载全部内容…');
          await forceLoad((pct, n) => toast(`正在加载内容 ${pct}%（已加载 ${n} 张图）…`));
    
          // 完整性校验：占位数 vs 实际加载数
          const slots = document.querySelectorAll('[data-testid="tweetPhoto"]').length;
          const got = [...document.querySelectorAll('main img, article img')].filter((i) => i.naturalWidth > 0).length;
          if (slots && got < slots) {
            toast(`注意：${slots} 处配图只加载出 ${got} 张，建议保持页面前台后重试`, 6000);
          }
    
          const data = extractArticle() || extractThread();
          if (!data || !data.blocks.length) {
            toast('解析失败：没有抽到正文内容', 4000);
            if (win) win.close();
            return;
          }
    
          toast('正在内联图片…');
          const res = await inlineImages(data.blocks.join('\n'), (d, t) => toast(`正在内联图片 ${d}/${t} …`));
          const doc = buildDoc(data, res.html, !win);
    
          if (win && !win.closed) {
            win.document.open();
            win.document.write(doc);
            win.document.close();
            setTimeout(() => { try { win.focus(); win.print(); } catch (e) {} }, 900);
          } else {
            // 弹窗被拦时的降级：直接在当前标签渲染，用浏览器后退键可回到原文
            document.open();
            document.write(doc);
            document.close();
            setTimeout(() => { try { window.print(); } catch (e) {} }, 900);
            return;
          }
    
          toast(
            `完成：${data.blocks.length} 个块，${res.total - res.failed}/${res.total} 张图已内联` +
              (res.failed ? `（${res.failed} 张失败，已保留远程链接）` : ''),
            5000
          );
        } catch (e) {
          toast('出错：' + e.message, 6000);
          console.error('[x-article-exporter]', e);
          if (win && !win.closed) try { win.close(); } catch (_) {}
        }
      })();
    })();
  }

  function mount() {
    if (document.getElementById('__xae_btn')) return;
    if (!/\/status\/\d+|\/i\/articles\//.test(location.pathname)) return;
    const b = document.createElement('button');
    b.id = '__xae_btn';
    b.textContent = '导出 PDF';
    b.style.cssText =
      'position:fixed;right:22px;bottom:22px;z-index:2147483646;padding:11px 20px;border:0;border-radius:999px;' +
      'background:#1d9bf0;color:#fff;font:14px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.24)';
    b.onclick = run;
    document.body.appendChild(b);
  }

  mount();
  // X 是 SPA，路由切换后按钮会被清掉，需要重新挂载
  let last = location.href;
  setInterval(() => {
    if (location.href !== last) { last = location.href; setTimeout(mount, 1200); }
    else mount();
  }, 1500);
})();
