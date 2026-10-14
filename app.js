/* Theodore Roosevelt's 1884 Diary — page-curl explorer
   Data: data/diary.json (structured page records), data/curator-notes.json, data/config.json
   Images: pages/<seq>.jpg (cropped, self-hosted); deep zoom from LOC IIIF. */
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
  let book = [];            // page records in book order
  let idxBySeq = {};        // seq -> book index
  let flip;                 // St.PageFlip instance
  let current = 0;
  let MINW = 160;

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  Promise.all([
    fetch('data/diary.json').then(r => r.json()),
    fetch('data/curator-notes.json').then(r => r.json()).catch(() => ({ notes: [] })),
    fetch('data/config.json').then(r => r.json()).catch(() => ({}))
  ]).then(([d, n, c]) => {
    DATA = d; CFG = c;
    (n.notes || []).forEach(x => { if (x.status === 'approved' || CFG.showDrafts) NOTES[x.seq] = x; });
    book = d.pages.filter(p => p.in_book);
    book.forEach((p, i) => { idxBySeq[p.seq] = i; p._w = writes(p); });
    init();
  });

  const writes = p => (p.handwriting || []).length > 0;

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
  function dateLabel(p) {
    if (p.date) {
      const [y, m, d] = p.date.split('-').map(Number);
      const wd = p.printed && p.printed.header ? p.printed.header.weekday + ', ' : '';
      return `${wd}${MONTHS[m - 1]} ${d}, ${y}`;
    }
    const t = { cover: 'Cover', endpaper: 'Endpaper', title: 'Title page', 'printed-matter': (p.printed && p.printed.title) ? titleCase(p.printed.title) : 'Printed page',
      memoranda: 'Memoranda', 'name-address': 'Names and addresses', 'cash-account': (p.printed && p.printed.title) ? titleCase(p.printed.title) : 'Cash account' }[p.page_type];
    return t || 'Page';
  }
  const titleCase = s => s.replace(/\.$/, '').toLowerCase().replace(/(^|[\s—-])(\w)/g, (m, a, b) => a + b.toUpperCase());
  const shortDate = p => { if (!p.date) return dateLabel(p); const [, m, d] = p.date.split('-').map(Number); return `${MONTHS[m - 1].slice(0, 3)} ${d}`; };

  /* ---------- book ---------- */
  function init() {
    if (CFG.showDrafts && CFG.draftBanner) { const b = $('#draftBanner'); b.textContent = CFG.draftBanner; b.hidden = false; }
    const binding = DATA.pages.find(p => p.seq === '0002');
    if (binding) $('#aboutBinding').src = binding.image.local;

    const el = $('#book');
    book.forEach((p, i) => {
      const d = document.createElement('div');
      const isCover = i === 0 || i === book.length - 1;
      d.className = 'page ' + (i === 0 ? 'right' : (i % 2 ? 'left' : 'right')) + (isCover ? ' cover' : '');
      if (isCover) d.dataset.density = 'hard';
      d.innerHTML = `<img class="pimg" data-seq="${p.seq}" alt="${esc(altText(p))}" draggable="false"><div class="shade"></div>` +
        `<button class="zoom-btn" data-zoom="${p.seq}" aria-label="Zoom into ${esc(dateLabel(p))}"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5M11 8v6M8 11h6"/></svg></button>`;
      el.appendChild(d);
    });

    const ratio = 1000 / 660;
    MINW = innerWidth < 760 ? 230 : 160;
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
    addEventListener('resize', fitBook);
    addEventListener('hashchange', () => { const h = location.hash.replace('#', ''); if (idxBySeq[h] !== undefined && !visible().includes(idxBySeq[h])) { $('#intro').hidden = true; go(idxBySeq[h]); } });

    buildTimeline();
    buildEntries();
    wire();

    const startSeq = idxBySeq[INITIAL_HASH] !== undefined ? INITIAL_HASH : (idxBySeq[qs.get('page')] !== undefined ? qs.get('page') : null);
    if (startSeq) { $('#intro').hidden = true; setTimeout(() => go(idxBySeq[startSeq], false), 0); }
    else { current = 0; render(); }
    $('#skipBlank').checked = store.get('skip', true);
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
    for (let i = Math.max(0, current - 6); i <= Math.min(book.length - 1, current + 8); i++) {
      const p = book[i];
      if (loaded.has(p.seq)) continue;
      $$(`img[data-seq="${p.seq}"]`).forEach(img => { img.src = p.image.local; });
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
    const p = book[visible().slice(-1)[0]];
    if (!KIOSK) history.replaceState(null, '', current === 0 ? location.pathname + location.search : '#' + book[visible()[0]].seq);
    store.set('last', p.seq);
  }

  /* ---------- side panel ---------- */
  function render() {
    if (!flip) return;
    const v = visible();
    const pages = v.map(i => book[i]);
    // label
    const labels = pages.map(p => p.date ? shortDate(p) : dateLabel(p));
    const yr = pages.some(p => p.date) ? ', 1884' : '';
    $('#where').textContent = labels.length > 1 && labels[0] !== labels[1] ? `${labels[0]} – ${labels[1]}${yr}` : labels[0] + yr;
    $('#btnPrev').disabled = v[0] === 0;
    $('#btnNext').disabled = v[v.length - 1] === book.length - 1;

    $('#panelBody').innerHTML = pages.map((p, k) => pageHTML(p, pages.length > 1 ? (k === 0 ? 'Left page' : 'Right page') : '')).join('');
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
    pages.forEach(p => { if (p.date) { const t = $(`.tl-day[data-seq="${p.seq}"]`); t && t.classList.add('cur'); } });
  }

  function pageHTML(p, sideLabel) {
    const head = p.printed && p.printed.header ? p.printed.header.raw : (p.printed && p.printed.title) || dateLabel(p);
    let h = `<section class="pg"><div class="pg-head"><span class="printed">${esc(head)}</span><span class="side-tag">${esc(sideLabel)}</span></div>`;
    const note = NOTES[p.seq];
    if (note) h += `<div class="curator"><h4>Curator's note${note.status !== 'approved' ? '<span class="badge">Draft</span>' : ''}</h4>${note.title ? `<h5>${esc(note.title)}</h5>` : ''}<p>${esc(note.body)}</p></div>`;

    if (p._w) {
      p.handwriting.forEach(b => {
        const label = blockLabel(b);
        if (label) h += `<span class="block-label">${esc(label)}</span>`;
        if (b.rows && b.rows.length) {
          const cols = b.columns || [];
          h += `<table class="hw-table">${cols.some(Boolean) ? `<thead><tr>${cols.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead>` : ''}<tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
        } else {
          const big = b.lines.length === 1 && b.lines[0].trim() === 'X';
          h += `<p class="hw${big ? ' big-x' : ''}">${b.lines.map(inline).join('<br>')}</p>`;
        }
      });
      const m = p.mentions || {};
      const chips = [...(m.people || []), ...(m.places || [])].map(x => x.as_written).filter(c => plain(c).replace(/\W/g, '').length > 2);
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
    items.push(`<li><span class="k">Scan</span> LOC image ${p.seq} of 410 · <a href="https://www.loc.gov/item/mss382990724/" target="_blank" rel="noopener" class="loc-link">view at LOC</a></li>`);
    if (CFG.showDrafts && p.transcriber_notes) items.push(`<li><span class="k">Transcriber's notes</span><div class="notes-raw">${esc(p.transcriber_notes)}</div></li>`);
    return `<details class="page-meta"><summary>About this page</summary><ul class="meta-list">${items.join('')}</ul></details>`;
  }

  /* ---------- timeline ---------- */
  function buildTimeline() {
    const tl = $('#timeline');
    const months = MONTHS.map(m => ({ m, days: [] }));
    book.forEach(p => { if (p.date) months[+p.date.slice(5, 7) - 1].days.push(p); });
    tl.innerHTML = months.map(mo => `<div class="tl-month"><span class="m">${mo.m.slice(0, 3)}</span>${mo.days.map(p => `<button class="tl-day${p._w ? ' w' : ''}" data-seq="${p.seq}" aria-label="${esc(dateLabel(p))}${p._w ? ', has an entry' : ''}" title="${esc(shortDate(p))}${p._w ? ' · entry' : ''}"></button>`).join('')}</div>`).join('');
    tl.addEventListener('click', e => { const b = e.target.closest('.tl-day'); if (b) { closeAll(); go(idxBySeq[b.dataset.seq]); } });
  }

  /* ---------- entries + search ---------- */
  function buildEntries() {
    const list = $('#entryList');
    const written = book.filter(p => p._w);
    const hl = (CFG.highlights || []).map(s => book[idxBySeq[s]]).filter(Boolean);
    $('#highlights').innerHTML = hl.length ? `<h3 class="block-label">Key passages</h3><ol class="entry-list">${hl.map(itemHTML).join('')}</ol><h3 class="block-label" style="margin-top:16px">All pages</h3>` : '';
    function itemHTML(p, q) {
      const txt = p.handwriting.map(b => plain((b.lines || []).join(' '))).join(' · ');
      let s = esc(txt.slice(0, 200));
      if (q) s = s.replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
      return `<li><button data-seq="${p.seq}"><span class="d">${esc(p.date ? shortDate(p) + ', 1884' : dateLabel(p))}</span><span class="s">${s}</span></button></li>`;
    }
    const draw = q => {
      const qq = (q || '').trim().toLowerCase();
      const items = written.filter(p => !qq || p.handwriting.some(b => plain((b.lines || []).join(' ')).toLowerCase().includes(qq)));
      list.innerHTML = items.length ? items.map(p => itemHTML(p, qq)).join('') : `<li class="blank-note" style="padding:12px 4px">No matches.</li>`;
    };
    draw('');
    $('#search').addEventListener('input', e => draw(e.target.value));
    $('#entries').addEventListener('click', e => { const b = e.target.closest('button[data-seq]'); if (b) { closeAll(); go(idxBySeq[b.dataset.seq]); } });
  }

  /* ---------- zoom ---------- */
  let viewer;
  function openZoom(seq) {
    const p = DATA.pages.find(x => x.seq === seq);
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
    viewer.addOnceHandler('open-failed', () => { viewer.open({ type: 'image', url: p.image.local }); });
  }
  $('#zoomIn').onclick = () => viewer && viewer.viewport.zoomBy(1.5);
  $('#zoomOut').onclick = () => viewer && viewer.viewport.zoomBy(1 / 1.5);

  /* ---------- wiring ---------- */
  function closeAll() { $$('.overlay').forEach(o => { if (o.id !== 'intro') o.hidden = true; }); }
  function wire() {
    $('#btnPrev').onclick = () => step(-1);
    $('#btnNext').onclick = () => step(1);
    $('#skipBlank').onchange = e => store.set('skip', e.target.checked);
    $('#btnEntries').onclick = () => { $('#entries').hidden = false; if (!KIOSK) $('#search').focus(); };
    $('#btnAbout').onclick = () => { $('#about').hidden = false; };
    $('#introFeb14').onclick = () => { $('#intro').hidden = true; go(idxBySeq[CFG.startSeq || '0066']); };
    $('#introCover').onclick = () => { $('#intro').hidden = true; };
    $$('[data-close]').forEach(b => b.onclick = closeAll);
    $$('.overlay.sheet').forEach(o => o.addEventListener('click', e => { if (e.target === o) closeAll(); }));
    document.addEventListener('click', e => { const z = e.target.closest('[data-zoom]'); if (z) { e.stopPropagation(); openZoom(z.dataset.zoom); } }, true);
    addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeAll(); return; }
      if (!$('#intro').hidden || $$('.overlay.sheet').some(o => !o.hidden) || !$('#zoom').hidden) return;
      if (e.target.matches('input')) return;
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    });
    if (KIOSK) {
      let t;
      const reset = () => { clearTimeout(t); t = setTimeout(() => { closeAll(); flip.turnToPage(0); current = 0; onTurn(); $('#intro').hidden = false; }, (CFG.kioskIdleSeconds || 120) * 1000); };
      ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, reset, { passive: true }));
      reset();
      $$('a').forEach(a => a.removeAttribute('href'));
    }
  }
})();
