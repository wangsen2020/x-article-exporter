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
  // 详情页走 TweetDetail；时间线（首页/个人页/搜索/列表/书签）各有各的 operation，
  // 一并收下——这样在时间线上就地导出也能拿到 note_tweet 富文本和原图，
  // 而不只是 DOM 里那点被截断的渲染结果。
  const RE = new RegExp(
    '/graphql/[^/?]+/(' +
      [
        'TweetDetail', 'TweetResultByRestId', 'ArticleTimeline',
        'HomeTimeline', 'HomeLatestTimeline',
        'UserTweets', 'UserTweetsAndReplies', 'UserMedia',
        'SearchTimeline', 'ListLatestTweetsTimeline', 'Bookmarks',
        'CommunityTweetsTimeline',
      ].join('|') +
    ')'
  );
  const MAX = 200;

  const keep = (url, json) => {
    if (buf.length >= MAX) buf.shift();
    buf.push({ url: String(url), json, t: Date.now() });
  };

  // Grok 的回答流。伪造 add_response 请求走不通（缺 X 前端现算的 x-client-transaction-id），
  // 所以由 grok.js 驱动 Grok 自己的输入框发请求，这里只截响应。
  // 这是拿到 Markdown **源码**的唯一途径：页面上渲染出来的只有排好版的文字。
  // 流是 ndjson，答案 = messageTag 为 final 的 message 按序拼接；
  // 不能无差别全拼，否则会把「Thinking about your request」这类状态文字也拼进去。
  const GROK_RE = /\/2\/grok\/add_response\.json/;
  const emitGrok = (text) => {
    const finals = [], others = [];
    for (const line of String(text).split(String.fromCharCode(10))) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line).result;
        if (!r || typeof r.message !== 'string') continue;
        if (r.messageTag === 'final') finals.push(r.message);
        else if (!r.isThinking && r.messageTag !== 'header') others.push(r.message);
      } catch (e) {}
    }
    const msg = finals.length ? finals.join('') : others.join('');
    window.postMessage({ __xae: 'grokStream', text: msg, raw: msg ? '' : String(text).slice(0, 400), t: Date.now() }, '*');
  };

  // fetch
  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (...args) {
      let url = '';
      try {
        const a = args[0];
        url = typeof a === 'string' ? a : a && a.url ? a.url : a && a.href ? a.href : '';
      } catch (e) {}
      const p = origFetch.apply(this, args);
      if (GROK_RE.test(url)) {
        p.then((resp) => {
          try { resp.clone().text().then(emitGrok).catch(() => {}); } catch (e) {}
        }).catch(() => {});
      }
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
