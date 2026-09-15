// ==UserScript==
// @name         X Article → PDF
// @namespace    https://x.com/
// @version      2.1.1
// @description  把 X (Twitter) 的 Article 长文或推文串导出为保留排版的 PDF / 自包含 HTML
// @description:en Export X (Twitter) articles and threads as layout-preserving PDF / self-contained HTML
// @match        https://x.com/*
// @match        https://twitter.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

// document-start：网络拦截必须赶在 X 自己发起 TweetDetail 请求之前装好。
// 油猴环境没有扩展后台，PDF 请求会在 2.5s 后超时并自动改为下载自包含 HTML。
/*!
 * X Article Exporter — 网络层拦截器
 *
 * 必须在页面自己的脚本之前运行（document_start + MAIN world），
 * 把 X 的 GraphQL TweetDetail 响应原样缓存下来。
 *
 * 为什么需要它：推文串在 DOM 里是虚拟列表，滚动会卸载已经划走的推文，
 * 靠滚动抓 DOM 必然丢内容。而 TweetDetail 的响应里是完整的结构化数据，
 * 包含 note_tweet 富文本（加粗/斜体的精确码点区间）和 inline_media，
 * 这些信息在渲染后的 DOM 里已经损失掉了。
 */
(function () {
  'use strict';
  if (window.__XAE_HOOKED) return;
  window.__XAE_HOOKED = true;

  const buf = (window.__XAE_GQL = window.__XAE_GQL || []);
  const RE = /\/graphql\/[^/?]+\/(TweetDetail|TweetResultByRestId|ArticleTimeline)/;
  const MAX = 200;

  const keep = (url, json) => {
    if (buf.length >= MAX) buf.shift();
    buf.push({ url: String(url), json, t: Date.now() });
  };

  // fetch
  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (...args) {
      let url = '';
      try {
        const a = args[0];
        url = typeof a === 'string' ? a : a && a.url ? a.url : '';
      } catch (e) {}
      const p = origFetch.apply(this, args);
      if (RE.test(url)) {
        p.then((resp) => {
          try {
            resp
              .clone()
              .json()
              .then((j) => keep(url, j))
              .catch(() => {});
          } catch (e) {}
        }).catch(() => {});
      }
      return p;
    };
  }

  // XMLHttpRequest（X 目前主要走 fetch，但历史版本和部分请求走 XHR）
  const XP = XMLHttpRequest.prototype;
  const origOpen = XP.open;
  const origSend = XP.send;
  XP.open = function (method, url, ...rest) {
    try { this.__xaeUrl = String(url); } catch (e) {}
    return origOpen.call(this, method, url, ...rest);
  };
  XP.send = function (...args) {
    try {
      if (RE.test(this.__xaeUrl || '')) {
        this.addEventListener('load', () => {
          try { keep(this.__xaeUrl, JSON.parse(this.responseText)); } catch (e) {}
        });
      }
    } catch (e) {}
    return origSend.apply(this, args);
  };
})();

/*!
 * X Article / Thread -> 保留排版的 PDF / HTML
 *
 * 本文件定义 window.__XAE_RUN(mode)，并在帖子的操作栏里挂一个 PDF 按钮。
 * mode: 'pdf'（默认，交给扩展后台静默生成 PDF）| 'html'（图片内联后直接下载 HTML）
 *
 * 实测得到的三条硬约束（改代码前先读）：
 * 1. X Article 的正文只在「文章自身的滚动范围内」不虚拟化。一旦滚进评论区，
 *    整篇正文会被从 DOM 卸载（实测：滚到 document 底部后正文块数 136 -> 0，
 *    根 article 元素也被换掉）。所以预滚动必须停在文章底部，绝不能滚到 document 底。
 * 2. 所有选择器必须限定在正文根 article 内。全文档选择会把评论区的配图
 *    当成正文插图抽进来（实测某篇 11 张正文图被抽成 19 张）。
 * 3. 不要在页面里调 print()。新开的同源标签页和 x.com 共用渲染进程，
 *    大文档的打印预览会把原页面主线程一起冻住。
 */
(function () {
  'use strict';
  if (window.__XAE_RUN) return; // 避免重复注入

  // ---------- 工具 ----------
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const unesc = (s) => String(s).replace(/&amp;/g, '&');
  const toOrig = (u) =>
    u ? u.replace(/name=(small|medium|large|tiny|900x900|360x360|240x240|4096x4096)/, 'name=orig') : u;
  const weight = (n) => parseInt(getComputedStyle(n).fontWeight, 10) || 400;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 正文根：Article 和推文串都挂在这个元素下
  const articleRoot = () => document.querySelector('article[data-testid="tweet"]') || document.body;

  // ---------- i18n ----------
  // 所有面向用户的文案集中在这里，加语言只需在 I18N 里加一个键。
  const I18N = {
    en: {
      tipPdf: 'Export as PDF',
      tipPdfHint: 'Right-click: pick format',
      fmtPdf: 'PDF',
      fmtMd: 'Markdown',
      fmtHtml: 'HTML (self-contained)',
      mdDone: (blocks) => `Markdown downloaded — ${blocks} blocks`,
      busy: 'Export already in progress…',
      notPost: 'Open a specific post or article first',
      needForeground: 'Keep this tab in the foreground so images can load…',
      cancelledBackground: 'Tab stayed in the background — export cancelled',
      loading: (p, n) => `Loading article ${p}% (${n} images)…`,
      loadingStart: 'Loading article…',
      noContent: 'No content could be extracted',
      domFallback: 'No GraphQL data captured — fell back to DOM (long threads may be incomplete). Reload the page and retry for the full path.',
      imagesShort: (slots, got) => `Heads-up: ${got} of ${slots} images loaded`,
      inlining: (d, t) => `Inlining images ${d}/${t}…`,
      htmlDone: (blocks, ok, total) => `HTML downloaded — ${blocks} blocks, ${ok}/${total} images inlined`,
      pdfWorking: 'Generating PDF…',
      pdfDone: (blocks) => `PDF ready — check your downloads (${blocks} blocks)`,
      pdfFailed: (err) => `PDF failed (${err}) — downloading self-contained HTML instead`,
      noBackend: 'Extension backend not detected — downloading self-contained HTML instead',
      error: (m) => `Error: ${m}`,
    },
    zh: {
      tipPdf: '导出为 PDF',
      tipPdfHint: '右键：选择格式',
      fmtPdf: 'PDF',
      fmtMd: 'Markdown',
      fmtHtml: 'HTML（自包含）',
      mdDone: (blocks) => `已下载 Markdown：${blocks} 个块`,
      busy: '正在导出中，请稍候…',
      notPost: '请在具体的推文页或长文页运行',
      needForeground: '请把本标签页切回前台，导出才能加载图片…',
      cancelledBackground: '页面长时间处于后台，已取消',
      loading: (p, n) => `正在加载正文 ${p}%（${n} 张图）…`,
      loadingStart: '正在加载正文…',
      noContent: '没有抽到正文内容',
      domFallback: '未捕获到 GraphQL 数据，已降级抓 DOM（长串可能不全）；刷新页面后重试可走完整路径',
      imagesShort: (slots, got) => `注意：${slots} 处配图只加载出 ${got} 张`,
      inlining: (d, t) => `正在内联图片 ${d}/${t} …`,
      htmlDone: (blocks, ok, total) => `已下载 HTML：${blocks} 个块，${ok}/${total} 张图已内联`,
      pdfWorking: '正在生成 PDF…',
      pdfDone: (blocks) => `PDF 已生成，见浏览器下载列表（${blocks} 个块）`,
      pdfFailed: (err) => `PDF 生成失败（${err}），改为下载自包含 HTML`,
      noBackend: '未检测到扩展后台，改为下载自包含 HTML',
      error: (m) => `出错：${m}`,
    },
  };
  const LANG = /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
  const t = (key, ...args) => {
    const v = (I18N[LANG] && I18N[LANG][key]) !== undefined ? I18N[LANG][key] : I18N.en[key];
    if (v === undefined) return key;
    return typeof v === 'function' ? v(...args) : v;
  };

  function toast(msg, ms) {
    let t = document.getElementById('__xae_toast');
    if (!t) {
      t = document.createElement('div');
      t.id = '__xae_toast';
      t.style.cssText =
        'position:fixed;z-index:2147483647;left:50%;top:24px;transform:translateX(-50%);' +
        'background:#0f1419;color:#fff;padding:10px 18px;border-radius:999px;font:14px/1.4 system-ui,sans-serif;' +
        'box-shadow:0 6px 24px rgba(0,0,0,.28);pointer-events:none;max-width:80vw;text-align:center';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(t.__h);
    if (ms) t.__h = setTimeout(() => t && (t.style.display = 'none'), ms);
  }

  // ---------- 行内序列化 ----------
  // X 不用 <strong>，加粗是 CSS class 做的，只能走 computed style；
  // font-weight 会继承，必须和父元素比较，否则会产生嵌套重复的 <strong>。
  function inline(node) {
    let out = '';
    for (const n of node.childNodes) {
      if (n.nodeType === 3) { out += esc(n.nodeValue); continue; }
      if (n.nodeType !== 1) continue;
      if (n.tagName === 'BR') { out += '<br>'; continue; }
      if (n.tagName === 'IMG') { out += `<img src="${esc(toOrig(n.src))}" alt="">`; continue; }
      if (n.tagName === 'A') {
        out += `<a href="${esc(n.href)}">${inline(n) || esc(n.innerText)}</a>`;
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

  // ---------- 抽取 A：Article 长文 ----------
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

  const isArticlePage = () => !!document.querySelector('.longform-unstyled,.longform-header-one');

  // 「这条是不是 X 长文（Article）」的 DOM 标识。两种形态各有各的标记：
  //  - 详情页：正文直接渲染出来，带 twitterArticleReadView / longform-* 这套；
  //  - 时间线：长文被折叠成一张带封面的卡片，标记只剩 article-cover-image。
  // 普通推文（含 note_tweet 长推）这两套都不会出现，所以可以拿来判定。
  const ARTICLE_MARK = [
    '[data-testid="twitterArticleReadView"]',
    '[data-testid="twitterArticleRichTextView"]',
    '[data-testid="twitter-article-title"]',
    '[data-testid="longformRichTextComponent"]',
    '[data-testid="article-cover-image"]',
    '.longform-unstyled',
    '.longform-header-one',
  ].join(',');

  const isArticlePost = (root) => !!(root && root.querySelector(ARTICLE_MARK));

  function extractArticle() {
    if (!isArticlePage()) return null;
    const root = articleRoot(); // 约束 2：只在正文根内选，排除评论区
    let nodes = [...root.querySelectorAll(ART_SEL)];
    if (!nodes.length) return null;

    const set = new Set(nodes);
    nodes = nodes.filter((n) => {
      for (let p = n.parentElement; p; p = p.parentElement) if (set.has(p)) return false;
      return true;
    });

    const parts = [];
    const seenImg = new Set();
    let list = [], listTag = 'ol';
    const flush = () => { if (list.length) { parts.push(`<${listTag}>${list.join('')}</${listTag}>`); list = []; } };

    for (const el of nodes) {
      const c = (el.className || '').toString();
      if (el.getAttribute && el.getAttribute('data-testid') === 'tweetPhoto') {
        flush();
        const im = [...el.querySelectorAll('img')].map((i) => toOrig(i.src)).filter(Boolean);
        im.forEach((u) => seenImg.add(u));
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

    // 封面图可能在 longform 块之外，补一张放到最前面。
    // 注意：parts 里的 URL 已经过 esc()（& -> &amp;），不能拿原始 URL 去 includes 比对，
    // 否则永远匹配不上，封面会重复出现一次。这里改用抽取过程收集的原始 URL 集合。
    const cover = root.querySelector('[data-testid="tweetPhoto"] img, img[src*="/media/"]');
    if (cover && !seenImg.has(toOrig(cover.src))) {
      parts.unshift(`<figure><img src="${esc(toOrig(cover.src))}"></figure>`);
    }

    const title =
      (document.title.match(/^.*? on X: "([\s\S]*?)"\s*\/ X$/) || [])[1] || document.title.replace(/\s*\/ X$/, '');
    return { kind: 'article', title, blocks: parts };
  }

  // ---------- 抽取 B1：从 GraphQL TweetDetail 重建推文串 ----------
  function mediaUrl(m) {
    if (!m) return null;
    if (m.type === 'photo' || !m.type) return m.media_url_https ? m.media_url_https + '?name=orig' : null;
    return m.media_url_https || null; // 视频用封面图代替
  }

  function mediaIndex(tw) {
    const map = {};
    const list =
      (tw.legacy && tw.legacy.extended_entities && tw.legacy.extended_entities.media) ||
      (tw.legacy && tw.legacy.entities && tw.legacy.entities.media) || [];
    for (const m of list) {
      const u = mediaUrl(m);
      if (!u) continue;
      if (m.media_key) map[m.media_key] = u;
      if (m.id_str) map[m.id_str] = u;
    }
    return map;
  }

  // 注意：X 的所有 indices / from_index / to_index 都是**码点**下标，
  // 不是 UTF-16 code unit——中文和 emoji 下按 length 切会整体错位。
  function renderRich(text, ent, richtextTags, inlineMedia, mediaMap) {
    const cps = Array.from(text || '');
    const N = cps.length;
    const B = new Uint8Array(N), I = new Uint8Array(N);

    for (const t of richtextTags || []) {
      const types = t.richtext_types || [];
      const b = types.indexOf('Bold') >= 0, i = types.indexOf('Italic') >= 0;
      for (let k = Math.max(0, t.from_index | 0); k < Math.min(N, t.to_index | 0); k++) {
        if (b) B[k] = 1;
        if (i) I[k] = 1;
      }
    }

    const spans = [];
    const add = (idx, html) => {
      if (!idx) return;
      const s = idx[0] | 0, e = idx[1] | 0;
      if (s >= 0 && e > s && e <= N) spans.push([s, e, html]);
    };
    const E = ent || {};
    for (const u of E.urls || []) add(u.indices, `<a href="${esc(u.expanded_url || u.url)}">${esc(u.display_url || u.expanded_url || u.url)}</a>`);
    for (const m of E.user_mentions || []) add(m.indices, `<a href="https://x.com/${esc(m.screen_name)}">@${esc(m.screen_name)}</a>`);
    for (const h of E.hashtags || []) add(h.indices, `<a href="https://x.com/hashtag/${encodeURIComponent(h.text)}">#${esc(h.text)}</a>`);
    for (const m of E.media || []) add(m.indices, '');
    spans.sort((a, b) => a[0] - b[0] || b[1] - a[1]);

    const ins = new Map();
    for (const m of inlineMedia || []) {
      const u = mediaMap[m.media_id];
      if (!u) continue;
      const at = m.index | 0;
      ins.set(at, (ins.get(at) || '') + `<figure><img src="${esc(u)}"></figure>`);
    }

    let out = '', i = 0, si = 0, cur = 0;
    const setStyle = (want) => {
      if (want === cur) return;
      if (cur & 2) out += '</em>';
      if (cur & 1) out += '</strong>';
      if (want & 1) out += '<strong>';
      if (want & 2) out += '<em>';
      cur = want;
    };

    while (i < N) {
      if (ins.has(i)) { setStyle(0); out += ins.get(i); }
      while (si < spans.length && spans[si][0] < i) si++;
      if (si < spans.length && spans[si][0] === i) {
        setStyle(0);
        out += spans[si][2];
        i = spans[si][1];
        si++;
        continue;
      }
      setStyle((B[i] ? 1 : 0) | (I[i] ? 2 : 0));
      const ch = cps[i];
      out += ch === '\n' ? '<br>' : esc(ch);
      i++;
    }
    setStyle(0);
    if (ins.has(N)) out += ins.get(N);
    return out;
  }

  function unwrapTweet(r) {
    if (!r) return null;
    if (r.__typename === 'TweetWithVisibilityResults' || r.tweet) return r.tweet || null;
    if (r.__typename === 'TweetTombstone') return null;
    return r.legacy || r.rest_id ? r : null;
  }

  function userOf(tw) {
    const u = tw.core && tw.core.user_results && tw.core.user_results.result;
    if (!u) return { name: '', handle: '' };
    return {
      name: (u.core && u.core.name) || (u.legacy && u.legacy.name) || '',
      handle: (u.core && u.core.screen_name) || (u.legacy && u.legacy.screen_name) || '',
    };
  }

  function collectFromGQL() {
    const buf = window.__XAE_GQL || [];
    if (!buf.length) return null;
    const byId = new Map(), order = [];
    const take = (res, displayType) => {
      const tw = unwrapTweet(res);
      if (!tw || !tw.rest_id) return;
      // X 直接标注博主的自串续文为 SelfThread（区别于博主在评论区回复读者，那是 "Tweet"）。
      const stored = byId.get(tw.rest_id) || tw;
      if (displayType === 'SelfThread') stored.__xaeSelfThread = true;
      if (byId.has(tw.rest_id)) return;
      byId.set(tw.rest_id, tw);
      order.push(tw.rest_id);
    };
    // 只走真正属于这条对话的 entry：焦点推文（tweet-）和回复串（conversationthread-）。
    // 丢弃 tweetdetailrelatedtweets-*（「Discover more / 更多推荐」——通常是同作者的无关帖，
    // 正是过度导出的根源）、cursor-*、promoted-*、who-to-follow-* 等注入模块。
    const THREAD_ENTRY = /^(tweet|conversationthread)-\d/;
    const walk = (entries) => {
      for (const e of entries || []) {
        if (e.entryId && !THREAD_ENTRY.test(e.entryId)) continue;
        const c = e.content || {};
        if (c.itemContent && c.itemContent.tweet_results) {
          take(c.itemContent.tweet_results.result, c.itemContent.tweetDisplayType);
        }
        for (const it of c.items || []) {
          const ic = it.item && it.item.itemContent;
          if (ic && ic.tweet_results) take(ic.tweet_results.result, ic.tweetDisplayType);
        }
      }
    };
    for (const rec of buf) {
      const d = rec.json && rec.json.data;
      if (!d) continue;
      const conv = d.threaded_conversation_with_injections_v2 || d.threaded_conversation_with_injections;
      if (conv) for (const ins of conv.instructions || []) walk(ins.entries);
      if (d.tweetResult) take(d.tweetResult.result);
    }
    return order.length ? order.map((id) => byId.get(id)) : null;
  }

  // 把 TweetDetail 里的推文收敛到「焦点推文 + 博主自串」：
  //  - X 标注为 SelfThread 的同作者续文（博主在自己帖子下接着写的）——最可靠的信号；
  //  - 兜底：沿 in_reply_to 向上取同作者祖先、向下取回复进已保留集合的同作者推文。
  // 排除：其他人的回复；博主在评论区回复读者的推文（同作者但 displayType 为 "Tweet"、
  //       且 in_reply_to 指向的是读者的评论，不在保留集合里）；以及注入模块里的推文。
  function scopeToThread(tweets, focalId, owner) {
    const byId = new Map();
    for (const tw of tweets) if (tw && tw.rest_id) byId.set(tw.rest_id, tw);
    const focal = byId.get(focalId);
    if (!focal) return null; // 拿不到焦点推文，交回调用方走 author-only 兜底
    const same = (tw) => {
      const h = userOf(tw).handle;
      return !owner || !h || h.toLowerCase() === owner.toLowerCase();
    };
    const keep = new Set([focalId]);
    // X 明确标注的自串续文
    for (const tw of tweets) if (tw && tw.__xaeSelfThread && same(tw)) keep.add(tw.rest_id);
    for (let cur = focal; cur; ) {
      const irs = (cur.legacy || {}).in_reply_to_status_id_str;
      const parent = irs && byId.get(irs);
      if (!parent || !same(parent)) break;
      keep.add(irs);
      cur = parent;
    }
    for (let grew = true; grew; ) {
      grew = false;
      for (const tw of tweets) {
        if (!tw || !tw.rest_id || keep.has(tw.rest_id)) continue;
        const irs = (tw.legacy || {}).in_reply_to_status_id_str;
        if (irs && keep.has(irs) && same(tw)) { keep.add(tw.rest_id); grew = true; }
      }
    }
    return tweets.filter((tw) => tw && keep.has(tw.rest_id));
  }

  function extractThreadGQL() {
    const all = collectFromGQL();
    if (!all) return null;
    const owner = (location.pathname.match(/^\/([^/]+)\/status\//) || [])[1] || '';
    const focalId = (location.pathname.match(/\/status\/(\d+)/) || [])[1] || '';
    // 优先按回复链收敛；拿不到焦点推文时退回「只保留作者本人的推文」
    const tweets =
      scopeToThread(all, focalId, owner) ||
      all.filter((tw) => {
        const h = userOf(tw).handle;
        return !owner || !h || h.toLowerCase() === owner.toLowerCase();
      });
    const parts = [];
    let title = '', kept = 0;

    for (const tw of tweets) {
      const { name, handle } = userOf(tw);
      if (owner && handle && handle.toLowerCase() !== owner.toLowerCase()) continue; // 双保险：非作者不进串

      const lg = tw.legacy || {};
      const note = tw.note_tweet && tw.note_tweet.note_tweet_results && tw.note_tweet.note_tweet_results.result;
      const mediaMap = mediaIndex(tw);

      let bodyHtml;
      if (note && note.text) {
        bodyHtml = renderRich(note.text, note.entity_set,
          note.richtext && note.richtext.richtext_tags,
          note.media && note.media.inline_media, mediaMap);
      } else {
        let text = lg.full_text || '', entities = lg.entities;
        const range = lg.display_text_range;
        if (range && range.length === 2) {
          const cps = Array.from(text);
          text = cps.slice(range[0], range[1]).join('');
          if (entities) {
            const shift = range[0];
            const mv = (arr) => (arr || []).map((x) => Object.assign({}, x, { indices: [x.indices[0] - shift, x.indices[1] - shift] }));
            entities = { urls: mv(entities.urls), user_mentions: mv(entities.user_mentions), hashtags: mv(entities.hashtags), media: mv(entities.media) };
          }
        }
        bodyHtml = renderRich(text, entities, null, null, mediaMap);
      }

      const inlineIds = new Set(((note && note.media && note.media.inline_media) || []).map((m) => m.media_id));
      const attached = [];
      for (const m of (lg.extended_entities && lg.extended_entities.media) || []) {
        if (inlineIds.has(m.media_key) || inlineIds.has(m.id_str)) continue;
        const u = mediaUrl(m);
        if (u) attached.push({ url: u, isVideo: m.type && m.type !== 'photo' });
      }
      if (!bodyHtml.trim() && !attached.length) continue;
      if (!title) title = bodyHtml.replace(/<[^>]+>/g, '').trim().slice(0, 60) || 'X thread';

      const when = lg.created_at ? new Date(lg.created_at) : null;
      const permalink = `https://x.com/${handle || owner}/status/${tw.rest_id}`;
      parts.push(
        '<section class="tw"><div class="tw-meta">' +
          (name ? esc(name) + ' ' : '') +
          (handle ? `<a href="https://x.com/${esc(handle)}">@${esc(handle)}</a>` : '') +
          (when ? ' · ' + esc(when.toLocaleString('zh-CN')) : '') +
          ` · <a href="${esc(permalink)}">原文</a></div>` +
          (bodyHtml.trim() ? `<p>${bodyHtml}</p>` : '') +
          (attached.length
            ? '<figure>' + attached.map((a) =>
                a.isVideo
                  ? `<img src="${esc(a.url)}"><div class="tw-meta">（视频封面，原视频见「原文」）</div>`
                  : `<img src="${esc(a.url)}">`).join('') + '</figure>'
            : '') +
          '</section>'
      );
      kept++;
    }
    if (!kept) return null;
    return { kind: 'thread-gql', title: document.title.replace(/\s*\/ X$/, '') || title, blocks: parts };
  }

  // ---------- 抽取 B2：推文串 DOM 降级 ----------
  function extractThreadDOM() {
    let tweets = [...document.querySelectorAll('article[data-testid="tweet"]')];
    if (!tweets.length) return null;

    // 「Discover more / 更多推荐」分隔线：一个没有 article、但含 role="heading" 的 cellInnerDiv。
    // 它之后的推文是「Sourced from across X」的推荐（常是同作者的无关帖），不属于本串，切掉。
    const cells = [...document.querySelectorAll('div[data-testid="cellInnerDiv"]')];
    const divider = cells.find((c) => !c.querySelector('article') && c.querySelector('[role="heading"]'));
    if (divider) {
      const cut = cells.indexOf(divider);
      tweets = tweets.filter((tw) => {
        const cell = tw.closest('div[data-testid="cellInnerDiv"]');
        return !cell || cells.indexOf(cell) < cut;
      });
      if (!tweets.length) return null;
    }

    const owner = (location.pathname.match(/^\/([^/]+)\/status\//) || [])[1] || '';
    const focalId = (location.pathname.match(/\/status\/(\d+)/) || [])[1] || '';
    const idOf = (t) => {
      const link = t.querySelector('a[href*="/status/"]');
      return link ? (link.getAttribute('href').match(/status\/(\d+)/) || [])[1] : null;
    };
    const handleOf = (t) => {
      const nameEl = t.querySelector('[data-testid="User-Name"]');
      return nameEl ? ((nameEl.innerText.match(/@([A-Za-z0-9_]+)/) || [])[1] || '') : '';
    };
    // 自串 = 焦点推文之后一段连续的「同一作者」推文。一旦冒出别人的回复就进入了评论区，
    // 停在那里——博主在评论区回复读者的推文虽是同作者，但不属于这篇。
    const focalIdx = tweets.findIndex((t) => idOf(t) === focalId);
    if (focalIdx >= 0 && owner) {
      let end = tweets.length;
      for (let i = focalIdx + 1; i < tweets.length; i++) {
        const h = handleOf(tweets[i]);
        if (h && h.toLowerCase() !== owner.toLowerCase()) { end = i; break; }
      }
      tweets = tweets.slice(0, end);
    }

    const parts = [], seen = new Set();
    for (const t of tweets) {
      const id = idOf(t);
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      const handle = handleOf(t);
      if (owner && handle && handle.toLowerCase() !== owner.toLowerCase()) continue;
      const textEl = t.querySelector('[data-testid="tweetText"]');
      const time = t.querySelector('time');
      const body = textEl ? inline(textEl).trim() : '';
      const im = [...t.querySelectorAll('[data-testid="tweetPhoto"] img')].map((i) => toOrig(i.src)).filter(Boolean);
      if (!body && !im.length) continue;
      parts.push('<section class="tw">' +
        (time ? `<div class="tw-meta">${esc(time.getAttribute('datetime') || time.innerText)}</div>` : '') +
        (body ? `<p>${body}</p>` : '') +
        (im.length ? '<figure>' + im.map((s) => `<img src="${esc(s)}">`).join('') + '</figure>' : '') +
        '</section>');
    }
    return parts.length ? { kind: 'thread-dom', title: document.title.replace(/\s*\/ X$/, ''), blocks: parts } : null;
  }

  // ---------- 预加载：只滚到文章底部，绝不进评论区 ----------
  async function waitVisible() {
    if (!document.hidden) return true;
    toast(t('needForeground'));
    return await new Promise((res) => {
      const to = setTimeout(() => { done(); res(false); }, 120000);
      const done = () => { clearTimeout(to); document.removeEventListener('visibilitychange', h); };
      const h = () => { if (!document.hidden) { done(); res(true); } };
      document.addEventListener('visibilitychange', h);
    });
  }

  async function loadArticle(onTick) {
    // 守卫：正文块还没渲染出来时，articleRoot 的高度是 0，边界会算成负数
    for (let i = 0; i < 40 && !isArticlePage() && !document.querySelector('article[data-testid="tweet"]'); i++) {
      await sleep(500);
    }
    const root = () => articleRoot();
    const bottom = () => {
      const r = root();
      return r ? r.getBoundingClientRect().bottom + window.scrollY : 0;
    };
    const imgCount = () => root().querySelectorAll('img').length;

    const step = Math.max(300, Math.round(window.innerHeight * 0.7));
    const t0 = Date.now();
    let y = 0, stable = 0, last = '';

    while (Date.now() - t0 < 90000) {
      // 约束 1：停在文章尾部，留半屏余量。滚进评论区会导致正文被卸载。
      const limit = Math.max(0, bottom() - window.innerHeight * 0.5);
      y = Math.min(y + step, limit);
      window.scrollTo(0, y);
      await sleep(420);
      const sig = Math.round(bottom()) + ':' + imgCount();
      if (y >= limit - 2) {
        if (sig === last) { if (++stable >= 3) break; } else stable = 0;
      }
      last = sig;
      onTick && onTick(limit ? Math.min(99, Math.round((y / limit) * 100)) : 0, imgCount());
    }

    await Promise.all([...root().querySelectorAll('img')].map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
    window.scrollTo(0, 0);
    await sleep(300);
  }

  // ---------- 图片内联（仅「下载 HTML」用；PDF 路径让渲染端自己去取，避免几十 MB 的文档） ----------
  async function inlineImages(html, onProgress) {
    const urls = [...new Set([...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]))];
    const map = {};
    let done = 0, failed = 0;
    await Promise.all(urls.map(async (u) => {
      try {
        // html 里的 URL 已被转义，fetch 前必须还原 &amp; -> &，
        // 否则 X 图床返回空响应且不报错，内联出来是空图。
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
      } catch (e) { failed++; }
      finally { done++; onProgress && onProgress(done, urls.length); }
    }));
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
/* 一条推最多 4 张配图，X 自己就是 2×2 铺的。竖着一张一行、打印时再一张一页，
   会把 PDF 撑出好几页大白边；按原样铺成两列，四张图一页就装得下。 */
figure:has(img + img){display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start}
figure:has(img + img) img{width:100%}
ol,ul{margin:0 0 1.15em;padding-left:1.6em}
li{margin:.35em 0}
pre{background:var(--bq);border:1px solid var(--line);border-radius:8px;padding:1em;overflow-x:auto}
code{font:.9em/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;background:#f0f3f5;padding:.15em .35em;border-radius:4px}
pre code{background:none;padding:0}
.tw{margin:0 0 1.6em;padding-bottom:1.2em;border-bottom:1px solid var(--line)}
.tw-meta{color:var(--mut);font-size:.8em;margin-bottom:.4em}
@page{size:A4;margin:16mm 14mm}
@media print{
  body{font-size:11.5pt}
  .wrap{max-width:none;padding:0}
  a{color:#0b62a4}
  a[href^="http"]::after{content:" (" attr(href) ")";font-size:.72em;color:#8a97a3;word-break:break-all}
  /* 只有站外链接才值得把真实地址印出来。话题标签、@提及、「原文」这类站内跳转，
     锚文本已经说明一切，再附一串灰色 URL 只会把正文割得七零八落。 */
  .meta a::after,h1 a::after,.tw-meta a::after,
  a[href*="//x.com/"]::after,a[href*="//twitter.com/"]::after{content:none}
  h1,h2,h3,h4,.tw-meta{break-after:avoid;page-break-after:avoid}
  /* 「别拆开」只发给铁定装得下一页的东西。
     以前 .tw 和 figure 也在这张名单里，于是一条配了图的长推（正文 + 四张图，
     三四页高）整块躲不进任何一页，浏览器只好把它整个推到下一页开头——
     前一页就剩标题和几行字，大片留白。装不下的东西，让它断反而更好看。 */
  blockquote,pre,li,img{break-inside:avoid;page-break-inside:avoid}
  figure img{border:none;max-height:80vh;object-fit:contain}
  figure:has(img + img) img{max-height:42vh}
  p{orphans:3;widows:3}
}`;

  function buildDoc(data, bodyHtml) {
    const stamp = new Date().toLocaleString('zh-CN');
    return (
      '<!doctype html><html lang="zh"><head><meta charset="utf-8">' +
      `<title>${esc(data.title)}</title><style>${CSS}</style></head><body>` +
      `<div class="wrap"><h1>${esc(data.title)}</h1><div class="meta">来源：<a href="${esc(location.href)}">${esc(location.href)}</a><br>存档于 ${esc(stamp)}</div>` +
      bodyHtml + '</div></body></html>'
    );
  }

  // ---------- Markdown 序列化 ----------
  // 复用已经抽好的 block HTML（data.blocks），用 DOMParser 走一遍转成 Markdown。
  // 图片保留远程链接（![](url)），不内联——写进笔记里不该是几 MB 的 base64。
  function blocksToMarkdown(data) {
    const doc = new DOMParser().parseFromString('<div id="__r">' + data.blocks.join('\n') + '</div>', 'text/html');
    const root = doc.getElementById('__r');

    const inlineMd = (node) => {
      let out = '';
      for (const n of node.childNodes) {
        if (n.nodeType === 3) { out += n.nodeValue; continue; }
        if (n.nodeType !== 1) continue;
        const tag = n.tagName;
        if (tag === 'BR') { out += '  \n'; continue; }
        if (tag === 'IMG') { out += `![](${n.getAttribute('src') || ''})`; continue; }
        if (tag === 'A') { out += `[${inlineMd(n) || n.textContent}](${n.getAttribute('href') || ''})`; continue; }
        if (tag === 'STRONG' || tag === 'B') { out += `**${inlineMd(n)}**`; continue; }
        if (tag === 'EM' || tag === 'I') { out += `*${inlineMd(n)}*`; continue; }
        if (tag === 'CODE') { out += '`' + n.textContent + '`'; continue; }
        out += inlineMd(n);
      }
      return out;
    };
    const blockMd = (container) => {
      const parts = [];
      for (const el of container.children) {
        if (el.classList && el.classList.contains('tw-meta')) continue; // 元信息已单独输出
        const tag = el.tagName;
        if (tag === 'H1') parts.push('# ' + inlineMd(el).trim());
        else if (tag === 'H2') parts.push('## ' + inlineMd(el).trim());
        else if (tag === 'H3') parts.push('### ' + inlineMd(el).trim());
        else if (tag === 'H4') parts.push('#### ' + inlineMd(el).trim());
        else if (tag === 'BLOCKQUOTE') parts.push(inlineMd(el).trim().split('\n').map((l) => '> ' + l).join('\n'));
        else if (tag === 'UL') parts.push([...el.children].map((li) => '- ' + inlineMd(li).trim()).join('\n'));
        else if (tag === 'OL') parts.push([...el.children].map((li, i) => `${i + 1}. ` + inlineMd(li).trim()).join('\n'));
        else if (tag === 'PRE') parts.push('```\n' + el.textContent.replace(/\n$/, '') + '\n```');
        else if (tag === 'FIGURE') parts.push([...el.querySelectorAll('img')].map((im) => `![](${im.getAttribute('src') || ''})`).join('\n\n'));
        else if (tag === 'SECTION') {
          const meta = el.querySelector('.tw-meta');
          if (parts.length) parts.push('---');
          if (meta) parts.push('**' + meta.textContent.replace(/\s+/g, ' ').trim() + '**');
          const inner = blockMd(el);
          if (inner) parts.push(inner);
        } else {
          const s = inlineMd(el).trim();
          if (s) parts.push(s);
        }
      }
      return parts.filter(Boolean).join('\n\n');
    };

    const stamp = new Date().toLocaleString('zh-CN');
    return `# ${data.title}\n\n> 来源：${location.href}  \n> 存档于 ${stamp}\n\n---\n\n${blockMd(root)}\n`;
  }

  const safeName = (s) => (s || 'x-export').replace(/[\\/:*?"<>|\n\r\t]/g, '_').slice(0, 80).trim();

  function downloadFile(name, text, mime) {
    const blob = new Blob([text], { type: mime + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }

  // ---------- 主入口 ----------
  let running = false;
  window.__XAE_RUN = async function (mode) {
    if (running) { toast(t('busy'), 3000); return; }
    running = true;
    mode = mode || 'pdf';
    try {
      if (!isArticlePage() && !document.querySelector('article[data-testid="tweet"]')) {
        toast(t('notPost'), 4000);
        return;
      }
      if (!(await waitVisible())) { toast(t('cancelledBackground'), 5000); return; }

      const hasGQL = (window.__XAE_GQL || []).length > 0;
      const article = isArticlePage();
      // Article 的配图是懒加载的，必须预滚动；推文串走 GraphQL 时数据已经完整，不用滚。
      if (article || !hasGQL) {
        toast(t('loadingStart'));
        await loadArticle((pct, n) => toast(t('loading', pct, n)));
      }

      const data = extractArticle() || extractThreadGQL() || extractThreadDOM();
      if (!data || !data.blocks.length) { toast(t('noContent'), 5000); return; }
      if (data.kind === 'thread-dom') {
        toast(t('domFallback'), 7000);
      }
      if (article) {
        const slots = articleRoot().querySelectorAll('[data-testid="tweetPhoto"]').length;
        const got = [...articleRoot().querySelectorAll('img')].filter((i) => i.naturalWidth > 0).length;
        if (slots && got < slots) toast(t('imagesShort', slots, got), 5000);
      }

      if (mode === 'md') {
        downloadFile(safeName(data.title) + '.md', blocksToMarkdown(data), 'text/markdown');
        toast(t('mdDone', data.blocks.length), 6000);
        return;
      }

      if (mode === 'html') {
        toast(t('inlining', 0, 0));
        const res = await inlineImages(data.blocks.join('\n'), (d, n) => toast(t('inlining', d, n)));
        downloadFile(safeName(data.title) + '.html', buildDoc(data, res.html), 'text/html');
        toast(t('htmlDone', data.blocks.length, res.total - res.failed, res.total), 6000);
        return;
      }

      // PDF：文档保持「远程图片链接」的轻量形态（几十 KB），
      // 交给扩展在独立进程里渲染并静默出 PDF，避免大文档冻住 x.com 页面。
      const doc = buildDoc(data, data.blocks.join('\n'));
      toast(t('pdfWorking'));
      bridgeAlive = false;
      pdfRunning = true;
      window.postMessage({ __xae: 'pdf', doc, title: safeName(data.title), blocks: data.blocks.length }, '*');
      // 2.5s 内桥接层连一声「我在」都没有 → 不在扩展环境里跑，退回下载 HTML。
      // 只看桥接层是否活着，不看 PDF 有没有生成完——万字长文的 printToPDF
      // 本来就要十几秒，不能因为慢就误判成失败、把它打断。
      setTimeout(() => {
        if (!bridgeAlive && pdfRunning) {
          pdfRunning = false;
          toast(t('noBackend'), 6000);
          window.__XAE_RUN('html');
        }
      }, 2500);
      // 兜底：桥接层活着，但 120s 还没回结果（printToPDF 卡死却没回报）→ 下载 HTML。
      setTimeout(() => {
        if (pdfRunning) {
          pdfRunning = false;
          toast(t('pdfFailed', 'timeout'), 7000);
          window.__XAE_RUN('html');
        }
      }, 120000);
    } catch (e) {
      toast(t('error', e.message), 6000);
      console.error('[x-article-exporter]', e);
    } finally {
      running = false;
    }
  };

  // 兜底：不再走打印对话框。PDF 生成不了时直接下载自包含 HTML，
  // 同样是一个文件进下载列表，不打断操作。
  let bridgeAlive = false;   // 桥接层是否回过话（证明在扩展环境里）
  let pdfRunning = false;    // 是否有一次 PDF 流程正在进行

  // 后台把结果回传给页面，用来显示成功/失败
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data) return;
    // 桥接层收到请求后的即时握手：只表示「扩展后台在」，取消 2.5s 的兜底
    if (e.data.__xae === 'alive') { bridgeAlive = true; return; }
    if (e.data.__xae === 'result') {
      bridgeAlive = true;
      if (!pdfRunning) return; // 已被兜底接管，忽略迟到的结果，避免下载两份
      pdfRunning = false;
      if (e.data.ok) {
        toast(t('pdfDone', e.data.blocks), 6000);
      } else {
        toast(t('pdfFailed', e.data.error || 'unknown'), 7000);
        window.__XAE_RUN('html');
      }
    }
    // 工具栏图标点击经桥接转发过来
    if (e.data.__xae === 'run') window.__XAE_RUN(e.data.mode || 'pdf');
  });

  // ---------- 在帖子操作栏里挂 PDF 按钮 ----------
  // 纯图标，无文字：与 X 原生图标一致（viewBox 24x24、18.75px、fill 而非 stroke），
  // 文案全部放进 hover 提示，走 i18n，未来加语言不用碰 DOM 结构。
  const PDF_ICON =
    '<svg viewBox="0 0 24 24" width="18.75" height="18.75" aria-hidden="true" focusable="false" ' +
    'style="fill:currentColor;display:block">' +
    '<path fill-rule="evenodd" d="M6 2h8.4L20 7.6V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm0 1.75' +
    'a.25.25 0 0 0-.25.25v16c0 .14.11.25.25.25h12a.25.25 0 0 0 .25-.25V9h-4.5a1.5 1.5 0 0 1-1.5-1.5V3.75H6Z' +
    'm8 .81v2.94c0 .14.11.25.25.25h2.94L14 4.56Z"/>' +
    '<path d="M11.25 10.5h1.5v4.44l1.22-1.22 1.06 1.06-2.5 2.5a.75.75 0 0 1-1.06 0l-2.5-2.5 1.06-1.06 1.22 1.22V10.5Z"/>' +
    '</svg>';

  function makeTip(host, title, hint) {
    const tip = document.createElement('span');
    // 按钮固定在操作栏最右端，居中定位会溢出正文列被裁掉，所以右对齐。
    tip.style.cssText =
      'position:absolute;bottom:calc(100% + 6px);right:0;left:auto;' +
      'background:rgba(15,20,25,.92);color:#fff;font:12px/1.5 system-ui,sans-serif;white-space:nowrap;' +
      'padding:4px 8px;border-radius:4px;opacity:0;pointer-events:none;transition:opacity .12s;' +
      'z-index:2147483647;text-align:right';
    const l1 = document.createElement('span');
    l1.textContent = title;
    tip.appendChild(l1);
    if (hint) {
      tip.appendChild(document.createElement('br'));
      const l2 = document.createElement('span');
      l2.textContent = hint;
      l2.style.cssText = 'opacity:.62;font-size:11px';
      tip.appendChild(l2);
    }
    host.appendChild(tip);
    const show = () => (tip.style.opacity = '1');
    const hide = () => (tip.style.opacity = '0');
    host.addEventListener('mouseenter', show);
    host.addEventListener('mouseleave', hide);
    host.addEventListener('focus', show);
    host.addEventListener('blur', hide);
    return tip;
  }

  // ---------- 右键格式菜单 ----------
  function closeFormatMenu() {
    document.querySelectorAll('.__xae-menu').forEach((m) => m.remove());
    document.removeEventListener('keydown', onMenuKey, true);
  }
  function onMenuKey(e) { if (e.key === 'Escape') { e.stopPropagation(); closeFormatMenu(); } }

  function openFormatMenu(host) {
    closeFormatMenu();
    const menu = document.createElement('div');
    menu.className = '__xae-menu';
    menu.style.cssText =
      'position:absolute;bottom:calc(100% + 6px);right:0;left:auto;z-index:2147483647;' +
      'background:var(--xae-menu-bg,#fff);color:var(--xae-menu-fg,#0f1419);' +
      'border:1px solid rgba(120,120,120,.3);border-radius:10px;overflow:hidden;' +
      'box-shadow:0 8px 28px rgba(0,0,0,.22);min-width:150px;padding:4px;' +
      'font:13px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:left';
    if (matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) {
      menu.style.setProperty('--xae-menu-bg', '#1e2732');
      menu.style.setProperty('--xae-menu-fg', '#e7e9ea');
    }
    [['pdf', t('fmtPdf')], ['md', t('fmtMd')], ['html', t('fmtHtml')]].forEach(([m, label]) => {
      const row = document.createElement('div');
      row.textContent = label;
      row.style.cssText = 'padding:8px 12px;border-radius:6px;cursor:pointer;white-space:nowrap';
      row.addEventListener('mouseenter', () => { row.style.background = 'rgba(127,127,127,.16)'; });
      row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
      row.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        closeFormatMenu();
        window.__XAE_RUN(m);
      });
      menu.appendChild(row);
    });
    host.appendChild(menu);
    setTimeout(() => {
      document.addEventListener('click', closeFormatMenu, { once: true, capture: true });
      document.addEventListener('keydown', onMenuKey, true);
    }, 0);
  }

  function mountButton() {
    const root = document.querySelector('article[data-testid="tweet"]');
    if (!root) return;
    // 只有 X 长文（Article）给导出图标。SPA 路由切换后旧按钮还挂在被复用的
    // 节点上，所以判定为「不是长文」时要主动把它摘掉。
    if (!isArticlePost(root)) {
      document.querySelectorAll('.__xae-btn').forEach((b) => b.remove());
      return;
    }
    const group = root.querySelector('[role="group"]');
    if (!group || group.querySelector('.__xae-btn')) return;

    const wrap = document.createElement('div');
    wrap.className = '__xae-btn';
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('aria-label', t('tipPdf') + ' — ' + t('tipPdfHint'));
    wrap.tabIndex = 0;
    // 操作栏是 align-items:stretch，兄弟节点高 47px。给固定高度会变成顶端对齐，
    // 图标中心比原生图标高约 7px；改成 align-self:stretch 跟着撑满即可对齐同一基线。
    // 不加圆形背景，就是一个图标。
    wrap.style.cssText =
      'display:inline-flex;align-self:stretch;align-items:center;justify-content:center;' +
      'position:relative;padding:0 6px;cursor:pointer;color:rgb(244,33,46);' +
      'background:none;border:0;border-radius:0;transition:opacity .15s;' +
      '-webkit-tap-highlight-color:transparent';
    wrap.innerHTML = PDF_ICON;
    makeTip(wrap, t('tipPdf'), t('tipPdfHint'));

    wrap.addEventListener('mouseenter', () => { wrap.style.opacity = '.7'; });
    wrap.addEventListener('mouseleave', () => { wrap.style.opacity = '1'; });
    wrap.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (wrap.querySelector('.__xae-menu')) { closeFormatMenu(); return; }
      window.__XAE_RUN('pdf');
    });
    // 右键 / 长按：弹出格式菜单（PDF / Markdown / HTML）
    wrap.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); openFormatMenu(wrap); });
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.__XAE_RUN('pdf'); }
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); openFormatMenu(wrap); }
    });

    group.appendChild(wrap);
  }

  function boot() {
    mountButton();
    // X 是 SPA，路由切换和虚拟列表重建都会清掉按钮
    const mo = new MutationObserver(() => {
      if (!document.querySelector('.__xae-btn')) mountButton();
    });
    if (document.body) mo.observe(document.body, { childList: true, subtree: true });
    setInterval(mountButton, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
