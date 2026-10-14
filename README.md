# DiaryExplorer

Turn the pages of Theodore Roosevelt's 1884 pocket diary (Library of Congress, Theodore Roosevelt Papers, Series 8, Vol. 7), with a page-by-page transcription.
Live at **https://diary.labs.trlibrary.com** (GitHub Pages, custom domain in `CNAME`).

## What's here

| Path | What it is |
|---|---|
| `index.html`, `app.css`, `app.js` | The explorer: page-curl book, transcription panel, 1884 timeline, entry search, deep zoom |
| `vendor/` | Third-party libraries kept in the repo so the site (and a future kiosk) has no CDN dependency: StPageFlip 2.0.7 (MIT) and OpenSeadragon 4.1.1 (BSD-3) |
| `pages/0001.jpg … 0410.jpg` | Every LOC scan cropped to the page edge, 1000 px tall |
| `transcription/pages/<seq>.json` | **Source of truth.** One structured record per scan (410) |
| `transcription/SCHEMA.md`, `CONVENTIONS.md` | Record format and transcription rules |
| `data/diary.json` | Built from the page records by `tools/build.py`. Don't edit by hand |
| `data/curator-notes.json` | Curator's notes, each `draft` or `approved` |
| `data/config.json` | Switches: `showDrafts`, `highlights` (key passages), `startSeq`, `kioskIdleSeconds` |
| `TRANSCRIPTION_REVIEW.md` | Human-readable review copy of every page with writing, flagged readings first |

## Page records

Each scan has one record, and every mark on the page is kept in the field for whoever made it:

- `printed`: what the 1884 printer put there (the dated header, page titles, ruling, calendars)
- `handwriting[]`: Roosevelt's writing, split into blocks (`entry`, `tally`, `table`, `list`, `address`, `inscription`, `heading`, …), each with position, ink or pencil, hand, confidence, and verbatim `lines` (or `rows`/`columns` for tables)
- `marks[]`: anything not by TR, such as later archival pencil page numbers, catalog marks, show-through, stains and tears
- `mentions`: people, places, animals and dates as written, with an optional `identified_as` (always `certain: false` unless the page says so)
- `review`: `{status, reviewer, date}`. Every record is currently `unreviewed`

Scans are numbered 0001–0410 (`seq`) to match LOC's image order. 0022 is January 1, 1884, and 0387 is December 31. Odd seq numbers are left-hand pages, even are right-hand. 0002 and 0409 are photos of the wallet binding opened flat. They appear in About, not in the book.

## Review workflow

1. Check readings in `TRANSCRIPTION_REVIEW.md` against the scans (links included).
2. Make corrections in `transcription/pages/<seq>.json` and set `review.status` to `"reviewed"`.
3. Run `python3 tools/build.py` to rebuild `data/diary.json` and the review file.
4. Approve curator's notes by setting `"status": "approved"` in `data/curator-notes.json`.
5. When review is done, set `"showDrafts": false` in `data/config.json`. That removes the review banner, transcriber's notes and draft curator's notes.
6. To feature key passages, list their seq numbers in `config.json` → `highlights` (e.g. `["0066","0068","0182"]`).

## Embedding and kiosk

- Website embed: `<iframe src="https://diary.labs.trlibrary.com/?embed" style="width:100%;height:860px;border:0" title="Theodore Roosevelt's 1884 diary"></iframe>`
- Open to a page: append `#0066` (any seq), or `?embed&page=0066`
- Kiosk: `?kiosk` gives larger touch targets, disables outbound links, and returns to the welcome screen after `kioskIdleSeconds` of inactivity

## Credits

Original diary and scans: Library of Congress, Manuscript Division, Theodore Roosevelt Papers, https://www.loc.gov/item/mss382990724/ (LOC: "No known restrictions on use or reproduction"). Transcription and site: Theodore Roosevelt Presidential Library.

Local preview: `python3 -m http.server` in the repo root, then open http://localhost:8000.
