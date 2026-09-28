/*!
 * X Article Exporter — Grok Markdown
 *
 * 在 x.com/i/grok 上驱动 Grok 自己的输入框，把一段推文串整理成 Markdown 文章。
 * 做法沿用 x-feed-digest 里实测过的结论：
 *
 * - 伪造 add_response.json 请求走不通（缺 X 前端现算的 x-client-transaction-id），
 *   只能往 Grok 自己的输入框里写 prompt，让 X 自己的代码把请求发出去。
 * - 发之前切到专家模式。Auto 会自己挑 Fast，整理长串时结构和取舍都明显差一截。
 *
 * 答案有两条来路：
 *   1. net-hook.js 截到的响应流 —— 模型输出的 Markdown 源码，首选；
 *   2. 页面上渲染出来的回答 —— 只剩排好版的文字，要反推回 Markdown，兜底用。
 *
 * 这个页面开在后台标签页里，定时器会被节流（隐藏满 5 分钟后一分钟才跑一次）。
 * 所以等待和轮询都不在这里做：后台每 3 秒经 bridge.js 发一次 grokTick，
 * 这里只在收到时检查一轮、把状态报回去。只有提交前那几十秒用到 sleep。
 */
(function () {
  'use strict';
  if (window.__XAE_GROK) return;
  window.__XAE_GROK = true;
  // 给隔离世界的 bridge.js 一个看得见的「我已就位」信号
  document.documentElement.setAttribute('data-xae-grok', '1');

  const NL = String.fromCharCode(10);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const onGrokPage = () => location.pathname.indexOf('/i/grok') === 0;

  const st = {
    state: 'idle',    // idle → driving → sent → done | error
    note: '',
    md: '', via: '', err: '',
    len: 0,
    mode: '',
    anchor: '',
    sendStart: 0,
    retried: false,
    doneTicks: 0,
    stream: null,     // 最近一次截到的流 { text, t }
  };
  const publish = () => window.postMessage({
    __xae: 'grokStatus',
    status: {
      state: st.state, note: st.note, err: st.err, via: st.via, len: st.len, mode: st.mode,
      // Markdown 只在完成时带上，平时轮询不来回搬几十 KB
      md: st.state === 'done' ? st.md : '',
    },
  }, '*');
  const set = (patch) => { Object.assign(st, patch); publish(); };

  // ---------- 页面元素 ----------
  // 输入框必须在 X 自己的 React 根里找：别的扩展会往 <body> 上挂隐藏 textarea，
  // 选错了不报错，prompt 塞进隐藏框，真输入框一直是空的。
  const findTa = () => {
    const root = document.getElementById('react-root');
    if (!root) return null;
    return Array.prototype.find.call(
      document.querySelectorAll('textarea'),
      (t) => root.contains(t) && t.offsetParent !== null && t.getBoundingClientRect().width > 100
    ) || null;
  };
  const SEND_LABELS = ['Grok something', '问问 Grok', '询问 Grok'];
  const findSend = () => Array.prototype.find.call(
    document.querySelectorAll('button'),
    (b) => SEND_LABELS.indexOf((b.getAttribute('aria-label') || '').trim()) >= 0
  );
  const ready = (b) => b && !b.disabled && b.getAttribute('aria-disabled') !== 'true';

  // 模式切换器的 aria-label 就是当前模式名；中英文都认，换个界面语言不至于全对不上。
  const MODES = ['Auto', 'Fast', 'Expert', '自动', '快速', '专家'];
  const EXPERT = ['Expert', '专家'];
  const modeBtn = () => Array.prototype.find.call(
    document.querySelectorAll('button'),
    (b) => MODES.indexOf((b.getAttribute('aria-label') || '').trim()) >= 0
  );
  const curMode = () => { const b = modeBtn(); return b ? (b.getAttribute('aria-label') || '').trim() : ''; };

  async function ensureExpert() {
    let b = null;
    for (let i = 0; i < 20 && !b; i++) { b = modeBtn(); if (!b) await sleep(300); }
    if (!b) return '';   // 没有模式切换器（旧版界面），用默认模式
    if (EXPERT.indexOf(curMode()) >= 0) return '';
    b.click();
    let item = null;
    for (let i = 0; i < 20 && !item; i++) {
      await sleep(200);
      const m = document.querySelector('[role=menu]');
      if (!m) continue;
      item = Array.prototype.find.call(
        m.querySelectorAll('[role=menuitem]'),
        // 每一项是「Expert」+「Thinks hard · Grok x」两行，只认第一行
        (n) => EXPERT.indexOf(((n.innerText || '').split(NL)[0] || '').trim()) >= 0
      );
    }
    if (!item) {
      // 没有专家模式的账号（非 Premium）菜单里只有「快速」。那就用现有模式照常整理，
      // 质量差一点也比整个功能不能用强。
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
      return '';
    }
    item.click();
    for (let i = 0; i < 20; i++) {
      await sleep(200);
      if (EXPERT.indexOf(curMode()) >= 0) return '';
    }
    return '点了「专家」但没切过去';
  }

  // ---------- 提交 ----------
  async function drive(prompt) {
    set({ state: 'driving', note: 'input', err: '', md: '', via: '', len: 0, retried: false, doneTicks: 0 });
    st.anchor = prompt.split(NL).filter((l) => l.trim()).pop() || '';

    let el = null;
    for (let i = 0; i < 60 && !el; i++) { el = findTa(); if (!el) await sleep(500); }
    if (!el) return set({ state: 'error', err: 'Grok 输入框一直没出现' });

    // 切模式会让 React 重渲染，必须在写 prompt 之前；切完重新找一次输入框
    set({ note: 'mode' });
    const modeErr = await ensureExpert();
    if (modeErr) return set({ state: 'error', err: '没能切到专家模式：' + modeErr });
    st.mode = curMode();
    el = findTa() || el;

    // React 受控组件：直接改 .value 不会触发 onChange，必须走原型上的 setter
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(el, prompt);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    if (el.value !== prompt) {
      return set({ state: 'error', err: '输入框没收下 prompt（' + el.value.length + '/' + prompt.length + ' 字）' });
    }

    // 能点发送按钮就点，点不到就回车；是否真的发出去由下面统一判定
    set({ note: 'send' });
    let btn = null;
    for (let i = 0; i < 24; i++) { btn = findSend(); if (ready(btn)) break; await sleep(250); }
    const sawBtn = !!btn;
    st.sendStart = Date.now();
    if (ready(btn)) {
      btn.click();
    } else {
      el.focus();
      const key = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
      ['keydown', 'keypress', 'keyup'].forEach((type) => el.dispatchEvent(new KeyboardEvent(type, key)));
    }

    // 提交成功的标志：输入框清空，或发送按钮消失（只有提交前确实见过它才算数，
    // 否则「按钮压根没出现」的故障会被当场误判成发送成功）
    for (let i = 0; i < 60; i++) {
      await sleep(250);
      const ta = findTa();
      if (!ta || ta.value === '' || (sawBtn && !findSend())) {
        // 答得快的话，流可能在这之前就已经到了
        if (st.stream && st.stream.t >= st.sendStart && st.stream.text) {
          return set({ state: 'done', md: tidy(st.stream.text), via: 'stream' });
        }
        return set({ state: 'sent', note: 'thinking' });
      }
    }
    set({ state: 'error', err: '提交没生效（输入框里仍有 ' + ((findTa() || {}).value || '').length + ' 字）' });
  }

  // ---------- 读答案 ----------
  // 有些回答会把整篇包进 ```markdown 代码块，剥掉最外层那一对
  function tidy(md) {
    let s = String(md || '').trim();
    const lines = s.split(NL);
    if (lines.length > 2 && /^```(markdown|md)?\s*$/i.test(lines[0]) && /^```\s*$/.test(lines[lines.length - 1])) {
      s = lines.slice(1, -1).join(NL).trim();
    }
    return s + NL;
  }

  const DONE_LABELS = ['Regenerate', 'Copy text', '重新生成', '复制文本', '复制'];
  const FAIL = /Grok was unable to reply|Something went wrong, please refresh/;

  const column = () =>
    document.querySelector('[data-testid=primaryColumn]') || document.querySelector('main') || document.body;

  // 回答所在的元素：先找到我们那条 prompt 的气泡（文字里含锚点句的最小元素），
  // 再从它往上爬，第一处「后面跟着一段像样文字的兄弟节点」就是回答。
  function answerRoot() {
    const col = column();
    let bubble = null, best = Infinity;
    col.querySelectorAll('div,span,p').forEach((n) => {
      const tx = n.innerText || '';
      if (tx.indexOf(st.anchor) >= 0 && tx.length < best) { best = tx.length; bubble = n; }
    });
    for (let n = bubble; n && n !== col; n = n.parentElement) {
      for (let s = n.nextElementSibling; s; s = s.nextElementSibling) {
        if ((s.innerText || '').trim().length > 40) return s;
      }
    }
    return null;
  }

  // 渲染后的回答 → Markdown。只认语义标签，不依赖 X 的 class 名。
  function toMarkdown(root) {
    const out = [];
    const skip = (n) => n.tagName === 'BUTTON' || n.tagName === 'svg' || n.tagName === 'SVG' ||
      n.getAttribute('aria-hidden') === 'true';
    const inline = (n) => {
      if (n.nodeType === 3) return n.nodeValue.replace(/\s+/g, ' ');
      if (n.nodeType !== 1 || skip(n)) return '';
      const tag = n.tagName;
      const inner = () => Array.prototype.map.call(n.childNodes, inline).join('');
      if (tag === 'BR') return NL;
      if (tag === 'STRONG' || tag === 'B') { const t = inner().trim(); return t ? '**' + t + '**' : ''; }
      if (tag === 'EM' || tag === 'I') { const t = inner().trim(); return t ? '*' + t + '*' : ''; }
      if (tag === 'CODE') return '`' + (n.textContent || '') + '`';
      if (tag === 'A') {
        const t = inner().trim(), h = n.getAttribute('href') || '';
        return h && t ? '[' + t + '](' + h + ')' : t;
      }
      if (tag === 'IMG') return n.src ? '![](' + n.src + ')' : '';
      return inner();
    };
    const block = (n, depth) => {
      if (n.nodeType === 3) { const t = n.nodeValue.trim(); if (t) out.push(t, ''); return; }
      if (n.nodeType !== 1 || skip(n)) return;
      const tag = n.tagName;
      const h = /^H([1-6])$/.exec(tag);
      if (h) { out.push('#'.repeat(+h[1]) + ' ' + inline(n).trim(), ''); return; }
      if (tag === 'P') { const t = inline(n).trim(); if (t) out.push(t, ''); return; }
      if (tag === 'PRE') { out.push('```', (n.textContent || '').replace(/\s+$/, ''), '```', ''); return; }
      if (tag === 'BLOCKQUOTE') {
        const t = inline(n).trim();
        if (t) out.push(t.split(NL).map((l) => '> ' + l).join(NL), '');
        return;
      }
      if (tag === 'HR') { out.push('---', ''); return; }
      if (tag === 'UL' || tag === 'OL') {
        let i = 1;
        Array.prototype.forEach.call(n.children, (li) => {
          if (li.tagName !== 'LI') return;
          const own = Array.prototype.filter.call(li.childNodes, (c) => !(c.nodeType === 1 && /^(UL|OL)$/.test(c.tagName)));
          const t = own.map(inline).join('').trim();
          out.push('  '.repeat(depth) + (tag === 'OL' ? (i++) + '. ' : '- ') + t);
          Array.prototype.forEach.call(li.children, (c) => { if (/^(UL|OL)$/.test(c.tagName)) block(c, depth + 1); });
        });
        if (!depth) out.push('');
        return;
      }
      if (tag === 'TABLE') {
        const rows = Array.prototype.map.call(n.querySelectorAll('tr'), (tr) =>
          Array.prototype.map.call(tr.children, (c) => inline(c).trim().replace(/\|/g, '\\|')));
        if (rows.length) {
          out.push('| ' + rows[0].join(' | ') + ' |', '|' + rows[0].map(() => ' --- ').join('|') + '|');
          rows.slice(1).forEach((r) => out.push('| ' + r.join(' | ') + ' |'));
          out.push('');
        }
        return;
      }
      if (tag === 'IMG') { if (n.src) out.push('![](' + n.src + ')', ''); return; }
      // 其余容器：有块级子元素就递归，否则当成一段
      const hasBlock = n.querySelector('p,h1,h2,h3,h4,h5,h6,ul,ol,pre,blockquote,table,hr');
      if (hasBlock) Array.prototype.forEach.call(n.childNodes, (c) => block(c, depth));
      else { const t = inline(n).trim(); if (t) out.push(t, ''); }
    };
    block(root, 0);
    return out.join(NL).replace(/\n{3,}/g, NL + NL).trim();
  }

  function clickRetry() {
    const leaf = Array.prototype.find.call(
      document.querySelectorAll('span,div,button'),
      (e) => e.children.length === 0 && /^(Retry|重试)$/.test((e.innerText || '').trim())
    );
    if (!leaf) return false;
    let n = leaf;
    for (let i = 0; i < 6 && n; i++) {
      if (n.tagName === 'BUTTON' || n.getAttribute('role') === 'button') break;
      n = n.parentElement;
    }
    (n || leaf).click();
    return true;
  }

  // 后台每 3 秒敲一次：检查一轮，把状态报回去
  function tick() {
    if (st.state !== 'sent') { publish(); return; }
    const text = column().innerText || '';
    const i = text.lastIndexOf(st.anchor);
    const after = i >= 0 ? text.slice(i + st.anchor.length) : '';

    // 报错只认我们这条 prompt 之后的：上一轮残留的横幅不会自己消失
    if (FAIL.test(after)) {
      if (!st.retried) { st.retried = true; st.doneTicks = 0; clickRetry(); return set({ note: 'retry' }); }
      return set({ state: 'error', err: 'Grok 连续两次 unable to reply' });
    }

    st.len = after.trim().length;
    const labels = Array.prototype.map.call(document.querySelectorAll('button'),
      (b) => (b.getAttribute('aria-label') || '').trim());
    const done = DONE_LABELS.some((l) => labels.indexOf(l) >= 0);
    if (done && st.len > 0) {
      // 流一般在完成信号前后就到了；多等两拍，还没到才退回从页面反推
      if (++st.doneTicks >= 3) {
        const root = answerRoot();
        const md = root ? toMarkdown(root) : '';
        if (md) return set({ state: 'done', md: tidy(md), via: 'dom' });
        return set({ state: 'error', err: 'Grok 答完了，但没能从页面上取到回答' });
      }
    }
    set({ note: st.len ? 'writing' : 'thinking' });
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data) return;
    const d = e.data;
    if (d.__xae === 'grokStream') {
      st.stream = { text: d.text || '', t: d.t || Date.now() };
      if ((st.state === 'sent' || st.state === 'driving') && st.sendStart &&
          st.stream.t >= st.sendStart && st.stream.text) {
        set({ state: 'done', md: tidy(st.stream.text), via: 'stream' });
      }
      return;
    }
    if (!onGrokPage()) return;
    if (d.__xae === 'grokDrive') {
      if (st.state === 'driving' || st.state === 'sent') return;
      drive(String(d.prompt || '')).catch((err) => set({ state: 'error', err: (err && err.message) || String(err) }));
      return;
    }
    if (d.__xae === 'grokTick') { tick(); return; }
  });
})();
