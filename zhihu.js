/*!
 * X Article Exporter — Markdown 一键灌进知乎专栏
 *
 * 在知乎写文章页（zhuanlan.zhihu.com/write 或 /p/<id>/edit）挂一个红色图标：
 * 选一个 .md 文件（可以连同本地图片一起多选），正文按顺序铺进去，**图片自动上传**，
 * 不用一张张复制粘贴。
 *
 * 为什么能自动传图（实测确认，这是整件事成立的前提）：
 * 知乎的编辑器也是 Draft.js。往它身上合成派发一个 ClipboardEvent('paste')，
 * 只要 clipboardData.files 里有图片 File，知乎就会走它自己的上传流水线，
 * 把图传到 pic-private.zhihu.com 并插入一个 atomic/figure 块 —— 和人手粘贴一模一样。
 * 同理，clipboardData 里放 text/html 就能一次性铺好标题、列表、引用、代码块。
 *
 * 图片从哪来：
 *  - http(s) 链接：直接在页面里 fetch。实测 pbs.twimg.com 带 CORS 头，能拿到 blob；
 *    抓不到的（防盗链、墙）不阻塞，跳过并在末尾报数。
 *  - 相对路径：从用户一起选中的文件里按文件名找。
 *
 * 为什么不走知乎自己的「识别 Markdown」和「导入」：
 *  - 提示条那条路（识别到特殊格式 → 确认并解析）实测会把整篇压成一个段落；
 *  - 导入 .md 那条路最后一步 upload 接口返回 400。
 * 两条都不稳，而且都不解决图片。粘贴这条路每一步都在自己手里。
 */
(function () {
  'use strict';
  if (window.__XAE_ZH) return;
  window.__XAE_ZH = true;

  const Md = window.XAEMd;
  if (!Md) return;

  const T = {
    tip: 'Markdown → 知乎',
    item: '导入MD',
    itemSub: '自动传图',
    hint: '选一个 .md 文件，正文和图片一起灌进来（图片自动上传）',
    pick: '选择 .md 文件（可同时选中本地图片）',
    reading: '正在读取…',
    noEditor: '没找到正文编辑器',
    noState: '接不上编辑器，这次没动正文',
    empty: '这个 .md 是空的',
    noMd: '没选到 .md 文件',
    text: (i, n) => `正在写入正文 ${i}/${n} …`,
    img: (i, n) => `正在上传图片 ${i}/${n} …`,
    done: (n, f) => (f ? `完成：${n} 张图已上传，${f} 张没拿到` : `完成：${n} 张图已上传`),
    doneNoImg: '完成',
  };

  // ---------- 编辑器 ----------
  function bodyEditor() {
    const eds = [...document.querySelectorAll('.public-DraftEditor-content[contenteditable="true"]')];
    if (!eds.length) return null;
    return eds.sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
  }

  // Draft 的真身在组件实例上。React 双缓冲两棵 fiber 树，DOM 节点挂的 __reactFiber$
  // 常常指着旧那棵，memoizedProps 会慢一拍；实例上的 _latestEditorState 永远是最新的。
  function draftEditor(el) {
    let f = null;
    for (const k in el) {
      if (k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')) { f = el[k]; break; }
    }
    for (let i = 0; f && i < 40; i++, f = f.return) {
      const sn = f.stateNode;
      if (sn && sn._latestEditorState) return sn;
    }
    return null;
  }

  // 把光标顶到文末。每段内容都追加在上一段后面，整篇才会按 Markdown 的顺序长出来。
  function caretToEnd(inst) {
    try {
      const st = inst._latestEditorState;
      inst.update(st.constructor.moveFocusToEnd(st));
      return true;
    } catch (e) {
      return false;
    }
  }

  function firePaste(el, build) {
    const dt = new DataTransfer();
    build(dt);
    let ev;
    try {
      ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    } catch (e) {
      ev = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'clipboardData', { value: dt });
    }
    el.dispatchEvent(ev);
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 粘贴进来的第一个元素总是并进光标所在的那个块。所以在一个非空块后面直接粘
  // 「只有一个 blockquote / 标题」的片段，知乎会把它整个吞掉——实测块数一点不涨。
  // 先敲一次回车造出空块，Draft 的 insertFragment 遇到空块是「替换」而不是「合并」，
  // 片段的第一个块就能带着自己的类型落地。
  async function freshBlock(ed, inst) {
    try {
      if (inst._latestEditorState.getCurrentContent().getLastBlock().getLength() === 0) return;
    } catch (e) {}
    ed.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true })
    );
    await sleep(250);
  }

  async function until(fn, ms, step) {
    const t0 = Date.now();
    for (;;) {
      if (fn()) return true;
      if (Date.now() - t0 > ms) return false;
      await sleep(step || 250);
    }
  }

  // ---------- 取图 ----------
  const local = new Map(); // 用户一起选中的本地图片，按文件名索引

  async function grab(url) {
    // 相对路径 / 纯文件名：在一起选中的文件里找
    if (!/^https?:/i.test(url) && !/^data:/i.test(url)) {
      const name = decodeURIComponent(url.split(/[?#]/)[0].split('/').pop() || '').toLowerCase();
      return local.get(name) || null;
    }
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

  // 一张图上传完的信号：编辑器里多了一个 figure，且它的 img 已经换成知乎自己的域名。
  // 只数 figure 不够——知乎会先插一个本地预览再替换 src，那时候图还没真的传上去。
  const figCount = (ed) => ed.querySelectorAll('figure').length;
  const lastImgSettled = (ed) => {
    const imgs = ed.querySelectorAll('figure img');
    const last = imgs[imgs.length - 1];
    return !!last && /^https:\/\/(pic\d*|picx?|pic-private)[^/]*\.(zhimg|zhihu)\.com/.test(last.src);
  };

  async function pasteImage(ed, file) {
    const before = figCount(ed);
    firePaste(ed, (dt) => dt.items.add(file));
    // 上传慢的时候（大图 / 网络差）给足 60s，超时就当这张没成，继续往下走
    return await until(() => figCount(ed) > before && lastImgSettled(ed), 60000, 400);
  }

  // ---------- 主流程 ----------
  //
  // 按图片把 Markdown 切成段：文字段落走 text/html 一次性粘贴，图片段落单独上传。
  // 不用占位符再回填，是因为每次粘贴后光标本来就停在新内容末尾，顺着贴下去就是原文顺序。
  function segments(md) {
    const re = Md.imgRe();
    const out = [];
    let last = 0;
    let m;
    while ((m = re.exec(md))) {
      out.push({ img: false, text: md.slice(last, m.index) });
      out.push({ img: true, alt: m[1], url: m[2] });
      last = m.index + m[0].length;
    }
    out.push({ img: false, text: md.slice(last) });
    return out.filter((s) => s.img || s.text.trim());
  }

  async function run(md, onStep) {
    const ed = bodyEditor();
    if (!ed) return T.noEditor;
    const inst = draftEditor(ed);
    if (!inst) return T.noState;
    if (!md.trim()) return T.empty;

    const segs = segments(md);
    const imgTotal = segs.filter((s) => s.img).length;
    let imgDone = 0;
    let imgFail = 0;
    let textDone = 0;
    const textTotal = segs.length - imgTotal;

    ed.focus();
    for (const seg of segs) {
      caretToEnd(inst);
      await sleep(80);
      if (!seg.img) {
        onStep(T.text(++textDone, textTotal));
        await freshBlock(ed, inst);
        firePaste(ed, (dt) => {
          // 尾部那个空段落不是凑数的：Draft 对**单块**片段只并文字、不带类型，
          // 所以「> 引用收尾」这种单独成段的片段会变成普通段落。补一块让它成为多块片段，
          // insertFragment 才会走「替换空块」那条路，类型跟着落地。（实测 A/B 对照）
          // 它留下的空段落也正好被下一段的 freshBlock 复用，不会越堆越多。
          dt.setData('text/html', Md.toHtml(seg.text) + '<p><br></p>');
          dt.setData('text/plain', Md.strip(seg.text));
        });
        await sleep(400);
        continue;
      }
      onStep(T.img(imgDone + imgFail + 1, imgTotal));
      const file = await grab(seg.url);
      if (!file) {
        imgFail++;
        // 图没拿到也别让读者莫名其妙少一块，把原链接留成一行文字
        firePaste(ed, (dt) => {
          dt.setData('text/html', '<p>' + (seg.alt || '图片') + '：' + seg.url + '</p>');
          dt.setData('text/plain', seg.url);
        });
        await sleep(300);
        continue;
      }
      (await pasteImage(ed, file)) ? imgDone++ : imgFail++;
    }
    if (!imgTotal) return T.doneNoImg;
    return T.done(imgDone, imgFail);
  }

  // ---------- UI ----------
  const ICON =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">' +
    '<path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2v10h16V7H4zm2 8V9h2l2 2.5L12 9h2v6h-2v-3l-2 2.4L8 12v3H6zm11 0-3-3.5h2V9h2v2.5h2L17 15z"/>' +
    '</svg>';

  // 菜单里的图标要和知乎原生条目同尺寸（24），工具栏/悬浮球那个是 20
  const ICON24 = ICON.replace('width="20" height="20"', 'width="24" height="24"');

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

  function pickFiles() {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.multiple = true; // .md 之外还可以带上它引用的本地图片
      inp.accept = '.md,.markdown,.txt,image/*';
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

  async function start() {
    const files = await pickFiles();
    if (!files.length) return;
    const mdFile = files.find((f) => /\.(md|markdown|txt)$/i.test(f.name));
    if (!mdFile) { toast(T.noMd); return; }

    local.clear();
    for (const f of files) if (f !== mdFile) local.set(f.name.toLowerCase(), f);

    toast(T.reading, true);
    const md = await mdFile.text();
    let msg;
    try {
      msg = await run(md, (s) => toast(s, true));
    } catch (e) {
      msg = (e && e.message) || String(e);
    }
    toast(msg);
  }

  // 一次导入的动作。挂在菜单条目和悬浮球上是同一个。
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
  // 知乎「导入」展开的是一个 div.Menu，里面是两个原生条目
  // （导入文档 MD/Doc、导入链接 公众号）。我们的入口就追加在它们后面。
  //
  // 条目不是自己拼的，是**克隆一个原生条目再改内容**：那些 css-xxxxx 类名是构建时
  // 哈希出来的，随时会变，照抄一份迟早对不上；克隆则连内边距、悬停态、字号一起继承。
  // 克隆出来的节点没有 React fiber，所以知乎自己的点击处理不会误触发——正合适。
  //
  // 结构（实测）：<button><span>[svg]</span>导入文档<span>MD/Doc</span></button>
  const MENU_MARK = /导入文档|导入链接/;

  function findMenu() {
    for (const m of document.querySelectorAll('div.Menu')) {
      if (MENU_MARK.test(m.textContent || '')) return m;
    }
    return null;
  }

  function makeMenuItem(sample) {
    const it = sample.cloneNode(true);
    it.id = '__xae-zh-item';
    it.setAttribute('aria-label', T.item);
    it.removeAttribute('data-tooltip-position');
    it.removeAttribute('data-tooltip-classname');
    it.title = T.hint;
    // 红字，svg 用的是 currentColor，图标跟着一起红
    it.style.color = 'rgb(244,33,46)';
    it.style.cursor = 'pointer';

    // 图标换成我们自己的
    const svg = it.querySelector('svg');
    if (svg) {
      const box = document.createElement('span');
      box.innerHTML = ICON24;
      svg.replaceWith(box.firstElementChild);
    }
    // 主标题是 button 下面那个裸文本节点
    for (const n of [...it.childNodes]) {
      if (n.nodeType === 3 && n.textContent.trim()) { n.textContent = T.item; break; }
    }
    // 副标签（原生是 MD/Doc、公众号那一小行）
    const subs = it.querySelectorAll('span');
    const sub = subs[subs.length - 1];
    if (sub && sub !== it.firstElementChild) sub.textContent = T.itemSub;

    it.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
      go(null);
    });
    return it;
  }

  // 点完把浮层收掉。合成的 pointerdown / mousedown / click 一概无效（实测菜单纹丝不动，
  // 大概只认真实指针事件），但 Esc 能关——知乎自己给这个浮层绑了键盘关闭。
  function closeMenu() {
    setTimeout(() => {
      try {
        document.body.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true })
        );
      } catch (e) {}
    }, 0);
  }

  function injectMenuItem() {
    const menu = findMenu();
    if (!menu || menu.querySelector('#__xae-zh-item')) return !!menu;
    const sample = menu.querySelector('button');
    if (!sample) return false;
    menu.appendChild(makeMenuItem(sample));
    return true;
  }

  // ---------- 兜底悬浮球 ----------
  //
  // 菜单是点开才存在的，所以「有没有菜单」不能用来判断入口在不在。
  // 真正的判断是工具栏上那颗「导入」还在不在：它在，入口就走菜单；
  // 它没了（知乎改版），才挂一个红色悬浮球，免得彻底没地方点。
  function makeFab() {
    const b = document.createElement('div');
    b.id = '__xae-zh-btn';
    b.setAttribute('role', 'button');
    b.tabIndex = 0;
    b.title = T.tip + ' — ' + T.hint;
    b.setAttribute('aria-label', T.tip);
    b.innerHTML = ICON;
    b.style.cssText =
      'position:fixed;right:24px;bottom:24px;z-index:2147483646;width:46px;height:46px;' +
      'display:flex;align-items:center;justify-content:center;border-radius:9999px;cursor:pointer;' +
      'background:rgb(244,33,46);color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.28);' +
      'transition:opacity .15s;-webkit-tap-highlight-color:transparent';
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); go(b); });
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') go(b); });
    return b;
  }

  // 工具栏上的「导入」。和 X 那边一样不认标签只认文字。
  const LABEL = /^(导入|Import)$/;

  let anchorAt = 0;
  let hasAnchor = false;
  function importButton() {
    for (const e of document.querySelectorAll('span,div,button,a,label')) {
      if (e.children.length) continue;
      const label = (e.textContent || '').trim();
      if (!label || label.length > 8 || !LABEL.test(label)) continue;
      if (e.getClientRects().length) return e;
    }
    return null;
  }

  function mount() {
    const onEditor = /^\/(write|p\/\d+\/edit)/.test(location.pathname);
    const fab = document.getElementById('__xae-zh-btn');
    if (!onEditor || !bodyEditor()) {
      if (fab) fab.remove();
      return;
    }

    // 菜单随时开随时关，这个查询很便宜，每帧跑也无所谓
    injectMenuItem();

    // 找「导入」要遍历整个文档，隔几秒确认一次就够
    const now = Date.now();
    if (now - anchorAt > 3000) {
      anchorAt = now;
      hasAnchor = !!importButton();
    }
    if (hasAnchor) {
      if (fab) fab.remove();
    } else if (!fab) {
      document.body.appendChild(makeFab());
    }
  }


  function boot() {
    mount();
    // 合并成一拍再跑，别让每次 DOM 变动都触发。
    // 这里刻意不用 requestAnimationFrame：标签页不在前台时 rAF 是冻结的，
    // setInterval 也会被节流到分钟级，两个一起哑火就等于没挂载。setTimeout 不受这个影响。
    let queued = false;
    const soon = () => {
      if (queued) return;
      queued = true;
      setTimeout(() => { queued = false; mount(); }, 16);
    };
    const mo = new MutationObserver(soon);
    if (document.body) mo.observe(document.body, { childList: true, subtree: true });
    // 「导入」菜单是点开才存在的，而点击一定会派发——比等 observer 更及时
    document.addEventListener('click', () => setTimeout(mount, 60), true);
    setInterval(mount, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // 供测试/调试使用
  window.__XAE_ZH_RUN = run;
})();
