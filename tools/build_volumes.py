#!/usr/bin/env python3
"""Build data/vol-<year>.json and data/volumes.json for the 1878–1883 diaries
from transcription/volumes/<year>/<frame>_<half>.json (LOC microfilm, Series 8).

Run from the repo root:  python3 tools/build_volumes.py
"""
import json, os, glob, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
V = P('transcription', 'volumes')

# Frames that re-photograph pages already filmed: kept in the data, left out of the book.
REFILMS = {'429_0502', '429_0542', '429_0546', '429_0582', '429_0602', '429_0603', '429_0604',
           '429_0605', '429_0606', '430_0065', '430_0066', '430_0067', '430_0068', '430_0069',
           '430_0088', '430_0103', '430_0122'}

VOLUMES = [
    # id, LOC item, LOC title suffix, blurb (draft — verify before approval)
    ('1878', 'mss382990718', 'Vol. 1, 1878, Jan. 1-Dec. 31',
     'A Harvard student’s year: classes, clubs and hunting, the death of his father in February, and the autumn he first met Alice Hathaway Lee.'),
    ('1879', 'mss382990719', 'Vol. 2, 1879, Jan. 1-Dec. 31',
     'His last full year at Harvard, filled with study, sport and the courtship of Alice Lee.'),
    ('1880', 'mss382990720', 'Vol. 3, 1880, Jan. 1-Dec. 31',
     'Engaged to Alice in January, graduated from Harvard in June, married on his twenty-second birthday, October 27.'),
    ('1881', 'mss382990721', 'Vol. 4, 1881, Jan. 1-Dec. 26',
     'Law school, a long wedding trip to Europe, and his first election, to the New York State Assembly.'),
    ('1882', 'mss382990722', 'Vol. 5, 1882, Jan. 1-Feb. 15',
     'Six weeks in Albany at the start of his first term in the Assembly.'),
    ('1883', 'mss382990723', 'Vol. 6, 1883, Jan. 1-Oct. 4',
     'Brief January entries. Later in the book, over the printed August–October dates, Roosevelt kept the log of his 1884 hunting trip to the Bighorn Mountains.'),
]

RESOURCE = {'1878': 'mss38299.mss38299-429_0476_0670', '1879': 'mss38299.mss38299-429_0671_0825', '1880': 'mss38299.mss38299-429_0826_1024', '1881': 'mss38299.mss38299-430_0001_0080', '1882': 'mss38299.mss38299-430_0081_0107', '1883': 'mss38299.mss38299-430_0108_0149'}
splits = json.load(open(os.path.join(V, 'splits.json')))
order = [l.split() for l in open(os.path.join(V, 'frames.txt')) if l.strip()]

meta = []
for vid, item, suffix, blurb in VOLUMES:
    pages = []
    for y, reel, img in order:
        if y != vid:
            continue
        fr = f'{reel}_{img}'
        sp = splits[fr]
        halves = ['S'] if sp['split'] is None else ['L', 'R']
        for h in halves:
            f = os.path.join(V, vid, f'{fr}_{h}.json')
            r = json.load(open(f))
            W, H = sp['w'], sp['h']
            if h == 'L':
                region = [0, 0, sp['split'], H]
            elif h == 'R':
                region = [sp['split'], 0, W - sp['split'], H]
            else:
                region = [0, 0, W, H]
            r['seq'] = f'{fr}_{h}'
            r['side'] = {'L': 'left', 'R': 'right', 'S': 'single'}[h]
            r['date'] = (r.get('dates') or [None])[0]
            r['image'] = {
                'w': W, 'h': H, 'crop': region,
                'iiif': f'https://tile.loc.gov/image-services/iiif/service:mss:mss38299:mss38299_{reel}:{img}',
                'microfilm': True,
            }
            r['in_book'] = fr not in REFILMS
            r['loc_sp'] = int(img) - int(order[[o[0] for o in order].index(vid)][2]) + 1  # image number within the LOC item
            pages.append(r)
    json.dump({'volume': vid, 'pages': pages}, open(P('data', f'vol-{vid}.json'), 'w'),
              ensure_ascii=False, separators=(',', ':'))
    written = [p for p in pages if p['handwriting'] and p['in_book']]
    dates = sorted({d for p in pages for d in (p.get('dates') or []) if d and d.startswith(vid)})
    meta.append({'id': vid, 'title': f'{vid} diary', 'loc_item': f'https://www.loc.gov/item/{item}/',
                 'loc_title': f'Theodore Roosevelt Papers: Series 8: Personal Diaries, 1878-1884; {suffix}',
                 'source': 'microfilm', 'blurb': blurb, 'blurb_status': 'draft',
                 'pages': len(pages), 'written_pages': len(written),
                 'first_date': dates[0] if dates else None, 'last_date': dates[-1] if dates else None,
                 'file': f'data/vol-{vid}.json', 'loc_resource': f'https://www.loc.gov/resource/{RESOURCE[vid]}/'})
    print(vid, len(pages), 'pages,', len(written), 'with writing')

meta.append({'id': '1884', 'title': '1884 diary', 'loc_item': 'https://www.loc.gov/item/mss382990724/',
             'loc_title': 'Theodore Roosevelt Papers: Series 8: Personal Diaries, 1878-1884; Vol. 7, 1884, Feb. 14-Dec. 17',
             'source': 'color', 'featured': True, 'loc_resource': 'https://www.loc.gov/resource/mss38299a.80701/',
             'blurb': 'The diary of February 14, 1884, and the year he went west to the Badlands. On view at the Library.',
             'blurb_status': 'draft', 'file': 'data/diary.json'})
json.dump({'generated': datetime.date.today().isoformat(), 'default': '1884', 'volumes': meta},
          open(P('data', 'volumes.json'), 'w'), ensure_ascii=False, indent=1)

# ---- review file for the earlier volumes ----
out = ['# Transcription review — Theodore Roosevelt diaries, 1878–1883 (LOC microfilm)', '',
       'Same conventions as the 1884 review. Records live in `transcription/volumes/<year>/<frame>_<L|R|S>.json`.', '']
for vid, *_ in VOLUMES:
    d = json.load(open(P('data', f'vol-{vid}.json')))
    flagged = [(p, b) for p in d['pages'] if p['in_book'] for b in p['handwriting'] if b['confidence'] != 'high']
    out += [f'## {vid}', '', f'{sum(1 for p in d["pages"] if p["handwriting"] and p["in_book"])} pages with writing · {len(flagged)} blocks flagged medium/low', '']
    for p, b in flagged:
        if b['confidence'] == 'low':
            out.append(f'- **{p["seq"]}** ({", ".join(p.get("dates") or []) or p["page_type"]}) — low: {b.get("note") or ""}')
    out.append('')
    for p in d['pages']:
        if not (p['handwriting'] and p['in_book']):
            continue
        out.append(f'### {p["seq"]} · {", ".join(p.get("printed", {}).get("headers") or []) or p["page_type"]}')
        out.append(f'Scan: {p["image"]["iiif"]}/{",".join(map(str, p["image"]["crop"]))}/full/0/default.jpg')
        out.append('')
        for b in p['handwriting']:
            out.append(f'*{b.get("date") or ""} · {b["kind"]} · {b["position"]} · {b["medium"]} · hand {b["hand"]} · {b["confidence"]}*')
            out.append('```')
            if b.get('rows'):
                if b.get('columns'): out.append(' | '.join(map(str, b['columns'])))
                out += [' | '.join(map(str, r)) for r in b['rows']]
            else:
                out += b['lines']
            out.append('```')
            if b.get('note'): out.append(f'> {b["note"]}')
            out.append('')
open(P('TRANSCRIPTION_REVIEW_1878-1883.md'), 'w').write('\n'.join(out))
print('review file written')
