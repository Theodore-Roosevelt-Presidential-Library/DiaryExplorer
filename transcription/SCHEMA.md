# Pass 2 — structured page records for TR's 1884 diary

Read INSTRUCTIONS.md in the same folder first: every transcription rule there still applies (verbatim, [?], [illegible], ~~struck~~, ^inserted^, ignore show-through, never correct TR's spelling).

Folder: (working folder)
- Pass-1 record for each page: trans/<seq>.json (a starting point — RE-CHECK it against the image; fix anything wrong)
- Images: crops/<seq>.jpg (full res, when present) else scans/<seq>.jpg. To check small marks at full resolution:
  curl -sS --http1.1 -o crops/<seq>.jpg "https://tile.loc.gov/image-services/iiif/service:mss:mss38299a:mss38299a_807:01:<seq>/full/pct:100/0/default.jpg"
- Write the new record to: v2/<seq>.json

Facts: odd seq = left-hand page (verso), even seq = right-hand page (recto). 0022 = Jan 1 1884 … 0387 = Dec 31 1884.

The point of pass 2: separate WHO/WHAT produced each mark on the page. TR's handwriting, the printed diary, and later archival/library marks must never be mixed together.

## Record shape (write valid JSON, exactly these keys)
{
  "seq": "0068",
  "side": "right",                       // odd=left, even=right
  "page_type": "diary-day" | "cover" | "endpaper" | "title" | "printed-matter" | "memoranda" | "name-address" | "cash-account" | "other",
  "date": "1884-02-16" | null,           // only for diary-day pages

  "printed": {                           // what the 1884 printer put on the page
    "header": {"raw": "February, Saturday 16. 1884.", "month": "February", "weekday": "Saturday", "day": 16, "year": 1884} | null,
    "title": "Cash Account—January." | null,   // printed page title for non-diary pages (Memoranda, Name and Address, Calendar for 1884, Rates of Postage …)
    "ruling": "lined" | "cash-columns" | "none" | "other",
    "description": "short description of other printed matter (calendar grid, almanac illustration, postage tables) or null"
  },

  "handwriting": [                       // TR's writing (or any period writing) — empty [] if none
    {
      "id": "b1",
      "kind": "entry" | "tally" | "list" | "table" | "address" | "inscription" | "heading" | "marginalia" | "correction" | "other",
      "position": "body" | "top" | "bottom" | "left-margin" | "right-margin" | "over-printed-title",
      "medium": "ink" | "pencil" | "unknown",
      "hand": "TR" | "uncertain",        // "TR" unless there is a reason to doubt
      "lines": ["line exactly as written", "..."],            // verbatim, one string per physical line, inline markup allowed
      "rows": [["col1","col2"], ...] | null,                  // ONLY for kind=table/tally laid out in columns: cells verbatim; else null
      "columns": ["header1","header2"] | null,                // column headings for tables, verbatim, else null
      "confidence": "high" | "medium" | "low",
      "note": "anything specific to this block, or null"
    }
  ],

  "marks": [                             // NOT TR: later additions and physical features
    {
      "kind": "archival-page-number" | "catalog-mark" | "library-stamp" | "show-through" | "offset" | "stain" | "tear" | "ink-blot" | "crease" | "debris" | "other",
      "value": "20" | null,              // the text of a page number / catalog mark, if any
      "position": "bottom-left" | "bottom-right" | "top-left" | "top-right" | "top" | "body" | "margin",
      "note": "e.g. 'mirrored text from Feb 14 on reverse of leaf' or null"
    }
  ],

  "mentions": {                          // only things TR actually wrote on this page; empty arrays if none
    "people":  [{"as_written": "Seawall", "identified_as": "William Wingate Sewall", "certain": false}],
    "places":  [{"as_written": "Chimney Butte Ranche", "identified_as": "Chimney Butte (Maltese Cross) Ranch", "certain": false}],
    "animals": [{"as_written": "whitetail buck", "count": 1, "taken": true}],
    "dates":   [{"as_written": "Feb 14th", "iso": "1884-02-14"}]
  },
  // "identified_as" is optional — only fill it if you are confident from the page itself or very well-established fact; otherwise omit it. "certain" is always false unless the page states it outright.

  "has_tr_writing": true,
  "confidence": "high" | "medium" | "low",   // lowest confidence of any handwriting block
  "transcriber_notes": "free-text notes for the human reviewer",
  "review": {"status": "unreviewed", "reviewer": null, "date": null}
}

## Rules for separating things
- The printed date line is "printed.header", never handwriting.
- Pencil numerals in page corners added later by an archive (page/folio numbers) → marks, kind "archival-page-number". Other modern pencil/catalog notations (e.g. on endpapers, "[ 7 ]") → "catalog-mark". If you genuinely can't tell whether something is TR's or later, put it in handwriting with hand="uncertain" and explain.
- Bottom-of-page game counts (e.g. "5 sharptail grouse") → their own handwriting block, kind "tally", position "bottom".
- Words written over a printed title (e.g. "Photographs" over "Cash Account") → handwriting block kind "heading", position "over-printed-title"; the printed title still goes in printed.title, and note it was struck.
- Show-through / offset → marks only (one mark per page is enough, describe the source page if known). Note: on a LEFT page, writing from earlier right pages can show through un-mirrored; on a RIGHT page, writing from later pages can show through un-mirrored. Text that duplicates another page's entry is show-through, not writing.
- Blank diary days: handwriting [] and has_tr_writing false; still record marks (page numbers, stains, show-through).
- Seq 0375 (Dec 19) has already been determined to be show-through of Dec 17 (0373) — keep it as a blank day with a show-through mark.

When done, reply with a brief summary: counts by page_type, how many pages have TR writing, any archival page numbers found (seq → value), any change you made to a pass-1 transcription (seq + what changed), and any low/medium confidence blocks. Do not paste records back.
