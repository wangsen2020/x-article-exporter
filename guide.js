/*!
 * Multi-language annotated tutorial controller for X Article Exporter (`guide.html`).
 * Renders left sticky navigation + 7 feature walkthroughs with SVG red-box/arrow diagrams
 * across 7 UI languages: zh, en, es, pt, ja, id, ar (with RTL support for ar).
 */
(function () {
  'use strict';

  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const SECTIONS_META = [
    { id: 'quickstart', num: 1, diagram: 'quickstart' },
    { id: 'pdf-export', num: 2, diagram: 'pdf' },
    { id: 'formats', num: 3, diagram: 'formats' },
    { id: 'google-docs', num: 4, diagram: 'gdoc' },
    { id: 'grok-md', num: 5, diagram: 'grok' },
    { id: 'md-import', num: 6, diagram: 'mdimport' },
    { id: 'archive', num: 7, diagram: 'archive' },
  ];

  const DATA = {
    zh: {
      pageTitle: 'XExport · X Article → PDF · 图文使用教程',
      brandSub: '完整图文操作指南',
      navHeading: '功能目录（7 项）',
      archiveBtn: '打开存档库',
      openXBtn: '去 X 试试 ↗',
      heroTitle: 'XExport (X Article to PDF) 完整功能教程',
      heroLead: '左侧按功能跳转，右侧结合红框、箭头与序号标注快速上手全部 7 项核心能力：PDF 导出、Markdown / 离线 HTML、Google Docs 与 Google Drive 集成、Grok AI 整理成文、长文编辑器 Markdown 导入及本地存档库。',
      sections: [
        {
          nav: '1. 固定插件与刷新页面',
          title: '快速上手：固定工具栏按钮并刷新 X 页面',
          desc: '固定扩展图标后，无论在任何 X 帖子页还是长文页都能从右上角浮窗一键导出或随时打开本教程。',
          steps: [
            '点击 Chrome 右上角的拼图图标，在列表中找到 X Article to PDF，点击右侧图钉固定到工具栏。',
            '点击工具栏上的扩展图标即可打开快捷浮窗；浮窗右上角「使用教程」按钮随时直达本指南。',
            '首次安装或更新后，请先刷新（F5）一次正在浏览的 X 推文串标签页，确保拦截器捕获完整的 Author Self-Thread 数据。',
          ],
          cap: '红框与箭头标出了工具栏固定钉位置、浮窗入口以及安装后必做的页面刷新操作。',
          tip: '提示：如果点击弹窗按钮提示「请刷新这个标签页后重试」，只需在当前 x.com 标签页按 F5 刷新即可。',
          labels: {
            toolbarPin: '1. 点拼图并固定图钉',
            popupGuide: '2. 浮窗右上角直达教程',
            reloadTab: '3. 装好后点一次刷新抓全推文串',
            popupTitle: 'XExport · X → PDF',
            popupBtnGuide: '使用教程',
            popupStatus: '当前帖子可一键导出',
            popupPdf: '导出为 PDF',
            popupGdoc: '转存到 Google Docs',
          },
        },
        {
          nav: '2. 一键导出矢量 PDF',
          title: 'X 长文与推文串一键导出为可搜索 PDF',
          desc: '与浏览器「打印成 PDF」截断或糊成图片不同，本扩展在后台以矢量排版渲染正文和原图，生成文字可选中、可全文搜索的 PDF。',
          steps: [
            '打开一篇 X Article 长文，或作者在评论区接续发布的推文串第一条（x.com/<作者>/status/<id>）。',
            '找到帖子底部操作栏（书签与分享图标右侧）的红色 PDF 图标，直接左键单击。',
            '后台标签页自动加载高清配图、保留标题/引用/代码块，生成矢量 PDF 并自动保存至浏览器下载目录。',
          ],
          cap: '红色 PDF 按钮直接嵌入在每条帖子的底部操作栏中，左键即导出。',
          tip: '导出推文串时只保留作者本人发布的连续推文（Self-Thread），自动过滤他人评论区回复与推荐流。',
          labels: {
            postHeader: 'DAN KOE @thedankoe · 长文示例',
            postLine1: 'How to fix your entire life in 1 day',
            postLine2: '标题、引用块、列表与高清配图均保留矢量可搜索排版…',
            step1: '① 操作栏找到红色 PDF 图标，左键直接导出',
            step2: '② 也可在扩展浮窗点击「导出为 PDF」',
            outFile: 'How_to_fix_your_entire_life.pdf （文字可选中 / 原图分辨率）',
          },
        },
        {
          nav: '3. Markdown 与离线 HTML',
          title: '右键格式菜单：导出 Markdown 与自包含离线 HTML',
          desc: '需要将推文或长文放进 Obsidian、Notion 等笔记软件，或者担心原帖日后被删？右键点击红色 PDF 图标即可切换格式。',
          steps: [
            '在帖子操作栏的红色 PDF 图标上右键单击（或长按），弹出格式菜单。',
            '选择 Markdown：将整篇长文或推文串按顺序转成标准 .md 文件，还原真实外链（自动脱壳 t.co 短链）并保留图片链接。',
            '选择 HTML（自包含）：自动将所有远程图片抓取并以 Base64 内联进单个 .html 文件，彻底断网也能长期离线阅读。',
          ],
          cap: '右键菜单提供本地三种格式（PDF / Markdown / HTML）以及云端与教程入口。',
          tip: 'Markdown 非常适合导入 Obsidian / Notion，而自包含 HTML 适合永久本地存档防删帖。',
          labels: {
            menuTitle: '右键弹出格式菜单',
            itemPdf: 'PDF',
            itemMd: 'Markdown',
            itemHtml: 'HTML（自包含）',
            itemGrok: 'Grok Markdown（AI 整理）',
            itemGdoc: '↗ Google Docs（在线文档）',
            itemGdrive: '↗ Google Drive（PDF 云盘）',
            call1: '① 右键红色 PDF 图标打开菜单',
            call2: '② Markdown：适配 Obsidian / Notion',
            call3: '③ 自包含 HTML：图片全内联，删帖也能看',
          },
        },
        {
          nav: '4. 转存 Google Docs 与 Drive',
          title: 'X (Twitter) 集成：一键保存到 Google Docs 与 Google Drive',
          desc: '无需 IFTTT、无需手动复制排版或逐张插图。一键将 X 长文或推文串直接转换为默认窄边框、图片自适应版心的可编辑 Google Doc 或 Drive PDF。',
          steps: [
            '在右键菜单选择「↗ Google Docs（在线文档）」或「↗ Google Drive（PDF 云盘）」，或在扩展浮窗中直接点击对应按钮。',
            '首次点击会按需拉起 Google 账号授权弹窗（仅请求非敏感权限 drive.file，只能访问扩展新建的「X Article Exporter」目录）。勾选并点击 Continue 即可无缝继续上传。',
            '上传完成后，页面顶部提示条会显示「打开 Google Doc ↗」蓝色锚文本，点击即可立刻打开或二次编辑，云端链接同步写入存档库。',
          ],
          cap: '图中标出了点击入口、首次按需 OAuth 授权提示、顶部直达链接以及默认 36pt 窄边框 + 720px 配图宽度的 Google Doc 成稿。',
          tip: '如果在自建凭证环境遇到 403 未开启 Drive API，顶部提示条会自动给出「去开启 API ↗」引导链接。',
          labels: {
            call1: '① 点击转存 Google Docs / Drive',
            call2: '② 仅首次按需点击 Continue 授权 drive.file',
            toastMsg: '已上传至 Google Docs · 快照已存档',
            toastLink: '打开 Google Doc ↗',
            docTitle: 'Google Docs 成稿（默认 36pt 窄边框）',
            docBody: '正文排版完整保留，配图自动缩放至 720px 版心宽度不溢出版面',
            call3: '③ 点顶部锚文本立刻打开云端文档',
          },
        },
        {
          nav: '5. Grok AI 整理成文',
          title: '用 Grok Markdown 把零散推文串改写成结构化文章',
          desc: '遇到作者连发十几条回复组成的长推文串（1/、2/、3/…），普通导出逐条罗列不够连贯；Grok Markdown 会调用你自己的 Grok 账号将其整合成一篇完整好读的深度文章。',
          steps: [
            '在帖子详情页右键红色 PDF 图标，选择「Grok Markdown（AI 整理）」（或在浮窗点击对应按钮）。',
            '扩展会在后台打开 x.com/i/grok，自动使用你已登录的 X 账号（优先使用 Expert 模式）发送整串正文并要求保留所有事实、链接与配图。',
            '通常一分钟以内完成并自动下载整理好的 .md 文章，底部保留原帖作者与链接溯源。',
          ],
          cap: '红框标注了长推文串 -> Grok 后台整理 -> 输出结构化 Markdown 文章的全链路。',
          tip: '仅将你当前选中的推文串文本发往你自己的 X Grok 账号历史记录，不经过第三方中转服务器；如果不用 AI，普通 Markdown 始终可用。',
          labels: {
            leftTitle: '原始长推文串 (1/, 2/, 3/...)',
            midTitle: '后台 X Grok (Expert 模式)',
            rightTitle: '结构化 .md 文章',
            call1: '① 选 Grok Markdown（AI 整理）',
            call2: '② 自动整理摘要、分节标题并保留配图',
            outSnippet: '# 标题\n> 一句话核心摘要\n## 要点一 … ![img](url)',
          },
        },
        {
          nav: '6. Markdown 导入 X 长文',
          title: '把写好的 Markdown 草稿一键转成 X 长文原生排版',
          desc: '在 Obsidian、Notion 或 AI 中写好了长文，想发布到 X Articles？不需要一段段手动调粗体和标题格式，在长文编辑器中一键原地转换。',
          steps: [
            '进入 X 长文编辑器（x.com/compose/articles/edit/<id>），可以看到右上角「Preview / 预览」按钮左侧多出一个红色 M↓ 导入图标。',
            '把你的 Markdown 原文直接粘贴到正文编辑区。',
            '点击 Preview 左侧的红色 M↓ 图标，标题（H1–H3）、列表、引用块、粗斜体与超链接会立刻原地转换为 X 长文原生格式；若不满意按 Ctrl+Z 即可整步撤销。',
          ],
          cap: '红框精确标出 X 长文编辑器中紧挨「Preview」按钮左侧的导入图标位置。',
          tip: '注：X 长文编辑器本身不支持代码块与 Markdown 表格样式，扩展会自动将其平滑降级为可阅读段落，不丢内容；文章配图需通过 X 编辑器自带上传。',
          labels: {
            editorBar: 'X 长文编辑器顶部工具栏',
            previewBtn: 'Preview',
            publishBtn: 'Publish',
            bodyPlaceholder: '# 文章大标题\n**重点加粗** 与 > 引用内容…',
            call1: '① 将 Markdown 草稿粘贴进正文区',
            call2: '② 点击 Preview 左侧的红色 M↓ 图标原地排版',
            call3: '③ 误操作随时 Ctrl+Z 撤销',
          },
        },
        {
          nav: '7. 本地存档库与云端历史',
          title: '本地存档库：离线回看、历史记录与一键补传云端',
          desc: '每次导出都会在扩展本地 IndexedDB 保存一份自包含图文快照，防止原帖删除失联；同时也完整记录每次生成的本地与云端链接。',
          steps: [
            '通过扩展浮窗底部「导出历史 / 存档库」或右键菜单「存档库…」打开管理页。',
            '支持按标题、作者与正文关键词瞬间检索；可设定最大保留篇数，清理旧存档释放空间。',
            '每张卡片均展示本地导出记录与 Google Docs / Drive 上传历史，未上云的历史快照可直接在卡片上点「↗ Google Docs」秒传，已上云的可一键点「打开 Google Doc ↗」。',
          ],
          cap: '红框展示了搜索筛选、本地快照查看以及未上传/已上传卡片的两态云端按钮与底部链接历史。',
          tip: '所有归档数据仅存储在你本机的 Chrome 浏览器扩展存储中，删除扩展即一并清除。',
          labels: {
            searchBar: '搜索标题、作者、正文…',
            capCtrl: '最多保留 [50] 篇   [保存并清理]',
            cardTitle: 'How to fix your entire life in 1 day',
            btnSnap: '打开快照',
            btnDoc: '打开 Google Doc ↗',
            btnUpload: '↗ Google Docs',
            historyRow: 'Google Docs：How_to_fix...  2026/11/18   [打开链接 ↗]',
            call1: '① 搜索与容量上限管理',
            call2: '② 一键打开离线快照或直达 Google Doc',
            call3: '③ 卡片底部持久化保留云端文件名与直达链接',
          },
        },
      ],
    },
    en: {
      pageTitle: 'XExport · X Article → PDF · Visual Guide',
      brandSub: 'Complete Annotated Guide',
      navHeading: 'Features (7)',
      archiveBtn: 'Open Archive',
      openXBtn: 'Open X ↗',
      heroTitle: 'XExport (X Article to PDF) — Complete Feature Guide',
      heroLead: 'Jump to any workflow on the left. Every section pairs concise steps with red-box and arrow callouts covering PDF export, Markdown & offline HTML, Google Docs & Drive integration, Grok AI rewrite, X Article Markdown import, and local archive history.',
      sections: [
        {
          nav: '1. Pin & Reload',
          title: 'Quick Start: Pin the Toolbar Icon & Reload Threads',
          desc: 'Pin the extension for instant access to the popup menu, export status, and this guide on any X page.',
          steps: [
            'Click the Chrome Extensions puzzle icon, locate X Article to PDF, and click its Pin icon.',
            'Click the pinned icon to open the compact popup; the top-right Guide button opens this visual tutorial anytime.',
            'Reload (F5) any already-open X thread tab once after installing so the extension captures the full GraphQL thread payload.',
          ],
          cap: 'Red frames and arrows highlight the Chrome pin toggle, the popup top-right Guide button, and the one-time thread reload.',
          tip: 'If the popup ever warns you to reload the tab after an update, press F5 once on the x.com tab and retry.',
          labels: {
            toolbarPin: '1. Pin icon to Chrome toolbar',
            popupGuide: '2. Top-right Guide button in popup',
            reloadTab: '3. Reload thread tab once (F5)',
            popupTitle: 'XExport · X → PDF',
            popupBtnGuide: 'Guide',
            popupStatus: 'Ready to export this post',
            popupPdf: 'Export as PDF',
            popupGdoc: 'Save to Google Docs',
          },
        },
        {
          nav: '2. Searchable PDF',
          title: 'Save X Articles & Threads as Searchable Vector PDFs',
          desc: 'Skip broken browser print dialogs and blurry screenshots. Export selectable vector text with full-resolution images straight to Downloads.',
          steps: [
            'Open any X Article or the first post of an author’s thread (x.com/<user>/status/<id>).',
            'Left-click the red PDF icon in the post’s action bar next to Bookmark and Share (or choose Export as PDF from the toolbar popup).',
            'A silent background renderer waits for full-res images and outputs a clean, searchable PDF without opening new visible tabs.',
          ],
          cap: 'Left-click the red PDF button embedded in the X post action bar or inside the extension popup.',
          tip: 'Thread exports include available posts by the thread author in sequence and exclude replies from other accounts.',
          labels: {
            postHeader: 'DAN KOE @thedankoe · X Article',
            postLine1: 'How to fix your entire life in 1 day',
            postLine2: 'Headings, quotes, lists & full-res images preserved in vector PDF…',
            step1: '① Left-click the red PDF icon on the post',
            step2: '② Or click Export as PDF in the popup',
            outFile: 'How_to_fix_your_entire_life.pdf (selectable text & full-res images)',
          },
        },
        {
          nav: '3. Markdown & HTML',
          title: 'Right-Click Format Menu: Markdown & Offline HTML',
          desc: 'Need clean Markdown notes for Obsidian/Notion or a single self-contained HTML copy that survives deleted posts? Right-click the red PDF icon.',
          steps: [
            'Right-click (or long-press) the red PDF icon in the post action bar to open the format menu.',
            'Pick Markdown to download a .md file with clean headings, restored external URLs (unwrapping t.co), and image links.',
            'Pick HTML (self-contained) to inline every image as Base64 into a single offline-ready HTML file.',
          ],
          cap: 'The context menu gives quick access to local formats, Grok AI rewrite, Google Docs/Drive, and your Archive.',
          tip: 'Use Markdown for personal knowledge bases (Obsidian/Notion) and self-contained HTML for permanent offline backups.',
          labels: {
            menuTitle: 'Right-click format menu',
            itemPdf: 'PDF',
            itemMd: 'Markdown',
            itemHtml: 'HTML (self-contained)',
            itemGrok: 'Grok Markdown (AI rewrite)',
            itemGdoc: '↗ Google Docs',
            itemGdrive: '↗ Google Drive (PDF)',
            call1: '① Right-click the red PDF icon',
            call2: '② Markdown: Obsidian & Notion ready',
            call3: '③ Self-contained HTML: works offline forever',
          },
        },
        {
          nav: '4. Google Docs & Drive',
          title: 'Save X Posts, Threads & Articles to Google Docs & Drive',
          desc: 'True 1-click X (Twitter) Google Docs integration without IFTTT limits or manual copy-pasting. Creates narrow-margin (36pt) Google Docs with 720px auto-fitted images.',
          steps: [
            'Choose ↗ Google Docs or ↗ Google Drive (PDF) from the post context menu or the extension popup.',
            'Only on first use, an on-demand Google consent prompt requests the minimal non-sensitive drive.file scope (restricted to the X Article Exporter folder it creates). Click Continue.',
            'When finished, click Open Google Doc ↗ in the top toast banner — and find the saved link anytime in Export History.',
          ],
          cap: 'Callouts highlight the trigger button, on-demand drive.file OAuth consent, top toast quick-open link, and narrow-margin Google Doc output.',
          tip: 'If a custom GCP project lacks Drive API enabled (403), the toast automatically shows a direct Enable Google Drive API ↗ button.',
          labels: {
            call1: '① Click Save to Google Docs / Drive',
            call2: '② First click prompts drive.file OAuth Continue',
            toastMsg: 'Uploaded to Google Docs · snapshot archived',
            toastLink: 'Open Google Doc ↗',
            docTitle: 'Google Docs Output (36pt Narrow Margins)',
            docBody: 'Rich formatting preserved; embedded images fitted cleanly to 720px doc width',
            call3: '③ Click toast link to open & edit immediately',
          },
        },
        {
          nav: '5. Grok AI Rewrite',
          title: 'Rewrite Long Twitter Threads into Articles with Grok',
          desc: 'Turn multi-post self-threads (1/, 2/, 3/…) into a flowing, structured Markdown article using your own signed-in X Grok account.',
          steps: [
            'Right-click the red PDF icon on a thread page and select Grok Markdown (AI rewrite) (or click it in the popup).',
            'In a background tab on x.com/i/grok, the extension submits the thread to Grok (using Expert mode when available) while keeping original facts, links, and images.',
            'Within ~1 minute, a clean structured .md article downloads automatically with source attribution.',
          ],
          cap: 'Diagram traces the thread input -> background x.com/i/grok session -> structured Markdown output.',
          tip: 'Only sends thread text to X’s own Grok in your logged-in account — never touches any third-party AI server.',
          labels: {
            leftTitle: 'Multi-post Thread (1/, 2/...)',
            midTitle: 'Background x.com/i/grok (Expert)',
            rightTitle: 'Clean .md Article',
            call1: '① Pick Grok Markdown (AI rewrite)',
            call2: '② Generates title, summary, headings & keeps images',
            outSnippet: '# Title\n> Summary line\n## Key Point 1 … ![](url)',
          },
        },
        {
          nav: '6. Markdown → X Article',
          title: 'Import Markdown Drafts into the X Article Editor',
          desc: 'Draft in Obsidian, Notion, or your favorite editor, paste straight into X Articles, and convert Markdown formatting in one click.',
          steps: [
            'Open x.com/compose/articles/edit/<id>. Notice the red M↓ icon added immediately to the left of Preview.',
            'Paste your raw Markdown draft into the Article body field.',
            'Click the red M↓ icon to convert H1–H3 headings, lists, blockquotes, bold/italic, and links in place. Press Ctrl+Z anytime to undo.',
          ],
          cap: 'Red highlight targets the M↓ icon injected right beside the Preview button inside X’s Article composer.',
          tip: 'X Articles do not support code blocks or tables natively, so those degrade safely to readable text without losing content.',
          labels: {
            editorBar: 'X Article Composer Toolbar',
            previewBtn: 'Preview',
            publishBtn: 'Publish',
            bodyPlaceholder: '# Article Heading\n**Bold insight** and > Blockquote…',
            call1: '① Paste raw Markdown into body',
            call2: '② Click red M↓ icon left of Preview',
            call3: '③ Ctrl+Z undoes cleanly anytime',
          },
        },
        {
          nav: '7. Local Archive & Cloud Links',
          title: 'Local Archive: Searchable Snapshots & Cloud History',
          desc: 'Every export stores a self-contained snapshot locally so deleted X posts remain readable, alongside persistent links to your Google Docs & Drive files.',
          steps: [
            'Open Export History / Archive from the popup footer or the context menu.',
            'Search across saved titles, authors, and full text, or set a max item cap to keep storage tidy.',
            'Upload any previously saved snapshot directly to Google Docs in one click (↗ Google Docs), or click Open Google Doc ↗ from the card or bottom link history.',
          ],
          cap: 'Red boxes point out search/retention controls, instant 1-click Google Docs actions, and persistent cloud link rows.',
          tip: 'All local snapshots live exclusively inside your browser’s IndexedDB and are never transmitted unless you click upload.',
          labels: {
            searchBar: 'Search title, author, body…',
            capCtrl: 'Keep max [50]   [Save & Trim]',
            cardTitle: 'How to fix your entire life in 1 day',
            btnSnap: 'Open Snapshot',
            btnDoc: 'Open Google Doc ↗',
            btnUpload: '↗ Google Docs',
            historyRow: 'Google Docs: How_to_fix...  2026/11/18   [Open Link ↗]',
            call1: '① Instant search & retention cap',
            call2: '② Open offline copy or cloud Doc in 1 click',
            call3: '③ Persistent Google Docs / Drive history links',
          },
        },
      ],
    },
    es: {
      pageTitle: 'XExport · X Artículo a PDF · Guía Visual',
      brandSub: 'Guía visual completa',
      navHeading: 'Funciones (7)',
      archiveBtn: 'Abrir archivo',
      openXBtn: 'Abrir X ↗',
      heroTitle: 'Guía completa de XExport (X Article to PDF)',
      heroLead: 'Navega por cada función a la izquierda. Cada módulo incluye pasos claros y capturas con recuadros y flechas rojas: PDF buscable, Markdown, HTML sin conexión, Google Docs y Google Drive, Grok Markdown, importación al editor de X y archivo local.',
      sections: [
        {
          nav: '1. Fijar y recargar',
          title: 'Inicio rápido: fija la extensión y recarga el hilo',
          desc: 'Fija el ícono en Chrome para abrir el menú compacto y esta guía visual en cualquier momento.',
          steps: [
            'Haz clic en el ícono de Extensiones de Chrome y fija X Article to PDF.',
            'Abre el menú desde la barra; el botón Guía en la esquina superior derecha abre este manual.',
            'Recarga una vez (F5) cualquier pestaña de hilo ya abierta después de instalar.',
          ],
          cap: 'Los recuadros rojos señalan el pin en Chrome, el botón Guía superior derecho y la recarga única.',
          tip: 'Si ves el aviso de recargar pestaña tras actualizar, pulsa F5 en x.com y reintenta.',
          labels: {
            toolbarPin: '1. Fijar en la barra',
            popupGuide: '2. Botón Guía arriba a la derecha',
            reloadTab: '3. Recargar el hilo una vez (F5)',
            popupTitle: 'XExport · X → PDF',
            popupBtnGuide: 'Guía',
            popupStatus: 'Listo para exportar este post',
            popupPdf: 'Exportar a PDF',
            popupGdoc: 'Guardar en Google Docs',
          },
        },
        {
          nav: '2. PDF con búsqueda',
          title: 'Exporta Artículos e hilos de X a PDF buscable',
          desc: 'Genera PDF vectoriales reales con texto seleccionable e imágenes en resolución original sin diálogo de impresión.',
          steps: [
            'Abre un Artículo de X o la primera publicación de un hilo del autor.',
            'Haz clic izquierdo en el ícono rojo de PDF junto a Guardar y Compartir (o en el popup).',
            'El renderizador en segundo plano guarda el PDF directo en Descargas.',
          ],
          cap: 'Un clic izquierdo en el ícono rojo de PDF exporta el artículo o hilo al instante.',
          tip: 'Solo se incluyen las publicaciones del autor del hilo en orden.',
          labels: {
            postHeader: 'DAN KOE @thedankoe · Artículo X',
            postLine1: 'How to fix your entire life in 1 day',
            postLine2: 'Títulos, citas, listas e imágenes originales intactas en PDF…',
            step1: '① Clic izquierdo en el ícono rojo de PDF',
            step2: '② O pulsa Exportar a PDF en el menú',
            outFile: 'How_to_fix_your_entire_life.pdf (texto buscable)',
          },
        },
        {
          nav: '3. Markdown y HTML',
          title: 'Clic derecho: Markdown para Obsidian y HTML offline',
          desc: 'Elige entre texto estructurado .md o un HTML autónomo con imágenes incrustadas.',
          steps: [
            'Haz clic derecho en el ícono rojo de PDF para abrir el menú de formatos.',
            'Elige Markdown para guardar notas listas para Obsidian o Notion sin acortadores t.co.',
            'Elige HTML (autónomo) para incrustar cada imagen y abrir el archivo sin internet.',
          ],
          cap: 'El menú contextual reúne los formatos locales, Grok, Google Docs/Drive y tu archivo.',
          tip: 'HTML autónomo sigue funcionando incluso si el autor borra la publicación original.',
          labels: {
            menuTitle: 'Menú con clic derecho',
            itemPdf: 'PDF',
            itemMd: 'Markdown',
            itemHtml: 'HTML (autónomo)',
            itemGrok: 'Grok Markdown (IA)',
            itemGdoc: '↗ Google Docs',
            itemGdrive: '↗ Google Drive (PDF)',
            call1: '① Clic derecho en el ícono PDF',
            call2: '② Markdown: Obsidian y Notion',
            call3: '③ HTML autónomo: legible sin conexión',
          },
        },
        {
          nav: '4. Google Docs y Drive',
          title: 'Integración con Google Docs y Google Drive (PDF)',
          desc: 'Guarda cualquier post, hilo o artículo de X en Google Docs editable (márgenes estrechos 36pt e imágenes adaptadas a 720px) o sube el PDF a Drive en un clic.',
          steps: [
            'Elige Guardar en Google Docs o Subir PDF a Drive en el menú o popup.',
            'Al primer uso aparece la ventana OAuth bajo demanda con permiso mínimo drive.file (solo carpeta X Article Exporter). Pulsa Continue.',
            'Al terminar, haz clic en Abrir Google Doc ↗ en el aviso superior o en el historial.',
          ],
          cap: 'Las flechas muestran el botón de inicio, la autorización única drive.file, el enlace del aviso y el Doc resultante.',
          tip: 'Tus credenciales e historial no salen de tu navegador; la subida va directo a la API oficial de Google.',
          labels: {
            call1: '① Elige Google Docs o Drive',
            call2: '② Autorización drive.file solo al primer clic',
            toastMsg: 'Subido a Google Docs · copia archivada',
            toastLink: 'Abrir Google Doc ↗',
            docTitle: 'Google Doc (márgenes estrechos 36pt)',
            docBody: 'Formato e imágenes ajustados al ancho de 720px sin recortes',
            call3: '③ Abre el documento directo desde el aviso',
          },
        },
        {
          nav: '5. Grok Markdown IA',
          title: 'Convierte hilos largos en un artículo con Grok Markdown',
          desc: 'Reescribe un hilo de varias respuestas del autor en un artículo Markdown limpio usando tu cuenta de Grok en X.',
          steps: [
            'Haz clic derecho en una página de hilo y elige Grok Markdown (IA).',
            'La extensión envía el texto al propio Grok de X en segundo plano (modo Experto si está disponible).',
            'Descarga un archivo .md con título, resumen, subtítulos y enlaces originales.',
          ],
          cap: 'Flujo completo desde el hilo en X hasta el artículo .md generado por tu Grok.',
          tip: 'Solo envía el texto del hilo a tu propio historial de Grok en x.com.',
          labels: {
            leftTitle: 'Hilo largo (1/, 2/, 3/...)',
            midTitle: 'x.com/i/grok en segundo plano',
            rightTitle: 'Artículo .md limpio',
            call1: '① Elige Grok Markdown (IA)',
            call2: '② Estructura título, resumen y secciones',
            outSnippet: '# Título\n> Resumen breve\n## Punto 1 … ![](url)',
          },
        },
        {
          nav: '6. Markdown → Editor X',
          title: 'Importa borradores Markdown al editor de Artículos de X',
          desc: 'Pega tu borrador Markdown y conviértelo en el formato nativo de X con un clic.',
          steps: [
            'Abre el editor x.com/compose/articles/edit/<id>. Verás el ícono rojo M↓ junto a Preview.',
            'Pega el texto Markdown en el cuerpo del artículo.',
            'Pulsa M↓ para convertir encabezados, listas, citas, negritas y enlaces. Usa Ctrl+Z para deshacer.',
          ],
          cap: 'El recuadro rojo señala el ícono M↓ agregado a la izquierda de Preview.',
          tip: 'X no admite bloques de código ni tablas nativas; se convierten en texto legible.',
          labels: {
            editorBar: 'Barra del editor de Artículos',
            previewBtn: 'Preview',
            publishBtn: 'Publish',
            bodyPlaceholder: '# Título\n**Texto en negrita** y > Cita…',
            call1: '① Pega tu borrador Markdown',
            call2: '② Pulsa el ícono M↓ junto a Preview',
            call3: '③ Ctrl+Z deshace en un paso',
          },
        },
        {
          nav: '7. Archivo e historial',
          title: 'Archivo local offline y enlaces de Google Docs',
          desc: 'Cada exportación guarda una copia offline local y conserva tus enlaces a Google Docs / Drive.',
          steps: [
            'Abre Historial y archivo local desde el pie del popup o el menú contextual.',
            'Filtra por título, autor o contenido y ajusta el máximo de copias almacenadas.',
            'Sube cualquier archivo guardado a Google Docs con un clic o ábrelo desde su tarjeta.',
          ],
          cap: 'Controles de búsqueda, botón directo de subida y enlaces persistentes en la tarjeta.',
          tip: 'Las copias locales permanecen solo en el almacenamiento IndexedDB de tu navegador.',
          labels: {
            searchBar: 'Buscar título, autor, texto…',
            capCtrl: 'Máximo [50]   [Guardar y limpiar]',
            cardTitle: 'How to fix your entire life in 1 day',
            btnSnap: 'Ver copia',
            btnDoc: 'Abrir Google Doc ↗',
            btnUpload: '↗ Google Docs',
            historyRow: 'Google Docs: How_to_fix...  2026/11/18   [Abrir ↗]',
            call1: '① Búsqueda rápida y límite',
            call2: '② Copia offline o Google Doc en 1 clic',
            call3: '③ Enlaces persistentes en el historial',
          },
        },
      ],
    },
    pt: {
      pageTitle: 'XExport · X Artigo para PDF · Guia Visual',
      brandSub: 'Guia visual completo',
      navHeading: 'Recursos (7)',
      archiveBtn: 'Abrir acervo',
      openXBtn: 'Abrir X ↗',
      heroTitle: 'Guia completo do XExport (X Article to PDF)',
      heroLead: 'Navegue pelos recursos à esquerda. Cada seção traz passos diretos com destaques e setas vermelhas: PDF pesquisável, Markdown, HTML offline, Google Docs e Drive, Grok AI, importação para Artigos do X e acervo local.',
      sections: [
        {
          nav: '1. Fixar e recarregar',
          title: 'Início rápido: fixe a extensão e recarregue a thread',
          desc: 'Fixe o ícone na barra do Chrome para acessar o popup compacto e este guia em qualquer página do X.',
          steps: [
            'Clique no ícone de quebra-cabeça do Chrome e fixe X Article to PDF.',
            'Abra o popup pelo ícone na barra; o botão Guia no canto superior direito abre este tutorial.',
            'Recarregue uma vez (F5) qualquer aba de thread aberta após instalar.',
          ],
          cap: 'Quadros e setas em vermelho indicam o pino de fixação, o botão Guia no popup e o F5 inicial.',
          tip: 'Se surgir aviso para recarregar após uma atualização, aperte F5 na aba do X e tente novamente.',
          labels: {
            toolbarPin: '1. Fixar ícone na barra',
            popupGuide: '2. Botão Guia no topo direito',
            reloadTab: '3. Recarregar thread (F5)',
            popupTitle: 'XExport · X → PDF',
            popupBtnGuide: 'Guia',
            popupStatus: 'Pronto para exportar este post',
            popupPdf: 'Exportar PDF',
            popupGdoc: 'Salvar no Google Docs',
          },
        },
        {
          nav: '2. PDF pesquisável',
          title: 'Salve Artigos e threads do X como PDF pesquisável',
          desc: 'Gere PDFs vetoriais reais com texto selecionável e imagens em resolução original direto na pasta Downloads.',
          steps: [
            'Abra um Artigo do X ou o primeiro post de uma thread do autor.',
            'Clique com o botão esquerdo no ícone vermelho de PDF (ou no popup).',
            'O renderizador em segundo plano salva o PDF limpo sem diálogo de impressão.',
          ],
          cap: 'O botão vermelho de PDF aparece na barra de ações de cada post e no popup.',
          tip: 'As threads preservam apenas os posts disponíveis do mesmo autor em ordem.',
          labels: {
            postHeader: 'DAN KOE @thedankoe · Artigo X',
            postLine1: 'How to fix your entire life in 1 day',
            postLine2: 'Títulos, citações, listas e imagens em alta resolução…',
            step1: '① Clique esquerdo no ícone vermelho de PDF',
            step2: '② Ou clique em Exportar PDF no popup',
            outFile: 'How_to_fix_your_entire_life.pdf (texto pesquisável)',
          },
        },
        {
          nav: '3. Markdown e HTML',
          title: 'Clique direito: Markdown e HTML autocontido offline',
          desc: 'Exporte em Markdown pronto para Obsidian/Notion ou HTML com imagens embutidas para ler sem internet.',
          steps: [
            'Clique com o botão direito no ícone vermelho de PDF.',
            'Escolha Markdown para salvar um arquivo .md limpo com links reais.',
            'Escolha HTML (autônomo) para embutir todas as imagens e manter acesso mesmo se o post for apagado.',
          ],
          cap: 'O menu contextual reúne exportações locais, Grok AI, Google Docs/Drive e Acervo.',
          tip: 'O HTML offline abre normalmente mesmo sem conexão com a internet.',
          labels: {
            menuTitle: 'Menu do botão direito',
            itemPdf: 'PDF',
            itemMd: 'Markdown',
            itemHtml: 'HTML (autônomo)',
            itemGrok: 'Grok Markdown (IA)',
            itemGdoc: '↗ Google Docs',
            itemGdrive: '↗ Google Drive (PDF)',
            call1: '① Clique direito no ícone PDF',
            call2: '② Markdown para Obsidian / Notion',
            call3: '③ HTML offline com imagens embutidas',
          },
        },
        {
          nav: '4. Google Docs e Drive',
          title: 'Integração com Google Docs e Google Drive (PDF)',
          desc: 'Salve posts, threads e Artigos do X direto no Google Docs (margens estreitas 36pt e imagens em 720px) ou suba o PDF no Drive.',
          steps: [
            'Clique em Salvar no Google Docs ou Salvar PDF no Drive no menu ou popup.',
            'No primeiro uso, autorize sob demanda o escopo mínimo drive.file (pasta X Article Exporter) clicando em Continue.',
            'Ao concluir, clique em Abrir Google Doc ↗ no aviso do topo ou no Histórico.',
          ],
          cap: 'Anotações destacam o botão de envio, a autorização única drive.file, o link do aviso e o documento pronto.',
          tip: 'O envio vai direto do navegador para a API oficial do Google sem servidores intermediários.',
          labels: {
            call1: '① Clique para salvar no Docs ou Drive',
            call2: '② Permissão drive.file sob demanda',
            toastMsg: 'Salvo no Google Docs · cópia no acervo',
            toastLink: 'Abrir Google Doc ↗',
            docTitle: 'Google Doc (margens estreitas 36pt)',
            docBody: 'Formatação e imagens ajustadas automaticamente a 720px',
            call3: '③ Abra o arquivo direto pelo aviso do topo',
          },
        },
        {
          nav: '5. Grok Markdown IA',
          title: 'Transforme threads longas em artigo com Grok Markdown',
          desc: 'Reescreva threads extensas (1/, 2/, 3/…) em um único artigo Markdown estruturado usando sua conta do Grok no X.',
          steps: [
            'Clique com o botão direito em uma página de thread e escolha Grok Markdown (IA).',
            'A extensão usa x.com/i/grok em segundo plano mantendo fatos, links e imagens.',
            'Em menos de um minuto, o arquivo .md organizado cai nos seus downloads.',
          ],
          cap: 'Fluxo visual mostrando thread original, Grok em segundo plano e artigo .md final.',
          tip: 'Apenas o texto da thread vai para o seu próprio histórico do Grok no X.',
          labels: {
            leftTitle: 'Thread longa (1/, 2/, 3/...)',
            midTitle: 'x.com/i/grok em 2º plano',
            rightTitle: 'Artigo .md estruturado',
            call1: '① Escolha Grok Markdown (IA)',
            call2: '② Cria título, resumo e subtítulos com imagens',
            outSnippet: '# Título\n> Resumo\n## Ponto 1 … ![](url)',
          },
        },
        {
          nav: '6. Markdown → Artigo X',
          title: 'Importe rascunhos Markdown para o editor de Artigos do X',
          desc: 'Cole qualquer rascunho Markdown no editor de Artigos do X e aplique a formatação nativa em um clique.',
          steps: [
            'Abra x.com/compose/articles/edit/<id> e localize o ícone vermelho M↓ à esquerda de Preview.',
            'Cole o conteúdo Markdown no corpo do artigo.',
            'Clique em M↓ para converter títulos, listas, citações, negrito e links. Aperte Ctrl+Z para desfazer.',
          ],
          cap: 'Destaque vermelho indica o botão M↓ posicionado ao lado esquerdo de Preview.',
          tip: 'Blocos de código e tabelas viram parágrafos simples por limitação do editor do X.',
          labels: {
            editorBar: 'Barra do editor de Artigos do X',
            previewBtn: 'Preview',
            publishBtn: 'Publish',
            bodyPlaceholder: '# Título\n**Negrito** e > Citação…',
            call1: '① Cole o rascunho Markdown no corpo',
            call2: '② Clique em M↓ à esquerda de Preview',
            call3: '③ Ctrl+Z desfaz tudo na hora',
          },
        },
        {
          nav: '7. Acervo e links na nuvem',
          title: 'Acervo local offline e histórico de links na nuvem',
          desc: 'Cada exportação cria uma cópia offline pesquisável e registra links diretos para seus arquivos no Google Docs e Drive.',
          steps: [
            'Abra Histórico e acervo local pelo rodapé do popup ou menu de contexto.',
            'Pesquise por título, autor ou texto e defina o limite de cópias mantidas.',
            'Envie snapshots antigos para o Google Docs com um clique ou abra os já enviados pelo cartão.',
          ],
          cap: 'Destaques mostram a busca, botões de envio/abertura e o histórico de links salvo no cartão.',
          tip: 'Os snapshots ficam armazenados apenas no IndexedDB do seu navegador.',
          labels: {
            searchBar: 'Buscar título, autor, texto…',
            capCtrl: 'Manter até [50]   [Salvar]',
            cardTitle: 'How to fix your entire life in 1 day',
            btnSnap: 'Abrir cópia',
            btnDoc: 'Abrir Google Doc ↗',
            btnUpload: '↗ Google Docs',
            historyRow: 'Google Docs: How_to_fix...  2026/11/18   [Abrir link ↗]',
            call1: '① Busca rápida e retenção',
            call2: '② Snapshot offline ou Google Doc em 1 clique',
            call3: '③ Links persistentes no rodapé do cartão',
          },
        },
      ],
    },
    ja: {
      pageTitle: 'XExport · X記事→PDF変換 · ビジュアルガイド',
      brandSub: '機能別・図解ガイド',
      navHeading: '機能一覧（7項目）',
      archiveBtn: '履歴・アーカイブ',
      openXBtn: 'Xを開く ↗',
      heroTitle: 'XExport (X Article to PDF) 完全操作ガイド',
      heroLead: '左の目次から各機能へ移動できます。赤枠と矢印で操作位置をわかりやすく示し、PDF書き出し・Markdown/HTML・Google Docs/Drive連携・Grok要約・記事エディタ取込・アーカイブ管理を解説します。',
      sections: [
        {
          nav: '1. ピン留めと更新',
          title: 'はじめ方：ツールバーへの固定とタブ再読み込み',
          desc: '拡張アイコンを固定すると、右上のポップアップからいつでもエクスポートとこのガイドにアクセスできます。',
          steps: [
            'Chrome右上のパズルアイコンから本拡張をピン留めします。',
            'アイコンをクリックし、ポップアップ右上の「ガイド」から本ページを開けます。',
            '導入直後は閲覧中のXスレッドタブを一度F5で再読み込みしてください。',
          ],
          cap: '赤枠でピン留め、ポップアップ右上のガイドボタン、スレッドタブの再読み込みを示しています。',
          tip: '「タブを再読み込み」と表示された場合はF5更新後に再実行してください。',
          labels: {
            toolbarPin: '1. ツールバーにピン留め',
            popupGuide: '2. 右上のガイドボタン',
            reloadTab: '3. 導入後に1度再読み込み(F5)',
            popupTitle: 'XExport · X → PDF',
            popupBtnGuide: 'ガイド',
            popupStatus: 'この投稿をエクスポート可能',
            popupPdf: 'PDF で保存',
            popupGdoc: 'Google ドキュメントに保存',
          },
        },
        {
          nav: '2. 検索可能PDF保存',
          title: 'X記事・スレッドをテキスト検索可能なベクターPDFで保存',
          desc: 'ブラウザ印刷のレイアウト崩れなく、テキスト選択・検索可能＋高解像度画像のPDFを直接ダウンロードします。',
          steps: [
            'X記事または著者の連続スレッドの最初の投稿を開きます。',
            '投稿アクションバーの赤いPDFアイコンを左クリック（またはポップアップから選択）。',
            'バックグラウンドで高品質なPDFを生成し、自動でダウンロード保存します。',
          ],
          cap: '赤枠のPDFアイコンを左クリックするだけで即座にPDF生成が始まります。',
          tip: '他ユーザーの返信は除外し、著者本人のスレッドのみ順に収録します。',
          labels: {
            postHeader: 'DAN KOE @thedankoe · X記事',
            postLine1: 'How to fix your entire life in 1 day',
            postLine2: '見出し・引用・リスト・原寸画像を高品質PDFで保持…',
            step1: '① 赤いPDFアイコンを左クリック',
            step2: '② ポップアップ「PDFで保存」でも可',
            outFile: 'How_to_fix_your_entire_life.pdf（テキスト検索可）',
          },
        },
        {
          nav: '3. Markdown・HTML',
          title: '右クリックメニュー：MarkdownとオフラインHTML',
          desc: 'Obsidian・Notion用の.md出力や、元投稿削除後も読める画像埋込HTMLを切り替えられます。',
          steps: [
            '赤いPDFアイコンを右クリックしてフォーマットメニューを開きます。',
            'Markdownを選ぶとt.co展開済みのクリーンな.mdファイルを保存します。',
            'HTML（オフライン完結）は全画像をBase64埋込し、ネットなしでも閲覧できます。',
          ],
          cap: '右クリックメニューに全ローカル形式とクラウド連携が並んでいます。',
          tip: '削除対策の長期保存にはオフラインHTMLが最適です。',
          labels: {
            menuTitle: '右クリックメニュー',
            itemPdf: 'PDF',
            itemMd: 'Markdown',
            itemHtml: 'HTML（オフライン完結）',
            itemGrok: 'Grok Markdown (AI)',
            itemGdoc: '↗ Google ドキュメント',
            itemGdrive: '↗ Google ドライブ (PDF)',
            call1: '① 赤いアイコンを右クリック',
            call2: '② Obsidian/Notion向けMarkdown',
            call3: '③ オフライン閲覧OKの完結HTML',
          },
        },
        {
          nav: '4. Google Docs連携',
          title: 'Google ドキュメント・Google ドライブ連携保存',
          desc: '投稿やX長文を狭余白(36pt)・720px幅画像フィット済みの編集可能なGoogleドキュメントやDrive PDFとしてワンクリック保存。',
          steps: [
            'メニューまたはポップアップから「Google ドキュメントに保存」等をクリック。',
            '初回のみ最小権限drive.fileのGoogle認可が開きます（X Article Exporterフォルダ専用）。Continueを押してください。',
            '完了後、上部通知の「Google Docを開く ↗」からすぐ編集画面を開けます。',
          ],
          cap: '送信ボタン、初回のみのオンデマンド認可、上部トースト直リンク、狭余白出力を示しています。',
          tip: 'データは開発者サーバーを経由せず、お使いのブラウザから直接Google APIへ送信されます。',
          labels: {
            call1: '① Docs / Drive保存をクリック',
            call2: '② 初回のみdrive.file認可でContinue',
            toastMsg: 'Google ドキュメントに保存完了',
            toastLink: 'Docを開く ↗',
            docTitle: 'Google Doc（狭余白36pt・画像720px最適化）',
            docBody: '見出し・リンク・画像をそのままオンライン編集可能',
            call3: '③ 上部トーストリンクから即座に開く',
          },
        },
        {
          nav: '5. Grok AI記事化',
          title: 'Grok Markdownで長いスレッドを1本の記事に構成',
          desc: '連続ポスト（1/, 2/, 3/…）をお使いのXアカウントのGrokで構造化Markdown記事へ整理します。',
          steps: [
            'スレッド詳細ページで右クリックまたはポップアップから「Grok Markdown (AI)」を選択。',
            'バックグラウンドでx.com/i/grokを使い、事実・リンク・画像を保ったまま記事化します。',
            '約1分以内にタイトル・要約・見出し付き.mdが保存されます。',
          ],
          cap: 'スレッド入力からGrok処理・構造化Markdown生成までの流れです。',
          tip: '処理はご自身のx.com Grok履歴内で行われ、外部AIサービスへは送信されません。',
          labels: {
            leftTitle: '連続スレッド (1/, 2/...)',
            midTitle: 'x.com/i/grok (バックグラウンド)',
            rightTitle: '整理済み .md 記事',
            call1: '① Grok Markdown (AI) を選択',
            call2: '② 見出し・要約・画像保持で構造化',
            outSnippet: '# タイトル\n> 要約\n## ポイント1 … ![](url)',
          },
        },
        {
          nav: '6. 記事エディタ取込',
          title: 'Markdown原稿をX長文エディタへワンクリック変換',
          desc: '外部で執筆したMarkdownをXの記事エディタに貼り付け、ネイティブ書式へ一括変換します。',
          steps: [
            'x.com/compose/articles/edit/<id> を開き、Previewボタン左隣の赤いM↓アイコンを確認。',
            '本文欄にMarkdownテキストをそのまま貼り付けます。',
            'M↓をクリックすると見出し・箇条書き・引用・太字・リンクに変換。Ctrl+Zで元に戻せます。',
          ],
          cap: 'Previewボタンのすぐ左に配置された赤いM↓アイコンを赤枠で示しています。',
          tip: 'Xエディタ非対応の表・コードブロックは欠落せず読みやすい段落へ変換されます。',
          labels: {
            editorBar: 'X記事エディタ ツールバー',
            previewBtn: 'Preview',
            publishBtn: 'Publish',
            bodyPlaceholder: '# 記事タイトル\n**太字ポイント** や > 引用…',
            call1: '① 本文欄へMarkdownを貼付け',
            call2: '② Preview左の赤いM↓をクリック',
            call3: '③ Ctrl+Zでいつでも取り消し',
          },
        },
        {
          nav: '7. 履歴・アーカイブ',
          title: 'ローカルアーカイブとGoogleクラウド履歴リンク',
          desc: 'エクスポートのたびにオフラインスナップショットを保存し、Google Docs/DriveのURL履歴も管理できます。',
          steps: [
            'ポップアップ下部の「エクスポート履歴」からアーカイブ画面を開きます。',
            'タイトル・著者・本文検索や最大保存件数の設定が可能です。',
            '過去の保存から「↗ Google Docs」で後追いアップロードしたり、Docリンクを直接開けます。',
          ],
          cap: '検索バー、各カードのワンクリッククラウド操作、下部履歴リンクを示しています。',
          tip: 'ローカルアーカイブはお使いのChromeのIndexedDB内にのみ保存されます。',
          labels: {
            searchBar: 'タイトル・著者・本文を検索…',
            capCtrl: '最大 [50] 件保存   [保存して整理]',
            cardTitle: 'How to fix your entire life in 1 day',
            btnSnap: 'スナップショット',
            btnDoc: 'Google Doc ↗',
            btnUpload: '↗ Google Docs',
            historyRow: 'Google Docs: How_to_fix...  2026/11/18   [開く ↗]',
            call1: '① キーワード検索と上限設定',
            call2: '② オフライン閲覧またはDocsへ送信',
            call3: '③ カード下部にクラウドURLを永続保存',
          },
        },
      ],
    },
    id: {
      pageTitle: 'XExport · X Artikel ke PDF · Panduan Visual',
      brandSub: 'Panduan Lengkap Beranotasi',
      navHeading: 'Fitur (7)',
      archiveBtn: 'Buka Arsip',
      openXBtn: 'Buka X ↗',
      heroTitle: 'Panduan Lengkap XExport (X Article to PDF)',
      heroLead: 'Pilih fitur di sebelah kiri. Setiap bagian menampilkan langkah ringkas serta diagram kotak merah dan panah untuk PDF, Markdown, HTML offline, Google Docs & Drive, Grok AI, impor editor X, dan arsip lokal.',
      sections: [
        {
          nav: '1. Pin & Muat Ulang',
          title: 'Mulai Cepat: Sematkan Ikon & Muat Ulang Thread',
          desc: 'Sematkan ekstensi agar popup ringkas dan panduan ini selalu siap dipakai di X.',
          steps: [
            'Klik ikon puzzle Chrome lalu sematkan X Article to PDF.',
            'Klik ikon di bilah alat; tombol Panduan di kanan atas membuka halaman ini.',
            'Muat ulang (F5) tab thread X yang sudah terbuka setelah memasang.',
          ],
          cap: 'Kotak merah menunjuk tombol pin Chrome, tombol Panduan kanan atas, dan refresh F5.',
          tip: 'Jika popup meminta refresh tab, tekan F5 sekali pada halaman x.com lalu coba lagi.',
          labels: {
            toolbarPin: '1. Sematkan di bilah alat',
            popupGuide: '2. Tombol Panduan di kanan atas',
            reloadTab: '3. Refresh tab thread sekali (F5)',
            popupTitle: 'XExport · X → PDF',
            popupBtnGuide: 'Panduan',
            popupStatus: 'Siap mengekspor postingan ini',
            popupPdf: 'Ekspor PDF',
            popupGdoc: 'Simpan ke Google Docs',
          },
        },
        {
          nav: '2. PDF Dapat Dicari',
          title: 'Simpan Artikel & Thread X Menjadi PDF Vektor',
          desc: 'Hasilkan PDF dengan teks bisa disalin dan gambar resolusi asli tanpa dialog cetak browser.',
          steps: [
            'Buka Artikel X atau postingan pertama dari thread penulis.',
            'Klik kiri ikon PDF merah di bilah aksi postingan atau di popup.',
            'Renderer latar belakang otomatis menyimpan PDF ke folder Downloads.',
          ],
          cap: 'Klik kiri langsung ikon PDF merah untuk menyimpan file dengan cepat.',
          tip: 'Ekspor thread hanya mengambil postingan berurutan dari penulis asli.',
          labels: {
            postHeader: 'DAN KOE @thedankoe · Artikel X',
            postLine1: 'How to fix your entire life in 1 day',
            postLine2: 'Judul, kutipan, daftar & gambar asli terjaga rapi di PDF…',
            step1: '① Klik kiri ikon PDF merah di post',
            step2: '② Atau klik Ekspor PDF di popup',
            outFile: 'How_to_fix_your_entire_life.pdf (teks vektor)',
          },
        },
        {
          nav: '3. Markdown & HTML',
          title: 'Klik Kanan: Markdown untuk Obsidian & HTML Offline',
          desc: 'Ekspor catatan .md bersih atau file HTML mandiri berisi gambar agar tetap terbaca walau post dihapus.',
          steps: [
            'Klik kanan ikon PDF merah untuk membuka menu format.',
            'Pilih Markdown untuk menyimpan .md siap pakai di Obsidian atau Notion.',
            'Pilih HTML (mandiri) untuk menyematkan semua gambar offline.',
          ],
          cap: 'Menu klik kanan berisi pilihan format lokal, Grok AI, Google Docs/Drive, dan Arsip.',
          tip: 'HTML offline tetap terbuka di browser meskipun tidak ada koneksi internet.',
          labels: {
            menuTitle: 'Menu klik kanan',
            itemPdf: 'PDF',
            itemMd: 'Markdown',
            itemHtml: 'HTML (offline)',
            itemGrok: 'Grok Markdown (AI)',
            itemGdoc: '↗ Google Docs',
            itemGdrive: '↗ Google Drive (PDF)',
            call1: '① Klik kanan ikon PDF merah',
            call2: '② Markdown siap untuk Obsidian / Notion',
            call3: '③ HTML offline mandiri tanpa internet',
          },
        },
        {
          nav: '4. Google Docs & Drive',
          title: 'Integrasi Google Docs & Google Drive (PDF)',
          desc: 'Simpan post atau Artikel X menjadi Google Docs margin sempit (36pt) dengan lebar gambar otomatis 720px, atau PDF di Google Drive.',
          steps: [
            'Pilih Simpan ke Google Docs atau Simpan PDF ke Drive dari menu atau popup.',
            'Pada klik pertama, OAuth drive.file on-demand muncul (khusus folder X Article Exporter). Klik Continue.',
            'Klik tautan Buka Google Doc ↗ pada notifikasi atas setelah selesai.',
          ],
          cap: 'Menyoroti tombol unggah, otorisasi drive.file pertama kali, tautan toast atas, dan dokumen hasil.',
          tip: 'Browser mengunggah langsung ke API Google resmi tanpa server perantara.',
          labels: {
            call1: '① Klik simpan ke Docs atau Drive',
            call2: '② Otorisasi drive.file saat dibutuhkan saja',
            toastMsg: 'Diunggah ke Google Docs · arsip tersimpan',
            toastLink: 'Buka Google Doc ↗',
            docTitle: 'Google Doc (Margin sempit 36pt)',
            docBody: 'Format rapi & lebar gambar pas 720px tanpa terpotong',
            call3: '③ Klik tautan atas untuk langsung membuka',
          },
        },
        {
          nav: '5. Grok Markdown AI',
          title: 'Ubah Thread Panjang Jadi Artikel Terstruktur dengan Grok',
          desc: 'Susun ulang thread balasan berantai (1/, 2/…) memakai akun X Grok milik Anda sendiri.',
          steps: [
            'Klik kanan di halaman thread lalu pilih Grok Markdown (AI).',
            'Ekstensi menjalankan x.com/i/grok di tab latar belakang dengan tetap menjaga tautan dan gambar.',
            'File .md terstruktur akan terunduh otomatis dalam ~1 menit.',
          ],
          cap: 'Alur dari thread X ke sesi Grok latar belakang hingga file artikel .md.',
          tip: 'Hanya teks thread yang dikirim ke akun Grok X Anda sendiri.',
          labels: {
            leftTitle: 'Thread panjang (1/, 2/...)',
            midTitle: 'x.com/i/grok di latar belakang',
            rightTitle: 'Artikel .md rapi',
            call1: '① Pilih Grok Markdown (AI)',
            call2: '② Menyusun judul, ringkasan & subjudul',
            outSnippet: '# Judul\n> Ringkasan\n## Poin 1 … ![](url)',
          },
        },
        {
          nav: '6. Impor ke Editor X',
          title: 'Impor Draf Markdown ke Editor Artikel X',
          desc: 'Tempel draf Markdown ke editor Artikel X lalu ubah menjadi format asli X dalam sekali klik.',
          steps: [
            'Buka x.com/compose/articles/edit/<id> dan temukan ikon M↓ merah di sebelah kiri Preview.',
            'Tempelkan teks Markdown mentah ke isi artikel.',
            'Klik ikon M↓ untuk mengonversi heading, daftar, kutipan, tebal, dan tautan (Ctrl+Z untuk batal).',
          ],
          cap: 'Kotak merah menunjuk tombol M↓ tepat di sebelah kiri tombol Preview.',
          tip: 'Blok kode dan tabel disederhanakan otomatis agar isi teks tidak hilang.',
          labels: {
            editorBar: 'Bilah Editor Artikel X',
            previewBtn: 'Preview',
            publishBtn: 'Publish',
            bodyPlaceholder: '# Judul Artikel\n**Teks tebal** dan > Kutipan…',
            call1: '① Tempel teks Markdown ke editor',
            call2: '② Klik M↓ di sebelah kiri Preview',
            call3: '③ Tekan Ctrl+Z kapan saja untuk batal',
          },
        },
        {
          nav: '7. Arsip & Tautan Cloud',
          title: 'Arsip Lokal Offline & Riwayat Tautan Google Drive',
          desc: 'Setiap ekspor menyimpan salinan offline di perangkat serta menyimpan riwayat tautan Google Docs & Drive.',
          steps: [
            'Buka Riwayat & Arsip dari bagian bawah popup atau menu klik kanan.',
            'Cari judul, penulis, atau isi postingan serta atur batas penyimpanan.',
            'Unggah arsip lama ke Google Docs dalam 1 klik atau buka ulang tautan cloud-nya.',
          ],
          cap: 'Menandai kotak cari, tombol cepat Google Docs pada kartu, dan baris tautan cloud.',
          tip: 'Semua arsip lokal disimpan secara privat di IndexedDB browser Anda.',
          labels: {
            searchBar: 'Cari judul, penulis, isi…',
            capCtrl: 'Simpan maks [50]   [Simpan]',
            cardTitle: 'How to fix your entire life in 1 day',
            btnSnap: 'Buka Arsip',
            btnDoc: 'Buka Google Doc ↗',
            btnUpload: '↗ Google Docs',
            historyRow: 'Google Docs: How_to_fix...  2026/11/18   [Buka ↗]',
            call1: '① Cari cepat & atur kuota arsip',
            call2: '② Buka snapshot offline atau Google Doc',
            call3: '③ Riwayat tautan cloud tersimpan permanen',
          },
        },
      ],
    },
    ar: {
      pageTitle: 'XExport · X مقالة إلى PDF · الدليل المصور',
      brandSub: 'الدليل الشامل المشروح',
      navHeading: 'الميزات (7)',
      archiveBtn: 'فتح الأرشيف',
      openXBtn: 'فتح X ↗',
      heroTitle: 'الدليل الشامل لإضافة XExport (X Article to PDF)',
      heroLead: 'اختر القسم من القائمة الجانبية. يتضمن كل قسم خطوات مختصرة مع رسوم توضيحية بإطارات وأسهم حمراء لجميع الميزات السبع: تصدير PDF، وMarkdown وHTML دون اتصال، ومزامنة Google Docs وDrive، وتلخيص Grok، واستيراد Markdown لمحرر X، والأرشيف المحلي.',
      sections: [
        {
          nav: '1. التثبيت والتحديث',
          title: 'البداية السريعة: تثبيت الأيقونة وتحديث صفحة السلسلة',
          desc: 'ثبّت أيقونة الإضافة في شريط Chrome للوصول الفوري للقائمة المصغرة وفتح هذا الدليل من أي صفحة.',
          steps: [
            'انقر على أيقونة الإضافات في Chrome ثم ثبّت X Article to PDF.',
            'افتح النافذة المنبثقة؛ زر «الدليل» في الزاوية العلوية يفتح هذا الشرح دائمًا.',
            'أعد تحميل صفحة السلسلة (F5) مرة واحدة بعد التثبيت لالتقاط كامل المنشورات.',
          ],
          cap: 'الإطارات الحمراء توضح التثبيت في Chrome وزر الدليل بالنافذة المنبثقة وتحديث F5.',
          tip: 'عند تحديث الإضافة، أعد تحميل تبويب x.com مرة واحدة ثم أعد المحاولة.',
          labels: {
            toolbarPin: '1. تثبيت الأيقونة في الشريط',
            popupGuide: '2. زر الدليل في الأعلى',
            reloadTab: '3. تحديث الصفحة مرة واحدة (F5)',
            popupTitle: 'XExport · X → PDF',
            popupBtnGuide: 'الدليل',
            popupStatus: 'جاهز لتصدير هذا المنشور',
            popupPdf: 'تصدير PDF',
            popupGdoc: 'حفظ في Google Docs',
          },
        },
        {
          nav: '2. تصدير PDF قابل للبحث',
          title: 'حفظ مقالات وسلاسل X كملف PDF متجهي',
          desc: 'ملف PDF حقيقي بنص قابل للبحث والنسخ وصور بالدقة الأصلية دون نافذة الطباعة.',
          steps: [
            'افتح مقالة X أو أول منشور في سلسلة الكاتب.',
            'انقر بزر الفأرة الأيسر على أيقونة PDF الحمراء بجانب الإشارة المرجعية والمشاركة.',
            'يُنشأ الملف في الخلفية ويُحفظ تلقائيًا في مجلد التنزيلات.',
          ],
          cap: 'نقر يسار على الأيقونة الحمراء يبدأ تصدير PDF فورًا.',
          tip: 'يشمل التصدير منشورات الكاتب المتتالية فقط دون ردود الآخرين.',
          labels: {
            postHeader: 'DAN KOE @thedankoe · مقالة X',
            postLine1: 'How to fix your entire life in 1 day',
            postLine2: 'العناوين والاقتباسات والصور محفوظة بدقتها الأصلية…',
            step1: '① انقر على أيقونة PDF الحمراء',
            step2: '② أو اختر تصدير PDF من النافذة',
            outFile: 'How_to_fix_your_entire_life.pdf (نص قابل للبحث)',
          },
        },
        {
          nav: '3. Markdown وHTML',
          title: 'قائمة النقر بالزر الأيمن: Markdown وHTML دون اتصال',
          desc: 'احصل على ملفات .md جاهزة لتطبيقات الملاحظات أو ملف HTML متكامل يعمل دون إنترنت.',
          steps: [
            'انقر بزر الفأرة الأيمن على أيقونة PDF الحمراء لفتح قائمة الصيغ.',
            'اختر Markdown لتنزيل نص منسق متوافق مع Obsidian وNotion.',
            'اختر HTML المستقل لتضمين جميع الصور محليًا ومواصلة القراءة حتى لو حُذف المنشور.',
          ],
          cap: 'تجمع القائمة كل خيارات التصدير المحلي والسحابي في مكان واحد.',
          tip: 'ملف HTML المستقل مناسب للأرشفة الدائمة دون اتصال.',
          labels: {
            menuTitle: 'قائمة النقر الأيمن',
            itemPdf: 'PDF',
            itemMd: 'Markdown',
            itemHtml: 'HTML (دون اتصال)',
            itemGrok: 'Grok Markdown (AI)',
            itemGdoc: '↗ Google Docs',
            itemGdrive: '↗ Google Drive (PDF)',
            call1: '① انقر يمينًا على أيقونة PDF',
            call2: '② صيغة Markdown للملاحظات',
            call3: '③ HTML يعمل دون إنترنت',
          },
        },
        {
          nav: '4. Google Docs وDrive',
          title: 'التكامل المباشر مع Google Docs وGoogle Drive',
          desc: 'حوّل منشورات ومقالات X إلى مستند Google Docs قابل للتحرير بهوامش ضيقة (36pt) وملاءمة تلقائية للصور بعرض 720px.',
          steps: [
            'اختر حفظ في Google Docs أو رفع PDF إلى Drive من القائمة أو النافذة.',
            'في المرة الأولى فقط تُطلب موافقة drive.file عند الحاجة (مقصورة على مجلد X Article Exporter).',
            'عند الانتهاء اضغط رابط فتح Google Doc ↗ في الإشعار العلوي للتحرير الفوري.',
          ],
          cap: 'الأسهم توضح زر الحفظ وطلب التفويض الأولي ورابط الفتح السريع والمستند الناتج.',
          tip: 'يتم الرفع مباشرة من متصفحك إلى واجهة Google الرسمية دون خوادم وسيطة.',
          labels: {
            call1: '① اختر الحفظ في Docs أو Drive',
            call2: '② تفويض drive.file عند الطلب فقط',
            toastMsg: 'تم الرفع إلى Google Docs وحفظ النسخة',
            toastLink: 'فتح Google Doc ↗',
            docTitle: 'مستند Google Doc (هوامش ضيقة 36pt)',
            docBody: 'التنسيق والصور مضبوطة بعرض 720px داخل الصفحة',
            call3: '③ افتح المستند مباشرة من الشريط العلوي',
          },
        },
        {
          nav: '5. إعادة الصياغة بـ Grok',
          title: 'إعادة كتابة السلاسل الطويلة إلى مقالة عبر Grok',
          desc: 'دع Grok في حسابك يعيد تنظيم السلاسل المتفرقة (1/، 2/…) في مقالة Markdown مترابطة.',
          steps: [
            'من صفحة المنشور انقر يمينًا واختر Grok Markdown (AI).',
            'تُرسل السلسلة عبر حسابك إلى x.com/i/grok مع الحفاظ على الروابط والصور.',
            'خلال دقيقة تقريبًا يكتمل تنزيل ملف .md منسقًا بالعناوين والملخص.',
          ],
          cap: 'مخطط المسار من السلسلة الأصلية عبر Grok إلى ملف .md.',
          tip: 'لا تُرسل البيانات لأي جهة ثالثة خارج حسابك في Grok على x.com.',
          labels: {
            leftTitle: 'سلسلة منشورات (1/, 2/...)',
            midTitle: 'x.com/i/grok في الخلفية',
            rightTitle: 'مقالة .md منظمة',
            call1: '① اختر Grok Markdown (AI)',
            call2: '② يولد العنوان والملخص والأقسام',
            outSnippet: '# العنوان\n> ملخص\n## النقطة 1 … ![](url)',
          },
        },
        {
          nav: '6. Markdown → محرر X',
          title: 'استيراد مسودات Markdown مباشرة لمحرر مقالات X',
          desc: 'الصق نص Markdown في محرر مقالات X وحوّله إلى التنسيق الأصلي بنقرة واحدة.',
          steps: [
            'افتح x.com/compose/articles/edit/<id> وستجد أيقونة M↓ الحمراء يسار Preview.',
            'الصق مسودة Markdown داخل المحرر.',
            'اضغط M↓ لتحويل العناوين والقوائم والاقتباسات والروابط؛ واضغط Ctrl+Z للتراجع.',
          ],
          cap: 'الإطار الأحمر يحدد موضع زر M↓ بجوار زر Preview في محرر X.',
          tip: 'الكتل البرمجية والجداول تُحوّل لنصوص مقروءة وفق قدرات محرر X.',
          labels: {
            editorBar: 'شريط أدوات محرر مقالات X',
            previewBtn: 'Preview',
            publishBtn: 'Publish',
            bodyPlaceholder: '# عنوان المقالة\n**نص عريض** و > اقتباس…',
            call1: '① الصق نص Markdown في المحرر',
            call2: '② اضغط M↓ يسار زر Preview',
            call3: '③ Ctrl+Z للتراجع في أي وقت',
          },
        },
        {
          nav: '7. الأرشيف والروابط السحابية',
          title: 'الأرشيف المحلي وسجل روابط Google Docs',
          desc: 'تُحفظ نسخة محلية غير متصلة لكل عملية تصدير مع سجل دائم لروابط المستندات المرفوعة.',
          steps: [
            'افتح السجل والأرشيف المحلي من أسفل النافذة المنبثقة.',
            'ابحث بالعنوان أو الكاتب أو النص، واضبط الحد الأقصى للمحفوظات.',
            'ارفع أي نسخة محفوظة إلى Google Docs بنقرة واحدة أو افتح الروابط المرفوعة مسبقًا.',
          ],
          cap: 'مربعات البحث وأزرار Google Docs على البطاقات وسجل الروابط أسفل البطاقة.',
          tip: 'تبقى جميع النسخ المحلية داخل متصفحك فقط.',
          labels: {
            searchBar: 'ابحث في العنوان أو الكاتب أو النص…',
            capCtrl: 'الحد الأقصى [50]   [حفظ]',
            cardTitle: 'How to fix your entire life in 1 day',
            btnSnap: 'فتح النسخة',
            btnDoc: 'فتح Google Doc ↗',
            btnUpload: '↗ Google Docs',
            historyRow: 'Google Docs: How_to_fix...  2026/11/18   [فتح الرابط ↗]',
            call1: '① البحث الفوري وضبط الحد',
            call2: '② فتح النسخة المحلية أو مستند Google',
            call3: '③ حفظ دائم لروابط Google Docs / Drive',
          },
        },
      ],
    },
  };

  function callout(x, y, text) {
    let px = 0;
    for (const ch of String(text || '')) {
      px += ch.charCodeAt(0) > 255 ? 12.2 : 6.9;
    }
    const w = Math.max(108, Math.round(px + 24));
    const rx = Math.max(8, Math.min(x, 868 - w));
    return `
      <rect x="${rx}" y="${y}" width="${w}" height="28" rx="14" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
      <text x="${rx + w / 2}" y="${y + 18}" text-anchor="middle" fill="#ffffff" font-size="11.5" font-weight="700" font-family="system-ui,-apple-system,sans-serif">${esc(text)}</text>`;
  }

  function svgDiagram(kind, L) {
    const defs = `
      <defs>
        <marker id="arr-${kind}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#ef4444"/>
        </marker>
      </defs>`;

    const box = (x, y, w, h, r = 8) =>
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="rgba(239,68,68,0.10)" stroke="#ef4444" stroke-width="2.5"/>`;

    const arrow = (d) =>
      `<path d="${d}" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" marker-end="url(#arr-${kind})"/>`;

    let inner = '';

    if (kind === 'quickstart') {
      inner = `
        <!-- Browser bar -->
        <rect x="20" y="20" width="840" height="46" rx="10" fill="#f1f5f9" stroke="#cbd5e1"/>
        <rect x="36" y="31" width="520" height="24" rx="12" fill="#ffffff" stroke="#e2e8f0"/>
        <text x="54" y="47" fill="#64748b" font-size="12" font-family="system-ui,sans-serif">https://x.com/thedankoe/status/…</text>
        <!-- Reload button -->
        <circle cx="585" cy="43" r="13" fill="#ffffff" stroke="#cbd5e1"/>
        <path d="M585 36 A7 7 0 1 1 579 44" fill="none" stroke="#0f172a" stroke-width="2"/>
        <!-- Pinned extension icon & puzzle -->
        <rect x="742" y="30" width="26" height="26" rx="6" fill="#e02424"/>
        <text x="755" y="47" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">PDF</text>
        <circle cx="806" cy="43" r="13" fill="#ffffff" stroke="#cbd5e1"/>
        <text x="806" y="47" text-anchor="middle" fill="#475569" font-size="12">🧩</text>
        <!-- Extensions pin popover on left -->
        <rect x="44" y="96" width="286" height="114" rx="12" fill="#ffffff" stroke="#cbd5e1"/>
        <text x="64" y="124" fill="#0f172a" font-size="13" font-weight="700">Chrome Extensions</text>
        <rect x="58" y="138" width="258" height="42" rx="8" fill="#f8fafc" stroke="#e2e8f0"/>
        <rect x="68" y="149" width="20" height="20" rx="5" fill="#e02424"/>
        <text x="96" y="164" fill="#0f172a" font-size="12" font-weight="600">X Article to PDF</text>
        <text x="292" y="164" fill="#1d9bf0" font-size="14" font-weight="700">📌</text>
        ${box(274, 142, 36, 34, 8)}
        <!-- Redesigned popup on right -->
        <rect x="530" y="88" width="310" height="248" rx="12" fill="#ffffff" stroke="#cbd5e1"/>
        <text x="550" y="116" fill="#0f172a" font-size="14" font-weight="700">${esc(L.popupTitle)}</text>
        <rect x="738" y="96" width="88" height="28" rx="6" fill="#f1f5f9" stroke="#cbd5e1"/>
        <text x="782" y="114" text-anchor="middle" fill="#0f172a" font-size="12" font-weight="700">${esc(L.popupBtnGuide)}</text>
        ${box(734, 92, 96, 36, 8)}
        <rect x="546" y="136" width="278" height="28" rx="6" fill="#ecfdf5"/>
        <circle cx="560" cy="150" r="4" fill="#10b981"/>
        <text x="572" y="154" fill="#065f46" font-size="12" font-weight="600">${esc(L.popupStatus)}</text>
        <rect x="546" y="176" width="278" height="32" rx="6" fill="#f8fafc" stroke="#e2e8f0"/>
        <text x="562" y="196" fill="#0f172a" font-size="12">${esc(L.popupPdf)}</text>
        <rect x="546" y="216" width="278" height="32" rx="6" fill="#f8fafc" stroke="#e2e8f0"/>
        <text x="562" y="236" fill="#0f172a" font-size="12">${esc(L.popupGdoc)}</text>
        ${box(567, 25, 36, 36, 18)}
        ${arrow('M578 60 L440 278')}
        ${arrow('M310 159 L185 236')}
        ${arrow('M782 128 L720 342')}
        ${callout(44, 240, L.toolbarPin)}
        ${callout(328, 282, L.reloadTab)}
        ${callout(586, 344, L.popupGuide)}`;
    } else if (kind === 'pdf') {
      inner = `
        <rect x="28" y="22" width="520" height="316" rx="14" fill="#ffffff" stroke="#cbd5e1"/>
        <circle cx="62" cy="58" r="18" fill="#0f172a"/>
        <text x="90" y="55" fill="#0f172a" font-size="13" font-weight="700">${esc(L.postHeader)}</text>
        <text x="50" y="102" fill="#0f172a" font-size="17" font-weight="700">${esc(L.postLine1)}</text>
        <text x="50" y="128" fill="#475569" font-size="12.5">${esc(L.postLine2)}</text>
        <rect x="50" y="146" width="474" height="106" rx="10" fill="#f1f5f9" stroke="#e2e8f0"/>
        <text x="287" y="204" text-anchor="middle" fill="#64748b" font-size="13">[ Original High-Resolution Illustration ]</text>
        <!-- Action bar -->
        <line x1="50" y1="274" x2="524" y2="274" stroke="#e2e8f0"/>
        <text x="64" y="306" fill="#64748b" font-size="14">💬 9.8K</text>
        <text x="150" y="306" fill="#64748b" font-size="14">🔁 79K</text>
        <text x="234" y="306" fill="#64748b" font-size="14">❤️ 380K</text>
        <text x="348" y="306" fill="#64748b" font-size="14">🔖</text>
        <text x="394" y="306" fill="#64748b" font-size="14">📤</text>
        <rect x="444" y="286" width="32" height="28" rx="6" fill="#e02424"/>
        <text x="460" y="304" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="700">PDF</text>
        ${box(438, 281, 44, 38, 8)}
        <!-- Output PDF preview -->
        <rect x="610" y="42" width="240" height="240" rx="12" fill="#f8fafc" stroke="#cbd5e1"/>
        <rect x="628" y="64" width="204" height="22" rx="4" fill="#e02424"/>
        <text x="730" y="79" text-anchor="middle" fill="#fff" font-size="11.5" font-weight="700">VECTOR PDF</text>
        <rect x="628" y="102" width="160" height="10" rx="4" fill="#94a3b8"/>
        <rect x="628" y="120" width="196" height="8" rx="4" fill="#cbd5e1"/>
        <rect x="628" y="136" width="180" height="8" rx="4" fill="#cbd5e1"/>
        <rect x="628" y="158" width="204" height="74" rx="6" fill="#e2e8f0"/>
        <text x="730" y="264" text-anchor="middle" fill="#0f172a" font-size="11" font-weight="600">${esc(L.outFile.slice(0, 34))}</text>
        ${arrow('M482 300 C540 300, 560 160, 608 160')}
        ${callout(44, 340, L.step1)}
        ${callout(520, 340, L.step2)}`;
    } else if (kind === 'formats') {
      inner = `
        <rect x="30" y="24" width="230" height="76" rx="10" fill="#ffffff" stroke="#cbd5e1"/>
        <text x="50" y="66" fill="#64748b" font-size="15">🔖   📤</text>
        <rect x="148" y="44" width="34" height="30" rx="6" fill="#e02424"/>
        <text x="165" y="63" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">PDF</text>
        ${box(142, 38, 46, 42, 8)}
        <!-- Context menu -->
        <rect x="290" y="24" width="290" height="278" rx="12" fill="#1e293b" stroke="#334155"/>
        <text x="310" y="54" fill="#e2e8f0" font-size="13">${esc(L.itemPdf)}</text>
        <rect x="302" y="66" width="266" height="36" rx="6" fill="rgba(29,155,240,0.22)"/>
        <text x="314" y="89" fill="#ffffff" font-size="13" font-weight="700">${esc(L.itemMd)}</text>
        <rect x="302" y="106" width="266" height="36" rx="6" fill="rgba(16,185,129,0.22)"/>
        <text x="314" y="129" fill="#ffffff" font-size="13" font-weight="700">${esc(L.itemHtml)}</text>
        <text x="314" y="168" fill="#cbd5e1" font-size="13">${esc(L.itemGrok)}</text>
        <line x1="306" y1="184" x2="564" y2="184" stroke="#475569"/>
        <text x="314" y="210" fill="#38bdf8" font-size="13" font-weight="600">${esc(L.itemGdoc)}</text>
        <text x="314" y="242" fill="#38bdf8" font-size="13" font-weight="600">${esc(L.itemGdrive)}</text>
        <line x1="306" y1="258" x2="564" y2="258" stroke="#475569"/>
        <text x="314" y="284" fill="#94a3b8" font-size="13">Archive…</text>
        ${box(298, 63, 274, 83, 8)}
        <!-- Right outputs -->
        <rect x="630" y="34" width="222" height="90" rx="10" fill="#f8fafc" stroke="#cbd5e1"/>
        <text x="648" y="64" fill="#0f172a" font-size="13" font-weight="700">.md  Obsidian / Notion</text>
        <text x="648" y="92" fill="#475569" font-size="11.5"># Heading · ![img](url)</text>
        <rect x="630" y="150" width="222" height="90" rx="10" fill="#f8fafc" stroke="#cbd5e1"/>
        <text x="648" y="180" fill="#0f172a" font-size="13" font-weight="700">.html  Offline Snapshot</text>
        <text x="648" y="208" fill="#475569" font-size="11.5">data:image/*;base64 inlined</text>
        ${arrow('M188 59 L288 85')}
        ${arrow('M574 84 L628 79')}
        ${arrow('M574 124 L628 190')}
        ${callout(30, 126, L.call1)}
        ${callout(490, 324, L.call2)}
        ${callout(180, 324, L.call3)}`;
    } else if (kind === 'gdoc') {
      inner = `
        <!-- Left trigger popup / menu -->
        <rect x="24" y="24" width="228" height="170" rx="12" fill="#ffffff" stroke="#cbd5e1"/>
        <text x="42" y="54" fill="#64748b" font-size="12" font-weight="700">Google Cloud Sync</text>
        <rect x="38" y="68" width="200" height="44" rx="8" fill="#eff8ff" stroke="#1d9bf0"/>
        <text x="52" y="95" fill="#0f172a" font-size="13" font-weight="700">↗ Google Docs</text>
        <rect x="38" y="124" width="200" height="44" rx="8" fill="#f8fafc" stroke="#cbd5e1"/>
        <text x="52" y="151" fill="#0f172a" font-size="13" font-weight="600">↗ Google Drive (PDF)</text>
        ${box(34, 64, 208, 108, 10)}
        <!-- OAuth modal middle bottom -->
        <rect x="24" y="218" width="248" height="114" rx="12" fill="#ffffff" stroke="#cbd5e1"/>
        <text x="42" y="244" fill="#0f172a" font-size="12.5" font-weight="700">Google OAuth (drive.file)</text>
        <text x="42" y="266" fill="#475569" font-size="11.5">Folder: X Article Exporter</text>
        <rect x="174" y="286" width="82" height="30" rx="6" fill="#1a73e8"/>
        <text x="215" y="305" text-anchor="middle" fill="#fff" font-size="12" font-weight="700">Continue</text>
        ${box(170, 282, 90, 38, 8)}
        <!-- Top Toast -->
        <rect x="318" y="24" width="530" height="46" rx="23" fill="#0f1419"/>
        <text x="344" y="52" fill="#ffffff" font-size="13">${esc(L.toastMsg)}</text>
        <text x="692" y="52" fill="#4db5ff" font-size="13" font-weight="700" text-decoration="underline">${esc(L.toastLink)}</text>
        ${box(682, 31, 152, 32, 8)}
        <!-- Google Doc output page -->
        <rect x="350" y="96" width="498" height="236" rx="12" fill="#f8fafc" stroke="#cbd5e1"/>
        <rect x="374" y="114" width="450" height="198" rx="6" fill="#ffffff" stroke="#e2e8f0"/>
        <text x="394" y="142" fill="#1a73e8" font-size="14" font-weight="700">${esc(L.docTitle)}</text>
        <text x="394" y="166" fill="#334155" font-size="12">${esc(L.docBody)}</text>
        <rect x="394" y="182" width="410" height="92" rx="6" fill="#e2e8f0"/>
        <text x="599" y="233" text-anchor="middle" fill="#475569" font-size="12">720px Auto-Fitted Embedded Image (36pt Narrow Margins)</text>
        ${arrow('M244 106 L348 160')}
        ${arrow('M758 65 L758 112')}
        ${callout(24, 342, L.call2)}
        ${callout(536, 342, L.call3)}`;
    } else if (kind === 'grok') {
      inner = `
        <rect x="24" y="34" width="230" height="248" rx="12" fill="#ffffff" stroke="#cbd5e1"/>
        <text x="42" y="64" fill="#0f172a" font-size="13" font-weight="700">${esc(L.leftTitle)}</text>
        <rect x="42" y="82" width="194" height="52" rx="8" fill="#f8fafc" stroke="#e2e8f0"/>
        <text x="52" y="112" fill="#475569" font-size="12">1/ Author thread post…</text>
        <rect x="42" y="144" width="194" height="52" rx="8" fill="#f8fafc" stroke="#e2e8f0"/>
        <text x="52" y="174" fill="#475569" font-size="12">2/ Author reply post…</text>
        <rect x="42" y="206" width="194" height="52" rx="8" fill="#f8fafc" stroke="#e2e8f0"/>
        <text x="52" y="236" fill="#475569" font-size="12">3/ Final tip + link…</text>
        <!-- Middle Grok -->
        <rect x="314" y="76" width="230" height="164" rx="12" fill="#0f1419"/>
        <text x="429" y="116" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="700">✨ Grok</text>
        <text x="429" y="146" text-anchor="middle" fill="#94a3b8" font-size="12">${esc(L.midTitle)}</text>
        <rect x="342" y="172" width="174" height="38" rx="8" fill="#1e293b"/>
        <text x="429" y="196" text-anchor="middle" fill="#38bdf8" font-size="12" font-weight="600">Grok Markdown (AI)</text>
        ${box(338, 168, 182, 46, 10)}
        <!-- Output MD -->
        <rect x="606" y="34" width="248" height="248" rx="12" fill="#f8fafc" stroke="#cbd5e1"/>
        <text x="626" y="64" fill="#0f172a" font-size="13" font-weight="700">${esc(L.rightTitle)}</text>
        <rect x="624" y="84" width="212" height="174" rx="8" fill="#ffffff" stroke="#e2e8f0"/>
        <text x="638" y="114" fill="#0f172a" font-size="12" font-family="monospace"># Article Title</text>
        <text x="638" y="142" fill="#475569" font-size="11.5" font-family="monospace">&gt; 1-line summary</text>
        <text x="638" y="170" fill="#1d9bf0" font-size="11.5" font-family="monospace">## Point 1</text>
        <text x="638" y="198" fill="#475569" font-size="11.5" font-family="monospace">![img](pbs.twimg.com)</text>
        <text x="638" y="232" fill="#64748b" font-size="11" font-family="monospace">Source: @author</text>
        ${box(620, 80, 220, 182, 10)}
        ${arrow('M256 158 L312 158')}
        ${arrow('M546 158 L604 158')}
        ${callout(40, 316, L.call1)}
        ${callout(480, 316, L.call2)}`;
    } else if (kind === 'mdimport') {
      inner = `
        <rect x="30" y="24" width="820" height="296" rx="14" fill="#ffffff" stroke="#cbd5e1"/>
        <!-- Composer top bar -->
        <rect x="30" y="24" width="820" height="58" rx="14" fill="#f8fafc" stroke="#cbd5e1"/>
        <text x="58" y="58" fill="#0f172a" font-size="14" font-weight="700">${esc(L.editorBar)}</text>
        <!-- M↓ Button next to Preview -->
        <rect x="572" y="38" width="42" height="30" rx="6" fill="#e02424"/>
        <text x="593" y="58" text-anchor="middle" fill="#fff" font-size="12" font-weight="700">M↓</text>
        ${box(567, 33, 52, 40, 8)}
        <rect x="628" y="38" width="94" height="30" rx="15" fill="#ffffff" stroke="#cbd5e1"/>
        <text x="675" y="57" text-anchor="middle" fill="#0f172a" font-size="12" font-weight="600">${esc(L.previewBtn)}</text>
        <rect x="734" y="38" width="94" height="30" rx="15" fill="#0f1419"/>
        <text x="781" y="57" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="600">${esc(L.publishBtn)}</text>
        <!-- Left pasted MD -> Right Rich preview -->
        <rect x="54" y="106" width="350" height="186" rx="10" fill="#f8fafc" stroke="#cbd5e1"/>
        <text x="74" y="140" fill="#0f172a" font-size="13" font-family="monospace"># Article Heading</text>
        <text x="74" y="168" fill="#475569" font-size="12" font-family="monospace">**Bold insight** &amp; [link](url)</text>
        <text x="74" y="196" fill="#475569" font-size="12" font-family="monospace">&gt; Quoted note</text>
        <text x="74" y="224" fill="#475569" font-size="12" font-family="monospace">- Bullet item 1</text>
        ${box(50, 102, 358, 194, 12)}
        <rect x="466" y="106" width="356" height="186" rx="10" fill="#ffffff" stroke="#1d9bf0"/>
        <text x="486" y="142" fill="#0f172a" font-size="17" font-weight="700">Article Heading</text>
        <text x="486" y="170" fill="#0f172a" font-size="13" font-weight="700">Bold insight <tspan fill="#1d9bf0" font-weight="400" text-decoration="underline">link</tspan></text>
        <rect x="486" y="184" width="4" height="24" fill="#1d9bf0"/>
        <text x="500" y="201" fill="#475569" font-size="12.5">Quoted note</text>
        <text x="486" y="232" fill="#0f172a" font-size="12.5">• Bullet item 1</text>
        ${arrow('M593 73 L593 102')}
        ${arrow('M408 198 L464 198')}
        ${callout(40, 338, L.call1)}
        ${callout(320, 338, L.call2)}
        ${callout(640, 338, L.call3)}`;
    } else if (kind === 'archive') {
      inner = `
        <rect x="26" y="22" width="828" height="46" rx="10" fill="#ffffff" stroke="#cbd5e1"/>
        <text x="48" y="50" fill="#64748b" font-size="12.5">${esc(L.searchBar)}</text>
        <text x="530" y="50" fill="#0f172a" font-size="12">${esc(L.capCtrl)}</text>
        ${box(32, 27, 360, 36, 8)}
        <!-- Card -->
        <rect x="26" y="88" width="520" height="242" rx="14" fill="#ffffff" stroke="#cbd5e1"/>
        <rect x="44" y="104" width="484" height="62" rx="8" fill="#f1f5f9"/>
        <text x="286" y="140" text-anchor="middle" fill="#64748b" font-size="12">Offline Snapshot Thumbnail</text>
        <text x="44" y="192" fill="#0f172a" font-size="14.5" font-weight="700">${esc(L.cardTitle)}</text>
        <!-- Action buttons -->
        <rect x="44" y="210" width="110" height="30" rx="8" fill="#1d9bf0"/>
        <text x="99" y="229" text-anchor="middle" fill="#fff" font-size="12" font-weight="600">${esc(L.btnSnap)}</text>
        <rect x="164" y="210" width="142" height="30" rx="8" fill="#f8fafc" stroke="#cbd5e1"/>
        <text x="235" y="229" text-anchor="middle" fill="#0f172a" font-size="12" font-weight="600">${esc(L.btnDoc)}</text>
        <rect x="316" y="210" width="126" height="30" rx="8" fill="#f8fafc" stroke="#cbd5e1"/>
        <text x="379" y="229" text-anchor="middle" fill="#0f172a" font-size="12">${esc(L.btnUpload)}</text>
        ${box(160, 206, 286, 38, 10)}
        <!-- Persistent bottom cloud link row -->
        <line x1="44" y1="262" x2="528" y2="262" stroke="#cbd5e1" stroke-dasharray="4 4"/>
        <text x="44" y="288" fill="#1d9bf0" font-size="12" font-weight="600">${esc(L.historyRow)}</text>
        ${box(38, 270, 492, 34, 8)}
        ${arrow('M556 58 L610 110')}
        ${arrow('M450 225 L600 225')}
        ${arrow('M532 287 L600 287')}
        ${callout(584, 114, L.call1)}
        ${callout(584, 210, L.call2)}
        ${callout(584, 274, L.call3)}`;
    }

    return `<svg viewBox="0 0 880 380" role="img" aria-label="${esc(L.toastMsg || kind)}">${defs}<rect width="880" height="380" fill="#ffffff"/>${inner}</svg>`;
  }

  function pickInitialLang() {
    const p = new URLSearchParams(location.search).get('hl');
    if (p && DATA[p]) return p;
    const raw = (
      (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) ||
      navigator.language ||
      'en'
    ).toLowerCase();
    const base = raw.split(/[-_]/)[0];
    return DATA[base] ? base : 'en';
  }

  let currentLang = pickInitialLang();
  const langSelect = document.getElementById('langSelect');
  langSelect.value = currentLang;

  function render() {
    const D = DATA[currentLang] || DATA.en;
    document.title = D.pageTitle;
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';

    document.getElementById('brandSub').textContent = D.brandSub;
    document.getElementById('navHeading').textContent = D.navHeading;
    document.getElementById('btnArchive').textContent = D.archiveBtn;
    document.getElementById('btnOpenX').textContent = D.openXBtn;
    document.getElementById('heroTitle').textContent = D.heroTitle;
    document.getElementById('heroLead').textContent = D.heroLead;

    const navList = document.getElementById('navList');
    const root = document.getElementById('sectionsRoot');
    navList.textContent = '';
    root.textContent = '';

    const activeHash = (location.hash || '#quickstart').replace(/^#/, '');

    SECTIONS_META.forEach((meta, idx) => {
      const s = D.sections[idx];
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.className = 'nav-link' + (meta.id === activeHash ? ' active' : '');
      a.href = '#' + meta.id;
      a.dataset.target = meta.id;
      const num = document.createElement('span');
      num.className = 'nav-num';
      num.textContent = String(meta.num);
      const txt = document.createElement('span');
      txt.textContent = s.nav.replace(/^\d+\.\s*/, '');
      a.appendChild(num);
      a.appendChild(txt);
      li.appendChild(a);
      navList.appendChild(li);

      const sec = document.createElement('section');
      sec.className = 'module';
      sec.id = meta.id;
      sec.innerHTML =
        `<div class="mod-head"><span class="mod-badge">${meta.num}</span><h2 class="mod-title">${esc(s.title)}</h2></div>` +
        `<p class="mod-desc">${esc(s.desc)}</p>` +
        `<ol class="steps">${s.steps.map((st) => `<li>${esc(st)}</li>`).join('')}</ol>` +
        `<div class="diagram-card">${svgDiagram(meta.diagram, s.labels)}<div class="diagram-cap"><span class="cap-dot" aria-hidden="true"></span><span>${esc(s.cap)}</span></div></div>` +
        `<div class="tip-box">${esc(s.tip)}</div>`;
      root.appendChild(sec);
    });
  }

  langSelect.addEventListener('change', () => {
    currentLang = langSelect.value;
    render();
  });

  document.getElementById('btnArchive').addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('options.html', '_blank', 'noopener');
    }
  });

  // Scroll-spy for left navigation
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const mods = [...document.querySelectorAll('.module')];
      let current = mods[0] && mods[0].id;
      for (const m of mods) {
        if (m.getBoundingClientRect().top <= 120) current = m.id;
      }
      document.querySelectorAll('.nav-link').forEach((el) => {
        el.classList.toggle('active', el.dataset.target === current);
      });
    });
  }, { passive: true });

  render();
})();
