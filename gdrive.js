/*!
 * Google Docs / Google Drive (PDF) 云端同步模块。
 *
 * 设计原则：
 * 1. 纯按需授权（On-Demand Auth）：绝不在安装、启动、打开页面或本地导出时预先请求授权；
 *    仅在用户点击「↗ Google Docs」或「↗ Google Drive (PDF)」时才获取 OAuth2 令牌。
 * 2. 最小权限范围：仅使用非敏感权限 https://www.googleapis.com/auth/drive.file，
 *    只能访问本扩展自己创建的文件夹与文档。
 * 3. 零第三方 SDK：基于 chrome.identity + Google Drive REST API v3 Multipart 原生接口，
 *    同时兼容 Service Worker、扩展页面（viewer / options）与 Node.js 单测环境。
 */
(function (root) {
  'use strict';

  const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const FOLDER_MIME = 'application/vnd.google-apps.folder';
  const GDOC_MIME = 'application/vnd.google-apps.document';
  const PDF_MIME = 'application/pdf';
  const HTML_MIME = 'text/html';
  const FOLDER_NAME = 'X Article Exporter';
  const FOLDER_CACHE_KEY = 'gdriveFolderId';
  const FILES_API = 'https://www.googleapis.com/drive/v3/files';
  const UPLOAD_API =
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink';
  const PLACEHOLDER_CLIENT_ID = 'YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com';
  const WEB_AUTH_CLIENT_ID = '51782706977-lan42tu980ttnm3ga78sbhen9113kf95.apps.googleusercontent.com';
  const WEB_TOKEN_CACHE_KEY = 'gdriveWebAuthToken';
  // Google Docs 默认窄边框（0.5in = 36pt 页边距）下 US Letter/A4 版心宽度约 7.5in (540pt = 720px @ 96dpi)；
  // 导入 HTML 时显式写入 width/height 属性可确保配图严格适配窄边框文档宽度而不溢出右侧页边距。
  const GDOC_CONTENT_WIDTH = 720;
  const AUTH_WAIT_PROMPT = '正在拉起 Google 授权窗：请选择账号并点击「Continue / 继续」授权云盘权限…';

  const GDOC_STYLE = [
    '@page{margin:36pt 36pt 36pt 36pt}',
    'body{max-width:540pt;padding:36pt 36pt 36pt 36pt;margin:36pt 36pt 36pt 36pt;font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",Arial,sans-serif;font-size:11.5pt;line-height:1.75;color:#0f1419}',
    'h1{font-size:20pt;line-height:1.3;margin:0 0 8pt;color:#0f1419}',
    'h2{font-size:15pt;line-height:1.35;margin:18pt 0 6pt;color:#0f1419}',
    'h3{font-size:13pt;line-height:1.4;margin:14pt 0 4pt;color:#0f1419}',
    'h4{font-size:11.5pt;line-height:1.4;margin:12pt 0 4pt;color:#0f1419}',
    'p{margin:0 0 10pt;color:#0f1419}',
    'a{color:#1d9bf0;text-decoration:underline}',
    'img{max-width:100%;height:auto}',
    'blockquote{margin:12pt 0;padding:8pt 12pt;border-left:3pt solid #1d9bf0;background-color:#f7f9fa;color:#0f1419}',
    'pre{background-color:#f7f9fa;border:1pt solid #e1e8ed;padding:10pt 12pt;font-family:Consolas,Menlo,monospace;font-size:9.5pt;white-space:pre-wrap}',
    'code{font-family:Consolas,Menlo,monospace;font-size:9.5pt;background-color:#f0f3f5;padding:1pt 3pt}',
    'pre code{background-color:transparent;padding:0}',
    'ul,ol{margin:0 0 10pt;padding-left:20pt}',
    'li{margin:3pt 0}',
  ].join('\n');

  /**
   * 判断错误是否属于用户主动取消或关闭了 Google OAuth 授权窗。
   */
  function isAuthCancelError(err) {
    if (!err) return false;
    if (err.code === 'AUTH_CANCELLED' || err.cancelled === true) return true;
    const msg = String(err.message || err || '');
    return /user did not approve|user_cancelled|access_denied|canceled|cancelled|closed the window|authorization page could not be loaded|interrupted/i.test(
      msg
    );
  }

  function makeCancelError(rawErr) {
    const e = new Error('已取消 Google 账号授权');
    e.code = 'AUTH_CANCELLED';
    e.cancelled = true;
    e.cause = rawErr;
    return e;
  }

  function hasPlaceholderClientId() {
    try {
      const m =
        typeof chrome !== 'undefined' &&
        chrome.runtime &&
        typeof chrome.runtime.getManifest === 'function' &&
        chrome.runtime.getManifest();
      const cid = m && m.oauth2 && m.oauth2.client_id;
      return !cid || cid === PLACEHOLDER_CLIENT_ID || cid.indexOf('YOUR_GOOGLE_OAUTH_CLIENT_ID') === 0;
    } catch (_) {
      return false;
    }
  }

  function callGetAuthToken(interactive) {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.identity || typeof chrome.identity.getAuthToken !== 'function') {
        reject(new Error('当前环境不支持 chrome.identity 授权接口'));
        return;
      }
      let settled = false;
      const finish = (err, val) => {
        if (settled) return;
        settled = true;
        if (err) {
          reject(err);
          return;
        }
        const token = typeof val === 'string' ? val : (val && val.token) || '';
        resolve(token);
      };
      try {
        const ret = chrome.identity.getAuthToken({ interactive: !!interactive }, (token) => {
          const lastErr = chrome.runtime && chrome.runtime.lastError;
          if (lastErr) finish(new Error(lastErr.message || String(lastErr)));
          else finish(null, token);
        });
        if (ret && typeof ret.then === 'function') {
          ret.then(
            (val) => finish(null, val),
            (err) => finish(err)
          );
        }
      } catch (e) {
        finish(e);
      }
    });
  }

  async function getCachedWebToken() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const obj = await chrome.storage.local.get(WEB_TOKEN_CACHE_KEY);
        const rec = obj && obj[WEB_TOKEN_CACHE_KEY];
        if (rec && rec.token && (!rec.expiresAt || rec.expiresAt > Date.now())) {
          return rec.token;
        }
      }
    } catch (_) {}
    return '';
  }

  async function setCachedWebToken(token, expiresInSec) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        if (!token) {
          if (typeof chrome.storage.local.remove === 'function') {
            await chrome.storage.local.remove(WEB_TOKEN_CACHE_KEY);
          } else {
            await chrome.storage.local.set({ [WEB_TOKEN_CACHE_KEY]: null });
          }
          return;
        }
        const ttl = Math.max(60, (Number(expiresInSec) || 3600) - 60) * 1000;
        await chrome.storage.local.set({
          [WEB_TOKEN_CACHE_KEY]: { token, expiresAt: Date.now() + ttl },
        });
      }
    } catch (_) {}
  }

  function callLaunchWebAuthFlow(interactive) {
    return new Promise((resolve, reject) => {
      if (
        typeof chrome === 'undefined' ||
        !chrome.identity ||
        typeof chrome.identity.launchWebAuthFlow !== 'function'
      ) {
        reject(new Error('当前环境不支持 chrome.identity.launchWebAuthFlow 授权接口'));
        return;
      }
      const redirectUri =
        typeof chrome.identity.getRedirectURL === 'function'
          ? chrome.identity.getRedirectURL()
          : `https://${(chrome.runtime && chrome.runtime.id) || ''}.chromiumapp.org/`;
      const authUrl =
        'https://accounts.google.com/o/oauth2/v2/auth?' +
        new URLSearchParams({
          client_id: WEB_AUTH_CLIENT_ID,
          response_type: 'token',
          redirect_uri: redirectUri,
          scope: DRIVE_SCOPE,
          prompt: interactive ? 'select_account' : 'none',
        }).toString();

      let settled = false;
      const finish = (err, responseUrl) => {
        if (settled) return;
        settled = true;
        if (err) {
          reject(err);
          return;
        }
        const raw = String(responseUrl || '');
        const hashIdx = raw.indexOf('#');
        const queryIdx = raw.indexOf('?');
        const frag = hashIdx >= 0 ? raw.slice(hashIdx + 1) : queryIdx >= 0 ? raw.slice(queryIdx + 1) : '';
        const params = new URLSearchParams(frag);
        const oauthErr = params.get('error');
        if (oauthErr) {
          reject(new Error(oauthErr));
          return;
        }
        const token = params.get('access_token') || '';
        const expiresIn = Number(params.get('expires_in')) || 3600;
        if (!token) {
          reject(new Error('empty token from launchWebAuthFlow'));
          return;
        }
        setCachedWebToken(token, expiresIn).then(
          () => resolve(token),
          () => resolve(token)
        );
      };

      try {
        const ret = chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: !!interactive }, (respUrl) => {
          const lastErr = chrome.runtime && chrome.runtime.lastError;
          if (lastErr) finish(new Error(lastErr.message || String(lastErr)));
          else finish(null, respUrl);
        });
        if (ret && typeof ret.then === 'function') {
          ret.then(
            (val) => finish(null, val),
            (err) => finish(err)
          );
        }
      } catch (e) {
        finish(e);
      }
    });
  }

  function removeCachedToken(token) {
    return new Promise((resolve) => {
      setCachedWebToken('', 0).catch(() => {});
      if (
        !token ||
        typeof chrome === 'undefined' ||
        !chrome.identity ||
        typeof chrome.identity.removeCachedAuthToken !== 'function'
      ) {
        resolve();
        return;
      }
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      try {
        const ret = chrome.identity.removeCachedAuthToken({ token }, done);
        if (ret && typeof ret.then === 'function') ret.then(done, done);
      } catch (_) {
        done();
      }
    });
  }

  /**
   * 按需获取 Google OAuth2 访问令牌：
   * 1) 先以 interactive: false 静默读取缓存令牌；
   * 2) 若无缓存令牌且允许交互（interactive !== false），触发 onInteractiveStart 回调并拉起 Google 授权窗；
   * 3) 若浏览器不支持 getAuthToken（如部分 Chromium 派生浏览器或未启用内置身份服务），自动回退到 launchWebAuthFlow。
   */
  async function ensureToken(opts) {
    const options = opts || {};
    const interactive = options.interactive !== false;
    let silentErr = null;
    try {
      const cached = await callGetAuthToken(false);
      if (cached) return { token: cached, interactiveUsed: false };
    } catch (e) {
      silentErr = e;
    }

    const cachedWeb = await getCachedWebToken();
    if (cachedWeb) return { token: cachedWeb, interactiveUsed: false };

    if (!interactive) {
      throw silentErr || new Error('未获取到已缓存的 Google 授权令牌');
    }

    if (typeof options.onInteractiveStart === 'function') {
      try {
        options.onInteractiveStart();
      } catch (_) {}
    }

    try {
      const token = await callGetAuthToken(true);
      if (!token) throw makeCancelError(new Error('empty token'));
      return { token, interactiveUsed: true };
    } catch (err) {
      if (isAuthCancelError(err)) throw makeCancelError(err);
      const msg = String((err && err.message) || err || '');
      if (
        hasPlaceholderClientId() &&
        /client_id|oauth2|bad client|invalid|not granted/i.test(msg)
      ) {
        const cfgErr = new Error('尚未配置有效的 Google OAuth Client ID（请先在 Google Cloud Console 创建凭据并填入 manifest.json）');
        cfgErr.guideUrl = 'https://console.cloud.google.com/apis/credentials';
        throw cfgErr;
      }
      if (
        typeof chrome !== 'undefined' &&
        chrome.identity &&
        typeof chrome.identity.launchWebAuthFlow === 'function'
      ) {
        try {
          const webToken = await callLaunchWebAuthFlow(true);
          if (!webToken) throw makeCancelError(new Error('empty token'));
          return { token: webToken, interactiveUsed: true };
        } catch (webErr) {
          if (isAuthCancelError(webErr)) throw makeCancelError(webErr);
          throw webErr instanceof Error ? webErr : new Error(String(webErr || msg || 'Google 授权失败'));
        }
      }
      throw err instanceof Error ? err : new Error(msg || 'Google 授权失败');
    }
  }

  /**
   * 带 Bearer Token 的请求封装；遇到 401 自动清理失效缓存令牌并重新获取一次。
   */
  async function fetchWithAuth(url, init, opts) {
    const options = opts || {};
    const fetchFn = options.fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!fetchFn) throw new Error('当前环境不支持 fetch');

    let token = options.token || '';
    if (!token) {
      const r = await ensureToken({
        interactive: options.interactive !== false,
        onInteractiveStart: options.onInteractiveStart,
      });
      token = r.token;
    }

    const doReq = (tk) => {
      const headers = Object.assign({}, (init && init.headers) || {}, {
        Authorization: 'Bearer ' + tk,
      });
      return fetchFn(url, Object.assign({}, init || {}, { headers }));
    };

    let resp = await doReq(token);
    if (resp && resp.status === 401) {
      await removeCachedToken(token);
      const refreshed = await ensureToken({
        interactive: options.interactive !== false,
        onInteractiveStart: options.onInteractiveStart,
      });
      token = refreshed.token;
      resp = await doReq(token);
    }
    return { resp, token };
  }

  async function getCachedFolderId() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const obj = await chrome.storage.local.get(FOLDER_CACHE_KEY);
        return (obj && obj[FOLDER_CACHE_KEY]) || '';
      }
    } catch (_) {}
    return '';
  }

  async function setCachedFolderId(id) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        if (id) await chrome.storage.local.set({ [FOLDER_CACHE_KEY]: id });
        else if (typeof chrome.storage.local.remove === 'function') {
          await chrome.storage.local.remove(FOLDER_CACHE_KEY);
        } else {
          await chrome.storage.local.set({ [FOLDER_CACHE_KEY]: '' });
        }
      }
    } catch (_) {}
  }

  async function parseDriveError(resp) {
    let detail = '';
    try {
      const data = await resp.json();
      detail = (data && data.error && data.error.message) || '';
    } catch (_) {
      try {
        detail = await resp.text();
      } catch (_2) {}
    }
    return detail ? `HTTP ${resp.status}: ${detail}` : `HTTP ${resp.status}`;
  }

  async function makeDriveError(prefix, resp) {
    const raw = await parseDriveError(resp);
    if (
      resp &&
      resp.status === 403 &&
      /drive\.googleapis\.com|has not been used in project|accessNotConfigured/i.test(raw)
    ) {
      const m = raw.match(/https:\/\/console\.(?:developers|cloud)\.google\.com\/[^\s"')\]]+/);
      const err = new Error('当前 Google Cloud 项目尚未开启 Google Drive API，请点击引导链接启用后重试');
      err.code = 'DRIVE_API_DISABLED';
      err.guideUrl = (m && m[0]) || 'https://console.cloud.google.com/apis/library/drive.googleapis.com';
      return err;
    }
    return new Error(prefix ? `${prefix}（${raw}）` : raw);
  }

  let folderInflight = null;

  /**
   * 幂等确保云端归档目录 "X Article Exporter" 存在，并缓存目录 ID。
   * 并发调用共享同一个 in-flight Promise，防止首次并发上传创建重复同名目录。
   */
  async function ensureFolder(opts) {
    const options = opts || {};
    if (!options.forceRefresh) {
      const cached = await getCachedFolderId();
      if (cached) return { folderId: cached, token: options.token || '' };
      if (folderInflight) return folderInflight;
    }

    const run = (async () => {
      const q = `mimeType='${FOLDER_MIME}' and name='${FOLDER_NAME}' and trashed=false`;
      const listUrl = `${FILES_API}?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1&spaces=drive`;
      const { resp: listResp, token } = await fetchWithAuth(listUrl, { method: 'GET' }, options);
      if (!listResp.ok) {
        throw await makeDriveError('查询 Google Drive 目录失败', listResp);
      }
      const listData = await listResp.json();
      const existing = listData && Array.isArray(listData.files) && listData.files[0];
      if (existing && existing.id) {
        await setCachedFolderId(existing.id);
        return { folderId: existing.id, token };
      }

      const { resp: createResp, token: token2 } = await fetchWithAuth(
        `${FILES_API}?fields=id,name`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
          body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
        },
        Object.assign({}, options, { token })
      );
      if (!createResp.ok) {
        throw await makeDriveError('创建 Google Drive 归档目录失败', createResp);
      }
      const created = await createResp.json();
      if (!created || !created.id) {
        throw new Error('创建 Google Drive 归档目录未返回有效 ID');
      }
      await setCachedFolderId(created.id);
      return { folderId: created.id, token: token2 };
    })();

    if (!options.forceRefresh) {
      folderInflight = run;
      try {
        return await run;
      } finally {
        if (folderInflight === run) folderInflight = null;
      }
    }
    return run;
  }

  /**
   * Google Docs 导入对单次 Multipart 体积敏感，且导入器不会主动按 CSS max-width:100% 缩小宽图：
   * 1) 在支持 Image + Canvas 的浏览器环境下，将宽度 > 1280px 的内联大图等比缩放到 1280px（JPEG 0.85）；
   * 2) 同时按 Google Docs 版心宽度（600px）计算并写入显式 width / height 属性与内联宽高，确保不超出页边距。
   */
  async function downscaleImagesForGDoc(rawHtml, maxWidth) {
    const html = String(rawHtml || '');
    const limitWidth = Number(maxWidth) > 0 ? Number(maxWidth) : 1280;
    const dataUris = [...new Set([...html.matchAll(/src="(data:image\/[^"]+)"/g)].map((m) => m[1]))];
    if (
      !dataUris.length ||
      typeof Image !== 'function' ||
      typeof document === 'undefined' ||
      typeof document.createElement !== 'function'
    ) {
      return html;
    }

    const replaced = {};
    const dims = {};
    const it = dataUris[Symbol.iterator]();
    const workers = Array.from({ length: Math.min(4, dataUris.length) }, async () => {
      for (;;) {
        const n = it.next();
        if (n.done) return;
        const uri = n.value;
        try {
          const img = new Image();
          img.src = uri;
          if (typeof img.decode === 'function') {
            let to;
            await Promise.race([
              Promise.resolve(img.decode()).catch(() => null),
              new Promise((res) => {
                to = setTimeout(() => res(null), 5000);
              }),
            ]).finally(() => clearTimeout(to));
          }
          if (!img.naturalWidth || !img.naturalHeight) continue;
          const displayW = Math.min(img.naturalWidth, GDOC_CONTENT_WIDTH);
          const displayH = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * displayW));
          dims[uri] = { width: displayW, height: displayH };

          if (img.naturalWidth <= limitWidth) continue;
          const w = limitWidth;
          const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const ctx2d = c.getContext && c.getContext('2d');
          if (!ctx2d) continue;
          ctx2d.drawImage(img, 0, 0, w, h);
          const outUri = c.toDataURL('image/jpeg', 0.85);
          if (outUri && outUri.startsWith('data:image/')) replaced[uri] = outUri;
        } catch (_) {}
      }
    });
    await Promise.all(workers);

    if (!Object.keys(replaced).length && !Object.keys(dims).length) return html;
    return html.replace(/<img\b([^>]*)>/gi, (tag, attrs) => {
      const m = attrs.match(/\bsrc="(data:image\/[^"]+)"/i);
      if (!m) return tag;
      const origSrc = m[1];
      let nextAttrs = replaced[origSrc] ? attrs.replace(m[0], 'src="' + replaced[origSrc] + '"') : attrs;
      const d = dims[origSrc];
      if (d) {
        nextAttrs = nextAttrs
          .replace(/\s+(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*'|\d+)/gi, '')
          .replace(/\s+style\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
        nextAttrs += ` width="${d.width}" height="${d.height}" style="width:${d.width}px;height:${d.height}px;max-width:100%"`;
      }
      return '<img' + nextAttrs + '>';
    });
  }

  function fitGDocImgTag(imgTag) {
    if (/height\s*:\s*1\.2em/i.test(imgTag)) return imgTag;
    if (/\bwidth\s*=\s*["']?\d+/i.test(imgTag)) return imgTag;
    if (/\bstyle\s*=/i.test(imgTag)) {
      return imgTag.replace(
        /<img\b/i,
        `<img width="${GDOC_CONTENT_WIDTH}"`
      );
    }
    return imgTag.replace(
      /<img\b/i,
      `<img width="${GDOC_CONTENT_WIDTH}" style="width:${GDOC_CONTENT_WIDTH}px;max-width:100%;height:auto"`
    );
  }

  /**
   * 将导出 HTML 净化并适配为适合 Google Docs 导入转换的 HTML：
   * - 移除 @media print、链接 ::after 伪元素及 CSS Grid；
   * - 确保存在 <meta charset="utf-8"> 与 <style>（即使输入 HTML 无 <head> 或仅为片段）；
   * - 将多图 <figure> 拆分为独立居中的段落图片，保证在 Google Docs 中纵向清晰排列并适配文档版心宽度；
   * - 为 meta、引用块、代码块、推文串分隔线补齐内联样式。
   */
  function buildGDocHtml(rawHtml) {
    let html = String(rawHtml || '');
    if (!html.trim()) return '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>';

    const styleTag = '<style>' + GDOC_STYLE + '</style>';
    const metaTag = '<meta charset="utf-8">';

    // 替换原有含 @media print / CSS 变量的样式表为 Google Docs 兼容样式，并确保 <meta charset="utf-8">
    if (/<style[\s\S]*?<\/style>/i.test(html)) {
      html = html.replace(/<style[\s\S]*?<\/style>/i, styleTag);
      if (!/<meta[^>]+charset=/i.test(html)) {
        html = html.replace(/<style>/i, metaTag + '<style>');
      }
    } else if (/<\/head>/i.test(html)) {
      const prefix = /<meta[^>]+charset=/i.test(html) ? '' : metaTag;
      html = html.replace(/<\/head>/i, prefix + styleTag + '</head>');
    } else if (/<html\b[^>]*>/i.test(html)) {
      html = html.replace(/<html\b[^>]*>/i, (m) => m + '<head>' + metaTag + styleTag + '</head>');
    } else {
      html = '<!doctype html><html><head>' + metaTag + styleTag + '</head><body>' + html + '</body></html>';
    }

    // 展开 <figure>...</figure> 中的多张图片为独立段落，保留可能的视频封面或 figcaption 说明
    html = html.replace(/<figure[^>]*>([\s\S]*?)<\/figure>/gi, (_, inner) => {
      const imgs = [...inner.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
      const captions = [
        ...[...inner.matchAll(/<div\s+class="tw-meta"[^>]*>([\s\S]*?)<\/div>/gi)].map((m) => m[1]),
        ...[...inner.matchAll(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi)].map((m) => m[1]),
      ];
      const out = imgs.map((imgTag) => {
        return '<p style="margin:10pt 0;text-align:center">' + fitGDocImgTag(imgTag) + '</p>';
      });
      captions.forEach((cap) => {
        out.push('<p style="color:#536471;font-size:9.5pt;text-align:center;margin:2pt 0 10pt">' + cap + '</p>');
      });
      return out.length ? out.join('\n') : inner;
    });

    // 确保散落在 <figure> 之外的正文图片同样受文档宽度约束
    html = html.replace(/<img\b[^>]*>/gi, (imgTag) => fitGDocImgTag(imgTag));

    // 为元信息、引用、代码块补上内联样式，确保 Google Docs 导入器保留视觉层次
    html = html
      .replace(
        /<div class="meta">/g,
        '<div class="meta" style="color:#536471;font-size:10pt;margin-bottom:16pt;padding-bottom:10pt;border-bottom:1pt solid #e1e8ed">'
      )
      .replace(
        /<div class="tw-meta">/g,
        '<div class="tw-meta" style="color:#536471;font-size:9.5pt;margin-bottom:4pt">'
      )
      .replace(
        /<section class="tw">/g,
        '<section class="tw" style="margin:0 0 14pt;padding-bottom:10pt;border-bottom:1pt solid #e1e8ed">'
      )
      .replace(
        /<blockquote>/g,
        '<blockquote style="margin:12pt 0;padding:8pt 12pt;border-left:3pt solid #1d9bf0;background-color:#f7f9fa">'
      )
      .replace(
        /<pre>/g,
        '<pre style="background-color:#f7f9fa;border:1pt solid #e1e8ed;padding:10pt 12pt;font-family:Consolas,Menlo,monospace;font-size:9.5pt;white-space:pre-wrap">'
      );

    return html;
  }

  /**
   * 构造符合 Google Drive v3 uploadType=multipart 规范的二进制请求体。
   */
  function buildMultipartPayload(params) {
    const boundary =
      (params && params.boundary) ||
      'xae_mp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    const metadata = (params && params.metadata) || {};
    const mediaContentType = (params && params.mediaContentType) || 'application/octet-stream';
    const rawBody = params && params.mediaBody;

    const enc = new TextEncoder();
    const preamble = enc.encode(
      `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: ${mediaContentType}\r\n\r\n`
    );
    const bodyBytes =
      rawBody instanceof Uint8Array
        ? rawBody
        : rawBody instanceof ArrayBuffer
        ? new Uint8Array(rawBody)
        : enc.encode(String(rawBody == null ? '' : rawBody));
    const epilogue = enc.encode(`\r\n--${boundary}--`);

    const merged = new Uint8Array(preamble.length + bodyBytes.length + epilogue.length);
    merged.set(preamble, 0);
    merged.set(bodyBytes, preamble.length);
    merged.set(epilogue, preamble.length + bodyBytes.length);

    return {
      boundary,
      contentType: `multipart/related; boundary=${boundary}`,
      body: merged,
    };
  }

  function defaultWebViewLink(id, mimeType) {
    if (!id) return '';
    if (mimeType === GDOC_MIME) {
      return `https://docs.google.com/document/d/${encodeURIComponent(id)}/edit`;
    }
    return `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
  }

  /**
   * 通用 Multipart 上传：自动挂载归档目录，若目录在云端被用户手动删除（404）则自动重建并重试一次。
   */
  async function uploadMultipart(opts) {
    const options = opts || {};
    const baseMeta = Object.assign({}, options.metadata || {});
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const handleInteractiveStart = () => {
      if (onProgress) onProgress(AUTH_WAIT_PROMPT);
      if (typeof options.onInteractiveStart === 'function') {
        try {
          options.onInteractiveStart();
        } catch (_) {}
      }
    };

    if (onProgress) onProgress('正在准备 Google Drive 归档目录…');
    let { folderId, token } = await ensureFolder({
      interactive: options.interactive !== false,
      onInteractiveStart: handleInteractiveStart,
      token: options.token,
      fetchImpl: options.fetchImpl,
    });

    const attemptUpload = async (parentId, tk) => {
      const metadata = Object.assign({}, baseMeta, {
        parents: parentId ? [parentId] : undefined,
      });
      const mp = buildMultipartPayload({
        metadata,
        mediaContentType: options.mediaContentType,
        mediaBody: options.mediaBody,
      });
      return fetchWithAuth(
        UPLOAD_API,
        {
          method: 'POST',
          headers: { 'Content-Type': mp.contentType },
          body: mp.body,
        },
        {
          interactive: options.interactive !== false,
          onInteractiveStart: handleInteractiveStart,
          token: tk,
          fetchImpl: options.fetchImpl,
        }
      );
    };

    if (onProgress) {
      onProgress(
        baseMeta.mimeType === GDOC_MIME
          ? '正在上传并转换为 Google Docs…'
          : '正在上传 PDF 到 Google Drive…'
      );
    }

    let { resp, token: activeToken } = await attemptUpload(folderId, token);
    if (resp && resp.status === 404) {
      // 用户可能手动删除了云端的 "X Article Exporter" 文件夹，清缓存重建并透明重试一次
      await setCachedFolderId('');
      const rebuilt = await ensureFolder({
        forceRefresh: true,
        interactive: options.interactive !== false,
        onInteractiveStart: handleInteractiveStart,
        token: activeToken,
        fetchImpl: options.fetchImpl,
      });
      folderId = rebuilt.folderId;
      activeToken = rebuilt.token;
      const retry = await attemptUpload(folderId, activeToken);
      resp = retry.resp;
    }

    if (!resp.ok) {
      throw await makeDriveError('Google Drive 上传失败', resp);
    }

    const data = await resp.json();
    if (!data || !data.id) {
      throw new Error('Google Drive 未返回有效文件 ID');
    }
    const finalMime = data.mimeType || baseMeta.mimeType || '';
    return {
      id: data.id,
      name: data.name || baseMeta.name || '',
      mimeType: finalMime,
      webViewLink: data.webViewLink || defaultWebViewLink(data.id, finalMime),
    };
  }

  /**
   * 将文章 HTML 上传并自动转换为可在线编辑的 Google Docs 文档。
   * 默认自动对内联大图（> 1280px）执行等比缩放，同时服务于 viewer.js 与 options.js 存档页。
   */
  async function uploadAsGoogleDoc(opts) {
    const options = opts || {};
    const rawHtml = String(options.html || '');
    if (!rawHtml.trim()) {
      throw new Error('没有可上传的文档内容');
    }
    const cleanTitle = String(options.title || (options.meta && options.meta.title) || 'X Article')
      .replace(/\.html?$/i, '')
      .trim() || 'X Article';
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    let sizedHtml = rawHtml;
    if (options.downscaleImages !== false && /src="data:image\//.test(rawHtml)) {
      if (onProgress) onProgress('正在优化文档配图…');
      sizedHtml = await downscaleImagesForGDoc(rawHtml, options.maxImageWidth || 1280);
    }
    const gdocHtml = buildGDocHtml(sizedHtml, options.meta);

    return uploadMultipart({
      metadata: {
        name: cleanTitle,
        mimeType: GDOC_MIME,
      },
      mediaContentType: HTML_MIME + '; charset=UTF-8',
      mediaBody: gdocHtml,
      interactive: options.interactive !== false,
      onInteractiveStart: options.onInteractiveStart,
      onProgress: options.onProgress,
      token: options.token,
      fetchImpl: options.fetchImpl,
    });
  }

  async function toPdfBytes(options) {
    if (options.pdfBytes instanceof Uint8Array) return options.pdfBytes;
    if (options.pdfBytes instanceof ArrayBuffer) return new Uint8Array(options.pdfBytes);
    if (options.pdfBlob && typeof options.pdfBlob.arrayBuffer === 'function') {
      const ab = await options.pdfBlob.arrayBuffer();
      return new Uint8Array(ab);
    }
    if (typeof options.pdfBase64 === 'string' && options.pdfBase64.length) {
      if (typeof atob === 'function') {
        return Uint8Array.from(atob(options.pdfBase64), (c) => c.charCodeAt(0));
      }
      if (typeof Buffer !== 'undefined') {
        return new Uint8Array(Buffer.from(options.pdfBase64, 'base64'));
      }
    }
    throw new Error('缺少有效的 PDF 数据');
  }

  /**
   * 将生成的矢量 PDF 直接上传至 Google Drive 归档目录。
   */
  async function uploadPdfBlob(opts) {
    const options = opts || {};
    const bytes = await toPdfBytes(options);
    if (!bytes.length) throw new Error('PDF 内容为空');
    const rawTitle = String(options.title || 'x-export').trim() || 'x-export';
    const pdfName = /\.pdf$/i.test(rawTitle) ? rawTitle : rawTitle + '.pdf';

    return uploadMultipart({
      metadata: {
        name: pdfName,
        mimeType: PDF_MIME,
      },
      mediaContentType: PDF_MIME,
      mediaBody: bytes,
      interactive: options.interactive !== false,
      onInteractiveStart: options.onInteractiveStart,
      onProgress: options.onProgress,
      token: options.token,
      fetchImpl: options.fetchImpl,
    });
  }

  const api = {
    DRIVE_SCOPE,
    FOLDER_MIME,
    GDOC_MIME,
    PDF_MIME,
    FOLDER_NAME,
    FOLDER_CACHE_KEY,
    GDOC_CONTENT_WIDTH,
    AUTH_WAIT_PROMPT,
    isAuthCancelError,
    ensureToken,
    removeCachedToken,
    fetchWithAuth,
    ensureFolder,
    downscaleImagesForGDoc,
    buildGDocHtml,
    buildMultipartPayload,
    uploadMultipart,
    uploadAsGoogleDoc,
    uploadPdfBlob,
  };

  root.XAEGDrive = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
