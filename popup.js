/*!
 * Toolbar popup controller (multi-language, compact 30px controls, on-demand guide entry).
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const POST_RE = /^https:\/\/(x|twitter)\.com\/(?:[^/]+\/status\/\d+|(?:i\/)?articles\/\d+)/;
  const EDITOR_RE = /^https:\/\/(x|twitter)\.com\/compose\/articles\//;
  const X_RE = /^https:\/\/(x|twitter)\.com\//;

  const I18N = {
    zh: {
      guide: '使用教程',
      checking: '正在检查当前页面…',
      ready: '当前帖子可一键导出',
      needPost: '请在 X 打开具体帖子或长文',
      needOpenX: '在 X 的帖子或长文页使用',
      editorHint: '正在编辑长文 · 点预览左侧 M↓ 导入 MD',
      openX: '打开 X ↗',
      seeImport: '看图示 ›',
      reloadTab: '请刷新本标签页后重试',
      localGroup: '本地与 AI 导出',
      cloudGroup: 'Google 云端同步',
      pdf: '导出为 PDF',
      md: '导出为 Markdown',
      html: '导出为 HTML（自包含）',
      grok: 'Grok Markdown（AI 整理）',
      gdoc: '转存到 Google Docs',
      gdrive: '上传到 Google Drive',
      cloudTip: '首次点击将按需拉起 Google 授权（仅 drive.file 权限），上传后可在顶部提示或导出历史直达打开',
      history: '导出历史 / 存档库',
      emptyArchive: '暂无存档',
      countFmt: (n, sz) => `${n} 篇 · ${sz}`,
      readErr: '读取失败',
    },
    en: {
      guide: 'Guide',
      checking: 'Checking active tab…',
      ready: 'Ready to export this post',
      needPost: 'Open a specific post or X Article',
      needOpenX: 'Use on any X post or Article page',
      editorHint: 'Article editor · click M↓ left of Preview',
      openX: 'Open X ↗',
      seeImport: 'See how ›',
      reloadTab: 'Reload this tab and retry',
      localGroup: 'Local & AI Export',
      cloudGroup: 'Google Cloud Sync',
      pdf: 'Export as PDF',
      md: 'Export as Markdown',
      html: 'Offline HTML (inlined)',
      grok: 'Grok Markdown (AI)',
      gdoc: 'Save to Google Docs',
      gdrive: 'Save PDF to Drive',
      cloudTip: 'Requests Google drive.file access on demand only when clicked. Opens directly from the toast or Export History.',
      history: 'Export History & Archive',
      emptyArchive: 'No archives',
      countFmt: (n, sz) => `${n} · ${sz}`,
      readErr: 'Read error',
    },
    es: {
      guide: 'Guía',
      checking: 'Comprobando pestaña…',
      ready: 'Listo para exportar este post',
      needPost: 'Abre un post o Artículo de X',
      needOpenX: 'Úsalo en cualquier post o Artículo de X',
      editorHint: 'Editor de X · haz clic en M↓ junto a Preview',
      openX: 'Abrir X ↗',
      seeImport: 'Ver guía ›',
      reloadTab: 'Recarga esta pestaña e inténtalo',
      localGroup: 'Exportación local e IA',
      cloudGroup: 'Sincronización Google',
      pdf: 'Exportar a PDF',
      md: 'Exportar a Markdown',
      html: 'HTML autónomo offline',
      grok: 'Grok Markdown (IA)',
      gdoc: 'Guardar en Google Docs',
      gdrive: 'Subir PDF a Drive',
      cloudTip: 'Solicita autorización drive.file bajo demanda solo al hacer clic.',
      history: 'Historial y archivo local',
      emptyArchive: 'Sin archivos',
      countFmt: (n, sz) => `${n} · ${sz}`,
      readErr: 'Error',
    },
    pt: {
      guide: 'Guia',
      checking: 'Verificando aba…',
      ready: 'Pronto para exportar este post',
      needPost: 'Abra um post ou Artigo do X',
      needOpenX: 'Use em qualquer post ou Artigo do X',
      editorHint: 'Editor do X · clique em M↓ ao lado de Preview',
      openX: 'Abrir X ↗',
      seeImport: 'Ver guia ›',
      reloadTab: 'Recarregue esta aba e tente de novo',
      localGroup: 'Exportação local e IA',
      cloudGroup: 'Sincronização Google',
      pdf: 'Exportar PDF',
      md: 'Exportar Markdown',
      html: 'HTML autônomo offline',
      grok: 'Grok Markdown (IA)',
      gdoc: 'Salvar no Google Docs',
      gdrive: 'Salvar PDF no Drive',
      cloudTip: 'Solicita acesso drive.file sob demanda apenas ao clicar.',
      history: 'Histórico e acervo local',
      emptyArchive: 'Sem itens',
      countFmt: (n, sz) => `${n} · ${sz}`,
      readErr: 'Erro',
    },
    ja: {
      guide: 'ガイド',
      checking: 'ページを確認中…',
      ready: 'この投稿をエクスポートできます',
      needPost: 'Xの投稿または記事ページを開いてください',
      needOpenX: 'Xの投稿・長文記事ページで使用できます',
      editorHint: '記事エディタ · Preview左のM↓で変換',
      openX: 'Xを開く ↗',
      seeImport: '手順を見る ›',
      reloadTab: 'タブを再読み込みして再試行してください',
      localGroup: 'ローカル・AI エクスポート',
      cloudGroup: 'Google クラウド連携',
      pdf: 'PDF で保存',
      md: 'Markdown で保存',
      html: 'HTML（オフライン完結）',
      grok: 'Grok Markdown (AI)',
      gdoc: 'Google ドキュメントに保存',
      gdrive: 'Google ドライブ (PDF)',
      cloudTip: 'クリック時のみ drive.file 権限をオンデマンドで要求します。',
      history: 'エクスポート履歴・アーカイブ',
      emptyArchive: '履歴なし',
      countFmt: (n, sz) => `${n}件 · ${sz}`,
      readErr: '読込エラー',
    },
    id: {
      guide: 'Panduan',
      checking: 'Memeriksa tab aktif…',
      ready: 'Siap mengekspor postingan ini',
      needPost: 'Buka postingan atau Artikel X tertentu',
      needOpenX: 'Gunakan di halaman post atau Artikel X',
      editorHint: 'Editor Artikel · klik M↓ di kiri Preview',
      openX: 'Buka X ↗',
      seeImport: 'Lihat cara ›',
      reloadTab: 'Muat ulang tab ini lalu coba lagi',
      localGroup: 'Ekspor Lokal & AI',
      cloudGroup: 'Sinkronisasi Google',
      pdf: 'Ekspor PDF',
      md: 'Ekspor Markdown',
      html: 'HTML Offline mandiri',
      grok: 'Grok Markdown (AI)',
      gdoc: 'Simpan ke Google Docs',
      gdrive: 'Simpan PDF ke Drive',
      cloudTip: 'Meminta izin drive.file sesuai permintaan hanya saat diklik.',
      history: 'Riwayat & Arsip Lokal',
      emptyArchive: 'Kosong',
      countFmt: (n, sz) => `${n} · ${sz}`,
      readErr: 'Gagal',
    },
    ar: {
      guide: 'الدليل',
      checking: 'جارٍ فحص الصفحة…',
      ready: 'جاهز لتصدير هذا المنشور',
      needPost: 'افتح منشورًا أو مقالة X محددة',
      needOpenX: 'يُستخدم في صفحة منشور أو مقالة X',
      editorHint: 'محرر المقالات · انقر M↓ يسار Preview',
      openX: 'فتح X ↗',
      seeImport: 'عرض الشرح ›',
      reloadTab: 'أعد تحميل هذه الصفحة وحاول مجددًا',
      localGroup: 'تصدير محلي والذكاء الاصطناعي',
      cloudGroup: 'مزامنة Google السحابية',
      pdf: 'تصدير PDF',
      md: 'تصدير Markdown',
      html: 'HTML مستقل بدون اتصال',
      grok: 'Grok Markdown (AI)',
      gdoc: 'حفظ في Google Docs',
      gdrive: 'حفظ PDF في Drive',
      cloudTip: 'يطلب إذن drive.file عند النقر فقط.',
      history: 'السجل والأرشيف المحلي',
      emptyArchive: 'فارغ',
      countFmt: (n, sz) => `${n} · ${sz}`,
      readErr: 'خطأ',
    },
  };

  function pickLang() {
    const raw = (
      (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) ||
      navigator.language ||
      'en'
    ).toLowerCase();
    const base = raw.split(/[-_]/)[0];
    return I18N[base] ? base : 'en';
  }

  const lang = pickLang();
  const T = I18N[lang];
  document.documentElement.lang = lang;
  if (lang === 'ar') document.documentElement.dir = 'rtl';

  const fmtBytes = (n) => {
    if (!n) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    return (n / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + u[i];
  };

  const openGuide = (hash) => {
    const base = chrome.runtime.getURL('guide.html');
    const qs = `?hl=${encodeURIComponent(lang)}`;
    chrome.tabs.create({ url: base + qs + (hash || '') });
    window.close();
  };

  // Apply localized labels upfront
  $('guideLabel').textContent = T.guide;
  $('state').textContent = T.checking;
  $('lblLocal').textContent = T.localGroup;
  $('lblCloud').textContent = T.cloudGroup;
  $('lblPdf').textContent = T.pdf;
  $('lblMd').textContent = T.md;
  $('lblHtml').textContent = T.html;
  $('lblGrok').textContent = T.grok;
  $('lblGdoc').textContent = T.gdoc;
  $('lblGdrive').textContent = T.gdrive;
  $('gdoc').title = T.cloudTip;
  $('gdrive').title = T.cloudTip;
  $('lblHistory').textContent = T.history;

  $('guide').addEventListener('click', () => openGuide(''));

  $('history').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  (async function init() {
    try {
      const u = await XAEArchive.usage();
      $('usageMeta').textContent = u.count ? T.countFmt(u.count, fmtBytes(u.bytes)) : T.emptyArchive;
    } catch (_) {
      $('usageMeta').textContent = T.readErr;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = (tab && tab.url) || '';
    const bar = $('statusBar');
    const state = $('state');
    const actionBtn = $('stateAction');

    if (EDITOR_RE.test(url)) {
      bar.className = 'status-bar editor';
      state.textContent = T.editorHint;
      actionBtn.textContent = T.seeImport;
      actionBtn.hidden = false;
      actionBtn.addEventListener('click', () => openGuide('#md-import'));
      return;
    }

    if (!POST_RE.test(url)) {
      bar.className = 'status-bar';
      state.textContent = X_RE.test(url) ? T.needPost : T.needOpenX;
      if (!X_RE.test(url)) {
        actionBtn.textContent = T.openX;
        actionBtn.hidden = false;
        actionBtn.addEventListener('click', () => {
          chrome.tabs.create({ url: 'https://x.com/home' });
          window.close();
        });
      }
      return;
    }

    bar.className = 'status-bar ok';
    state.textContent = T.ready;

    [['pdf', 'pdf'], ['md', 'md'], ['html', 'html'], ['grok', 'grok'], ['gdoc', 'gdoc'], ['gdrive', 'gdrive']].forEach(
      ([id, mode]) => {
        const btn = $(id);
        btn.disabled = false;
        btn.addEventListener('click', () => {
          chrome.tabs.sendMessage(tab.id, { cmd: 'runExport', mode }, () => {
            if (chrome.runtime.lastError) {
              bar.className = 'status-bar';
              state.textContent = T.reloadTab;
              return;
            }
            window.close();
          });
        });
      }
    );
  })();
})();
