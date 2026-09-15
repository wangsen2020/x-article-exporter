/*!
 * 存档库界面。
 *
 * 快照正文不在这里渲染——它体积大且来自第三方页面，
 * 统一丢给 snapshot.html 里的沙箱 iframe 显示（见 snapshot.js）。
 * 这一页只读元信息（每条几百字节），所以几百篇也能瞬开。
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const grid = $('grid');
  const empty = $('empty');
  const qBox = $('q');
  const capBox = $('cap');

  let all = [];

  const fmtBytes = (n) => {
    if (!n) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    return (n / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + u[i];
  };
  const fmtDate = (ms) => new Date(ms).toLocaleString('zh-CN', { hour12: false });

  function card(rec) {
    const el = document.createElement('div');
    el.className = 'card';

    if (rec.thumb) {
      const img = document.createElement('img');
      img.className = 'thumb';
      img.src = rec.thumb;
      img.alt = '';
      el.appendChild(img);
    } else {
      const d = document.createElement('div');
      d.className = 'thumb none';
      d.textContent = rec.textPreview || '（无预览）';
      el.appendChild(d);
    }

    const body = document.createElement('div');
    body.className = 'body';

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = rec.title || '(无标题)';
    body.appendChild(title);

    const who = document.createElement('div');
    who.className = 'who';
    who.textContent = [rec.name, rec.handle ? '@' + rec.handle : '', fmtDate(rec.savedAt)]
      .filter(Boolean).join(' · ');
    body.appendChild(who);

    const chips = document.createElement('div');
    chips.className = 'chips';
    const addChip = (txt) => {
      const c = document.createElement('span');
      c.className = 'chip';
      c.textContent = txt;
      chips.appendChild(c);
    };
    if (rec.kind) addChip(rec.kind === 'article' ? '长文' : '推文串');
    if (rec.blocks) addChip(rec.blocks + ' 块');
    if (rec.images && rec.images.total) addChip(`图 ${rec.images.inlined}/${rec.images.total}`);
    addChip(fmtBytes(rec.bytes));
    (rec.files || []).forEach((f) => addChip(String(f.format || '').toUpperCase()));
    body.appendChild(chips);

    const acts = document.createElement('div');
    acts.className = 'acts';

    const bOpen = document.createElement('button');
    bOpen.className = 'primary';
    bOpen.textContent = '打开快照';
    bOpen.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('snapshot.html?id=' + encodeURIComponent(rec.id)) });
    });
    acts.appendChild(bOpen);

    if (rec.url) {
      const bSrc = document.createElement('button');
      bSrc.textContent = '原帖';
      bSrc.title = '原帖可能已被作者删除';
      bSrc.addEventListener('click', () => chrome.tabs.create({ url: rec.url }));
      acts.appendChild(bSrc);
    }

    const lastFile = (rec.files || [])[rec.files.length - 1];
    if (lastFile && lastFile.downloadId !== undefined) {
      const bShow = document.createElement('button');
      bShow.textContent = '在文件夹中显示';
      bShow.addEventListener('click', () => {
        // 文件可能已被用户手动删掉，show() 会静默失败，这里给一句提示
        chrome.downloads.search({ id: lastFile.downloadId }, (items) => {
          if (items && items[0] && items[0].exists) chrome.downloads.show(lastFile.downloadId);
          else bShow.textContent = '文件已不在';
        });
      });
      acts.appendChild(bShow);
    }

    const bDel = document.createElement('button');
    bDel.className = 'danger';
    bDel.textContent = '删除';
    bDel.addEventListener('click', async () => {
      if (bDel.dataset.armed !== '1') {
        bDel.dataset.armed = '1';
        bDel.textContent = '再点一次确认';
        setTimeout(() => { bDel.dataset.armed = '0'; bDel.textContent = '删除'; }, 4000);
        return;
      }
      await XAEArchive.remove(rec.id);
      await refresh();
    });
    acts.appendChild(bDel);

    body.appendChild(acts);

    if (lastFile && lastFile.filename) {
      const p = document.createElement('div');
      p.className = 'path';
      const b = document.createElement('b');
      b.textContent = '已保存到：';
      p.appendChild(b);
      p.appendChild(document.createTextNode(lastFile.filename));
      body.appendChild(p);
    }

    el.appendChild(body);
    return el;
  }

  function render() {
    const q = qBox.value.trim().toLowerCase();
    const rows = q
      ? all.filter((r) =>
          [r.title, r.name, r.handle, r.textPreview].join(' ').toLowerCase().includes(q))
      : all;

    grid.textContent = '';
    rows.forEach((r) => grid.appendChild(card(r)));
    empty.hidden = rows.length > 0;
    if (q && !rows.length) {
      empty.hidden = false;
      empty.querySelector('strong').textContent = '没有匹配的存档';
    }
  }

  async function refresh() {
    all = await XAEArchive.list();
    const u = await XAEArchive.usage();
    $('usage').textContent = `${u.count} 篇 · ${fmtBytes(u.bytes)}`;
    render();
  }

  qBox.addEventListener('input', render);

  $('save').addEventListener('click', async () => {
    const cap = Math.max(0, parseInt(capBox.value, 10) || 0);
    await chrome.storage.local.set({ maxPosts: cap });
    const dropped = await XAEArchive.prune(cap);
    await refresh();
    const btn = $('save');
    btn.textContent = dropped ? `已清理 ${dropped} 篇` : '已保存';
    setTimeout(() => (btn.textContent = '保存并清理'), 2500);
  });

  (async function init() {
    const { maxPosts } = await chrome.storage.local.get({ maxPosts: 0 });
    capBox.value = maxPosts;
    await refresh();
  })();
})();
