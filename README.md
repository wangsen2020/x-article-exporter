# X Article → PDF

把 X (Twitter) 的 **Article 长文**或**推文串**导出为保留排版的 PDF——
文字可选中可搜索、图片原图分辨率、直接进浏览器下载列表，不弹打印对话框、不开新标签页。

也可以导出为图片全部内联的自包含 HTML，用于离线归档。

## 用法

### Chrome 扩展（推荐）

1. `chrome://extensions` → 打开「开发者模式」→「加载已解压的扩展程序」→ 选中本文件夹
2. 打开任意 X 长文 / 推文串页面
3. 点帖子操作栏里的 **PDF** 按钮（在书签、分享图标旁边）——**只有 X 长文（Article）才有这个图标**

- **左键** = 导出 PDF（静默生成，落到下载列表）
- **右键** = 导出自包含 HTML（图片内联为 data URI，可离线打开）
- 也可以点浏览器工具栏上的扩展图标，效果同左键

按钮是纯图标、红色、无圆形背景，跟随 X 原生规格（viewBox 24×24、18.75px、`fill` 而非 `stroke`）。
对齐要点：操作栏是 `align-items:stretch`，兄弟节点高 47px，**给按钮固定高度会变成顶端对齐**，
图标中心比原生图标高约 7px；必须用 `align-self:stretch` 跟着撑满。
文案在 hover 提示和 `aria-label` 里，全部走 `extract.js` 顶部的 `I18N` 表。
加一种语言只需往 `I18N` 里加一个键，不用碰任何 DOM 结构。目前内置 `zh` / `en`，
按 `navigator.language` 自动选。

> **推文串**场景：装完扩展后**刷新一次页面**再导出。网络拦截器只能捕获它装好之后
> 发出的请求，当前页面的 `TweetDetail` 早就发完了。捕获不到会自动降级抓 DOM 并提示。

### Markdown → 长文编辑器（写的方向）

进 `x.com/compose/articles/edit/<id>`，**Preview 按钮左边**多一个图标。把 Markdown 原样
贴进正文框，点一下图标：正文就地变成 X 长文自己的排版（标题 / 列表 / 引用 / 代码块 /
粗斜体 / 链接）。没有确认弹窗，转错了按 **Ctrl+Z** —— 走的是 Draft 自己的编辑历史。

实现的关键是**不要碰 DOM**。X 的长文编辑器是 Draft.js，真身是内存里的 ContentState，
contenteditable 只是投影——塞 innerHTML 不但不认，下一次 setState 还会把它抹掉。
Draft 唯一对外开放的富文本入口是 `paste`：它的 `editOnPaste` 读 `clipboardData` 里的
`text/html`，用自己的转换器解析。所以做法是 Markdown → 一份 Draft 认得的 HTML →
合成一次 `ClipboardEvent('paste')`。

三个实测结论（Draft 0.11.7，见 `compose.js` 注释）：

- **要接的是组件实例，不是 props**。React 双缓冲两棵 fiber 树，DOM 节点上挂的
  `__reactFiber$` 常常指着旧的那棵，`memoizedProps.editorState` 会慢一拍——实测读出来是
  「空文档」，而同一时刻实例上的 `_latestEditorState` 是最新的。读状态用它，写回用
  实例的 `update()`，那正是 Draft 内部改状态走的同一个口子。
- **嵌套列表只认「子列表是父列表的兄弟」**：`<ul><li>B</li><ul><li>B1</li></ul></ul>` 给出
  `depth:1`；写成 `<li>B<ul>…</ul></li>` 会塌成一块 `BB1`（而后者恰好是大多数 Markdown
  库的默认输出）。
- **DOM 选区对 Draft 无效**：`Range` 和 `execCommand('selectAll')` 都改不动它（后者还返回
  true），粘贴照样插在它自己记着的光标处。要整篇替换只能 `forceSelection` 撑开它的选区。

转完一次之后正文里已经没有任何标记了，这时再点会把整篇当大白文重排成清一色段落——
所以没有 Markdown 标记就直接不动，顺带挡住误点。

图标插在 Preview 左边。**Preview 不是 `<button>`，也没有 `role="button"`，它是
`<a role="link">`**——第一版只在 button / role=button 里找，真实编辑页 0 命中，图标退回了
右下角悬浮。所以现在不认标签只认文字：找到「整个元素就只有 Preview 这几个字」的叶子
节点，往上爬到文本仍然只有这几个字的最外层，插在它前面。

X 长文放不下的东西一律降级，宁可朴素也不丢字：表格 → `甲 | 1` 的普通段落，
分隔线 → 一行 `— — —`，图片 → 链接（X 的图必须走它自己的上传）。

**代码块 X 不支持**：真机实测 ```` ``` ```` 围栏和行内 `` ` `` 都会落成普通段落 / 普通文字
（文字不丢，只丢样式）。它的工具栏里也确实没有代码按钮。真机通过的是：三级标题、
有序 / 无序列表（含嵌套 depth）、引用、粗体、斜体、链接。

### Markdown → 知乎专栏（图片自动上传）

进知乎写文章页（`zhuanlan.zhihu.com/write` 或 `/p/<id>/edit`），点工具栏「导入」，
展开的菜单里多一条红色的 **「导入MD / 自动传图」**（原生两条是「导入文档 MD/Doc」和
「导入链接 公众号」）。选一个 `.md`（可以连同它引用的本地图片一起多选），正文按顺序
铺进去，**图片自动上传**——不用再一张张复制粘贴。

菜单条目不是自己拼的，是**克隆一条原生条目再改内容**：知乎那些 `css-xxxxx` 类名是构建时
哈希出来的，照抄迟早对不上；克隆连内边距、悬停态、字号一起继承。克隆出来的节点没有
React fiber，所以知乎自己的点击处理不会被误触发。找不到「导入」时（改版）退回右下角
红色悬浮球，免得彻底没入口。

两个实测细节：浮层**只认 Esc**，合成的 pointerdown / mousedown / click 一概关不掉它；
以及 observer 的合帧**不能用 `requestAnimationFrame`**——标签页不在前台时 rAF 冻结、
`setInterval` 被节流到分钟级，两个一起哑火就等于没挂载，改用 `setTimeout`。

能成立的前提是一条实测结论：**知乎的编辑器也是 Draft.js**。往它身上合成派发
`ClipboardEvent('paste')`，只要 `clipboardData.files` 里有图片 `File`，知乎就会走它自己的
上传流水线，把图传到 `pic-private.zhihu.com` 并插入 atomic/figure 块，和人手粘贴一模一样。
同理 `text/html` 能一次铺好标题、列表、引用、代码块（知乎的 h1 会被压成 header-two）。

图片来源两种：`http(s)` 链接在页面里直接 `fetch`（实测 `pbs.twimg.com` 带 CORS 头，拿得到
blob）；相对路径则在用户一起选中的文件里按文件名找。抓不到的不阻塞，降级成一行
「说明：原链接」，末尾报数。

本地图片是最容易漏的一步——正文里写的是 `![图1](01-xxx.png)` 这种相对路径，而文件框
只拿得到**被选中**的文件，漏选就静悄悄降级成一行文字。所以读完 `.md` 会先扫一遍，
把引用了但没选中的文件名**点名列出来**再要一次。注意这里不能直接弹第二个文件框：
第一次选完文件不算用户手势，`input.click()` 会被浏览器静默拒掉，必须先摆一条带按钮的
提示，让用户自己点那一下。

**为什么不用知乎自己的两个入口**（都实测过）：

- 「识别到特殊格式 → 确认并解析」那条提示条：点下去整篇被压成**一个段落**，格式全丢。
- 工具栏「导入」收 `.md`：文件确实传上了 OSS，但最后一步
  `zhida.zhihu.com/api/v4/ai_ingress/community/editor/upload` 返回 **400**。

两条都不稳，而且都不解决图片。粘贴这条路每一步都在自己手里。

**一个必须绕开的坑**：粘贴进来的第一个元素总是并进光标所在的那个块，所以在非空块后面
直接粘「整段只有一个 `<blockquote>`（或标题）」的片段，知乎会把它**整个吞掉**——实测块数
一点不涨。修法是先敲一次回车造出空块：Draft 的 `insertFragment` 遇到空块是「替换」而不是
「合并」，片段的第一个块就能带着自己的类型落地。

### Markdown → CSDN（图片自动上传）

进 CSDN 的 Markdown 编辑器（`editor.csdn.net/md`），点工具栏右边的「更多」，
展开的菜单里多一条红色的 **「导入 MD（自动传图）」**（原生五条是撤销 / 重做 / 导入 /
导出 / 模版）。用法和知乎那条一样：选一个 `.md`，可以连同它引用的本地图片一起多选。
条目同样是**克隆一条原生 `button.more-actions-item` 再改内容**；找不到「更多」时退回
右下角悬浮球。

**比知乎简单一层**：CSDN 这个编辑器是 StackEdit 那一系
（`<pre class="editor__inner" contenteditable>`），里面躺的**就是 Markdown 源码本身**。
所以不需要 md → HTML，不需要按图片切段贴，也不用去够 React 内部状态——整件事退化成
「把图换成 CSDN 直链，再把整篇文本一次性写进去」。

传图的原理和知乎同源：合成派发 `ClipboardEvent('paste')`，`clipboardData.files` 里带一个
图片 `File`，CSDN 就会走它自己的上传流水线，传到 `i-blog.csdnimg.cn` 并在光标处写下
`![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/<hash>.png)`。实测 2.1MB 的 PNG
约 1.9s 传完，**没有中间占位态**。

#### CSDN 自己会「外链图片转存」，为什么还要我们传

会，而且是**服务端**去抓：粘一个 https 图片链接进来，它显示「外链图片转存中…」，抓到
就换成 `i-blog.csdnimg.cn/img_convert/<hash>`。实测 `www.python.org` 的图 7 秒搞定。

但**它的服务器够不着 `pbs.twimg.com`**——实测那条永远停在 `[外链图片转存中...(img-xxx)]`，
连图片语法都不是了，发出去就是一行废字。而这个扩展导出的正文，图清一色是
`pbs.twimg.com`。所以必须我们自己在浏览器里取、在浏览器里传：墙和防盗链是按
「谁在发请求」算的，浏览器带着你的网络和身份，服务端没有。

反过来，我们 `fetch` 不到的 https 图（多半是对方没给 CORS 头）就**原样留着**交给 CSDN
转存，它服务端往往反而抓得到——两条路互补，不是二选一。所以完成提示把三种下场分开报：
已上传 / 交给 CSDN 转存（结果还没出来）/ 没拿到已留成文字。

#### 必须绕开的坑：别在非空文档里连着传

这是整件事里最费劲的一条。**在有内容的文档里连传多张，第二张开始会互相覆盖**：
实测第二张传完，第一张那行 `![…](url)` 会被削成光秃秃的 `在这里插入图片描述`，
成功 / 失败严格交替。

原因是 CSDN 先插一个占位、上传完再**按记下来的偏移**替换回去，而合成 `paste` 没有走它
自己的选区更新——用 DOM `Range` 挪光标它根本不认，等一拍让 `selectionchange` 跑到也没用，
偏移就是旧的，替换自然落到上一张身上。（服务端其实都成功了：`upload/signature` 和
华为云 OBS 两个 POST 全是 200，丢的只是写回编辑器那一步。）

修法是**每张都在空文档里传**：进来先把原文记下来，清空，一张张传，最后把原文和改写好的
正文一起写回去。改完 5/5 全中、每张稳定 1 秒，整篇 5 图从 35s 降到 13s。代价是上传期间
编辑器是空的，所以中途抛错要在 `catch` 里把原文放回去，不能让人因为导入失败白丢一篇。

另外两条：

- **选中全文后直接 paste 覆盖不掉选区**（它走自己的选区模型，结果是追加而不是替换），
  必须先 `execCommand('delete')` 清空再 paste。清空走 `execCommand` 而不是自己改 DOM，
  也是同一个道理——`execCommand` 过的是浏览器编辑管线，编辑器的内部模型跟得上。
- **失败时 CSDN 只留一行光秃秃的 alt，永远不会有链接**。所以盯着链接死等会白等满 90 秒，
  「正文一变就判失败」又会误杀慢图。判据取中间：正文**变过之后又稳住 2 秒**还没链接，
  才算这张没了。

### 油猴脚本 / 书签小工具

`x-article-exporter.user.js` 拖进 Tampermonkey；或把 `bookmarklet.txt` 全部内容粘进书签网址栏。

这两种形态**没有扩展后台**，拿不到 `chrome.debugger`，所以 PDF 请求会在 2.5s 后超时并
自动改为下载自包含 HTML。书签小工具还因为注入太晚装不上网络拦截器，推文串只能走 DOM 降级。

## 三条硬约束（都是实测踩出来的，改代码前先读）

### 1. 预滚动必须停在文章底部，绝不能滚到 document 底

X Article 的正文只在**文章自身的滚动范围内**不虚拟化。一旦滚进评论区，
整篇正文会被从 DOM 卸载：

| 指标 | 滚到 document 底 | 滚到文章底 |
|---|---|---|
| 正文块数 | **0**（正文被卸载，根 article 元素也被换掉） | **136** |
| 正文配图 | 0，且混入评论区的图 | **11** |
| 滚动终点 | 27354 | **17529** |

所以 `loadArticle()` 每轮重算 `articleRoot().getBoundingClientRect().bottom + scrollY`
作为上限，并留半屏余量。另外正文渲染出来之前这个高度是 0，会把上限算成负数——
必须先等 `.longform-unstyled` 出现再开始。

### 2. 所有选择器必须限定在正文根 article 内

全文档选择会把评论区的配图当成正文插图抽进来，配合约束 1 的正文卸载问题会抽出一锅混合物。

### 2b. 封面图去重不能用字符串 includes

`parts` 里的 URL 已经过 `esc()`（`&` → `&amp;`），拿未转义的原始 URL 去 `includes` 比对
**永远匹配不上**，封面会被重复插入一次。实测某篇文章封面 URL 含 `&`，
旧逻辑 100% 复现重复。现在改用抽取过程中收集的原始 URL `Set` 判重。

### 3. 不要在页面里调 print()

新开的同源标签页和 x.com **共用渲染进程**，大文档的打印预览会把原页面主线程一起冻住
（表现为页面完全卡死、滚轮无响应）。所以现在：

- PDF 渲染放在**扩展页面**（`chrome-extension://` 源，独立进程）里做
- 传给它的文档保持「远程图片链接」的轻量形态（几十 KB），只有导出 HTML 时才内联图片

## 两条抽取路径

### Article 长文 —— 抓 DOM

用 `.longform-unstyled` / `.longform-header-one` / `.longform-header-two` /
`.longform-blockquote` / `.longform-ordered-list-item` / `[data-testid="tweetPhoto"]`
作锚点，还原成 `<p> <h2> <h3> <blockquote> <ol> <figure>`。

加粗必须走 computed style：**X 不用 `<strong>`，加粗是 CSS class 做的**；
而且 `font-weight` 会继承，要和父元素比较，否则会抽出嵌套重复的 `<strong>`。

### 推文串 —— 拦 GraphQL

推文串在 DOM 里是虚拟列表，抓 DOM 必然丢内容。`net-hook.js` 在 `document_start`
抢在 X 自己的请求之前装好 fetch / XHR 拦截，缓存 `TweetDetail` 响应，
导出时直接从结构化 JSON 重建。这条路径还能拿到 DOM 里已经损失的信息：

| 字段 | 拿到了什么 |
|---|---|
| `note_tweet.richtext.richtext_tags` | 长推文加粗 / 斜体的精确区间 |
| `note_tweet.media.inline_media` | 正文中间内嵌图片及其插入位置 |
| `entities.urls[].expanded_url` | 链接真实地址（DOM 里只有 t.co 短链） |
| `extended_entities.media` | 原始媒体，不受显示尺寸影响 |

**所有下标都是码点（code point），不是 UTF-16 code unit。**
中文和 emoji 下按 `string.length` 切会整体错位，必须先 `Array.from()`。
`node test-renderRich.js` 有 11 条单元测试覆盖这块。

## PDF 是怎么生成的

`chrome.debugger` + `Page.printToPDF`。这是扩展里**唯一**能拿到
「真 PDF、矢量文字、无打印对话框、不开可见标签页」的途径。

代价：Chrome 会显示一条 **「"X Article → PDF" 已开始调试此浏览器」** 的横幅。
这是 Chrome 的强制提示，无法去掉。横幅出现期间 DevTools 不能用（反之亦然）。

流程：内容脚本把轻量 HTML 交给后台 → 后台在**后台标签页**里打开扩展页面渲染 →
等图片解码完 → `printToPDF` → 页面用 `<a download>` 触发下载 → 关掉标签页。
全程不切走你当前的页面。

如果 debugger 附加失败（DevTools 已打开、企业策略限制等），**不会弹打印对话框**——
直接改为下载自包含 HTML 并提示原因。整条链路里任何一步都不会打断你手上的操作。

## 其他已知坑

- **必须保持页面在前台**。后台标签页 Chrome 不加载懒加载图片（实测滚了 23 轮图片数
  一直是 0，一强制重绘立刻变 14 张），脚本会先等你切回来。
- **fetch 图片前要把 `&amp;` 还原成 `&`**。HTML 转义过的 URL 直接拿去 fetch，
  X 图床会返回空响应且**不报错**，内联出来是一堆空图。
- **注入必须落在 MAIN world**。缓存的 GraphQL 数据挂在页面的 `window` 上，
  隔离世界读不到；图片 fetch 也需要页面自己的 x.com 源才有 CORS。
  MAIN world 没有 `chrome.*` API，所以用 `bridge.js`（隔离世界）做 postMessage 中转。
- X 随时可能改版。Article 路径会变的是 `ART_SEL` 那几个 class；
  推文串路径会变的是 GraphQL 字段结构（`collectFromGQL` / `userOf` 已兼容新旧 schema）。

## 尚未验证

以下部分只有代码和推理，**没有跑通过端到端**：

- `chrome.debugger` + `printToPDF` 整条链路（需要装上扩展实跑）
- PDF 的实际分页表现（标题是否孤立在页尾、大图是否被切断）
- 推文串 GraphQL 路径的端到端（渲染函数有单元测试，但没在真实长串上跑过）

已在真实页面验证过的：正文抽取与边界（136 块 / 11 图）、加粗抽取、图片内联
（11/11，0 失败）、渲染效果、操作栏按钮挂载。

## 文件

| 文件 | 用途 |
|---|---|
| `extract.js` | 抽取、渲染、按钮挂载；定义 `window.__XAE_RUN(mode)`（MAIN world） |
| `compose.js` | Markdown → Draft.js 粘贴注入，长文编辑页的图标（MAIN world） |
| `zhihu.js` | Markdown 一键灌进知乎专栏，图片自动上传（MAIN world，zhuanlan.zhihu.com） |
| `csdn.js` | Markdown 一键灌进 CSDN，图片自动上传（MAIN world，editor.csdn.net） |
| `md2html.js` | Markdown → Draft 认得的 HTML，compose.js 和 zhihu.js 共用 |
| `net-hook.js` | GraphQL 网络拦截（MAIN world，`document_start`） |
| `bridge.js` | 隔离世界中继，MAIN ↔ 后台（MAIN 没有 `chrome.*`） |
| `background.js` | `chrome.debugger` + `printToPDF` |
| `viewer.html` / `viewer.js` | 扩展页面，独立进程里渲染文档并触发下载 |
| `extract.min.js` / `bookmarklet.txt` | 书签小工具 |
| `x-article-exporter.user.js` | 油猴脚本 |
| `test-renderRich.js` | 富文本渲染单元测试，`node test-renderRich.js` |

## License

MIT
