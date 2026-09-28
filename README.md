<p align="center">
  <b>English</b> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt-BR.md">Português (Brasil)</a>
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/akmedeebhjkchcpocceffimhpmfjimhn">
    <img src="docs/readme_hero.jpg" alt="X Article → PDF — install free from the Chrome Web Store">
  </a>
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/akmedeebhjkchcpocceffimhpmfjimhn"><img src="https://img.shields.io/badge/Chrome%20Web%20Store-Add%20to%20Chrome-2563eb?style=for-the-badge&amp;logo=googlechrome&amp;logoColor=white" alt="Add to Chrome — Chrome Web Store"></a>
</p>

<p align="center">
  <b><a href="https://chromewebstore.google.com/detail/akmedeebhjkchcpocceffimhpmfjimhn">Install from the Chrome Web Store</a></b><br>
  Free · no clone, no build, no developer mode · auto-updates · works in Edge too
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-38bdf8?style=flat-square&amp;logo=googlechrome&amp;logoColor=white" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Browser-Chrome%20%26%20Edge-60a5fa?style=flat-square&amp;logo=googlechrome&amp;logoColor=white" alt="Chrome and Edge">
  <img src="https://img.shields.io/badge/License-MIT-94a3b8?style=flat-square" alt="MIT License">
</p>

# X Article → PDF

Export an X (Twitter) **Article** or **thread** to a PDF that keeps its layout —
selectable, searchable text and full-resolution images, saved straight to your downloads.
No print dialog, no new tab.

You can also export a self-contained HTML file with every image inlined, for offline archiving.

## Features

![X Article → PDF feature overview](docs/features.en.svg)

## Usage

### Chrome extension (recommended)

1. Install it from the **[Chrome Web Store](https://chromewebstore.google.com/detail/akmedeebhjkchcpocceffimhpmfjimhn)** (Edge can install it from there too)
2. Open any X Article or thread
3. Click the **PDF** button in the post's action bar (next to bookmark and share) — **it only appears on X Articles**

![The PDF export button in the post action bar, next to bookmark and share](docs/shot_pdf_button.png)

- **Left-click** = export PDF (generated silently, lands in your downloads)
- **Right-click** = format menu: PDF / Markdown / HTML (self-contained, images inlined, opens offline) / Grok Markdown / Archive
- Clicking the extension's toolbar icon does the same as a left-click

The button is icon-only, red, with no round background, matching X's native spec (24×24 viewBox,
18.75px, `fill` rather than `stroke`). Alignment gotcha: the action bar is `align-items:stretch` with
47px-tall siblings, so **giving the button a fixed height top-aligns it** and puts the icon about 7px
above the native ones; it has to use `align-self:stretch` instead.
The copy lives in the hover tooltip and `aria-label`, all driven by the `I18N` table at the top of
`extract.js`. Adding a language means adding one key to `I18N` — no DOM changes. `zh` and `en` are
built in, picked from `navigator.language`.

> **Threads:** after installing, **reload the page once** before exporting. The network hook can only
> capture requests made after it was installed, and the current page's `TweetDetail` has already been
> sent. If nothing was captured the exporter falls back to scraping the DOM and tells you so.

### Grok Markdown: turn a thread into an article

Plenty of authors publish a long piece as a chain of replies to themselves: tip 1, tip 2, tip 3…
Open that post, right-click the red PDF icon and pick **Grok Markdown (AI rewrite)**. The extension
hands the whole self-thread to Grok on x.com (your own logged-in account, in a background tab), and
Grok rewrites it into one clean Markdown article: a title, a one-line summary, one heading per point,
links and images kept. The `.md` file lands in your downloads, usually in under a minute.

![Right-click the PDF icon, pick Grok Markdown, and the thread comes back as a clean .md article](docs/shot_grok.png)

- The item only appears on a post's own page, and only when the author continued the post in their own replies
- Uses Grok's **Expert** mode when your account has it, otherwise whatever mode is available
- Only the thread's text is sent, and only to X's own Grok; the conversation shows up in your Grok history
- The plain **Markdown** item in the same menu is the no-AI export

How it works: `grok.js` runs on `x.com/i/grok` and drives Grok's own input box; the answer is read
from the `add_response.json` stream that `net-hook.js` already intercepts (with a DOM fallback). The
background worker polls the Grok tab, and the job is kept in `storage.session` so a recycled service
worker picks the poll back up instead of leaving a finished answer uncollected.

### Load from source (developers)

Only needed if you want to change the code or run a version that isn't in the store yet:
`chrome://extensions` → turn on **Developer mode** → **Load unpacked** → pick this repository folder.
For normal use, install from the store above — it updates automatically.

### Markdown → Article editor (the writing direction)

Open `x.com/compose/articles/edit/<id>` and you'll see an extra icon **to the left of Preview**. Paste
your Markdown into the body as-is and click the icon: the body turns into X's own Article formatting
in place (headings / lists / quotes / code blocks / bold and italic / links). There's no confirmation
dialog — if it goes wrong, press **Ctrl+Z**; it uses Draft's own edit history.

![The Article editor toolbar with the red Markdown import icon to the left of Preview](docs/shot_md_toolbar.png)

The key is **not touching the DOM**. X's Article editor is Draft.js: the real document is an in-memory
ContentState and the contenteditable is only a projection — injected innerHTML is ignored, and the next
setState wipes it anyway. Draft's only public rich-text entry point is `paste`: its `editOnPaste` reads
`text/html` from `clipboardData` and parses it with its own converter. So the approach is Markdown →
HTML that Draft understands → a synthetic `ClipboardEvent('paste')`.

Three findings from testing (Draft 0.11.7, see the comments in `compose.js`):

- **Hook the component instance, not the props.** React double-buffers two fiber trees, and the
  `__reactFiber$` on a DOM node often points at the stale one, so `memoizedProps.editorState` lags a
  step behind — in practice it read as an empty document while the instance's `_latestEditorState` was
  current. Read state from that, and write back through the instance's `update()`, the same path Draft
  uses internally.
- **Nested lists only work as "child list is a sibling of the parent list"**:
  `<ul><li>B</li><ul><li>B1</li></ul></ul>` gives `depth:1`; `<li>B<ul>…</ul></li>` collapses into a
  single `BB1` block (and the latter is what most Markdown libraries emit by default).
- **DOM selection means nothing to Draft**: neither `Range` nor `execCommand('selectAll')` moves it (the
  latter even returns true); a paste still lands at the cursor Draft remembers. Replacing the whole
  body requires stretching its selection with `forceSelection`.

After one conversion the body contains no markup anymore; clicking again would re-flow the whole
article as plain paragraphs — so if there's no Markdown syntax the icon does nothing, which also guards
against accidental clicks.

The icon sits left of Preview. **Preview is not a `<button>` and has no `role="button"` — it's an
`<a role="link">`.** The first version only searched buttons and role=button, got zero hits on the real
editor, and the icon fell back to floating in the bottom-right. So now it matches on text, not tags:
find the leaf whose entire text is "Preview", climb to the outermost ancestor whose text is still just
that, and insert before it.

Whatever an X Article can't hold is downgraded — plain beats lost text: tables → plain paragraphs like
`A | 1`, horizontal rules → a `— — —` line, images → links (X images must go through its own upload).

**X doesn't support code blocks**: tested on the real editor, ```` ``` ```` fences and inline `` ` `` both
land as plain paragraphs / plain text (the text survives, only the styling is lost). Its toolbar has no
code button either. What passed on the real editor: three heading levels, ordered and unordered lists
(including nested depth), quotes, bold, italic and links.

### Userscript / bookmarklet

Drag `x-article-exporter.user.js` into Tampermonkey, or paste the whole of `bookmarklet.txt` into a
bookmark's URL field.

Neither form has an **extension backend**, so there's no `chrome.debugger`: a PDF request times out
after 2.5s and falls back to downloading self-contained HTML. The bookmarklet also injects too late to
install the network hook, so threads can only use the DOM fallback.

## Three hard constraints (all learned the hard way — read before changing the code)

### 1. Pre-scrolling must stop at the bottom of the article, never the bottom of the document

An X Article's body is only non-virtualized **within the article's own scroll range**. As soon as you
scroll into the replies, the whole body is unloaded from the DOM:

| Metric | Scrolled to document bottom | Scrolled to article bottom |
|---|---|---|
| Body blocks | **0** (body unloaded, root article element replaced) | **136** |
| Body images | 0, mixed with images from replies | **11** |
| Scroll end | 27354 | **17529** |

So every round, `loadArticle()` recomputes `articleRoot().getBoundingClientRect().bottom + scrollY` as
the upper bound and keeps half a screen of margin. Before the body renders that height is 0, which
would make the bound negative — it has to wait for `.longform-unstyled` to appear first.

### 2. Every selector must be scoped to the body's root article

Selecting across the whole document pulls reply images in as body illustrations; combined with the
unloading in constraint 1, you get a mixed-up mess.

### 2b. Cover de-duplication can't use string `includes`

URLs in `parts` have already been through `esc()` (`&` → `&amp;`), so an `includes` check with the raw,
unescaped URL **never matches** and the cover gets inserted twice. One real article had a cover URL
containing `&` and the old logic reproduced the duplicate 100% of the time. De-duplication now uses a
`Set` of raw URLs collected during extraction.

### 3. Don't call print() in the page

A newly opened same-origin tab **shares the renderer process** with x.com, so a large document's print
preview freezes the original page's main thread too (the page locks up, the wheel stops responding).
So now:

- PDF rendering happens in an **extension page** (`chrome-extension://` origin, separate process)
- The document handed to it stays lightweight with remote image links (tens of KB); images are only
  inlined when exporting HTML

## Two extraction paths

### X Article — scrape the DOM

Anchored on `.longform-unstyled` / `.longform-header-one` / `.longform-header-two` /
`.longform-blockquote` / `.longform-ordered-list-item` / `[data-testid="tweetPhoto"]`, rebuilt as
`<p> <h2> <h3> <blockquote> <ol> <figure>`.

Bold has to come from computed style: **X doesn't use `<strong>`; bold is a CSS class**. And
`font-weight` inherits, so it must be compared with the parent, or you extract nested duplicate
`<strong>` tags.

### Threads — intercept GraphQL

Threads are a virtualized list in the DOM, so scraping the DOM always loses content. `net-hook.js` runs
at `document_start`, installs fetch / XHR interception before X's own requests go out, caches the
`TweetDetail` responses, and export rebuilds the thread straight from the structured JSON. This path
also recovers information the DOM has already lost:

| Field | What you get |
|---|---|
| `note_tweet.richtext.richtext_tags` | Exact bold / italic ranges in long posts |
| `note_tweet.media.inline_media` | Images embedded mid-text and where they go |
| `entities.urls[].expanded_url` | Real link targets (the DOM only has t.co short links) |
| `extended_entities.media` | Original media, independent of display size |

**Every index is a code point, not a UTF-16 code unit.**
With CJK text and emoji, slicing by `string.length` shifts everything — you have to `Array.from()`
first. `node test-renderRich.js` covers this with 11 unit tests.

## How the PDF is generated

`chrome.debugger` + `Page.printToPDF`. It's the **only** way for an extension to get a real PDF with
vector text, no print dialog and no visible tab.

The cost: Chrome shows a **"X Article → PDF" started debugging this browser** banner. Chrome forces it
and it can't be removed. While the banner is up, DevTools can't be used (and vice versa).

Flow: the content script hands lightweight HTML to the background → the background opens an extension
page in a **background tab** to render it → waits for images to decode → `printToPDF` → the page
triggers the download with `<a download>` → the tab closes. Your current page is never switched away.

If attaching the debugger fails (DevTools already open, enterprise policy, etc.), **no print dialog
appears** — it downloads self-contained HTML instead and tells you why. Nothing in the chain interrupts
what you're doing.

## Other known pitfalls

- **Keep the page in the foreground.** Chrome doesn't load lazy images in background tabs (in testing,
  23 scroll rounds kept the image count at 0; forcing a repaint jumped it to 14), so the script waits
  for you to switch back.
- **Turn `&amp;` back into `&` before fetching images.** Fetching an HTML-escaped URL makes X's image
  host return an empty response **without an error**, and the inlined result is a pile of blank images.
- **Injection must be in the MAIN world.** The cached GraphQL data hangs off the page's `window`, which
  the isolated world can't read; image fetches also need the page's own x.com origin for CORS.
  The MAIN world has no `chrome.*` API, so `bridge.js` (isolated world) relays via postMessage.
- X can change at any time. On the Article path, what breaks is the handful of classes in `ART_SEL`;
  on the thread path, the GraphQL field structure (`collectFromGQL` / `userOf` already handle both the
  old and new schema).

## Not yet verified

The following only has code and reasoning behind it and **has not been run end to end**:

- The full `chrome.debugger` + `printToPDF` chain (needs the extension installed and run for real)
- How the PDF actually paginates (orphaned headings at page ends, large images split across pages)
- The thread GraphQL path end to end (the render functions have unit tests, but haven't run on a real
  long thread)

Verified on real pages: body extraction and boundaries (136 blocks / 11 images), bold extraction, image
inlining (11/11, 0 failures), rendering, and mounting the action-bar button.

## Privacy

**No data is collected.** No account, no server, no analytics, no remote code. Every export and archive
happens locally in your own browser. What the `debugger` / `downloads` / `storage` permissions are each
used for is explained in [PRIVACY.md](PRIVACY.md).

## Files

| File | Purpose |
|---|---|
| `extract.js` | Extraction, rendering, button mounting; defines `window.__XAE_RUN(mode)` (MAIN world) |
| `compose.js` | Markdown → Draft.js paste injection, the icon on the Article editor (MAIN world) |
| `md2html.js` | Markdown → HTML that Draft understands, used by compose.js |
| `net-hook.js` | GraphQL network interception (MAIN world, `document_start`) |
| `bridge.js` | Isolated-world relay, MAIN ↔ background (MAIN has no `chrome.*`) |
| `background.js` | `chrome.debugger` + `printToPDF` |
| `viewer.html` / `viewer.js` | Extension page that renders the document in a separate process and triggers the download |
| `extract.min.js` / `bookmarklet.txt` | Bookmarklet |
| `x-article-exporter.user.js` | Userscript |
| `test-renderRich.js` | Rich-text rendering unit tests, `node test-renderRich.js` |

## Related projects

The "synthesize a paste and ride the editor's own upload pipeline" idea was later split out into two
standalone, zero-permission extensions:

- [csdn-md-importer](https://github.com/wangsen2020/csdn-md-importer) — one-click Markdown into the CSDN editor, images uploaded automatically
- [zhihu-md-importer](https://github.com/wangsen2020/zhihu-md-importer) — one-click Markdown into Zhihu columns, images uploaded automatically

This repository focuses on doing one thing well for X: exporting Articles and threads, and importing
Markdown into X's Article editor.

## License

MIT
