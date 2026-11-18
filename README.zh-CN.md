<p align="center">
  <a href="README.md">English</a> ·
  <b>简体中文</b> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt-BR.md">Português (Brasil)</a>
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/akmedeebhjkchcpocceffimhpmfjimhn">
    <img src="docs/readme_hero.zh-CN.jpg" alt="X Article to PDF Chrome 扩展：把推特长文和推文串存成可搜索的 PDF">
  </a>
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/akmedeebhjkchcpocceffimhpmfjimhn"><img src="https://img.shields.io/badge/Chrome%20%E7%BD%91%E4%B8%8A%E5%BA%94%E7%94%A8%E5%BA%97-%E6%B7%BB%E5%8A%A0%E5%88%B0%20Chrome-2563eb?style=for-the-badge&amp;logo=googlechrome&amp;logoColor=white" alt="添加到 Chrome —— Chrome 网上应用店"></a>
</p>

<p align="center">
  <b><a href="https://chromewebstore.google.com/detail/akmedeebhjkchcpocceffimhpmfjimhn">从 Chrome 网上应用店一键安装</a></b><br>
  免费 · 不用克隆、不用打包、不用开开发者模式 · 自动更新 · Edge 也能装<br>
  🌐 <a href="https://xexport.goodexts.com/zh">官网、教程和常见问题：xexport.goodexts.com</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-38bdf8?style=flat-square&amp;logo=googlechrome&amp;logoColor=white" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Browser-Chrome%20%26%20Edge-60a5fa?style=flat-square&amp;logo=googlechrome&amp;logoColor=white" alt="Chrome and Edge">
  <img src="https://img.shields.io/badge/License-MIT-94a3b8?style=flat-square" alt="MIT License">
</p>

# XExport（X Article to PDF）：推特长文、推文串一键导出 PDF / Google Docs / Markdown

**XExport（X Article to PDF）** 是一个免费开源的 Chrome 扩展：把 X（Twitter）的 **Article 长文**和**推文串**
一键存成真正的 PDF——文字可选中、可搜索，图片保持原图分辨率——也支持一键转存至
**Google Docs 在线文档**、**Google Drive（PDF 云盘）**、Markdown 与自包含 HTML。不弹打印框、不用手动复制排版。

还能用 X 自带的 Grok，把博主在评论区连续写的一长串（技巧 1、技巧 2、技巧 3……）整理成一篇
干净的 Markdown 文章；反过来也能把 Markdown 贴进 X 的长文编辑器，自动排好版。

## 功能

![X Article to PDF 核心能力：抓取、导出、离线归档、Markdown 导入](docs/features.svg)

- **推特长文 / 推文串 → PDF**：矢量文字可搜索可复制，图片原图分辨率
- **X 帖子与长文 → Google Docs / Google Drive**：一键转存为默认窄边框（36pt）、配图自动适配 720px 版心宽度的 Google Doc 或云端 PDF，纯按需授权（仅 `drive.file` 权限），完成提示和存档库均带直达链接
- **推文串 → Markdown**：直接导出，或用 **Grok Markdown** 让 AI 改写成一篇结构化文章
- **自包含 HTML**：图片全部内联，原帖被删了也能离线打开
- **本地存档库**：可选，导出过的内容在你自己的设备上留一份，支持一键补传 Google Docs
- **Markdown → X 长文编辑器**：贴进 Markdown 草稿，一键转成 X 原生排版
- **内置 7 语言图文使用教程**：点击工具栏浮窗右上角「使用教程」即可打开带红框与箭头标注的完整教程
- **隐私**：没有服务器、没有统计，本地处理；仅在你主动点击 Google 云端选项时从浏览器直连 Google 官方接口

## 用法

1. 从 **[Chrome 网上应用店](https://chromewebstore.google.com/detail/akmedeebhjkchcpocceffimhpmfjimhn)** 安装（Edge 也可以直接从这里装）
2. 打开任意 X 长文，或者博主在评论区接着写了续文的帖子
3. 点帖子操作栏里的红色 **PDF** 图标（在书签、分享图标旁边）

![X 帖子操作栏里的红色 PDF 导出图标，紧挨着书签和分享图标](docs/shot_pdf_button.png)

- **左键** = 导出 PDF（后台生成，落到下载列表）
- **右键** = 格式菜单：`PDF` / `Markdown` / `HTML（自包含）` / `Grok Markdown` / `↗ Google Docs（在线文档）` / `↗ Google Drive（PDF 云盘）` / `存档库…` / `使用教程…`
- 点击浏览器工具栏上的扩展图标可打开紧凑浮窗（右上角提供「使用教程」直达图文指南）

> **推文串**：装完扩展后**刷新一次页面**再导出。扩展是从 X 自己的网络响应里读推文串的，
> 当前页面的响应在扩展装好之前就已经到了。读不到时会自动改为从页面上抓，并提示你。

### 一键把推特长文、推文串保存到 Google Docs 或 Google Drive

在右键菜单点击 **↗ Google Docs（在线文档）** 或 **↗ Google Drive（PDF 云盘）**（也可在工具栏浮窗中点击）：

- **纯按需授权**：本地导出 PDF / Markdown / HTML 完全无需登录 Google；只有当你主动点击云端选项时，才会触发 Google 非敏感权限 `drive.file`（仅访问扩展自己创建的 `X Article Exporter` 目录）。
- **默认窄边框与配图适配**：自动生成默认 36pt 窄边框 Google Doc，保留标题、引用与链接，内嵌图片严格适配 720px 版心宽度。
- **即点即开 + 历史持久化**：上传完毕后页面顶部会显示可点击的 **打开 Google Doc ↗** 锚文本；存档库也会持久保存云端文件链接，并支持历史快照一键补传云端。

完整图文说明见：[如何把 X（推特）帖子、推文串和长文一键保存到 Google Docs](https://xexport.goodexts.com/zh/blog/save-x-post-to-google-docs)。

### 用 Grok 把推文串整理成 Markdown 文章

很多博主写长内容不发 Article，而是发一条主帖，再在评论区自己接着回复：技巧 1、技巧 2、技巧 3……
打开这样的帖子，右键红色 PDF 图标，选 **Grok Markdown（AI 整理）**。扩展会在后台标签页里用你自己
已登录的 X 账号，把整串续文交给 x.com 自带的 Grok，让它改写成一篇排版干净的 Markdown 文章：标题、
一句话摘要、每个要点一个小标题，链接和图片都保留。`.md` 文件直接进下载列表，通常一分钟以内，
拖进 Obsidian、Notion 或任何 Markdown 编辑器就能用。

![右键 PDF 图标选 Grok Markdown，整串推文变成一篇干净的 .md 文章](docs/shot_grok.zh-CN.png)

- 只在帖子详情页、且博主在评论区有自己的续文时才出现这一项
- 账号有**专家模式**就用专家模式，没有就用当前可用的模式
- 只把推文串的正文发给 X 自己的 Grok，这段对话会出现在你自己的 Grok 历史里
- 同一菜单里的普通 **Markdown** 是不经过 AI 的直接导出

### 把 Markdown 贴进 X 长文编辑器

进 `x.com/compose/articles/edit/<id>`，**Preview 按钮左边**多一个图标。把 Markdown 原样
贴进正文框，点一下图标：正文就地变成 X 长文自己的排版（标题 / 列表 / 引用 / 粗斜体 / 链接）。
没有确认弹窗，转错了按 **Ctrl+Z**，走的是编辑器自己的编辑历史。

![X 长文编辑器工具栏，Preview 左边多出来的红色 Markdown 导入图标](docs/shot_md_toolbar.png)

X 长文放不下的东西一律降级，宁可朴素也不丢字：表格 → `甲 | 1` 的普通段落，分隔线 → 一行
`— — —`，图片 → 链接（X 的图必须走它自己的上传）。X 长文没有代码格式，代码块和行内代码都会
落成普通文字。

### 油猴脚本 / 书签小工具

`x-article-exporter.user.js` 拖进 Tampermonkey；或把 `bookmarklet.txt` 全部内容粘进书签网址栏。
这两种形态没有扩展的后台页，所以导出的是自包含 HTML 而不是 PDF；书签小工具的推文串也只能从
页面上抓。

## 常见问题

### 怎么把推特（X）长文导出成 PDF？

装好扩展，在 x.com 上打开那篇 Article，点帖子操作栏里的红色 PDF 图标。PDF 在后台生成，直接存进
下载列表，不弹打印对话框。文字可选中、可搜索，图片保持原图分辨率。

### 推文串怎么保存成 PDF？

打开推文串第一条帖子的详情页（`x.com/<用户>/status/<id>`），装完扩展后先刷新一次页面，再点 PDF
图标。扩展用 X 自己的数据重建整串，时间线滚出视野的帖子也不会丢。

### 怎么把推特帖子或 X 长文保存到 Google Docs？

打开帖子或 X 长文，右键红色 PDF 图标（或点击工具栏浮窗），选择 **转存到 Google Docs**。首次使用按需确认 Google `drive.file` 授权即可从浏览器直传并生成顶部直达链接，后续无需重复授权。

### 推文串怎么转成 Markdown，存进 Obsidian / Notion？

右键 PDF 图标，选 **Markdown** 是直接导出；选 **Grok Markdown** 则由 Grok 改写成带标题、摘要、
小标题的结构化文章。两种都会存成 `.md` 文件，可以直接拖进 Obsidian、Notion、Logseq 等工具。

### 免费吗？会收集我的数据吗？

免费、开源（MIT）。不收集任何数据：没有账号、没有服务器、没有统计、不加载远程代码。唯一会把内容
发出去的是 Grok Markdown，它用你自己的账号把推文串正文发给 X 自己的 Grok。详见
[PRIVACY.md](PRIVACY.md)。

### 为什么 Chrome 会提示「已开始调试此浏览器」？

这是扩展不弹打印框就能生成真 PDF 的办法：用 Chrome 的 `debugger` 接口在后台标签页里把页面渲染成
PDF。运行期间 Chrome 一定会显示这条提示，导出完就消失。调试器挂不上时，会改为下载自包含 HTML。

### Edge 能用吗？

能。Edge 可以直接从 Chrome 网上应用店安装扩展。

## 隐私

**不收集任何数据。** 没有账号、没有服务器、没有统计、没有远程代码。所有导出和归档都在
你自己的浏览器本地完成。各项权限分别用来做什么，详见 [PRIVACY.md](PRIVACY.md)。

首次安装会打开[官网](https://xexport.goodexts.com/zh)的使用引导页。卸载时 Chrome 会打开一个
反馈页，地址里只有扩展版本、浏览器语言和安装日期，填不填随你。

## 开发者

内部实现、设计背后踩过的坑，以及怎么从源码加载，见 [docs/DEVELOPMENT.zh-CN.md](docs/DEVELOPMENT.zh-CN.md)。
单元测试：`node test-renderRich.js`。

## 相关项目

「合成 paste 借编辑器自己的上传流水线」这套思路后来拆成了两个独立的零权限扩展：

- [csdn-md-importer](https://github.com/wangsen2020/csdn-md-importer) —— Markdown 一键灌进 CSDN 编辑器，图片自动上传
- [zhihu-md-importer](https://github.com/wangsen2020/zhihu-md-importer) —— Markdown 一键灌进知乎专栏，图片自动上传

## License

MIT
