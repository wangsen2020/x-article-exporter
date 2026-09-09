# X Article → PDF

把 X (Twitter) 的 **Article 长文模式**或**推文串**导出为一份保留排版、图片内联的干净 HTML，
再用浏览器打印成 PDF。文字可选中、可搜索，图片是原图分辨率，导出物不依赖 X 的服务器。

针对 `x.com/rwayne/status/2097305709683884441`（万字长文开源X自媒体增长指南）实测通过。

## 三种用法，任选其一

### 1. Chrome 扩展（推荐，常用就装这个）

1. `chrome://extensions` → 右上角打开「开发者模式」
2. 点「加载已解压的扩展程序」，选中本文件夹
3. 打开任意 X 长文 / 推文串页面，点工具栏上的扩展图标

### 2. 油猴用户脚本

安装 Tampermonkey 后，把 `x-article-exporter.user.js` 拖进去。
X 的推文页右下角会出现一个蓝色「导出 PDF」按钮。

### 3. 书签小工具（零安装）

新建一个书签，把 `bookmarklet.txt` 的**全部内容**粘贴到「网址」一栏。
在 X 推文页点这个书签即可。

## 它做了什么

1. **等页面前台 + 全文预滚动**。X 长文的正文一次性全在 DOM 里（不虚拟化），
   但配图是懒加载的，而且标签页在后台时 Chrome 根本不会加载它们——
   不预滚动会导出一篇没有图的文章。
2. **按语义抽取**。用 `.longform-unstyled` / `.longform-header-one` /
   `.longform-blockquote` / `.longform-ordered-list-item` /
   `[data-testid="tweetPhoto"]` 这些 class 作锚点，还原成
   `<p> <h2> <h3> <blockquote> <ol> <figure>`。
3. **加粗走 computed style**。X 不用 `<strong>`，加粗是 CSS class 做的；
   且 `font-weight` 会继承，所以要和父元素比较，否则会抽出嵌套重复的 `<strong>`。
4. **图片升到原图并内联**。把 URL 里的 `name=small` 换成 `name=orig`，
   fetch 后转成 data URI 塞进 HTML——导出的文件完全自包含，可离线归档。
5. **打印样式**。A4、标题不与正文分离（`break-after:avoid`）、
   图片和引用块不跨页断裂、打印时在链接后面附上真实 URL。

## 已知坑（都是实测踩出来的）

- **必须保持页面在前台**。后台标签页 Chrome 不加载懒加载图片，脚本会先等你切回来。
- **`window.open` 必须在点击的同步阶段调用**。如果先 `await` 抓图片再开窗，
  用户手势的 transient activation 已过期，新窗口会被弹窗拦截器静默拦掉。
  脚本已经先开窗再干活；万一还是被拦，会自动降级成在当前标签渲染（浏览器后退键可回到原文）。
- **fetch 图片前要把 `&amp;` 还原成 `&`**。HTML 转义过的 URL 直接拿去 fetch，
  X 图床会返回空响应且不报错，内联出来是一堆空图。
- **推文串是虚拟列表**，滚动会卸载旧节点。脚本会先滚到底再抽，
  但超长串仍可能丢内容——推文串场景建议改走拦截 GraphQL `TweetDetail` 的路子。
- X 随时可能改版。真正会变的是那几个 class 名，改 `ART_SEL` 一处即可。

## 文件

| 文件 | 用途 |
|---|---|
| `extract.js` | 核心逻辑，扩展和用户脚本共用 |
| `extract.min.js` | 压缩版，书签小工具用 |
| `manifest.json` / `background.js` | MV3 扩展 |
| `x-article-exporter.user.js` | 油猴脚本 |
| `bookmarklet.txt` | 书签小工具，整段粘进书签网址栏 |
