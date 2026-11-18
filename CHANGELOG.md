# Changelog

## 2.8.1

- Added the official **XExport** brand identity (`short_name: "XExport"`, updated all Chrome Web Store locale titles and summaries, added `zh_CN` locale strings, and updated the popup, visual guide, archive header, and README docs).

## 2.8.0

- Added optional on-demand Google Docs (`↗ Google Docs`) and Google Drive PDF (`↗ Google Drive (PDF)`) integration across the post format menu, popup, and local archive cards.
- Formatted exported Google Docs with narrow `36pt` margins and auto-fitted image widths (`720px` content frame), clickable quick-open toast links, and persistent cloud history links in Options.
- Added on-demand OAuth2 authorization (`identity` + non-sensitive `drive.file` scope) with clear recovery guidance if Drive API is not enabled.
- Redesigned the toolbar popup with compact status controls, a top-right Guide button, and a built-in 7-language interactive visual tutorial (`guide.html`) featuring red-box & arrow callout diagrams across all 7 export/import workflows.

## 2.7.1

- Open a localized welcome guide on xexport.goodexts.com on first install.
- Register a localized uninstall feedback page. Its address carries only the version, browser
  language, install date (when known) and fixed attribution parameters; no user identifiers.
- No new permissions.

## 2.7.0

- Grok Markdown: rewrite a long thread into a Markdown article with X's own Grok.
