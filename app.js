/* Theodore Roosevelt's diaries — page-curl explorer
   Featured: 1884 (data/diary.json, color scans self-hosted in pages/).
   Shelf: 1878–1883 (data/vol-<year>.json, LOC microfilm loaded from IIIF).
   data/volumes.json lists the shelf; data/curator-notes.json, data/config.json as before. */
(() => {
  'use strict';
  const qs = new URLSearchParams(location.search);
  const KIOSK = qs.has('kiosk');
  const INITIAL_HASH = location.hash.replace('#', '');
  const EMBED = qs.has('embed');
  if (KIOSK) document.body.classList.add('kiosk');
  if (EMBED) document.body.classList.add('embed');
  if (matchMedia('(hover: none)').matches) document.body.classList.add('touch');

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem('diary:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('diary:' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } }
  };

  let DATA, NOTES = {}, CFG = {};
  let VOLS = [], VOL = '1884';  // shelf + current volume id
  const VDATA = {};             // volume id -> {pages}
  let book = [];            // page records in book order (fillers keep left/right pages on the right side)
  let idxBySeq = {};        // seq -> book index
  let flip;                 // St.PageFlip instance
  let current = 0;
  let MINW = 160;

  const ZOOM_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5M11 8v6M8 11h6"/></svg>';
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  Promise.all([
    fetch('data/diary.json').then(r => r.json()),
    fetch('data/curator-notes.json').then(r => r.json()).catch(() => ({ notes: [] })),
    fetch('data/config.json').then(r => r.json()).catch(() => ({})),
    fetch('data/volumes.json').then(r => r.json()).catch(() => ({ volumes: [] }))
  ]).then(([d, n, c, v]) => {
    DATA = d; CFG = c;
    VOLS = (v.volumes || []).slice().sort((x, y) => x.id.localeCompare(y.id));
    if (!VOLS.length) VOLS = [{ id: '1884', featured: true, source: 'color' }];
    VDATA['1884'] = prep(d.pages, '1884');
    (n.notes || []).forEach(x => { if (x.status === 'approved' || CFG.showDrafts) NOTES[x.seq] = x; });
    init();
  });

  const writes = p => (p.handwriting || []).length > 0;
  const volMeta = id => VOLS.find(v => v.id === id) || {};
  function prep(pages, vid) {
    pages.forEach(p => {
      p._vol = vid; p._w = writes(p);
      if (!p.date && p.dates && p.dates.length) p.date = p.dates.find(d => d && d.startsWith(vid)) || p.dates[0];
    });
    return pages;
  }
  function loadVolData(vid) {
    if (VDATA[vid]) return Promise.resolve(VDATA[vid]);
    const m = volMeta(vid);
    return fetch(m.file || `data/vol-${vid}.json`).then(r => r.json()).then(d => (VDATA[vid] = prep(d.pages, vid)));
  }
  // order pages so left halves land on left pages and right halves on right pages
  function bookOrder(pages) {
    const out = [];
    const want = p => p.side === 'left' ? 1 : p.side === 'right' ? 0 : -1; // index parity: odd = left
    pages.filter(p => p.in_book).forEach(p => {
      const w = want(p);
      if (w >= 0 && out.length > 0 && out.length % 2 !== w) out.push({ seq: '_f' + out.length, filler: true, handwriting: [], page_type: 'filler', _vol: p._vol });
      out.push(p);
    });
    if (out.length % 2) out.push({ seq: '_f' + out.length, filler: true, handwriting: [], page_type: 'filler' });
    return out;
  }
  function imgURL(p) {
    if (p.filler) return '';
    if (p.image.local) return p.image.local;
    const [x, y, w, h] = p.image.crop;
    return `${p.image.iiif}/${x},${y},${w},${h}/,1000/0/default.jpg`;
  }

  /* ---------- formatting ---------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function inline(s) {
    let h = esc(s);
    h = h.replace(/\[illegible(?::\s*([^\]]+))?\]/g, (_, n) => `<span class="ill">[illegible${n ? ': ' + n : ''}]</span>`);
    h = h.replace(/~~(.+?)~~/g, '<del>$1</del>');
    h = h.replace(/\^(.+?)\^/g, '<ins>$1</ins>');
    h = h.replace(/(\S+?)\[\?\]/g, '<span class="unc">$1<sup>?</sup></span>');
    h = h.replace(/\[\?\]/g, '<span class="unc"><sup>?</sup></span>');
    return h;
  }
  const plain = s => String(s).replace(/~~.*?~~\s*/g, '').replace(/\^|\[\?\]/g, '');
  function fmtDate(iso) { const [y, m, d] = iso.split('-').map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; }
  function dateLabel(p) {
    if (p.filler) return '';
    const ds = (p.dates || []).filter(Boolean);
    if (ds.length > 1) {
      const [y1, m1, d1] = ds[0].split('-').map(Number); const [y2, m2, d2] = ds[ds.length - 1].split('-').map(Number);
      return m1 === m2 ? `${MONTHS[m1 - 1]} ${d1}–${d2}, ${y1}` : `${MONTHS[m1 - 1]} ${d1} – ${MONTHS[m2 - 1]} ${d2}, ${y2}`;
    }
    if (p.date) {
      const [y, m, d] = p.date.split('-').map(Number);
      const wd = p.printed && p.printed.header && p.printed.header.weekday ? p.printed.header.weekday + ', ' : '';
      return `${wd}${MONTHS[m - 1]} ${d}, ${y}`;
    }
    const t = { cover: 'Cover', endpaper: 'Endpaper', title: 'Title page', 'printed-matter': (p.printed && p.printed.title) ? titleCase(p.printed.title) : 'Printed page',
      memoranda: 'Memoranda', 'name-address': 'Names and addresses', 'cash-account': (p.printed && p.printed.title) ? titleCase(p.printed.title) : 'Cash account' }[p.page_type];
    return t || 'Page';
  }
  const titleCase = s => s.replace(/\.$/, '').toLowerCase().replace(/(^|[\s—-])(\w)/g, (m, a, b) => a + b.toUpperCase());
  const shortDate = p => {
    if (!p.date) return dateLabel(p);
    const ds = (p.dates || []).filter(Boolean);
    const one = iso => { const [, m, d] = iso.split('-').map(Number); return `${MONTHS[m - 1].slice(0, 3)} ${d}`; };
    if (ds.length > 1) return `${one(ds[0])}–${ds[ds.length - 1].slice(5, 7) === ds[0].slice(5, 7) ? +ds[ds.length - 1].slice(8) : one(ds[ds.length - 1])}`;
    return one(p.date);
  };
  const headerText = p => (p.printed && p.printed.header && p.printed.header.raw) || ((p.printed && p.printed.headers) || []).join(' · ') || (p.printed && p.printed.title) || dateLabel(p);

  /* ---------- book ---------- */
  function init() {
    if (CFG.showDrafts && CFG.draftBanner) { const b = $('#draftBanner'); b.textContent = CFG.draftBanner; b.hidden = false; }
    const binding = DATA.pages.find(p => p.seq === '0002');
    if (binding) $('#aboutBinding').src = binding.image.local;
    MINW = innerWidth < 760 ? 230 : 160;
    buildShelf();
    buildEntries();
    wire();
    addEventListener('resize', fitBook);
    addEventListener('hashchange', () => { const t = parseHash(location.hash); if (t) { $('#intro').hidden = true; openAt(t.vol, t.seq, true); } });
    $('#skipBlank').checked = store.get('skip', true);
    const t = parseHash('#' + INITIAL_HASH) || (qs.get('page') ? parseHash('#' + qs.get('page')) : null);
    if (t) { $('#intro').hidden = true; openAt(t.vol, t.seq, false); }
    else loadVolume('1884');
  }

  // '#0066' = 1884 page; '#1880' = a volume; '#1880/429_0851_R' = a page in a volume
  function parseHash(h) {
    h = (h || '').replace('#', '');
    if (!h) return null;
    let m = h.match(/^(\d{4})\/(.+)$/);
    if (m) return { vol: m[1], seq: m[2] };
    if (/^\d{4}$/.test(h)) return VOLS.some(v => v.id === h && v.id !== '1884') && +h > 410 ? { vol: h, seq: null } : { vol: '1884', seq: h };
    return null;
  }
  function openAt(vid, seq, animate) {
    if (vid === VOL && flip) { if (seq && idxBySeq[seq] !== undefined && !visible().includes(idxBySeq[seq])) go(idxBySeq[seq], animate); return; }
    loadVolume(vid, seq);
  }

  function loadVolume(vid, seq) {
    if (!volMeta(vid).id && vid !== '1884') vid = '1884';
    document.body.classList.add('loading-vol');
    return loadVolData(vid).then(pages => {
      VOL = vid;
      document.body.classList.toggle('microfilm', volMeta(vid).source === 'microfilm');
      book = bookOrder(pages);
      idxBySeq = {};
      book.forEach((p, i) => { idxBySeq[p.seq] = i; });
      loaded.clear();
      buildBook();
      buildTimeline();
      buildShelf();
      if (!$('#entries').hidden) drawEntries($('#search').value);
      const i = seq && idxBySeq[seq] !== undefined ? idxBySeq[seq] : 0;
      setTimeout(() => { if (i) { flip.turnToPage(i); current = i; } else current = 0; onTurn(); document.body.classList.remove('loading-vol'); }, 0);
    });
  }

  function buildBook() {
    if (flip) { try { flip.destroy(); } catch { } flip = null; }
    const wrap = $('#bookWrap');
    $$('#book', wrap).forEach(e => e.remove());
    const el = document.createElement('div'); el.id = 'book'; el.className = 'book'; wrap.appendChild(el);
    const mf = volMeta(VOL).source === 'microfilm';
    book.forEach((p, i) => {
      const d = document.createElement('div');
      const isCover = i === 0 || i === book.length - 1;
      d.className = 'page ' + (i === 0 ? 'right' : (i % 2 ? 'left' : 'right')) + (isCover && !mf ? ' cover' : '') + (mf ? ' mf' : '') + (p.filler ? ' filler' : '');
      if (isCover) d.dataset.density = 'hard';
      d.innerHTML = p.filler ? '<div class="shade"></div>' : `<img class="pimg" data-seq="${p.seq}" alt="${esc(altText(p))}" draggable="false"><div class="shade"></div>`;
      el.appendChild(d);
    });
    const ratio = 1000 / 660;
    flip = new St.PageFlip(el, {
      width: 440, height: Math.round(440 * ratio),
      size: 'stretch', minWidth: MINW, maxWidth: 900, minHeight: 240, maxHeight: 1400,
      showCover: true, usePortrait: true, autoSize: true,
      maxShadowOpacity: 0.55, drawShadow: true, flippingTime: 850,
      mobileScrollSupport: false, swipeDistance: 24, showPageCorners: true,
      clickEventForward: true
    });
    flip.on('flip', e => { current = e.data; onTurn(); });
    flip.on('changeOrientation', () => { hydrate(); render(); });
    flip.on('init', () => { hydrate(); render(); });
    flip.loadFromHTML($$('.page', el));
    fitBook();
  }

  /* ---------- shelf of diaries ---------- */
  function buildShelf() {
    const s = $('#shelf'); if (!s) return;
    s.innerHTML = '<span class="shelf-label">The diaries</span>' + VOLS.map(v => `<button class="vol${v.id === VOL ? ' on' : ''}${v.featured ? ' featured' : ''}" data-vol="${v.id}" aria-pressed="${v.id === VOL}" title="${esc(v.blurb || '')}">${v.id}${v.featured ? '<span class="vol-tag">On view</span>' : ''}</button>`).join('');
  }

  // keep the book fully visible inside the stage at the page aspect ratio
  function fitBook() {
    const wrap = $('#bookWrap');
    const cs = getComputedStyle(wrap);
    const W = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const H = wrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const pr = 660 / 1000;
    const portrait = W < MINW * 2;
    const spreadAR = portrait ? pr : pr * 2;
    let w = W, h = W / spreadAR;
    if (h > H) { h = H; w = H * spreadAR; }
    const el = $('#book');
    el.style.width = Math.floor(w) + 'px';
    el.style.height = Math.floor(h) + 'px';
    if (flip && flip.update) { try { flip.update(); } catch { } }
  }

  function altText(p) {
    const parts = [dateLabel(p)];
    if (p._w) parts.push('Handwritten: ' + p.handwriting.map(b => plain((b.lines || []).join(' '))).join(' ').slice(0, 220));
    else if (p.page_type === 'diary-day') parts.push('No writing on this day');
    return parts.join('. ');
  }

  // load images only near the current spread (portrait mode clones pages, so match by data-seq)
  const loaded = new Set();
  function hydrate() {
    for (let i = Math.max(0, current - 4); i <= Math.min(book.length - 1, current + 6); i++) {
      const p = book[i];
      if (p.filler || loaded.has(p.seq)) continue;
      $$(`img[data-seq="${p.seq}"]`).forEach(img => { img.src = imgURL(p); });
      loaded.add(p.seq);
    }
  }

  function visible() {
    const portrait = flip.getOrientation && flip.getOrientation() === 'portrait';
    if (portrait) return [current];
    if (current === 0) return [0];
    if (current === book.length - 1 && book.length % 2 === 0) return [current];
    const L = current % 2 ? current : current - 1;
    return [L, L + 1].filter(i => i < book.length);
  }

  function go(i, animate = true) {
    i = Math.max(0, Math.min(book.length - 1, i));
    if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) flip.flip(i);
    else { flip.turnToPage(i); current = i; onTurn(); }
  }

  function nextWritten(after) { for (let i = after + 1; i < book.length; i++) if (book[i]._w) return i; return book.length - 1; }
  function prevWritten(before) { for (let i = before - 1; i >= 0; i--) if (book[i]._w) return i; return 0; }

  function step(dir) {
    const v = visible();
    const skip = $('#skipBlank').checked;
    if (!skip) { dir > 0 ? flip.flipNext() : flip.flipPrev(); return; }
    if (dir > 0) go(nextWritten(v[v.length - 1]));
    else go(prevWritten(v[0]));
  }

  function onTurn() {
    hydrate();
    render();
    const vis = visible().map(i => book[i]).filter(p => !p.filler);
    const first = vis[0];
    if (!KIOSK) {
      const h = current === 0 ? (VOL === '1884' ? '' : '#' + VOL) : (first ? (VOL === '1884' ? '#' + first.seq : `#${VOL}/${first.seq}`) : '');
      history.replaceState(null, '', h || location.pathname + location.search);
    }
  }

  /* ---------- side panel ---------- */
  function render() {
    if (!flip) return;
    const v = visible();
    const pages = v.map(i => book[i]).filter(p => !p.filler);
    if (!pages.length) pages.push(book[v[0]]);
    // label
    const labels = pages.map(p => p.date ? shortDate(p) : dateLabel(p));
    const dated = pages.find(p => p.date);
    const yr = dated ? ', ' + dated.date.slice(0, 4) : '';
    $('#where').textContent = labels.length > 1 && labels[0] !== labels[1] ? `${labels[0]} – ${labels[1]}${yr}` : labels[0] + yr;
    $('#btnPrev').disabled = v[0] === 0;
    $('#btnNext').disabled = v[v.length - 1] === book.length - 1;

    const m = volMeta(VOL);
    const intro = m.source === 'microfilm' ? `<div class="vol-note"><strong>${esc(VOL)} diary.</strong> ${esc(m.blurb || '')}${m.blurb_status === 'draft' && CFG.showDrafts ? '<span class="badge">Draft</span>' : ''}<br><span class="mf-note">Black-and-white microfilm from the Library of Congress. The 1884 diary is the only one photographed in color.</span></div>` : '';
    $('#panelBody').innerHTML = intro + pages.map((p, k) => pageHTML(p, pages.length > 1 ? (k === 0 ? 'Left page' : 'Right page') : '')).join('');
    $('#panel').scrollTop = 0;

    // gap chip: a run of blank days
    const chip = $('#gapChip');
    if (pages.every(p => !p._w && p.page_type === 'diary-day')) {
      const last = v[v.length - 1];
      const n = nextWritten(last);
      const np = book[n];
      chip.hidden = false;
      $('#gapText').textContent = np && np.date ? `No entries until ${shortDate(np)}` : 'No more dated entries';
      $('#gapSkip').onclick = () => go(n);
    } else chip.hidden = true;

    // timeline marker
    $$('.tl-day.cur').forEach(e => e.classList.remove('cur'));
    pages.forEach(p => (p.dates && p.dates.length ? p.dates : [p.date]).forEach(d => { if (d) { const t = $(`.tl-day[data-date="${d}"]`); t && t.classList.add('cur'); } }));
  }

  function pageHTML(p, sideLabel) {
    const head = headerText(p);
    const multi = (p.dates || []).filter(Boolean).length > 1;
    let h = `<section class="pg"><div class="pg-head"><span class="printed">${esc(head)}</span><span class="pg-tools"><span class="side-tag">${esc(sideLabel)}</span><button class="zoom-link" data-zoom="${p.seq}" aria-label="Zoom into ${esc(dateLabel(p))}">${ZOOM_SVG}Zoom</button></span></div>`;
    const note = NOTES[p.seq];
    if (note) h += `<div class="curator"><h4>Curator's note${note.status !== 'approved' ? '<span class="badge">Draft</span>' : ''}</h4>${note.title ? `<h5>${esc(note.title)}</h5>` : ''}<p>${esc(note.body)}</p></div>`;

    if (p._w) {
      let lastDate = null;
      p.handwriting.forEach(b => {
        if (multi && b.date && b.date !== lastDate) { h += `<span class="day-label">${esc(fmtDate(b.date))}</span>`; lastDate = b.date; }
        const label = blockLabel(b);
        if (label) h += `<span class="block-label">${esc(label)}</span>`;
        if (b.rows && b.rows.length) {
          const cols = b.columns || [];
          h += `<table class="hw-table">${cols.some(Boolean) ? `<thead><tr>${cols.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead>` : ''}<tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
        } else {
          const lines = b.lines || [];
          const big = lines.length === 1 && lines[0].trim() === 'X';
          h += `<p class="hw${big ? ' big-x' : ''}">${lines.map(inline).join('<br>')}</p>`;
        }
      });
      const m = p.mentions || {};
      const chips = [...(m.people || []), ...(m.places || [])].map(x => x.as_written || '').filter(c => plain(c).replace(/\W/g, '').length > 2);
      if (chips.length) h += `<div class="chips">${[...new Set(chips)].map(c => `<span class="chip">${esc(plain(c))}</span>`).join('')}</div>`;
    } else if (p.page_type === 'diary-day') {
      h += `<p class="blank-note">No entry on this day.</p>`;
    } else if (p.printed && p.printed.description) {
      h += `<p class="blank-note">${esc(p.printed.description)}</p>`;
    } else {
      h += `<p class="blank-note">No writing on this page.</p>`;
    }
    h += metaHTML(p);
    return h + '</section>';
  }

  function blockLabel(b) {
    const pos = { bottom: 'at the foot of the page', top: 'at the top of the page', 'left-margin': 'in the margin', 'right-margin': 'in the margin', 'over-printed-title': 'written over the printed title' }[b.position] || '';
    const kind = { tally: 'Tally', table: 'Table', list: 'List', address: 'Address', inscription: 'Inscription', heading: 'Heading', marginalia: 'Note', correction: 'Correction' }[b.kind];
    let l = kind ? (pos ? `${kind} ${pos}` : kind) : (pos && b.position !== 'body' ? `Written ${pos}` : '');
    if (b.hand === 'uncertain') l = (l ? l + ' · ' : '') + 'hand uncertain';
    if (b.medium === 'pencil' && b.kind !== 'entry') l = (l ? l + ' · ' : '') + 'pencil';
    return l;
  }

  function metaHTML(p) {
    const items = [];
    const marks = p.marks || [];
    const archival = marks.filter(m => ['archival-page-number', 'catalog-mark', 'library-stamp'].includes(m.kind));
    const physical = marks.filter(m => !archival.includes(m));
    const kindName = { 'archival-page-number': 'Archive page number', 'catalog-mark': 'Catalog mark', 'library-stamp': 'Library stamp', 'show-through': 'Show-through', offset: 'Offset', stain: 'Stain', tear: 'Tear', 'ink-blot': 'Ink blot', crease: 'Crease', debris: 'Debris', other: 'Other' };
    archival.forEach(m => items.push(`<li><span class="k">${kindName[m.kind]}${m.value ? ': ' + esc(m.value) : ''}</span> <span>(later pencil, not Roosevelt's)</span></li>`));
    physical.forEach(m => items.push(`<li><span class="k">${kindName[m.kind] || m.kind}</span>${m.note ? ' — ' + esc(m.note) : ''}</li>`));
    if (p._w) items.unshift(`<li><span class="k">Written in</span> ${[...new Set(p.handwriting.map(b => b.medium).filter(x => x !== 'unknown'))].join(' and ') || 'unknown'}</li>`);
    if (p._vol === '1884' || !p._vol) items.push(`<li><span class="k">Scan</span> LOC image ${p.seq} of 410 · <a href="https://www.loc.gov/resource/mss38299a.80701/?sp=${parseInt(p.seq, 10)}" target="_blank" rel="noopener" class="loc-link">view at LOC</a></li>`);
    else items.push(`<li><span class="k">Scan</span> LOC microfilm frame ${esc(p.frame || '')}${p.half && p.half !== 'S' ? ' (' + (p.half === 'L' ? 'left' : 'right') + ' page)' : ''} · <a href="${esc(volMeta(p._vol).loc_resource || volMeta(p._vol).loc_item || '#')}?sp=${p.loc_sp || 1}" target="_blank" rel="noopener" class="loc-link">view at LOC</a></li>`);
    if (CFG.showDrafts && p.transcriber_notes) items.push(`<li><span class="k">Transcriber's notes</span><div class="notes-raw">${esc(p.transcriber_notes)}</div></li>`);
    return `<details class="page-meta"><summary>About this page</summary><ul class="meta-list">${items.join('')}</ul></details>`;
  }

  /* ---------- timeline ---------- */
  function buildTimeline() {
    const tl = $('#timeline');
    const year = VOL;
    const pageFor = {}, written = {};
    book.forEach(p => {
      if (p.filler) return;
      const ds = (p.dates && p.dates.length ? p.dates : [p.date]).filter(d => d && d.startsWith(year));
      ds.forEach(d => { if (!pageFor[d]) pageFor[d] = p.seq; });
      (p.handwriting || []).forEach(b => { const d = b.date || (ds.length === 1 ? ds[0] : null); if (d) written[d] = true; });
    });
    const months = MONTHS.map((m, mi) => {
      const n = new Date(+year, mi + 1, 0).getDate();
      const days = [];
      for (let d = 1; d <= n; d++) { const iso = `${year}-${String(mi + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; days.push(iso); }
      return { m, days };
    });
    tl.innerHTML = months.map(mo => `<div class="tl-month"><span class="m">${mo.m.slice(0, 3)}</span>${mo.days.map(d => {
      const has = pageFor[d]; const w = written[d];
      return has ? `<button class="tl-day${w ? ' w' : ''}" data-seq="${pageFor[d]}" data-date="${d}" aria-label="${esc(fmtDate(d))}${w ? ', has an entry' : ''}" title="${esc(fmtDate(d))}${w ? ' · entry' : ''}"></button>` : `<span class="tl-day none" data-date="${d}"></span>`;
    }).join('')}</div>`).join('');
    if (!tl.dataset.wired) { tl.dataset.wired = 1; tl.addEventListener('click', e => { const b = e.target.closest('button.tl-day'); if (b) { closeAll(); go(idxBySeq[b.dataset.seq]); } }); }
  }

  /* ---------- entries + search ---------- */
  let allLoaded = false;
  function entryText(p) { return p.handwriting.map(b => plain((b.lines || (b.rows || []).map(r => r.join(' '))).join(' '))).join(' · '); }
  function itemHTML(p, q) {
    let s = esc(entryText(p).slice(0, 200));
    if (q) s = s.replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
    const d = p.date ? shortDate(p) + ', ' + p.date.slice(0, 4) : dateLabel(p) + (p._vol && p._vol !== '1884' ? ' (' + p._vol + ')' : '');
    return `<li><button data-vol="${p._vol}" data-seq="${p.seq}"><span class="d">${esc(d)}</span><span class="s">${s}</span></button></li>`;
  }
  function drawEntries(q) {
    const list = $('#entryList');
    const qq = (q || '').trim().toLowerCase();
    $('#entriesTitle').textContent = qq ? 'Search all the diaries' : `Every page with writing, ${VOL}`;
    const hl = !qq && VOL === '1884' ? (CFG.highlights || []).map(s => VDATA['1884'].find(p => p.seq === s)).filter(Boolean) : [];
    $('#highlights').innerHTML = hl.length ? `<h3 class="block-label">Key passages</h3><ol class="entry-list">${hl.map(p => itemHTML(p)).join('')}</ol><h3 class="block-label" style="margin-top:16px">All pages</h3>` : '';
    const pool = qq ? Object.keys(VDATA).sort().flatMap(v => VDATA[v]) : (VDATA[VOL] || []);
    const items = pool.filter(p => p._w && p.in_book && (!qq || entryText(p).toLowerCase().includes(qq)));
    const shown = items.slice(0, 300);
    list.innerHTML = shown.length ? shown.map(p => itemHTML(p, qq)).join('') + (items.length > shown.length ? `<li class="blank-note" style="padding:12px 4px">${items.length - shown.length} more — refine the search.</li>` : '') : `<li class="blank-note" style="padding:12px 4px">${qq && !allLoaded ? 'Searching…' : 'No matches.'}</li>`;
  }
  function buildEntries() {
    $('#search').addEventListener('input', e => {
      const q = e.target.value;
      if (q.trim() && !allLoaded) { drawEntries(q); Promise.all(VOLS.map(v => loadVolData(v.id).catch(() => []))).then(() => { allLoaded = true; drawEntries($('#search').value); }); }
      else drawEntries(q);
    });
    $('#entries').addEventListener('click', e => { const b = e.target.closest('button[data-seq]'); if (b) { closeAll(); $('#intro').hidden = true; openAt(b.dataset.vol || '1884', b.dataset.seq, true); } });
  }

  /* ---------- zoom ---------- */
  let viewer, zoomSeq = null;
  function zoomStep(dir) {
    let j = idxBySeq[zoomSeq]; if (j === undefined) return;
    do { j += dir; } while (j > 0 && j < book.length - 1 && book[j].filler);
    j = Math.max(0, Math.min(book.length - 1, j));
    if (!book[j].filler && book[j].seq !== zoomSeq) openZoom(book[j].seq);
  }
  function closeZoom() {
    if ($('#zoom').hidden) return;
    $('#zoom').hidden = true;
    const i = idxBySeq[zoomSeq];
    if (i !== undefined && !visible().includes(i)) { flip.turnToPage(i); current = i; onTurn(); }
  }
  function openZoom(seq) {
    zoomSeq = seq;
    const p = book.find(x => x.seq === seq) || DATA.pages.find(x => x.seq === seq);
    const zi = idxBySeq[seq];
    $('#zoomPrev').disabled = !zi; $('#zoomNext').disabled = zi === book.length - 1;
    const z = $('#zoom'); z.hidden = false;
    $('#zoomLabel').textContent = dateLabel(p);
    if (viewer) viewer.destroy();
    viewer = OpenSeadragon({
      element: $('#osd'), showNavigationControl: false, prefixUrl: '',
      tileSources: p.image.iiif + '/info.json', gestureSettingsMouse: { clickToZoom: true },
      visibilityRatio: 0.6, minZoomImageRatio: 0.6, maxZoomPixelRatio: 2.5, crossOriginPolicy: 'Anonymous'
    });
    viewer.addOnceHandler('open', () => {
      const [x, y, w, h] = p.image.crop;
      const r = viewer.viewport.imageToViewportRectangle(x, y, w, h);
      viewer.viewport.fitBounds(r, true);
    });
    viewer.addOnceHandler('open-failed', () => { viewer.open({ type: 'image', url: imgURL(p) }); });
  }
  $('#zoomIn').onclick = () => viewer && viewer.viewport.zoomBy(1.5);
  $('#zoomPrev').onclick = () => zoomStep(-1);
  $('#zoomNext').onclick = () => zoomStep(1);
  $('#zoomOut').onclick = () => viewer && viewer.viewport.zoomBy(1 / 1.5);

  /* ---------- full screen ---------- */
  // In an iframe: go true full screen when the embed allows it; otherwise break out to the full site in a new tab.
  // Standalone: toggle browser full screen.
  function wireFullscreen() {
    const btn = $('#btnFull');
    const inFrame = (() => { try { return window.self !== window.top; } catch { return true; } })();
    const canFS = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
    const isFS = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (!canFS && !inFrame) { btn.hidden = true; return; }
    const sync = () => {
      const on = isFS();
      document.body.classList.toggle('is-fs', on);
      btn.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
      btn.title = on ? 'Exit full screen' : 'Full screen';
      $('.fs-label', btn).textContent = on ? 'Exit' : 'Full screen';
      setTimeout(fitBook, 60);
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    btn.onclick = () => {
      if (isFS()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      if (canFS) {
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        Promise.resolve(req.call(el)).catch(() => inFrame && breakOut());
      } else breakOut();
    };
    function breakOut() {
      window.open(location.origin + location.pathname + location.hash, '_blank', 'noopener');
    }
  }

  /* ---------- wiring ---------- */
  function closeAll() { closeZoom(); $$('.overlay').forEach(o => { if (o.id !== 'intro') o.hidden = true; }); }
  function wire() {
    $('#btnPrev').onclick = () => step(-1);
    $('#btnNext').onclick = () => step(1);
    $('#btnZoom').onclick = () => { const v = visible().map(i => book[i]).filter(p => !p.filler); const p = v.find(x => x._w) || v[v.length - 1]; if (p) openZoom(p.seq); };
    $('#shelf').addEventListener('click', e => { const b = e.target.closest('[data-vol]'); if (b && b.dataset.vol !== VOL) { $('#intro').hidden = true; closeAll(); loadVolume(b.dataset.vol); } });
    $('#skipBlank').onchange = e => store.set('skip', e.target.checked);
    $('#btnEntries').onclick = () => { drawEntries($('#search').value); $('#entries').hidden = false; if (!KIOSK) $('#search').focus(); };
    $('#btnAbout').onclick = () => { $('#about').hidden = false; };
    wireFullscreen();
    $('#introFeb14').onclick = () => { $('#intro').hidden = true; if (VOL === '1884') go(idxBySeq[CFG.startSeq || '0066']); else loadVolume('1884', CFG.startSeq || '0066'); };
    $('#introShelf') && ($('#introShelf').onclick = () => { $('#intro').hidden = true; loadVolume('1878'); });
    $('#introCover').onclick = () => { $('#intro').hidden = true; };
    $$('[data-close]').forEach(b => b.onclick = closeAll);
    $$('.overlay.sheet').forEach(o => o.addEventListener('click', e => { if (e.target === o) closeAll(); }));
    document.addEventListener('click', e => { const z = e.target.closest('[data-zoom]'); if (z) { e.stopPropagation(); openZoom(z.dataset.zoom); } }, true);
    addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeAll(); return; }
      if (!$('#zoom').hidden) { if (e.key === 'ArrowRight') zoomStep(1); if (e.key === 'ArrowLeft') zoomStep(-1); return; }
      if (!$('#intro').hidden || $$('.overlay.sheet').some(o => !o.hidden) || !$('#zoom').hidden) return;
      if (e.target.matches('input')) return;
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    });
    if (KIOSK) {
      let t;
      const reset = () => { clearTimeout(t); t = setTimeout(() => { closeAll(); $('#intro').hidden = false; if (VOL !== '1884') loadVolume('1884'); else { flip.turnToPage(0); current = 0; onTurn(); } }, (CFG.kioskIdleSeconds || 120) * 1000); };
      ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, reset, { passive: true }));
      reset();
      $$('a').forEach(a => a.removeAttribute('href'));
    }
  }
})();
