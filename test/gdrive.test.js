const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const GDrive = require('../gdrive.js');

function makeChromeEnv({
  silentToken = '',
  interactiveToken = 'tok_interactive_123',
  interactiveError = null,
  clientId = '1234567890-realclient.apps.googleusercontent.com',
  storageData = {},
} = {}) {
  const calls = {
    getAuthToken: [],
    removeCachedAuthToken: [],
  };
  const chrome = {
    runtime: {
      lastError: null,
      getManifest: () => ({
        version: '2.8.0',
        oauth2: {
          client_id: clientId,
          scopes: ['https://www.googleapis.com/auth/drive.file'],
        },
      }),
      getURL: (p) => 'chrome-extension://test-id/' + p,
    },
    storage: {
      local: {
        async get(key) {
          if (typeof key === 'string') return { [key]: storageData[key] };
          return Object.assign({}, key, storageData);
        },
        async set(values) {
          Object.assign(storageData, values);
        },
        async remove(key) {
          delete storageData[key];
        },
      },
      session: {
        async get(key) {
          return { [key]: storageData['session:' + key] };
        },
        async set(values) {
          for (const [k, v] of Object.entries(values)) storageData['session:' + k] = v;
        },
        async remove(key) {
          delete storageData['session:' + key];
        },
      },
    },
    identity: {
      getAuthToken(details, cb) {
        calls.getAuthToken.push(Boolean(details && details.interactive));
        if (!details || !details.interactive) {
          if (silentToken) {
            cb && cb(silentToken);
            return Promise.resolve(silentToken);
          }
          const err = new Error('OAuth2 not granted or revoked.');
          if (cb) {
            chrome.runtime.lastError = err;
            cb(undefined);
            chrome.runtime.lastError = null;
          }
          return Promise.reject(err);
        }
        if (interactiveError) {
          const err =
            interactiveError instanceof Error ? interactiveError : new Error(String(interactiveError));
          if (cb) {
            chrome.runtime.lastError = err;
            cb(undefined);
            chrome.runtime.lastError = null;
          }
          return Promise.reject(err);
        }
        cb && cb(interactiveToken);
        return Promise.resolve(interactiveToken);
      },
      removeCachedAuthToken(details, cb) {
        calls.removeCachedAuthToken.push(details && details.token);
        cb && cb();
        return Promise.resolve();
      },
    },
  };
  return { chrome, calls, storageData };
}

test('ensureToken uses cached token silently when available and does not open interactive prompt', async () => {
  const { chrome, calls } = makeChromeEnv({ silentToken: 'cached_tok_abc' });
  global.chrome = chrome;
  let interactiveStarted = false;
  const res = await GDrive.ensureToken({
    interactive: true,
    onInteractiveStart: () => {
      interactiveStarted = true;
    },
  });
  assert.equal(res.token, 'cached_tok_abc');
  assert.equal(res.interactiveUsed, false);
  assert.equal(interactiveStarted, false);
  assert.deepEqual(calls.getAuthToken, [false]);
});

test('ensureToken falls back to interactive prompt on demand when silent check misses', async () => {
  const { chrome, calls } = makeChromeEnv({
    silentToken: '',
    interactiveToken: 'fresh_interactive_tok',
  });
  global.chrome = chrome;
  let interactiveStarted = false;
  const res = await GDrive.ensureToken({
    interactive: true,
    onInteractiveStart: () => {
      interactiveStarted = true;
    },
  });
  assert.equal(res.token, 'fresh_interactive_tok');
  assert.equal(res.interactiveUsed, true);
  assert.equal(interactiveStarted, true);
  assert.deepEqual(calls.getAuthToken, [false, true]);
});

test('ensureToken classifies user cancellation accurately so caller avoids local HTML fallback', async () => {
  const { chrome } = makeChromeEnv({
    silentToken: '',
    interactiveError: new Error('The user did not approve access.'),
  });
  global.chrome = chrome;
  await assert.rejects(
    () => GDrive.ensureToken({ interactive: true }),
    (err) => {
      assert.equal(GDrive.isAuthCancelError(err), true);
      assert.equal(err.cancelled, true);
      assert.equal(err.code, 'AUTH_CANCELLED');
      return true;
    }
  );
});

test('fetchWithAuth automatically clears expired 401 token and retries with refreshed token', async () => {
  let step = 0;
  const { chrome, calls } = makeChromeEnv({
    silentToken: 'expired_tok',
    interactiveToken: 'renewed_tok',
  });
  // First silent call returns expired_tok; after removeCachedAuthToken, silent fails so interactive returns renewed_tok
  chrome.identity.getAuthToken = (details, cb) => {
    calls.getAuthToken.push(Boolean(details && details.interactive));
    if (!details.interactive) {
      if (step === 0) {
        step++;
        cb && cb('expired_tok');
        return Promise.resolve('expired_tok');
      }
      const e = new Error('no cached token');
      if (cb) {
        chrome.runtime.lastError = e;
        cb(undefined);
        chrome.runtime.lastError = null;
      }
      return Promise.reject(e);
    }
    cb && cb('renewed_tok');
    return Promise.resolve('renewed_tok');
  };
  global.chrome = chrome;

  const seenAuthHeaders = [];
  const fetchImpl = async (_url, init) => {
    seenAuthHeaders.push(init.headers.Authorization);
    if (seenAuthHeaders.length === 1) {
      return { status: 401, ok: false, json: async () => ({ error: { message: 'Invalid Credentials' } }) };
    }
    return { status: 200, ok: true, json: async () => ({ ok: true }) };
  };

  const { resp, token } = await GDrive.fetchWithAuth('https://www.googleapis.com/drive/v3/files', {}, { fetchImpl });
  assert.equal(resp.status, 200);
  assert.equal(token, 'renewed_tok');
  assert.deepEqual(calls.removeCachedAuthToken, ['expired_tok']);
  assert.deepEqual(seenAuthHeaders, ['Bearer expired_tok', 'Bearer renewed_tok']);
});

test('buildGDocHtml strips @media print pseudo-links and unwraps multi-image figures for Google Docs', () => {
  const sampleHtml = [
    '<!doctype html><html lang="zh"><head><meta charset="utf-8">',
    '<style>@media print{a[href^="http"]::after{content:" (" attr(href) ")"}} figure:has(img+img){display:grid}</style>',
    '</head><body><div class="wrap">',
    '<h1>深度长文标题</h1>',
    '<div class="meta">来源：<a href="https://x.com/u/status/1">https://x.com/u/status/1</a></div>',
    '<p>第一段正文 <strong>加粗</strong></p>',
    '<figure><img src="data:image/jpeg;base64,AAA"><img src="data:image/jpeg;base64,BBB"><div class="tw-meta">（视频封面）</div></figure>',
    '<blockquote>引用内容</blockquote>',
    '<pre><code>const x = 1;</code></pre>',
    '</div></body></html>',
  ].join('');

  const out = GDrive.buildGDocHtml(sampleHtml);
  assert.equal(out.includes('@media print'), false);
  assert.equal(out.includes('display:grid'), false);
  assert.equal(out.includes('<figure>'), false);
  assert.equal((out.match(/<img\b/g) || []).length, 2);
  assert.equal(out.includes('（视频封面）'), true);
  assert.equal(out.includes('border-left:3pt solid #1d9bf0'), true);
});

test('uploadAsGoogleDoc and uploadPdfBlob create folder idempotently, recover from 404 deleted folder, and upload multipart', async () => {
  const { chrome, storageData } = makeChromeEnv({ silentToken: 'valid_token' });
  global.chrome = chrome;

  const requests = [];
  let failFirstUploadWith404 = false;

  const fetchImpl = async (url, init) => {
    requests.push({ url, method: init.method || 'GET', headers: init.headers, body: init.body });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files?q=')) {
      return {
        status: 200,
        ok: true,
        json: async () => ({ files: [] }),
      };
    }
    if (url === 'https://www.googleapis.com/drive/v3/files?fields=id,name' && init.method === 'POST') {
      const folderId = 'folder_' + requests.length;
      return {
        status: 200,
        ok: true,
        json: async () => ({ id: folderId, name: 'X Article Exporter' }),
      };
    }
    if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files')) {
      if (failFirstUploadWith404) {
        failFirstUploadWith404 = false;
        return {
          status: 404,
          ok: false,
          json: async () => ({ error: { message: 'File not found: old_folder' } }),
        };
      }
      const text = new TextDecoder().decode(init.body);
      const isDoc = text.includes('application/vnd.google-apps.document');
      return {
        status: 200,
        ok: true,
        json: async () => ({
          id: isDoc ? 'gdoc_id_001' : 'pdf_id_002',
          name: isDoc ? '测试长文' : '测试长文.pdf',
          mimeType: isDoc ? GDrive.GDOC_MIME : GDrive.PDF_MIME,
        }),
      };
    }
    throw new Error('Unexpected URL: ' + url);
  };

  // 1) 首次上传 Google Doc：自动查目录 -> 创建目录 -> 缓存目录 ID -> Multipart 上传
  const docRes = await GDrive.uploadAsGoogleDoc({
    title: '测试长文.html',
    html: '<html><body><h1>Hello</h1><p>World</p></body></html>',
    fetchImpl,
  });
  assert.equal(docRes.id, 'gdoc_id_001');
  assert.equal(docRes.name, '测试长文');
  assert.equal(docRes.webViewLink, 'https://docs.google.com/document/d/gdoc_id_001/edit');
  assert.ok(storageData.gdriveFolderId, 'folder id should be cached in chrome.storage.local');

  // 2) 模拟用户手动删了云端文件夹，上传 PDF 遇到 404 后自动重建目录并重试成功
  storageData.gdriveFolderId = 'deleted_folder_id';
  failFirstUploadWith404 = true;
  const pdfRes = await GDrive.uploadPdfBlob({
    title: '测试长文',
    pdfBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]), // %PDF
    fetchImpl,
  });
  assert.equal(pdfRes.id, 'pdf_id_002');
  assert.equal(pdfRes.name, '测试长文.pdf');
  assert.equal(pdfRes.webViewLink, 'https://drive.google.com/file/d/pdf_id_002/view');
  assert.notEqual(storageData.gdriveFolderId, 'deleted_folder_id');
});

test('background.js only requests Google auth on gdoc/gdrive export and never on startup or local pdf/md/html export', async () => {
  const { chrome, calls } = makeChromeEnv({
    silentToken: '',
    interactiveError: new Error('The user did not approve access.'),
  });
  let onMessageHandler = null;
  const createdTabs = [];
  chrome.runtime.onInstalled = { addListener() {} };
  chrome.runtime.setUninstallURL = async () => {};
  chrome.runtime.onMessage = {
    addListener(fn) {
      onMessageHandler = fn;
    },
  };
  chrome.downloads = { onChanged: { addListener() {} } };
  chrome.tabs = {
    create(opts, cb) {
      const tab = { id: 99, url: opts.url };
      createdTabs.push(tab);
      cb && cb(tab);
      return Promise.resolve(tab);
    },
    sendMessage: async () => ({}),
  };

  const ctx = vm.createContext({
    chrome,
    console,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    ArrayBuffer,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
  });
  ctx.self = ctx;
  ctx.importScripts = (...files) => {
    for (const f of files) {
      if (f === 'site.js' || f === 'gdrive.js') {
        vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx);
      }
    }
  };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8'), ctx);

  // 1) 启动阶段零授权调用
  assert.equal(calls.getAuthToken.length, 0);

  // 2) 本地 PDF 导出：零授权调用，直接打开 viewer.html
  await new Promise((resolve) => {
    onMessageHandler(
      { cmd: 'export', format: 'pdf', doc: '<html></html>', title: 'local' },
      { tab: { id: 1 } },
      () => resolve()
    );
    setTimeout(resolve, 30);
  });
  assert.equal(calls.getAuthToken.length, 0);
  assert.equal(createdTabs.length, 1);

  // 3) 点击 gdoc 云端导出但用户取消授权：触发按需授权，取消后立即返回 cancelled: true 且不打开 viewer.html
  const gdocReply = await new Promise((resolve) => {
    onMessageHandler(
      { cmd: 'export', format: 'gdoc', doc: '<html></html>', title: 'cloud' },
      { tab: { id: 1 } },
      (resp) => resolve(resp)
    );
  });
  assert.deepEqual(calls.getAuthToken, [false, true]);
  assert.equal(gdocReply.ok, false);
  assert.equal(gdocReply.cancelled, true);
  assert.equal(gdocReply.format, 'gdoc');
  assert.equal(createdTabs.length, 1, 'viewer.html must not open when user cancels Google authorization');
});

test('edge cases: empty inputs, placeholder client_id diagnostics, and binary PDF base64 conversion', async () => {
  const { chrome } = makeChromeEnv({
    silentToken: '',
    interactiveError: new Error('OAuth2 not granted or revoked.'),
    clientId: 'YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com',
  });
  global.chrome = chrome;

  await assert.rejects(
    () => GDrive.ensureToken({ interactive: true }),
    /尚未配置有效的 Google OAuth Client ID/
  );

  await assert.rejects(
    () => GDrive.uploadAsGoogleDoc({ title: 'empty', html: '   ' }),
    /没有可上传的文档内容/
  );

  await assert.rejects(
    () => GDrive.uploadPdfBlob({ title: 'empty', pdfBytes: new Uint8Array(0) }),
    /PDF 内容为空/
  );

  await assert.rejects(
    () => GDrive.uploadPdfBlob({ title: 'missing' }),
    /缺少有效的 PDF 数据/
  );

  // buildGDocHtml on head-less HTML or fragments still injects <meta charset="utf-8"> and <style>
  const headlessOut = GDrive.buildGDocHtml('<html><body><h1>中文标题</h1><figure><img src="a.jpg"><figcaption>图注</figcaption></figure></body></html>');
  assert.equal(headlessOut.includes('<meta charset="utf-8">'), true);
  assert.equal(headlessOut.includes('<style>'), true);
  assert.equal(headlessOut.includes('图注'), true);
  const fragOut = GDrive.buildGDocHtml('<div><p>纯片段</p></div>');
  assert.equal(fragOut.includes('<meta charset="utf-8">'), true);
  assert.equal(fragOut.includes('<style>'), true);
});

test('uploadAsGoogleDoc automatically downscales >1280px data URI images via Canvas for both viewer and options', async () => {
  const { chrome } = makeChromeEnv({ silentToken: 'valid_token', storageData: { gdriveFolderId: 'folder_1' } });
  global.chrome = chrome;

  const prevImage = global.Image;
  const prevDoc = global.document;
  const drawnSizes = [];

  global.Image = class MockImage {
    set src(v) {
      this._src = v;
      if (v.includes('LARGE')) {
        this.naturalWidth = 2560;
        this.naturalHeight = 1440;
      } else {
        this.naturalWidth = 800;
        this.naturalHeight = 600;
      }
    }
    decode() {
      return Promise.resolve();
    }
  };
  global.document = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            drawImage(_img, _x, _y, w, h) {
              drawnSizes.push({ w, h });
            },
          };
        },
        toDataURL(mime, quality) {
          return `data:${mime};q=${quality};base64,DOWNSCALED_1280`;
        },
      };
    },
  };

  try {
    let uploadedPayload = '';
    const fetchImpl = async (_url, init) => {
      uploadedPayload = new TextDecoder().decode(init.body);
      return {
        status: 200,
        ok: true,
        json: async () => ({ id: 'doc_scaled', name: 'Scaled Doc', mimeType: GDrive.GDOC_MIME }),
      };
    };

    const progressMsgs = [];
    await GDrive.uploadAsGoogleDoc({
      title: 'Scaled Doc',
      html: '<html><body><img src="data:image/png;base64,LARGE_IMG"><img src="data:image/jpeg;base64,SMALL_IMG"></body></html>',
      onProgress: (m) => progressMsgs.push(m),
      fetchImpl,
    });

    assert.deepEqual(drawnSizes, [{ w: 1280, h: 720 }]);
    assert.equal(uploadedPayload.includes('DOWNSCALED_1280'), true);
    assert.equal(uploadedPayload.includes('LARGE_IMG'), false);
    assert.equal(uploadedPayload.includes('SMALL_IMG'), true);
    assert.equal(uploadedPayload.includes('width="720" height="405"'), true);
    assert.equal(uploadedPayload.includes('width="720" height="540"'), true);
    assert.equal(progressMsgs.includes('正在优化文档配图…'), true);
  } finally {
    global.Image = prevImage;
    global.document = prevDoc;
  }
});

test('concurrent ensureFolder calls deduplicate in-flight requests and 401 refresh notifies onProgress', async () => {
  let step = 0;
  const { chrome } = makeChromeEnv({ silentToken: 'expired_tok', interactiveToken: 'fresh_tok' });
  chrome.identity.getAuthToken = (details, cb) => {
    if (!details.interactive) {
      if (step === 0) {
        step++;
        cb && cb('expired_tok');
        return Promise.resolve('expired_tok');
      }
      const err = new Error('no cached token');
      if (cb) {
        chrome.runtime.lastError = err;
        cb(undefined);
        chrome.runtime.lastError = null;
      }
      return Promise.reject(err);
    }
    cb && cb('fresh_tok');
    return Promise.resolve('fresh_tok');
  };
  global.chrome = chrome;

  let listCalls = 0;
  let createCalls = 0;
  const fetchImpl = async (url, init) => {
    if (init.headers.Authorization === 'Bearer expired_tok') {
      return { status: 401, ok: false, json: async () => ({ error: { message: 'Expired' } }) };
    }
    if (url.startsWith('https://www.googleapis.com/drive/v3/files?q=')) {
      listCalls++;
      await new Promise((r) => setTimeout(r, 15));
      return { status: 200, ok: true, json: async () => ({ files: [] }) };
    }
    if (url === 'https://www.googleapis.com/drive/v3/files?fields=id,name' && init.method === 'POST') {
      createCalls++;
      return { status: 200, ok: true, json: async () => ({ id: 'dedup_folder_id', name: 'X Article Exporter' }) };
    }
    if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files')) {
      return { status: 200, ok: true, json: async () => ({ id: 'doc_1', name: 'Doc', mimeType: GDrive.GDOC_MIME }) };
    }
    throw new Error('Unexpected URL: ' + url);
  };

  const progress = [];
  const [r1, r2] = await Promise.all([
    GDrive.uploadAsGoogleDoc({
      title: 'A',
      html: '<p>A</p>',
      onProgress: (m) => progress.push(m),
      fetchImpl,
    }),
    GDrive.uploadAsGoogleDoc({
      title: 'B',
      html: '<p>B</p>',
      fetchImpl,
    }),
  ]);

  assert.equal(r1.id, 'doc_1');
  assert.equal(r2.id, 'doc_1');
  assert.equal(listCalls, 1, 'concurrent uploads should only list Drive folders once');
  assert.equal(createCalls, 1, 'concurrent uploads should only create Drive folder once');
  assert.equal(progress.includes(GDrive.AUTH_WAIT_PROMPT), true);
});

test('buildGDocHtml uses narrow margins (36pt / 540pt) and constrains fallback images to 720px doc width, while 403 disabled Drive API surfaces guideUrl', async () => {
  const docHtml = GDrive.buildGDocHtml('<p><img src="https://pbs.twimg.com/media/abc.jpg"></p>');
  assert.equal(docHtml.includes('@page{margin:36pt 36pt 36pt 36pt}'), true);
  assert.equal(docHtml.includes('max-width:540pt;padding:36pt 36pt 36pt 36pt'), true);
  assert.equal(docHtml.includes('width="720"'), true);
  assert.equal(docHtml.includes('width:720px;max-width:100%'), true);

  const { chrome } = makeChromeEnv({ silentToken: 'tok_ok' });
  global.chrome = chrome;
  const fetchImpl = async () => ({
    status: 403,
    ok: false,
    json: async () => ({
      error: {
        message:
          'Google Drive API has not been used in project 51782706977 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=51782706977 then retry.',
      },
    }),
  });

  await assert.rejects(
    () => GDrive.ensureFolder({ fetchImpl }),
    (err) => {
      assert.equal(err.code, 'DRIVE_API_DISABLED');
      assert.equal(
        err.guideUrl,
        'https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=51782706977'
      );
      assert.match(err.message, /尚未开启 Google Drive API/);
      return true;
    }
  );
});

test('ensureToken falls back to launchWebAuthFlow when getAuthToken fails with browser error and caches web token', async () => {
  const { chrome, storageData } = makeChromeEnv({
    silentToken: '',
    interactiveError: new Error('This API is not supported on this browser'),
  });
  let webAuthCalls = 0;
  chrome.identity.getRedirectURL = () => 'https://hfcjpigmiacfjobbihhnnljamlpongkg.chromiumapp.org/';
  chrome.identity.launchWebAuthFlow = (details, cb) => {
    webAuthCalls++;
    assert.equal(details.interactive, true);
    assert.equal(details.url.includes('response_type=token'), true);
    const redirectUrl =
      'https://hfcjpigmiacfjobbihhnnljamlpongkg.chromiumapp.org/#access_token=web_flow_tok_999&expires_in=3600';
    cb && cb(redirectUrl);
    return Promise.resolve(redirectUrl);
  };
  global.chrome = chrome;

  const first = await GDrive.ensureToken({ interactive: true });
  assert.equal(first.token, 'web_flow_tok_999');
  assert.equal(first.interactiveUsed, true);
  assert.equal(webAuthCalls, 1);
  assert.equal(storageData.gdriveWebAuthToken.token, 'web_flow_tok_999');

  // Second call hits cached web token silently without opening popup again
  const second = await GDrive.ensureToken({ interactive: true });
  assert.equal(second.token, 'web_flow_tok_999');
  assert.equal(second.interactiveUsed, false);
  assert.equal(webAuthCalls, 1);

  // removeCachedToken clears the cached web token as well
  await GDrive.removeCachedToken('web_flow_tok_999');
  assert.equal(storageData.gdriveWebAuthToken, undefined);
});



