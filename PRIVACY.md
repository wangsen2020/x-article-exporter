# 隐私政策 / Privacy Policy

**最后更新：2026-09-19**

扩展名称：X Article → PDF

## 一句话

**本扩展不收集、不存储、不传输任何用户数据到开发者或任何第三方。**
所有处理都在你自己的浏览器本地完成。

## 详细说明

### 收集的数据

无。本扩展没有账号体系，没有后端服务器，没有任何统计、埋点或崩溃上报，也不加载任何
远程代码。它不读取密码、表单内容或剪贴板。

### 权限为什么需要

`manifest.json` 声明了 4 个权限，逐条说明：

- **`debugger`** —— 唯一用途是调用 `chrome.debugger` + `Page.printToPDF`，把你当前导出
  的那篇文章在扩展自己开的一个后台标签页里渲染成真正的 PDF（矢量文字、可选中可搜索）。
  这是 Manifest V3 扩展里唯一能拿到「无打印对话框、不开可见标签页」PDF 输出的途径。
  调试器只附加到扩展自己创建的那个渲染标签页，生成完 PDF 立刻 `detach`，不会附加到你
  其他的标签页，也不用它读取任何页面数据。

- **`downloads`** —— 唯一用途是把生成好的 PDF / HTML 文件通过 `chrome.downloads.download`
  存进你自己的下载文件夹，以及在你点击「查看文件」时用 `chrome.downloads.show` 帮你在
  系统文件管理器里定位它。不读取你下载目录里的其他文件。

- **`storage` / `unlimitedStorage`** —— 两个用途：
  1. `chrome.storage.session` 存导出过程中的临时任务状态（哪篇文章、进度到哪一步），
     浏览器关闭即清空；
  2. 本地归档功能（点开选项页可关）用扩展自己的 IndexedDB（`xae-archive`）保存你导出过
     的文章快照——这样原帖被作者删除后你本地仍留一份能看的备份。`unlimitedStorage` 是因为
     单篇快照（图片内联进 HTML）常有几 MB，普通 `storage.local` 的配额不够用。归档内容只
     存在你自己的设备上，扩展不会把它发到任何地方。

- **`host_permissions`**（`x.com` / `twitter.com` / `pbs.twimg.com`）—— 内容脚本只在这三个
  域名上运行，用于读取你正在查看的文章/推文串内容、抓取 `pbs.twimg.com` 上的图片字节以内联
  进导出文件。在其他任何网站上，本扩展的内容脚本不运行、不加载。

### 你导出的内容怎么被处理

点击导出按钮时，扩展读取你当前打开的 X 文章或推文串页面内容（含图片），在你自己的浏览器
里转换成 PDF / HTML，写进你自己的下载文件夹或本地归档库。整个过程不经过任何服务器，开发者
拿不到你导出的任何内容。

Markdown 导入功能同理：你粘进正文框的 Markdown 只在你的浏览器里转换成 X 编辑器认得的格式，
不离开你的设备。

### 数据的出售或转让

不存在。没有数据被收集，因此也没有数据可被出售、转让或用于与功能无关的用途。

### 第三方

本扩展不引入任何第三方 SDK、分析服务或广告，与 X (Twitter) 官方没有任何关联，未获其授权或
认可，仅通过公开的网页界面与 X 的页面交互。「X」「Twitter」是其各自所有者的商标。

### 源代码

全部代码开源，可自行审阅：

https://github.com/wangsen2020/x-article-exporter

License: MIT

### 联系方式

有隐私相关的疑问，请在上述仓库提 Issue。

---

# Privacy Policy (English)

**Last updated: 2026-09-19**

This extension **does not collect, store, or transmit any user data to the developer or any
third party.** Everything happens locally in your own browser.

It has no accounts, no backend server, no analytics, no telemetry, and loads no remote code.

### Why each permission is needed

- **`debugger`** — used solely to call `chrome.debugger` + `Page.printToPDF`, rendering the
  article you're exporting into a real PDF inside a background tab the extension itself opens.
  It is only attached to that self-created rendering tab and detached immediately after the PDF
  is generated — never attached to any other tab, and never used to read page data.
- **`downloads`** — used solely to save the generated PDF/HTML into your own Downloads folder
  and to reveal it in your file manager when you click "show file". No access to other files in
  that folder.
- **`storage` / `unlimitedStorage`** — session storage holds transient per-export job state
  (cleared when the browser closes); the optional local archive feature stores self-contained
  HTML snapshots of exported posts in the extension's own on-device IndexedDB, so a deleted
  original post remains viewable locally. `unlimitedStorage` is needed because a single snapshot
  with inlined images can be several MB. Archive data never leaves your device.
- **`host_permissions`** (`x.com`, `twitter.com`, `pbs.twimg.com`) — the content scripts run only
  on these domains, to read the post you're viewing and fetch its images for inlining. The
  extension does not run on any other site.

No data is sold or transferred to third parties, because none is collected. This extension is
not affiliated with, authorized, or endorsed by X Corp.

Source code (MIT): https://github.com/wangsen2020/x-article-exporter
