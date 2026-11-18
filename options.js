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
    (rec.files || []).forEach((f) => {
      const fmt = String(f.format || '').toLowerCase();
      addChip(fmt === 'gdoc' ? 'Google Docs' : fmt === 'gdrive' ? 'Google Drive' : fmt.toUpperCase());
    });
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

    // 云端 Google Docs 按钮：未上传时一键把本地快照转存为 Google Doc（按需拉起授权），已上传则直达在线文档
    const gdocFile = [...(rec.files || [])].reverse().find((f) => f.format === 'gdoc' && f.webViewLink);
    const gdriveFile = [...(rec.files || [])].reverse().find((f) => f.format === 'gdrive' && f.webViewLink);
    let guideBox = null;
    if (gdocFile) {
      const bCloud = document.createElement('button');
      bCloud.textContent = '打开 Google Doc ↗';
      bCloud.title = `${gdocFile.filename || rec.title || 'Google Docs'}\n${gdocFile.webViewLink}`;
      bCloud.addEventListener('click', () => chrome.tabs.create({ url: gdocFile.webViewLink }));
      acts.appendChild(bCloud);
    } else if (typeof XAEGDrive !== 'undefined') {
      const bUpDoc = document.createElement('button');
      bUpDoc.textContent = '↗ Google Docs';
      bUpDoc.title = '将本地快照上传并转换为 Google Docs 在线文档（首次使用会弹出 Google 授权窗）';
      bUpDoc.addEventListener('click', async () => {
        if (bUpDoc.disabled) return;
        bUpDoc.disabled = true;
        bUpDoc.textContent = '正在读取快照…';
        if (guideBox) { guideBox.remove(); guideBox = null; }
        try {
          const html = await XAEArchive.snapshot(rec.id);
          if (!html) throw new Error('本地快照为空');
          const up = await XAEGDrive.uploadAsGoogleDoc({
            title: rec.title || 'X Article',
            html,
            meta: rec,
            onInteractiveStart: () => {
              bUpDoc.textContent = '等待授权…';
            },
            onProgress: (txt) => {
              if (txt && txt.includes('授权')) bUpDoc.textContent = '等待授权…';
              else bUpDoc.textContent = txt.replace(/^正在/, '').replace(/…$/, '') || '上传中…';
            },
          });
          await XAEArchive.addFile(rec.id, {
            format: 'gdoc',
            filename: up.name,
            fileId: up.id,
            webViewLink: up.webViewLink,
            at: Date.now(),
          });
          await refresh();
        } catch (e) {
          bUpDoc.disabled = false;
          const cancelled = XAEGDrive.isAuthCancelError && XAEGDrive.isAuthCancelError(e);
          bUpDoc.textContent = cancelled ? '已取消授权' : '上传失败';
          bUpDoc.title = (e && e.message) || String(e);
          if (e && e.guideUrl) {
            guideBox = document.createElement('div');
            guideBox.className = 'path';
            const b = document.createElement('b');
            b.textContent = '需要开启服务：';
            const a = document.createElement('a');
            a.href = e.guideUrl;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.textContent = '点击开启 Google Drive API ↗';
            guideBox.appendChild(b);
            guideBox.appendChild(a);
            body.appendChild(guideBox);
          }
          setTimeout(() => {
            bUpDoc.textContent = '↗ Google Docs';
          }, 3000);
        }
      });
      acts.appendChild(bUpDoc);
    }

    if (gdriveFile) {
      const bDrivePdf = document.createElement('button');
      bDrivePdf.textContent = '打开云端 PDF ↗';
      bDrivePdf.title = `${gdriveFile.filename || 'PDF'}\n${gdriveFile.webViewLink}`;
      bDrivePdf.addEventListener('click', () => chrome.tabs.create({ url: gdriveFile.webViewLink }));
      acts.appendChild(bDrivePdf);
    }

    if (rec.url) {
      const bSrc = document.createElement('button');
      bSrc.textContent = '原帖';
      bSrc.title = '原帖可能已被作者删除';
      bSrc.addEventListener('click', () => chrome.tabs.create({ url: rec.url }));
      acts.appendChild(bSrc);
    }

    const lastLocalFile = [...(rec.files || [])].reverse().find((f) => f.downloadId !== undefined);
    if (lastLocalFile && lastLocalFile.downloadId !== undefined) {
      const bShow = document.createElement('button');
      bShow.textContent = '在文件夹中显示';
      bShow.addEventListener('click', () => {
        // 文件可能已被用户手动删掉，show() 会静默失败，这里给一句提示
        chrome.downloads.search({ id: lastLocalFile.downloadId }, (items) => {
          if (items && items[0] && items[0].exists) chrome.downloads.show(lastLocalFile.downloadId);
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

    if ((lastLocalFile && lastLocalFile.filename) || gdocFile || gdriveFile) {
      const p = document.createElement('div');
      p.className = 'path';
      const appendCloudRow = (label, fileRec, fallbackName) => {
        const row = document.createElement('div');
        const b = document.createElement('b');
        b.textContent = label;
        const a = document.createElement('a');
        a.href = fileRec.webViewLink;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = (fileRec.filename || fallbackName) + ' ↗';
        row.appendChild(b);
        row.appendChild(a);
        if (fileRec.at) {
          row.appendChild(document.createTextNode('（' + fmtDate(fileRec.at) + '）'));
        }
        p.appendChild(row);
      };
      if (lastLocalFile && lastLocalFile.filename) {
        const row = document.createElement('div');
        const b = document.createElement('b');
        b.textContent = '已保存到：';
        row.appendChild(b);
        row.appendChild(document.createTextNode(lastLocalFile.filename));
        p.appendChild(row);
      }
      if (gdocFile) appendCloudRow('Google Docs：', gdocFile, rec.title || '在线文档');
      if (gdriveFile) appendCloudRow('Google Drive：', gdriveFile, (rec.title || 'x-export') + '.pdf');
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

  const guideBtn = $('openGuide');
  if (guideBtn) {
    guideBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('guide.html') });
    });
  }

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
