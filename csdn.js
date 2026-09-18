/*!
 * X Article Exporter — Markdown 一键灌进 CSDN
 *
 * 在 CSDN 的 Markdown 编辑器（editor.csdn.net/md）「更多」菜单里挂一个条目：
 * 选一个 .md 文件（可以连同本地图片一起多选），整篇铺进去，**图片自动上传**。
 *
 * 和知乎那份的根本差别：CSDN 这个编辑器（StackEdit 那一系，
 * <pre class="editor__inner" contenteditable>）里躺的**就是 Markdown 源码本身**。
 * 所以不需要 md → HTML，不需要按图片切段落顺着贴，也不用去够 React 内部状态。
 * 整件事退化成两步：把图换成 CSDN 的直链，再把整篇文本一次性写进去。
 *
 * 为什么图能自动传（实测确认）：
 * 往编辑器合成派发 ClipboardEvent('paste')，clipboardData.files 里带一个图片 File，
 * CSDN 就会走它自己的上传流水线，传到 i-blog.csdnimg.cn 并在光标处写下
 * `![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/<hash>.png)`。
 * 实测 2.1MB 的 PNG 约 1.9s 传完。
 *
 * 但**别去正文里认上传结果**——CSDN 那个回填是坏的，在非空文档里连传会互相覆盖，
 * 4 张传完正文里一个链接都不剩。上传本身没问题（两个 POST 全是 200），
 * 而且 OBS 的响应里直接就带最终直链。所以结果从网络层拿，完整的来龙去脉见 HOOK 那段。
 *
 * 于是顺序是「一张张传（只为拿 URL）→ 最后整篇写一次」，而不是像知乎那样边走边贴：
 *  - 上传把链接写在光标处，alt 恒定是 CSDN 自己那句「在这里插入图片描述」，
 *    顺着贴就没法保留原文的 alt；先拿到链接再回填就能保留。
 *  - 源码编辑器里一次性写入的结果和原文逐字一致，不用担心分段拼接处多/少空行。
 *  上传期间 CSDN 会把编辑器插得乱七八糟，但用户原有的正文在第一步就记下来了，
 *  最后连同新正文一起写回去；中途抛错也会在 catch 里放回去（见 run）。
 *
 * 那 CSDN 自己不是会「外链图片转存」吗，为什么还要我们传？
 * 会，而且是**服务端**去抓：粘一个 https 图片链接进来，它会显示「外链图片转存中…」，
 * 抓到就换成 i-blog.csdnimg.cn/img_convert/<hash>。实测 www.python.org 的图 7 秒搞定。
 * 但**它的服务器够不着 pbs.twimg.com**——实测那条永远停在
 * `[外链图片转存中...(img-xxx)]`，连图片语法都不是了，发出去就是一行废字。
 * 而这个扩展导出的正文，图清一色是 pbs.twimg.com。所以必须我们自己在浏览器里取、
 * 在浏览器里传：墙和防盗链是按「谁在发请求」算的，浏览器带着你的网络和身份，服务端没有。
 * 反过来说，我们取不到的 https 图（多半是对方没给 CORS 头）就原样留着交给 CSDN 转存，
 * 它服务端往往反而能抓到——两条路互补，不是二选一。
 *
 * 三个实测出来的坑，改代码前先看一眼：
 *  - 选中全文后**直接 paste 覆盖不掉选区**（CSDN 的 paste 处理走它自己的选区模型，
 *    结果是追加而不是替换）。必须先 execCommand('delete') 清空，再 paste。
 *  - 相对路径的图只能从用户一起选中的文件里找。漏选的读完 md 会点名再要一次
 *    （见 askFiles —— 不能直接弹第二个文件框，那时候已经没有用户手势了）。
 *  - 交给 CSDN 转存的那些，是在我们写完正文**之后**才慢慢跑完的，所以完成提示里
 *    只能说「交给 CSDN 了」，不能算进「已上传」——结果还没出来，报数就是撒谎。
 */
(function () {
  'use strict';
  if (window.__XAE_CSDN) return;
  window.__XAE_CSDN = true;

  const T = {
    tip: 'Markdown → CSDN',
    item: '导入 MD（自动传图）',
    hint: '选一个 .md 文件，正文和图片一起灌进来（图片自动上传到 CSDN 图床）',
    reading: '正在读取…',
    need: (n, names) =>
      `正文里有 ${n} 张本地图片还没选中：` + names.slice(0, 3).join('、') + (names.length > 3 ? ' 等' : ''),
    needBtn: '选择这些图片',
    needSkip: '跳过（留成文字链接）',
    noEditor: '没找到 Markdown 编辑器',
    empty: '这个 .md 是空的',
    noMd: '没选到 .md 文件',
    img: (i, n) => `正在上传图片 ${i}/${n} …`,
    writing: '正在写入正文…',
    // 三种下场分开报：传上去了 / 交给 CSDN 转存（还没出结果）/ 彻底没了（留成文字）
    done: (n, handed, dropped) =>
      '完成：' + n + ' 张图已上传' +
      (handed ? '，' + handed + ' 张交给 CSDN 转存（稍等看结果）' : '') +
      (dropped ? '，' + dropped + ' 张没拿到，已留成文字' : ''),
    doneNoImg: '完成',
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- 编辑器 ----------
  // StackEdit 那个 <pre contenteditable>。页面上还有别的 contenteditable（AI 侧栏），
  // 所以认类名而不是认标签。
  const editor = () => document.querySelector('pre.editor__inner[contenteditable="true"]');

  // 清空。走 execCommand 而不是自己改 DOM：execCommand 过的是浏览器编辑管线，
  // 编辑器自己的模型跟得上；直接改 DOM 它就脱节了。
  async function clear(ed) {
    ed.focus();
    const sel = getSelection();
    const r = document.createRange();
    r.selectNodeContents(ed);
    sel.removeAllRanges();
    sel.addRange(r);
    document.execCommand('delete');
    await sleep(300);
  }

  function firePaste(ed, build) {
    const dt = new DataTransfer();
    build(dt);
    let ev;
    try {
      ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    } catch (e) {
      ev = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'clipboardData', { value: dt });
    }
    ed.dispatchEvent(ev);
  }

  // 整篇覆盖。先 clear 再 paste——选中全文直接 paste 是覆盖不掉的，见文件头那条坑。
  async function setAll(ed, text) {
    await clear(ed);
    firePaste(ed, (dt) => dt.setData('text/plain', text));
    await sleep(400);
  }

  // ---------- 取图 / 传图 ----------
  const local = new Map(); // 用户一起选中的本地图片，按文件名索引

  function localKey(url) {
    if (/^https?:/i.test(url) || /^data:/i.test(url)) return null;
    return decodeURIComponent(url.split(/[?#]/)[0].split('/').pop() || '').toLowerCase() || null;
  }

  // 把代码区域挖成等长的空白。长度不变，所以在挖过的副本上算出来的下标，
  // 拿回原文照样对得上。
  const maskCode = (md) =>
    md
      .replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/(^|[^`])(`[^`\n]*`)/g, (m, p, c) => p + c.replace(/[^\n]/g, ' '));

  // 扫出正文里**真正**的图片，返回 [{index, len, alt, url}]。
  //
  // 为什么不直接拿正则去 exec 原文：讲 Markdown 的文章会把 ![](…) 写在反引号或
  // ``` 围栏里当**例子**，那不是图片。照着改会把人家正文改烂——实测踩过：一篇讲这个
  // 功能的文章，三处示例全被换成了「图1：01-xxx.png」这样的文字，句子当场读不通。
  // 所以先挖掉代码区再找，位置从副本上取，内容回原文取。
  // （md2html.js 里有一份一样的，那边给知乎用；这个文件刻意不依赖它，所以各存一份。）
  function imgScan(md) {
    const masked = maskCode(String(md || ''));
    const re = /!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g;
    const out = [];
    let m;
    while ((m = re.exec(masked))) out.push({ index: m.index, len: m[0].length, alt: m[1], url: m[2] });
    return out;
  }

  function missingLocal(md) {
    const out = [];
    for (const g of imgScan(md)) {
      const k = localKey(g.url);
      if (k && !local.has(k) && out.indexOf(k) < 0) out.push(k);
    }
    return out;
  }

  async function grab(url) {
    const key = localKey(url);
    if (key) return local.get(key) || null;
    try {
      // HTML 里的 & 常常是转义过的，不还原的话图床会返回空响应且不报错
      const resp = await fetch(url.replace(/&amp;/g, '&'), { mode: 'cors', credentials: 'omit' });
      if (!resp.ok) return null;
      const blob = await resp.blob();
      if (!blob.size || !/^image\//.test(blob.type)) return null;
      const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      return new File([blob], 'image.' + ext, { type: blob.type });
    } catch (e) {
      return null; // 防盗链 / 没有 CORS 头 / 网络不通，跳过就是了
    }
  }

  // ---------- 上传结果从网络层拿，不从正文里认 ----------
  //
  // 这是整个文件最关键的一个决定，值得说清楚。
  //
  // CSDN 传完图会把 ![](url) 写回编辑器，但**这一步是坏的**：在非空文档里连着传，
  // 第二张的回填会按旧偏移落到第一张身上，把 ![…](url) 啃成光秃秃的
  // 「在这里插入图片描述」。实测 4 张连传，最后正文里一个链接都不剩。
  // （换成往 CSDN 自己的 input[type=file] 里塞 files 再派发 change 也一样烂——
  //   坏的是回填，不是触发方式。这条我试过，别再试第二遍。）
  //
  // 但上传本身**从来没失败过**：signature 和华为云 OBS 两个 POST 全是 200，
  // 而且 OBS 那个响应里直接就带最终直链：
  //   {"code":200,"data":{"imageUrl":"https://i-blog.csdnimg.cn/direct/<hash>.png", ...}}
  // 所以别再跟那个坏掉的回填较劲了——**直接问上传要结果**。
  //
  // 这样换来三件事：
  //  - 不用为了躲开覆盖而在每张图之前清空编辑器，用户正在写的东西全程原样待着；
  //  - 判定是精确的：有 imageUrl 就是成了，OBS 回了却没有 imageUrl 就是没成。
  //    不再需要「变过又稳住 2 秒」那种靠猜的启发式，也不需要重试兜底；
  //  - 快：实测每张稳定 1 秒。
  //
  // 编辑器那边照样会被 CSDN 自己插得乱七八糟，无所谓——最后一步整篇覆盖时一并抹掉。
  const HOOK = { urls: [], fails: 0, on: false };

  function note(url, text) {
    const u = String(url || '');
    if (!/myhuaweicloud|obs\.|csdn/i.test(u)) return;
    let j = null;
    try { j = JSON.parse(text); } catch (e) { return; }
    if (!j || !j.data) return;
    if (j.data.imageUrl) HOOK.urls.push(String(j.data.imageUrl));
    // OBS 回了却没给 imageUrl —— 这张是真没传上，不用干等超时
    else if (/myhuaweicloud|obs\./i.test(u)) HOOK.fails++;
  }

  // 只读不改：一律先把原实现跑完、结果原样返回，note 出任何岔子都吞掉，
  // 绝不能因为我们挂了钩子就把人家页面搞坏。
  function installHook() {
    if (HOOK.on) return;
    HOOK.on = true;
    try {
      const of = window.fetch;
      window.fetch = function (...a) {
        const p = of.apply(this, a);
        try {
          const u = (a[0] && a[0].url) || a[0];
          p.then((r) => { try { r.clone().text().then((t) => note(u, t), () => {}); } catch (e) {} }, () => {});
        } catch (e) {}
        return p;
      };
      const oo = XMLHttpRequest.prototype.open;
      const os = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (m, u) {
        this.__xaeUrl = u;
        return oo.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function () {
        try {
          this.addEventListener('load', () => { try { note(this.__xaeUrl, this.responseText); } catch (e) {} });
        } catch (e) {}
        return os.apply(this, arguments);
      };
    } catch (e) {}
  }

  // 传一张，返回 CSDN 直链；没传上返回 null。
  // 90 秒是给大图留的余量，正常一秒就回来了——失败也不会等到超时，见上面的 fails。
  async function upload(ed, file) {
    const n = HOOK.urls.length;
    const f = HOOK.fails;
    firePaste(ed, (dt) => dt.items.add(file));
    const t0 = Date.now();
    while (Date.now() - t0 < 90000) {
      if (HOOK.urls.length > n) return HOOK.urls[HOOK.urls.length - 1];
      if (HOOK.fails > f) return null;
      await sleep(150);
    }
    return null;
  }

  // ---------- 主流程 ----------
  async function run(md, onStep) {
    const ed = editor();
    if (!ed) return T.noEditor;
    if (!md.trim()) return T.empty;

    installHook();

    // CSDN 自己会往编辑器里插图（插得还是坏的，见上面 HOOK 那段），所以原文先记下来，
    // 最后连同新正文一起写回去。中途抛错也要放回去——见下面的 catch。
    const orig = ed.textContent.replace(/\s+$/, '');

    // 同一张图在正文里引用多次只传一次
    const hits = imgScan(md);
    const urls = [];
    for (const g of hits) if (urls.indexOf(g.url) < 0) urls.push(g.url);

    const map = new Map();
    let done = 0;
    let handed = 0;  // 我们取不到，原样留给 CSDN 服务端转存
    let dropped = 0; // 本地图又没选中，只能降级成文字
    try {
      for (let i = 0; i < urls.length; i++) {
        onStep(T.img(i + 1, urls.length));
        const file = await grab(urls[i]);
        const up = file ? await upload(ed, file) : null;
        if (up) map.set(urls[i], up);
        if (up) done++;
        else if (/^https?:/i.test(urls[i])) handed++;
        else dropped++;
      }

      onStep(T.writing);
      // 按 imgScan 给的下标逐段拼，不用 md.replace——replace 会连代码块里的例子一起改
      const rewrite = (alt, url, whole) => {
        const up = map.get(url);
        if (up) return '![' + (alt || '') + '](' + up + ')';
        // 取不到的 https 原样留着：CSDN 服务端会自己试着转存，它往往抓得到我们抓不到的
        if (/^https?:/i.test(url)) return whole;
        // 本地图连文件都没有，谁也救不了。降级成一行文字，
        // 免得读者莫名其妙少一块、作者还不知道为什么。
        // data: 的不能把 url 写出来——那是一整串 base64，几十 KB 糊在正文里比缺图还糟。
        if (/^data:/i.test(url)) return '（图片没能上传：' + (alt || '未命名') + '）';
        return (alt || '图片') + '：' + url;
      };
      let body = '';
      let last = 0;
      for (const g of hits) {
        body += md.slice(last, g.index) + rewrite(g.alt, g.url, md.substr(g.index, g.len));
        last = g.index + g.len;
      }
      body += md.slice(last);

      await setAll(ed, orig ? orig + '\n\n' + body : body);
    } catch (e) {
      // 这时候编辑器八成是空的（上传中途炸的）。把原文放回去再往上抛，
      // 不能让人因为导入失败白丢一篇正在写的东西。
      try { await setAll(ed, orig); } catch (e2) {}
      throw e;
    }
    if (!urls.length) return T.doneNoImg;
    return T.done(done, handed, dropped);
  }

  // ---------- UI ----------
  const ICON =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">' +
    '<path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2v10h16V7H4zm2 8V9h2l2 2.5L12 9h2v6h-2v-3l-2 2.4L8 12v3H6zm11 0-3-3.5h2V9h2v2.5h2L17 15z"/>' +
    '</svg>';
  const RED = 'rgb(252,85,49)'; // CSDN 自己的红

  let toastEl = null;
  function toast(msg, sticky) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText =
        'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:2147483647;' +
        'background:rgba(15,20,25,.92);color:#fff;padding:10px 16px;border-radius:9999px;' +
        'font:500 14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;max-width:80vw;text-align:center';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    clearTimeout(toastEl.__t);
    if (!sticky) toastEl.__t = setTimeout(() => { toastEl.remove(); toastEl = null; }, 3600);
  }

  function pickFiles(accept) {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.multiple = true; // .md 之外还可以带上它引用的本地图片
      inp.accept = accept || '.md,.markdown,.txt,image/*';
      inp.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(inp);
      inp.addEventListener('change', () => {
        const files = [...(inp.files || [])];
        inp.remove();
        resolve(files);
      });
      inp.click();
    });
  }

  // 缺图时不能直接再弹一次文件框：第一次选完文件不算「用户手势」，
  // input.click() 会被浏览器静默拒掉。所以先摆一条带按钮的提示，
  // 让用户自己点那一下——那一下才是真手势。
  function askFiles(names) {
    return new Promise((resolve) => {
      const bar = document.createElement('div');
      bar.style.cssText =
        'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:2147483647;' +
        'background:rgba(15,20,25,.95);color:#fff;padding:12px 16px;border-radius:12px;' +
        'font:500 14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;max-width:80vw;' +
        'display:flex;flex-direction:column;gap:10px;align-items:center;text-align:center';

      const msg = document.createElement('div');
      msg.textContent = T.need(names.length, names);
      bar.appendChild(msg);

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:10px';
      const mk = (label, bg) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.style.cssText =
          'border:0;border-radius:9999px;padding:7px 16px;cursor:pointer;font:inherit;color:#fff;background:' + bg;
        row.appendChild(b);
        return b;
      };
      const ok = mk(T.needBtn, RED);
      const skip = mk(T.needSkip, 'rgba(255,255,255,.14)');
      bar.appendChild(row);
      document.body.appendChild(bar);

      const close = (v) => { bar.remove(); resolve(v); };
      ok.addEventListener('click', async () => {
        ok.disabled = true;
        close(await pickFiles('image/*'));
      });
      skip.addEventListener('click', () => close([]));
    });
  }

  async function start() {
    const files = await pickFiles();
    if (!files.length) return;
    const mdFile = files.find((f) => /\.(md|markdown|txt)$/i.test(f.name));
    if (!mdFile) { toast(T.noMd); return; }

    local.clear();
    for (const f of files) if (f !== mdFile) local.set(f.name.toLowerCase(), f);

    toast(T.reading, true);
    const md = await mdFile.text();

    // 本地图片是最容易漏的一步：正文写的是相对路径，可这个文件框只拿得到被选中的文件。
    // 漏了就只会降级成一行文字，用户还不知道为什么。所以点名把缺的要回来。
    const missing = missingLocal(md);
    if (missing.length) {
      for (const f of await askFiles(missing)) local.set(f.name.toLowerCase(), f);
    }

    let msg;
    try {
      msg = await run(md, (s) => toast(s, true));
    } catch (e) {
      msg = (e && e.message) || String(e);
    }
    toast(msg);
  }

  let busy = false;
  async function go(el) {
    if (busy) return;
    busy = true;
    if (el) el.style.opacity = '.45';
    try { await start(); } finally {
      busy = false;
      if (el) el.style.opacity = '1';
    }
  }

  // ---------- 菜单条目 ----------
  //
  // 「更多」展开的是 .more-actions-popup，里面是 撤销/重做/导入/导出/模版 五个
  // button.more-actions-item。我们的入口追加在它们后面。
  //
  // 条目不是自己拼的，是**克隆一个原生条目再改内容**——连内边距、悬停态、字号一起继承，
  // CSDN 改样式我们跟着变。克隆出来的节点没有框架的事件绑定，所以不会误触发原生动作。
  //
  // 结构（实测）：<button class="more-actions-item"><svg/>\n  导入\n</button>
  const ID = '__xae-csdn-item';

  function makeMenuItem(sample) {
    const it = sample.cloneNode(true);
    it.id = ID;
    it.disabled = false;
    it.removeAttribute('disabled');
    it.title = T.hint;
    it.style.color = RED;
    it.style.cursor = 'pointer';

    const svg = it.querySelector('svg');
    if (svg) {
      const box = document.createElement('span');
      box.innerHTML = ICON;
      svg.replaceWith(box.firstElementChild);
    }
    // 文字是 button 下面那个裸文本节点（带着缩进的换行，照原样只换内容）
    for (const n of [...it.childNodes]) {
      if (n.nodeType === 3 && n.textContent.trim()) { n.textContent = T.item; break; }
    }

    it.addEventListener('click', (e) => {
      e.preventDefault();
      closeMenu();
      go(null);
    });
    return it;
  }

  // 点完把浮层收掉：再点一次触发器就是 CSDN 自己的关闭逻辑，比猜它的内部状态稳。
  function closeMenu() {
    setTimeout(() => {
      const trig = document.querySelector('.navigation_bar_more_actions_trigger.is-open');
      if (trig) trig.click();
    }, 0);
  }

  function injectMenuItem() {
    const pop = document.querySelector('.more-actions-popup');
    if (!pop || pop.querySelector('#' + ID)) return;
    const items = pop.querySelectorAll('button.more-actions-item');
    // 拿一个没被 disabled 的当模板（「重做」经常是灰的，克隆过来样式就不对）
    const sample = [...items].find((b) => !b.disabled) || items[0];
    if (!sample) return;
    pop.appendChild(makeMenuItem(sample));
  }

  // ---------- 兜底悬浮球 ----------
  //
  // 菜单是点开才存在的，所以「有没有菜单」不能用来判断入口在不在。
  // 真正的判断是「更多」那颗触发器还在不在：它在，入口就走菜单；
  // 它没了（CSDN 改版），才挂一个悬浮球，免得彻底没地方点。
  function makeFab() {
    const b = document.createElement('div');
    b.id = '__xae-csdn-btn';
    b.setAttribute('role', 'button');
    b.tabIndex = 0;
    b.title = T.tip + ' — ' + T.hint;
    b.setAttribute('aria-label', T.tip);
    b.innerHTML = ICON.replace('width="16" height="16"', 'width="20" height="20"');
    b.style.cssText =
      'position:fixed;right:24px;bottom:24px;z-index:2147483646;width:46px;height:46px;' +
      'display:flex;align-items:center;justify-content:center;border-radius:9999px;cursor:pointer;' +
      'background:' + RED + ';color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.28);' +
      'transition:opacity .15s;-webkit-tap-highlight-color:transparent';
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); go(b); });
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') go(b); });
    return b;
  }

  let anchorAt = 0;
  let hasAnchor = false;
  function mount() {
    const fab = document.getElementById('__xae-csdn-btn');
    if (!editor()) {
      if (fab) fab.remove();
      return;
    }

    // 菜单随时开随时关，这个查询很便宜
    injectMenuItem();

    const now = Date.now();
    if (now - anchorAt > 3000) {
      anchorAt = now;
      hasAnchor = !!document.querySelector('.navigation_bar_more_actions_trigger');
    }
    if (hasAnchor) {
      if (fab) fab.remove();
    } else if (!fab) {
      document.body.appendChild(makeFab());
    }
  }

  function boot() {
    mount();
    // 合并成一拍再跑。刻意不用 requestAnimationFrame：标签页不在前台时 rAF 是冻结的，
    // setInterval 也会被节流到分钟级，两个一起哑火就等于没挂载。setTimeout 不受这个影响。
    let queued = false;
    const soon = () => {
      if (queued) return;
      queued = true;
      setTimeout(() => { queued = false; mount(); }, 16);
    };
    const mo = new MutationObserver(soon);
    if (document.body) mo.observe(document.body, { childList: true, subtree: true });
    // 「更多」菜单是点开才存在的，而点击一定会派发——比等 observer 更及时
    document.addEventListener('click', () => setTimeout(mount, 60), true);
    setInterval(mount, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // 供测试/调试使用
  window.__XAE_CSDN_RUN = run;
})();
