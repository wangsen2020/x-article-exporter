/*!
 * X Article Exporter — Markdown → X 长文编辑器
 *
 * 在长文编辑页（/compose/articles/edit/<id>）的 Preview 按钮左边挂一个图标。
 * 点一下：把正文框里现有的 Markdown 原文就地转成 X 长文自己的排版
 * （标题 / 列表 / 引用 / 代码块 / 粗斜体 / 链接），整篇替换，没有确认步骤。
 * 转错了按 Ctrl+Z —— 走的是 Draft 自己的编辑历史，撤销是原生的。
 *
 * 为什么走「粘贴」而不是直接写 DOM：
 * X 的长文编辑器是 Draft.js。它的真身是内存里的 ContentState，DOM 只是投影。
 * 往 contenteditable 里塞 innerHTML，Draft 不但不认，下一次 setState 还会把它抹掉，
 * 严重时整篇内容错乱。Draft 唯一对外开放的富文本入口就是 paste：
 * editOnPaste 会读 clipboardData 里的 text/html，用它自己的 HTML→ContentState
 * 转换器解析。所以这里做的事是：Markdown → 一份「Draft 认得的 HTML」→ 合成一次粘贴。
 */
(function () {
  'use strict';
  if (window.__XAE_MD) return;
  window.__XAE_MD = true;

  const ZH = (navigator.language || '').toLowerCase().startsWith('zh');
  const T = ZH
    ? {
        tip: 'Markdown → 长文排版',
        hint: '把正文里的 Markdown 就地转成 X 长文样式（Ctrl+Z 可撤销）',
        ok: '已转换',
        empty: '正文是空的',
        noMd: '正文里没有 Markdown 标记，没动它',
        noEditor: '没找到正文编辑器',
        noState: '接不上编辑器，这次没敢动正文',
        fail: '转换没生效，正文未改动',
      }
    : {
        tip: 'Markdown → article',
        hint: 'Convert the Markdown in the body to X article styling (Ctrl+Z to undo)',
        ok: 'Converted',
        empty: 'Body is empty',
        noMd: 'No Markdown found in the body — left untouched',
        noEditor: 'Body editor not found',
        noState: "Can't reach the editor state — body left untouched",
        fail: 'Conversion did not apply — body unchanged',
      };

  // Markdown → HTML 在 md2html.js 里（知乎那边也用同一份）。它是同一个 MAIN world
  // 的前一个内容脚本，正常一定先跑完；真没有就安静退出，别在页面上留个点了没反应的图标。
  const Md = window.XAEMd;
  if (!Md) return;
  const mdToHtml = Md.toHtml;
  const stripMd = Md.strip;


  // ---------- 找正文编辑器 ----------
  //
  // 标题和正文是两个独立的 Draft 实例。正文那个的特征：块用的是 longform-* class，
  // 而且它是页面上最高的一个。两条都不中就退回「最高的那个可编辑的」。
  function bodyEditor() {
    const eds = [...document.querySelectorAll('.public-DraftEditor-content[contenteditable="true"]')];
    if (!eds.length) return null;
    const marked = eds.filter((e) => e.querySelector('[class*="longform-"]'));
    return (marked.length ? marked : eds).sort(
      (a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height
    )[0];
  }

  // ---------- 接上 Draft 的状态 ----------
  //
  // Draft 的「当前内容」和「选中了哪一段」都在 EditorState 里，跟 DOM 是两回事：
  // 用 Range 或 execCommand('selectAll') 改 DOM 选区，Draft 根本不看，
  // 粘贴照样插在它自己记着的那个光标处（实测确认）。
  //
  // 要接的是 DraftEditor 这个组件实例本身，不是它的 props：
  // React 双缓冲两棵 fiber 树，DOM 节点上挂的 __reactFiber$ 常常指着旧的那棵，
  // 于是 memoizedProps.editorState 会慢一拍——实测读出来是「空文档」，
  // 而同一时刻 alternate 那边和实例上都是最新的 185 个字。
  // 实例上的 _latestEditorState 是 Draft 自己每次 update 都刷新的，永远最新；
  // 写回也用它的 update()，那正是 Draft 内部改状态走的同一个口子。
  // 这条路依赖 React / Draft 内部字段，随时可能失效——接不上就不动正文。
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

  const stateOf = (inst) => inst._latestEditorState;

  const pushState = (inst, st) => {
    if (typeof inst.update === 'function') inst.update(st);
    else inst.props.onChange(st); // update() 没了也还有 props 这条路
  };

  const blockText = (st) =>
    st
      .getCurrentContent()
      .getBlocksAsArray()
      .map((b) => b.getText())
      .join('\n');

  // 把选区撑成整篇，粘贴才会是「替换」而不是「插入」
  function selectAll(inst) {
    const st = stateOf(inst);
    const ES = st.constructor;
    const c = st.getCurrentContent();
    const first = c.getFirstBlock();
    const last = c.getLastBlock();
    pushState(
      inst,
      ES.forceSelection(
        st,
        st.getSelection().merge({
          anchorKey: first.getKey(),
          anchorOffset: 0,
          focusKey: last.getKey(),
          focusOffset: last.getLength(),
          isBackward: false,
          hasFocus: true,
        })
      )
    );
  }

  function firePaste(el, html, text) {
    const dt = new DataTransfer();
    dt.setData('text/html', html);
    dt.setData('text/plain', text);
    let ev;
    try {
      ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    } catch (e) {
      // 老浏览器不支持在构造函数里塞 clipboardData，退回手工挂一个
      ev = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'clipboardData', { value: dt });
    }
    el.dispatchEvent(ev);
  }

  // 一键：读正文 → 转换 → 整篇换掉
  async function convertInPlace() {
    const ed = bodyEditor();
    if (!ed) return T.noEditor;

    let inst = null;
    try { inst = draftEditor(ed); } catch (e) {}
    if (!inst) return T.noState;

    const md = blockText(stateOf(inst));
    if (!md.trim()) return T.empty;
    // 转完一次之后正文里已经没有任何标记了（标题就是标题块，不再带 #）。
    // 这时再点一下，整篇会被「当成大白文」重排成清一色段落，样式全丢。
    // 所以没有标记就直接不动——顺带也挡住了误点。
    if (!Md.hasMd(md)) return T.noMd;

    const html = mdToHtml(md);
    const before = ed.innerText;

    ed.focus();
    try { selectAll(inst); } catch (e) { return T.noState; }
    await new Promise((r) => setTimeout(r, 120)); // 等 Draft 把新选区渲染出来
    firePaste(ed, html, stripMd(md));
    await new Promise((r) => setTimeout(r, 160));

    return ed.innerText === before ? T.fail : T.ok;
  }

  // ---------- UI ----------
  const ICON =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">' +
    '<path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2v10h16V7H4zm2 8V9h2l2 2.5L12 9h2v6h-2v-3l-2 2.4L8 12v3H6zm11 0-3-3.5h2V9h2v2.5h2L17 15z"/>' +
    '</svg>';

  function toast(msg) {
    const d = document.createElement('div');
    d.textContent = msg;
    d.style.cssText =
      'position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:2147483647;' +
      'background:rgba(15,20,25,.92);color:#fff;padding:10px 16px;border-radius:9999px;' +
      'font:500 14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;max-width:80vw;text-align:center';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 3000);
  }

  // 顶栏的 Preview 控件。X 既不给它 data-testid，也不一定是 <button> 或
  // role="button"——第一版只在这两种里找，结果在真实编辑页上一个都没匹配到，
  // 图标退回了右下角。所以现在不认标签，只认文字：
  // 先找到「整个元素就只有 Preview 这几个字」的叶子节点，再往上爬到
  // 文本仍然只有这几个字的最外层——那一层就是这个控件的外壳，插在它前面。
  const PREVIEW = /^(preview|预览|預覽|プレビュー|미리보기|vista previa|aperçu|vorschau|anteprima|visualizar)$/i;

  let anchor = null; // 上次找到的 Preview 控件
  let anchorAt = 0; // 上次翻文档找它的时间
  function previewButton() {
    for (const e of document.querySelectorAll('span,div,button,a,p,label')) {
      if (e.children.length) continue; // 只看叶子，避免匹配到一整个容器
      const label = (e.textContent || '').trim();
      if (!label || label.length > 20 || !PREVIEW.test(label)) continue;
      if (!e.getClientRects().length) continue; // 隐藏的（菜单里的同名项）不算
      let node = e;
      while (
        node.parentElement &&
        node.parentElement !== document.body &&
        (node.parentElement.textContent || '').trim() === label
      ) {
        node = node.parentElement;
      }
      return node;
    }
    return null;
  }

  function makeButton() {
    const b = document.createElement('div');
    b.id = '__xae-md-btn';
    b.setAttribute('role', 'button');
    b.tabIndex = 0;
    b.title = T.tip + ' — ' + T.hint; // 图标按钮，文字只在提示里
    b.setAttribute('aria-label', T.tip);
    b.innerHTML = ICON;
    const run = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (b.dataset.busy) return; // 连点两下会把上一次的结果再转一遍
      b.dataset.busy = '1';
      b.style.opacity = '.4';
      let msg;
      try {
        msg = await convertInPlace();
      } catch (err) {
        msg = (err && err.message) || String(err);
      }
      delete b.dataset.busy;
      b.style.opacity = '1';
      toast(msg);
    };
    b.addEventListener('click', run);
    b.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') run(e);
    });
    b.addEventListener('mouseenter', () => { if (!b.dataset.busy) b.style.opacity = '.7'; });
    b.addEventListener('mouseleave', () => { if (!b.dataset.busy) b.style.opacity = '1'; });
    return b;
  }

  function mount() {
    // 只在长文编辑器里出现。认得到可编辑的 Draft 正文才算真进了编辑页。
    const inComposer =
      /\/compose\/articles?\//.test(location.pathname) || /\/i\/article\/edit/.test(location.pathname);
    let b = document.getElementById('__xae-md-btn');
    if (!inComposer || !bodyEditor()) {
      if (b) b.remove();
      anchor = null;
      return;
    }

    // 已经稳稳在 Preview 左边，就连扫都不用扫。mount 在每一帧变动后都会跑，
    // 而找 Preview 要遍历整个文档——不设这道闸，滚动时会明显卡。
    if (b && b.isConnected && anchor && anchor.isConnected && b.nextElementSibling === anchor) return;

    // 退回悬浮之后也要继续找：顶栏可能比编辑器晚挂出来。但别每帧都翻一遍文档。
    const now = Date.now();
    if (b && b.isConnected && !anchor && now - anchorAt < 1500) return;
    anchorAt = now;

    const prev = previewButton();
    anchor = prev;
    if (b) b.remove();
    b = makeButton();

    if (prev && prev.parentElement) {
      // 跟着 Preview 走，别在工具栏里显得高一截或矮一截。
      // 用红色：顶栏一圈都是蓝色链接和灰字，跟着用 inherit 就混进去了，
      // 用户根本不知道那是个能点的东西。红色跟帖子里的导出图标也是同一个色号。
      b.style.cssText =
        'display:inline-flex;align-items:center;justify-content:center;align-self:center;' +
        'padding:0 10px;min-height:32px;cursor:pointer;color:rgb(244,33,46);background:none;border:0;' +
        'border-radius:9999px;transition:opacity .15s;-webkit-tap-highlight-color:transparent';
      prev.parentElement.insertBefore(b, prev);
    } else {
      // 找不到 Preview（换文案 / 改结构）也得有地方点，退回右下角悬浮
      b.style.cssText =
        'position:fixed;right:24px;bottom:24px;z-index:2147483646;width:46px;height:46px;' +
        'display:flex;align-items:center;justify-content:center;border-radius:9999px;cursor:pointer;' +
        'background:rgb(244,33,46);color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.28);' +
        'transition:opacity .15s;-webkit-tap-highlight-color:transparent';
      document.body.appendChild(b);
    }
  }

  // 编辑器和工具栏都是异步挂上来的，SPA 路由切走还会整块拆掉——持续对账
  function boot() {
    mount();
    let queued = false;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; mount(); });
    });
    if (document.body) mo.observe(document.body, { childList: true, subtree: true });
    setInterval(mount, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // 供测试/调试使用
  window.__XAE_MD2HTML = mdToHtml;
  window.__XAE_MD_RUN = convertInPlace;
})();
