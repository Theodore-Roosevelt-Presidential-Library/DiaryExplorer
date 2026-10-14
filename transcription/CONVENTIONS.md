# Transcribing Theodore Roosevelt's 1884 diary (Library of Congress, mss382990724)

Context: a pocket "Excelsior Diary" for 1884, one printed day per page. Scans are single pages, numbered 0001–0410 ("seq").
- 0001–0021: covers, endpapers, printed calendar/postage/almanac pages.
- 0022 = January 1, 1884 ... 0387 = December 31, 1884 (one day per page, leap year).
- 0388–0410: printed Memoranda / Name and Address / Cash Account pages, back endpapers, back cover.
TR's written entries are mostly: Feb 14–17 (death of his wife Alice and mother), June (Dakota ranch, hunting), Nov–Dec (Dakota, hunting), plus account notes at the back.

Directory: (working folder)
- Full-resolution images (written pages): crops/<seq>.jpg   (~1100px wide)
- Half-resolution images (all pages): scans/<seq>.jpg  (~870px wide)
Use crops/ when it exists for your page, otherwise scans/.

## Your job
For EACH seq in your batch, open the image with the Read tool and look at it yourself. Do not guess from neighbouring pages or outside knowledge. Then write one JSON file to trans/<seq>.json (use the Write tool) with exactly this shape:

{
  "seq": "0068",
  "type": "entry" | "blank-day" | "cover" | "endpaper" | "printed" | "accounts" | "memoranda" | "other",
  "printed_header": "February, Saturday 16. 1884.",   // the printed heading text, or "" if none
  "has_writing": true,
  "text": "line 1\nline 2\n...",                      // TR's handwriting only; "" if none
  "notes": "short transcriber notes: pencil vs ink, things written in margins/bottom of page, damage, strike-throughs, uncertain readings and alternatives",
  "confidence": "high" | "medium" | "low"
}

Types: "entry" = a dated diary page with handwriting. "blank-day" = dated diary page with NO handwriting. "printed" = printed front matter (calendars, postage rates, etc.) with no handwriting. "accounts"/"memoranda" = back-matter pages (use these even if blank, and transcribe any writing). "cover"/"endpaper" for the binding and inside covers (transcribe any inscription, e.g. a signature).

## Transcription rules (non-negotiable — this will be published by a presidential library)
- Verbatim. Keep TR's spelling, abbreviations, capitalization, punctuation and line breaks exactly as written. Never correct, modernize, or "improve". If he wrote "christenned", transcribe "christenned".
- Preserve line breaks as they fall on the page ("\n").
- Superscripts (29th, 16th): write them inline as "29th".
- Uncertain word: give your best reading followed by [?], e.g. "Chimney[?]". Unreadable: [illegible] (or [illegible: 2 words]).
- Struck-through text: ~~text~~. Words inserted above the line: ^text^.
- Writing elsewhere on the page (bottom-of-page tallies like "3 sharptail grouse", margins): include it in "text" after a blank line, and say where it is in "notes".
- IGNORE bleed-through / show-through from the other side of the leaf. It appears faint and MIRRORED (reversed). Only transcribe writing that reads normally on this page. If unsure whether faint marks are real writing or bleed-through, zoom by reading the crops/ file, and say so in notes.
- Don't transcribe the printed header into "text"; put it in "printed_header".
- Be careful with numbers and proper names (people, places, animals). If a reading of a name is uncertain, mark [?].
- For blank pages, still look properly: faint pencil counts as writing.

When finished with every page in your batch, reply with a brief summary: count of pages by type, and a list of any pages with confidence "low" or "medium" and why. Do not paste the transcriptions back.
