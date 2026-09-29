# Developer notes

How X Article → PDF works inside, and the traps that shaped it. For what the extension does and how to
use it, see the [README](../README.md).

## Load from source

`chrome://extensions` → turn on **Developer mode** → **Load unpacked** → pick the repository folder.
Bump `version` in `manifest.json` on every change, so a reload visibly picks up the new build.

## Files

| File | Purpose |
|---|---|
| `extract.js` | Extraction, rendering, button mounting; defines `window.__XAE_RUN(mode)` (MAIN world) |
| `compose.js` | Markdown → Draft.js paste injection, the icon on the Article editor (MAIN world) |
| `md2html.js` | Markdown → HTML that Draft understands, used by compose.js |
| `net-hook.js` | GraphQL network interception (MAIN world, `document_start`) |
| `bridge.js` | Isolated-world relay, MAIN ↔ background (MAIN has no `chrome.*`) |
| `background.js` | `chrome.debugger` + `printToPDF`; runs the Grok Markdown job (opens the Grok tab, polls, downloads) |
| `grok.js` | Drives Grok's input on `x.com/i/grok` for Grok Markdown, picks Expert mode when available (MAIN world) |
| `viewer.html` / `viewer.js` | Extension page that renders the document in a separate process and triggers the download |
| `extract.min.js` / `bookmarklet.txt` | Bookmarklet |
| `x-article-exporter.user.js` | Userscript |
| `test-renderRich.js` | Rich-text rendering unit tests, `node test-renderRich.js` |

## The action-bar button

The button is icon-only, red, with no round background, matching X's native spec (24×24 viewBox,
18.75px, `fill` rather than `stroke`). Alignment gotcha: the action bar is `align-items:stretch` with
47px-tall siblings, so **giving the button a fixed height top-aligns it** and puts the icon about 7px
above the native ones; it has to use `align-self:stretch` instead.
The copy lives in the hover tooltip and `aria-label`, all driven by the `I18N` table at the top of
`extract.js`. Adding a language means adding one key to `I18N` — no DOM changes. `zh` and `en` are
built in, picked from `navigator.language`.

## Markdown → Article editor internals

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

## Grok Markdown internals

How it works: `grok.js` runs on `x.com/i/grok` and drives Grok's own input box; the answer is read
from the `add_response.json` stream that `net-hook.js` already intercepts (with a DOM fallback). The
background worker polls the Grok tab, and the job is kept in `storage.session` so a recycled service
worker picks the poll back up instead of leaving a finished answer uncollected.

The Grok tab is opened inactive, so its page timers are throttled; the waiting therefore happens in the
background worker, whose `tabs.sendMessage` poll every 3 s also drives `grok.js` one step per tick.
The Grok tab's `bridge.js` also sends `grokWake` whenever the status changes, which is what restarts the
poll after Chrome recycles the worker.

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

## Verification status

Verified on real pages: body extraction and boundaries (136 blocks / 11 images), bold extraction, image
inlining (11/11, 0 failures), rendering, mounting the action-bar button, the full `chrome.debugger` +
`printToPDF` chain (shipping in the Chrome Web Store since 2.x), the thread GraphQL path on real
self-threads, and Grok Markdown end to end (thread → Grok → downloaded `.md`).

Not systematically checked yet: how long PDFs paginate (orphaned headings at page ends, large images
split across pages).
