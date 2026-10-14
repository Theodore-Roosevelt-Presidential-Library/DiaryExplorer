#!/usr/bin/env python3
"""Rebuild data/diary.json and TRANSCRIPTION_REVIEW.md from transcription/pages/*.json.

Run from the repo root after editing any page record:
    python3 tools/build.py
No third-party packages needed. Page images in pages/ are already built.
"""
import json, os, glob, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
IIIF = 'https://tile.loc.gov/image-services/iiif/service:mss:mss38299a:mss38299a_807:01:'
NOT_IN_BOOK = {'0002', '0409'}   # photos of the wallet binding opened flat

crop = json.load(open(P('transcription', 'cropbox.json')))
dims = json.load(open(P('transcription', 'dims.json')))
pages = []
for f in sorted(glob.glob(P('transcription', 'pages', '*.json'))):
    r = json.load(open(f))
    s = r['seq']
    W, H = dims[s]
    r['image'] = {'w': W, 'h': H, 'crop': crop[s], 'local': f'pages/{s}.jpg', 'iiif': IIIF + s}
    r['in_book'] = s not in NOT_IN_BOOK
    pages.append(r)
assert len(pages) == 410, len(pages)

meta = {
    'title': "Theodore Roosevelt's 1884 Diary",
    'loc_item': 'https://www.loc.gov/item/mss382990724/',
    'loc_title': 'Theodore Roosevelt Papers: Series 8: Personal Diaries, 1878-1884; Vol. 7, 1884, Feb. 14-Dec. 17',
    'credit': 'Library of Congress, Manuscript Division, Theodore Roosevelt Papers',
    'generated': datetime.date.today().isoformat(),
}
json.dump({'meta': meta, 'pages': pages}, open(P('data', 'diary.json'), 'w'), ensure_ascii=False, separators=(',', ':'))

# ---- human review file ----
def label(r):
    if r['date']:
        d = datetime.date.fromisoformat(r['date'])
        return d.strftime('%A, %B ') + str(d.day) + ', 1884'
    return (r['printed'].get('title') or r['page_type']).strip()

out = ['# Transcription review — Theodore Roosevelt diary, 1884',
       '',
       'Check each reading against the scan (link under each page). Mark corrections directly in this file or in the page record',
       '`transcription/pages/<seq>.json`, then set that record\'s `review.status` to `"reviewed"`.',
       '',
       'Conventions: `word[?]` uncertain · `[illegible]` · `~~struck~~` · `^inserted above line^` · spelling kept exactly as written.',
       '']
written = [r for r in pages if r['handwriting']]
flagged = [(r, b) for r in written for b in r['handwriting'] if b['confidence'] != 'high']
out += [f'**{len(written)} pages with handwriting** · {sum(1 for r in written if r["has_tr_writing"])} attributed to TR · {len(flagged)} blocks flagged medium/low', '',
        '## Flagged for a closer look', '']
for r, b in flagged:
    out.append(f'- **{r["seq"]} · {label(r)}** — {b["kind"]}, {b["confidence"]}: {b.get("note") or ""}')
out += ['', '## Every page with writing', '']
for r in written:
    out.append(f'### {r["seq"]} · {label(r)}')
    out.append(f'Scan: {IIIF}{r["seq"]}/full/pct:50/0/default.jpg  ·  side: {r["side"]}  ·  review: {r["review"]["status"]}')
    out.append('')
    for b in r['handwriting']:
        out.append(f'*{b["kind"]} · {b["position"]} · {b["medium"]} · hand: {b["hand"]} · confidence: {b["confidence"]}*')
        out.append('')
        out.append('```')
        if b.get('rows'):
            if b.get('columns'): out.append(' | '.join(b['columns']))
            for row in b['rows']: out.append(' | '.join(row))
        else:
            out += b['lines']
        out.append('```')
        if b.get('note'): out.append(f'> {b["note"]}')
        out.append('')
    if r['marks']:
        out.append('Not TR: ' + '; '.join(f'{m["kind"]}' + (f' "{m["value"]}"' if m.get('value') else '') for m in r['marks']))
        out.append('')
    if r.get('transcriber_notes'):
        out.append(f'Transcriber notes: {r["transcriber_notes"]}')
        out.append('')
pn = [(r['seq'], m['value']) for r in pages for m in r['marks'] if m['kind'] == 'archival-page-number']
out += ['## Archival page numbers found (later pencil, not TR)', '', ', '.join(f'{s} → {v}' for s, v in pn), '']
open(P('TRANSCRIPTION_REVIEW.md'), 'w').write('\n'.join(out))
print(f'built {len(pages)} pages; {len(written)} with handwriting; {len(flagged)} flagged blocks')
