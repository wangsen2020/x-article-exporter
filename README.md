<p align="center">
  <b>English</b> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt-BR.md">Português (Brasil)</a>
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/akmedeebhjkchcpocceffimhpmfjimhn">
    <img src="docs/readme_hero.jpg" alt="X Article to PDF Chrome extension: save X (Twitter) Articles and threads as searchable PDF">
  </a>
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/akmedeebhjkchcpocceffimhpmfjimhn"><img src="https://img.shields.io/badge/Chrome%20Web%20Store-Add%20to%20Chrome-2563eb?style=for-the-badge&amp;logo=googlechrome&amp;logoColor=white" alt="Add to Chrome — Chrome Web Store"></a>
</p>

<p align="center">
  <b><a href="https://chromewebstore.google.com/detail/akmedeebhjkchcpocceffimhpmfjimhn">Install from the Chrome Web Store</a></b><br>
  Free · no clone, no build, no developer mode · auto-updates · works in Edge too<br>
  🌐 <a href="https://xexport.goodexts.com">Website, guides and FAQ: xexport.goodexts.com</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-38bdf8?style=flat-square&amp;logo=googlechrome&amp;logoColor=white" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Browser-Chrome%20%26%20Edge-60a5fa?style=flat-square&amp;logo=googlechrome&amp;logoColor=white" alt="Chrome and Edge">
  <img src="https://img.shields.io/badge/License-MIT-94a3b8?style=flat-square" alt="MIT License">
</p>

# XExport (X Article to PDF) — Save Twitter Threads & Articles to PDF, Google Docs & Markdown

**XExport** (**X Article to PDF**) is a free, open-source Chrome extension that saves X (Twitter) **Articles** and
**threads** as real PDFs — selectable, searchable text and full-resolution images — as well as
**Google Docs**, **Google Drive (PDF)**, Markdown, and self-contained HTML in one click. No print
dialog, no copy-pasting, no account required.

It also gives you a direct **X (Twitter) Google Docs integration** (creating editable narrow-margin
Google Docs with auto-fitted embedded images), can turn a long self-thread into one clean Markdown
article using X's own Grok, and pastes Markdown back into X's Article editor with formatting intact.

## Features

![X Article to PDF feature overview: capture, export, offline archive, Markdown import](docs/features.en.svg)

- **X Article / Twitter thread → PDF**: vector text you can search and copy, images at original resolution
- **Save X posts & threads → Google Docs / Google Drive**: 1-click upload via on-demand `drive.file` consent, narrow `36pt` margins, `720px` auto-fitted images, and quick-open links in the toast and Archive
- **Twitter thread → Markdown**: plain Markdown export, or an AI rewrite into an article with **Grok Markdown**
- **Self-contained HTML**: every image inlined, opens offline even if the original post is deleted
- **Local archive**: optional on-device library of everything you exported (with 1-click upload to Google Docs)
- **Markdown → X Article editor**: paste a Markdown draft and convert it to X's native formatting
- **Built-in interactive visual guide**: click **Guide** in the top-right corner of the extension popup for annotated diagrams in 7 languages
- **Private**: no server, no analytics; everything runs in your browser (Google Drive upload talks directly from your browser to Google only when clicked)

## How to use

1. Install it from the **[Chrome Web Store](https://chromewebstore.google.com/detail/akmedeebhjkchcpocceffimhpmfjimhn)** (Edge can install it from there too)
2. Open any X Article, or a post the author continued as a thread
3. Click the red **PDF** icon in the post's action bar, next to bookmark and share

![The red PDF export icon in an X post's action bar, next to bookmark and share](docs/shot_pdf_button.png)

- **Left-click** = export PDF (generated in the background, lands in your downloads)
- **Right-click** = format menu: `PDF` / `Markdown` / `HTML (self-contained)` / `Grok Markdown` / `↗ Google Docs` / `↗ Google Drive (PDF)` / `Archive…` / `Visual Guide…`
- Click the extension's toolbar icon to open the compact multi-format popup (with a **Guide** button in the top-right corner)

> **Threads:** after installing, **reload the page once** before exporting. The extension reads the
> thread from X's own network responses, and the current page's responses arrived before it was
> installed. If nothing was captured it falls back to reading the page and tells you so.

### Save X Posts & Threads to Google Docs or Google Drive

Right-click the PDF icon and pick **↗ Google Docs** or **↗ Google Drive (PDF)** (or choose it from
the toolbar popup):

- **On-demand authorization only**: local exports never ask for Google sign-in. Only when you click a
  cloud option does Chrome prompt once for Google's non-sensitive `drive.file` permission, restricted
  to the `X Article Exporter` folder it creates in your Drive.
- **Ready-to-read Google Docs layout**: exports directly to an editable Google Doc with narrow `36pt`
  margins, preserved headings/quotes/links, and embedded images auto-fitted to the `720px` content width.
- **Instant & persistent links**: click **Open Google Doc ↗** in the top toast when done, or reopen
  and back-upload past snapshots anytime from the extension's Archive page.

Read the step-by-step walkthrough: [How to Save X (Twitter) Posts, Threads & Articles to Google Docs](https://xexport.goodexts.com/blog/save-x-post-to-google-docs).

### Turn a Twitter thread into a Markdown article with Grok

Plenty of authors publish a long piece as a chain of replies to themselves: tip 1, tip 2, tip 3…
Open that post, right-click the red PDF icon and pick **Grok Markdown (AI rewrite)**. The extension
hands the whole self-thread to Grok on x.com (your own logged-in account, in a background tab), and
Grok rewrites it into one clean Markdown article: a title, a one-line summary, one heading per point,
links and images kept. The `.md` file lands in your downloads, usually in under a minute — ready for
Obsidian, Notion or any Markdown editor.

![Right-click the PDF icon, pick Grok Markdown, and the thread comes back as a clean .md article](docs/shot_grok.png)

- The item only appears on a post's own page, and only when the author continued the post in their own replies
- Uses Grok's **Expert** mode when your account has it, otherwise whatever mode is available
- Only the thread's text is sent, and only to X's own Grok; the conversation shows up in your Grok history
- The plain **Markdown** item in the same menu is the no-AI export

### Paste Markdown into the X Article editor

Open `x.com/compose/articles/edit/<id>` and you'll see an extra icon **to the left of Preview**. Paste
your Markdown into the body as-is and click the icon: the body turns into X's own Article formatting
in place (headings / lists / quotes / bold and italic / links). There's no confirmation dialog — if it
goes wrong, press **Ctrl+Z**; it uses the editor's own edit history.

![The X Article editor toolbar with the red Markdown import icon to the left of Preview](docs/shot_md_toolbar.png)

Whatever an X Article can't hold is downgraded rather than lost: tables → plain paragraphs like
`A | 1`, horizontal rules → a `— — —` line, images → links (X images must go through its own upload).
X Articles have no code formatting, so code blocks and inline code land as plain text.

### Userscript / bookmarklet

Drag `x-article-exporter.user.js` into Tampermonkey, or paste the whole of `bookmarklet.txt` into a
bookmark's URL field. Neither has the extension's background page, so they export self-contained HTML
instead of PDF, and the bookmarklet can only read threads from the page itself.

## FAQ

### How do I save an X (Twitter) Article as a PDF?

Install the extension, open the Article on x.com and click the red PDF icon in the post's action bar.
The PDF is generated in the background and saved to your downloads — no print dialog. The text stays
selectable and searchable, and images keep their original resolution.

### How do I save a Twitter thread as a PDF?

Open the first post of the thread (its own page, `x.com/<user>/status/<id>`), reload the page once
after installing, then click the PDF icon. The extension rebuilds the whole thread from X's own data,
so posts that the timeline has scrolled out of view are not lost.

### How do I save X posts or Twitter threads to Google Docs?

Open the X Article or thread, right-click the red PDF icon (or open the toolbar popup), and click
**Save to Google Docs**. The first time only, confirm Google's `drive.file` permission window; the
extension uploads directly from your browser and gives you a clickable **Open Google Doc ↗** link.

### How do I convert a Twitter thread to Markdown for Obsidian or Notion?

Right-click the PDF icon and pick **Markdown** for a direct export, or **Grok Markdown** to have Grok
rewrite the thread into a structured article with a title, summary and headings. Both save a `.md` file
you can drop into Obsidian, Notion, Logseq or any Markdown editor.

### Is it free? Does it collect my data?

It's free and open source (MIT). It collects nothing: no account, no server, no analytics, no remote
code. The only feature that sends content anywhere is Grok Markdown, which sends the thread's text to
X's own Grok in your own account. Details in [PRIVACY.md](PRIVACY.md).

### How is this different from Thread Reader App?

Thread Reader App is a web service: you reply to a thread with a bot mention and read the unrolled
version on its site. This extension works in your own browser, right on x.com: one click saves the
Article or thread as a PDF, Markdown or HTML file on your computer, and it also handles X Articles.

### Why does Chrome show "started debugging this browser"?

That's how the extension produces a real PDF without a print dialog: it uses Chrome's `debugger` API to
render the page to PDF in a background tab. Chrome always shows this banner while it runs; it closes
when the export finishes. If the debugger can't attach, you get a self-contained HTML file instead.

### Does it work in Microsoft Edge?

Yes. Edge can install extensions from the Chrome Web Store directly.

## Privacy

**No data is collected.** No account, no server, no analytics, no remote code. Every export and archive
happens locally in your own browser. What each permission is used for is explained in
[PRIVACY.md](PRIVACY.md).

On first install the extension opens a short welcome guide on the [website](https://xexport.goodexts.com).
On uninstall, Chrome opens a feedback page whose address carries only the extension version, browser
language and install date. Answering it is optional.

## For developers

Architecture, the traps behind the design, and how to load the extension from source are in
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). Unit tests: `node test-renderRich.js`.

## Related projects

The "synthesize a paste and ride the editor's own upload pipeline" idea was later split out into two
standalone, zero-permission extensions:

- [csdn-md-importer](https://github.com/wangsen2020/csdn-md-importer) — one-click Markdown into the CSDN editor, images uploaded automatically
- [zhihu-md-importer](https://github.com/wangsen2020/zhihu-md-importer) — one-click Markdown into Zhihu columns, images uploaded automatically

More extensions for X from [GoodExts](https://goodexts.com):

- [X Video Downloader](https://xdown.goodexts.com) — save videos, GIFs and photos from X in one click, with quality selection and a download history
- [X Blocker](https://xblocker.goodexts.com) — one-click block and keyword / regex batch blocking for spam accounts on X

## License

MIT
