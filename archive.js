/*!
 * 存档库 —— 扩展自己的 IndexedDB。
 *
 * 目的：原帖被作者删掉之后，本地仍留着一份能看的东西。
 *
 * 为什么不用 chrome.storage.local：快照是自包含 HTML（图片内联成 data URI），
 * 单篇长文轻松几 MB。storage.local 是整体序列化的 key-value，列表页读一次
 * 就把所有正文都拉进内存。这里把「元信息」和「快照正文」拆成两个 store，
 * 列表只读前者（每条几百字节），正文按需读。
 *
 * 这个文件同时被 service worker（importScripts）、viewer 页和 options 页加载，
 * 三者同源共享同一个库。
 */
(function (global) {
  'use strict';

  const DB_NAME = 'xae-archive';
  const DB_VER = 1;
  const POSTS = 'posts';       // 元信息：id / url / 作者 / 标题 / 时间 / 缩略图 / 文件记录
  const SNAPS = 'snapshots';   // 自包含 HTML 正文

  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains(POSTS)) {
          const s = db.createObjectStore(POSTS, { keyPath: 'id' });
          s.createIndex('savedAt', 'savedAt');
          s.createIndex('handle', 'handle');
        }
        if (!db.objectStoreNames.contains(SNAPS)) {
          db.createObjectStore(SNAPS, { keyPath: 'id' });
        }
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      // blocked 既不算成功也不算失败。不管它的话这个 Promise 永远悬着，
      // 调用方就永远停在「正在写入存档…」。宁可报错，让上层跳过存档。
      r.onblocked = () => reject(new Error('IndexedDB blocked by another tab'));
    });
    dbPromise.catch(() => { dbPromise = null; }); // 失败别缓存住，下次还能重试
    return dbPromise;
  }

  /**
   * 一次事务做一件事，请求在拿到事务的同一个任务里发出去。
   *
   * IndexedDB 的事务在当前任务跑完就自动失活，跨一次事件循环再发请求就是
   * TransactionInactiveError。之前那种「先 await 拿到 objectStore，再对它
   * 发请求」的写法正踩在这条线上：平时侥幸能过，一旦调用点前面多一次 await
   * （比如先算缩略图），整条存档就静悄悄地失败，用户只看到存档库是空的。
   */
  function tx(name, mode, run) {
    return open().then(
      (db) =>
        new Promise((res, rej) => {
          let t;
          try {
            t = db.transaction(name, mode);
          } catch (e) {
            rej(e);
            return;
          }
          let result;
          t.oncomplete = () => res(result);
          t.onabort = t.onerror = () => rej(t.error || new Error('transaction aborted'));
          let r;
          try {
            r = run(t.objectStore(name));
          } catch (e) {
            try { t.abort(); } catch (e2) {}
            rej(e);
            return;
          }
          if (r) r.onsuccess = () => { result = r.result; };
        })
    );
  }

  /**
   * 写入 / 覆盖一条存档。
   * meta: { id, url, handle, name, title, textPreview, kind, blocks, thumb }
   * html: 自包含快照（可为空——只记元信息时）
   * 已存在的同 id 会保留原有的 files 列表和首次存档时间。
   */
  async function put(meta, html) {
    const prev = await get(meta.id);
    const rec = Object.assign({}, prev || {}, meta, {
      savedAt: Date.now(),
      firstSavedAt: (prev && prev.firstSavedAt) || Date.now(),
      files: (prev && prev.files) || [],
      bytes: html ? html.length : (prev && prev.bytes) || 0,
    });
    await tx(POSTS, 'readwrite', (st) => st.put(rec));
    if (html) await tx(SNAPS, 'readwrite', (st) => st.put({ id: meta.id, html }));
    return rec;
  }

  async function get(id) {
    return tx(POSTS, 'readonly', (st) => st.get(id));
  }

  async function snapshot(id) {
    const r = await tx(SNAPS, 'readonly', (st) => st.get(id));
    return r ? r.html : null;
  }

  /** 按存档时间倒序返回全部元信息（不含正文）。 */
  async function list() {
    const all = await tx(POSTS, 'readonly', (st) => st.getAll());
    return (all || []).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  }

  /** 记一个落盘文件：{ format, filename, downloadId, at } */
  async function addFile(id, file) {
    const rec = await get(id);
    if (!rec) return null;
    rec.files = (rec.files || []).filter((f) => f.downloadId !== file.downloadId);
    rec.files.push(file);
    await tx(POSTS, 'readwrite', (st) => st.put(rec));
    return rec;
  }

  async function remove(id) {
    await tx(POSTS, 'readwrite', (st) => st.delete(id));
    await tx(SNAPS, 'readwrite', (st) => st.delete(id));
  }

  async function usage() {
    const all = await list();
    return {
      count: all.length,
      bytes: all.reduce((n, r) => n + (r.bytes || 0), 0),
    };
  }

  /** 超出条数上限时，从最旧的开始删。maxCount <= 0 表示不限。 */
  async function prune(maxCount) {
    if (!maxCount || maxCount <= 0) return 0;
    const all = await list();
    const drop = all.slice(maxCount);
    for (const r of drop) await remove(r.id);
    return drop.length;
  }

  global.XAEArchive = { put, get, snapshot, list, addFile, remove, usage, prune };
})(typeof self !== 'undefined' ? self : window);
