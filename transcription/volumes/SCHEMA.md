# Transcribing Theodore Roosevelt's diaries, 1878–1883 (LOC microfilm)

Working folder: (working folder)

These are black-and-white microfilm frames of T.R.'s pocket diaries (Library of Congress, Theodore Roosevelt Papers, Series 8). Each frame is usually an open two-page spread, which has already been split into halves:
- `halves/<frame>_L.jpg` (left page), `halves/<frame>_R.jpg` (right page). A frame that is not a spread (cover, title card, single page) has only `halves/<frame>_S.jpg`.
- The whole frame is at `full/<frame>.jpg` if you need to check the split.
`<frame>` looks like `429_0530` (microfilm reel 429, image 530).

## Budget: be efficient
Open each half image ONCE with the Read tool and transcribe from it. Re-open or crop/zoom (e.g. with python PIL into your own temp file in `vols/tmp_<your batch>/`) only for a genuinely unclear word. Do not write long notes. Keep your final reply under 80 words.

## Rules (non-negotiable — a presidential library will publish this)
- Verbatim: TR's spelling, capitalization, punctuation, abbreviations and line breaks exactly as written. Never correct or modernize.
- One string per physical line. Uncertain word: `word[?]`. Unreadable: `[illegible]` or `[illegible: 3 words]`. Struck through: `~~text~~`. Inserted above line: `^text^`. Superscripts inline ("29th").
- Microfilm shows heavy show-through from the other side of the leaf (faint, mirrored, grey). Ignore it. Transcribe only writing that reads normally on THIS page. If you cannot tell, say so in the block note.
- Printed matter (date headings, calendars, ruled headings) is NOT handwriting — it goes in `printed`.
- Later archival marks (pencil folio numbers, stamps, the microfilm title card, reel targets) go in `marks`, never in handwriting.
- Never use outside knowledge to fill a word you cannot read.

## Output: one JSON file per half, written to `vrec/<frame>_<L|R|S>.json`
```
{
  "frame": "429_0530", "half": "L",           // L, R or S
  "volume": "1878",                            // given in your batch list
  "page_type": "diary-day" | "cover" | "endpaper" | "title" | "printed-matter" | "memoranda" | "cash-account" | "microfilm-target" | "other",
  "dates": ["1878-04-14"],                     // every printed date that appears on this page (ISO), [] if none
  "printed": {
    "headers": ["April, Sunday 14. 1878."],    // each printed date heading verbatim, in page order
    "title": null,                             // printed title for non-diary pages, e.g. "Memoranda", "Cash Account—May."
    "description": null                        // short description of other printed matter (calendar, almanac), or null
  },
  "handwriting": [
    {
      "id": "b1",
      "date": "1878-04-14",                     // which printed day this block is written under; null if not a dated area
      "kind": "entry" | "tally" | "list" | "table" | "address" | "inscription" | "heading" | "marginalia" | "other",
      "position": "body" | "top" | "bottom" | "left-margin" | "right-margin" | "over-printed-title",
      "medium": "ink" | "pencil" | "unknown",
      "hand": "TR" | "uncertain",
      "lines": ["Had a debating", "..."],
      "rows": null, "columns": null,            // only for tables
      "confidence": "high" | "medium" | "low",
      "note": null
    }
  ],
  "marks": [ {"kind": "archival-page-number" | "catalog-mark" | "microfilm-target" | "show-through" | "stain" | "tear" | "ink-blot" | "other", "value": null, "position": "body", "note": null} ],
  "mentions": { "people": [{"as_written": "Alice", "identified_as": null, "certain": false}], "places": [], "dates": [] },
  "has_tr_writing": true,
  "confidence": "high" | "medium" | "low",
  "transcriber_notes": "",
  "review": {"status": "unreviewed", "reviewer": null, "date": null}
}
```
- Use the year of your volume for ISO dates. If a page holds several days (some of these diaries print 2–3 days per page), list them all in `dates`/`headers` and give each block its own `date`.
- A blank day still gets a record: `handwriting: []`, `has_tr_writing: false`.
- `mentions`: only names as written on the page; leave `identified_as` null unless the page itself says who it is. Keep it short.
- Writing that runs on from the previous day/page continues under the block's `date` of the day it started; say "continues from previous page" in the note.

If the split looks wrong (a page cut in half), still transcribe what you see and put "BAD SPLIT" in transcriber_notes.

Final reply (under 80 words): pages done, how many with writing, count of low-confidence blocks, any BAD SPLIT frames.
