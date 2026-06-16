// In-pattern reader for Emma's own uploads (IMAGE or PDF). Renders the pattern, then overlays a
// draggable row-ruler, an embedded row counter, and highlighter/pencil/eraser annotation.
// Annotation + counter saved per pattern (IDB). PDFs render via vendored pdf.js. Pinch-zoom supported.
import { putUpload } from './idb.js';
import { videosForPattern, categoryIdsForPattern } from './videos.js';

const E = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const RENDER_W = 1400;   // render PDFs crisp so they stay sharp when zoomed/pinched
const RS = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const RI = {
  ruler: RS('<rect x="3" y="8.5" width="18" height="7" rx="1"/><path d="M7 8.5v3M11 8.5v4M15 8.5v3M19 8.5v4"/>'),
  marker: RS('<path d="M4 20h5"/><path d="M9.5 15 15 9.5l3 3L12.5 18H9.5z"/><path d="M14 8.5 17 5.5l2 2-3 3"/>'),
  video: RS('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M10 9.5l5 2.5-5 2.5z"/>'),
  pencil: RS('<path d="M5 19l1.2-4L15 6.2l2.8 2.8L9 17.8z"/><path d="M14 7l3 3"/>'),
  eraser: RS('<path d="M8 17 4.5 13.5 12 6l4.5 4.5L11.5 17z"/><path d="M6 19h11"/>'),
  trash: RS('<path d="M5 7h14M9.5 7V5h5v2M7 7l1 12h8l1-12"/>'),
  zin: RS('<circle cx="11" cy="11" r="7"/><path d="M11 8v6M8 11h6M20 20l-3.5-3.5"/>'),
  zout: RS('<circle cx="11" cy="11" r="7"/><path d="M8 11h6M20 20l-3.5-3.5"/>'),
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>',
};

// progress (optional) = { obj, save } — where the row-count + ruler/scroll/zoom are remembered.
// From a project it's the project (so the same recipe tracks separately per project); from the
// gallery it defaults to the pattern itself. Annotations always live on the pattern (upload).
export async function openReader(upload, progress) {
  progress = progress || { obj: upload, save: () => putUpload(upload) };
  const ov = E('div', 'reader');
  let mode = 'pan', scale = 1, count = progress.obj.readerCount || 0;
  let rulerFrac = 0.12;   // ruler position as a fraction of content height (so it survives zoom)

  ov.innerHTML = `
    <div class="reader-top">
      <button class="rbtn rclose" aria-label="Luk">‹</button>
      <span class="rtitle">${(upload.name || 'Opskrift').replace(/[<>&]/g, '')}</span>
      <div class="rtools">
        <button class="rbtn lbl rulertoggle" aria-label="Lineal"><span>${RI.ruler}</span><small>Lineal</small></button>
        <button class="rbtn lbl tool" data-m="hi" aria-label="Overstregning"><span>${RI.marker}</span><small>Marker</small></button>
        <button class="rbtn lbl moretoggle" aria-label="Flere værktøjer"><span>${RI.more}</span><small>Mere</small></button>
      </div>
      <div class="rmenu" hidden>
        <button class="rmenu-row zin"><span class="rmi">${RI.zin}</span>Zoom ind</button>
        <button class="rmenu-row zout"><span class="rmi">${RI.zout}</span>Zoom ud</button>
        <button class="rmenu-row tool" data-m="pen"><span class="rmi">${RI.pencil}</span>Blyant</button>
        <button class="rmenu-row tool" data-m="eraser"><span class="rmi">${RI.eraser}</span>Slet</button>
        <button class="rmenu-row clear"><span class="rmi">${RI.trash}</span>Ryd tegning</button>
        <button class="rmenu-row videobtn"><span class="rmi">${RI.video}</span>Videoer</button>
      </div>
    </div>
    <div class="reader-stage">
      <div class="reader-wrap">
        <div class="reader-pages"><div class="reader-loading">Indlæser…</div></div>
        <canvas class="reader-canvas"></canvas>
        <div class="reader-ruler" hidden><div class="ruler-grip">↕ omgang</div></div>
      </div>
    </div>
    <div class="reader-counter">
      <button class="rc-btn minus">−</button>
      <div class="rc-val"><b>${count}</b><span>omg.</span></div>
      <button class="rc-btn plus">＋</button>
    </div>`;
  document.body.append(ov);

  const stage = ov.querySelector('.reader-stage');
  const wrap = ov.querySelector('.reader-wrap');
  const pages = ov.querySelector('.reader-pages');
  const canvas = ov.querySelector('.reader-canvas');
  const ruler = ov.querySelector('.reader-ruler');
  const ctx = canvas.getContext('2d');
  const cntEl = ov.querySelector('.rc-val b');
  const objURLs = [];

  function placeRuler() { if (!ruler.hidden) ruler.style.top = Math.round(rulerFrac * wrap.clientHeight) + 'px'; }
  function applyScale() { wrap.style.width = (stage.clientWidth * scale) + 'px'; placeRuler(); }

  async function buildContent() {
    const isImg = (upload.mime || '').startsWith('image/');
    if (isImg) {
      const url = URL.createObjectURL(upload.blob); objURLs.push(url);
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
      const w = Math.min(img.naturalWidth, 1400), h = Math.round(img.naturalHeight * w / img.naturalWidth);
      pages.innerHTML = ''; img.className = 'rpage'; pages.append(img);
      return { w, h };
    }
    const pdfjsLib = await import('../vendor/pdf.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.mjs', import.meta.url).href;
    const pdf = await pdfjsLib.getDocument({ data: await upload.blob.arrayBuffer() }).promise;
    pages.innerHTML = '';
    let totalH = 0; const n = Math.min(pdf.numPages, 40);
    for (let i = 1; i <= n; i++) {
      const page = await pdf.getPage(i);
      const s = RENDER_W / page.getViewport({ scale: 1 }).width;
      const vp = page.getViewport({ scale: s });
      const pc = E('canvas', 'rpage'); pc.width = Math.round(vp.width); pc.height = Math.round(vp.height);
      await page.render({ canvasContext: pc.getContext('2d'), viewport: vp }).promise;
      pages.append(pc); totalH += pc.height;
    }
    return { w: RENDER_W, h: totalH };
  }

  let content;
  try { content = await buildContent(); }
  catch (err) { pages.innerHTML = ''; window.open(URL.createObjectURL(upload.blob), '_blank'); ov.remove(); return; }

  canvas.width = content.w; canvas.height = content.h;
  if (upload.anno) { const a = new Image(); a.onload = () => ctx.drawImage(a, 0, 0, canvas.width, canvas.height); a.src = upload.anno; }
  applyScale();
  // resume where she left off last time (per project when opened from one)
  const rv = progress.obj.readerView;
  if (rv) {
    if (rv.scale) scale = Math.max(1, Math.min(4, rv.scale));
    if (typeof rv.rulerFrac === 'number') rulerFrac = rv.rulerFrac;
    if (rv.rulerShown) { ruler.hidden = false; const rb = ov.querySelector('.rulertoggle'); if (rb) rb.classList.add('on'); }
    applyScale();
    requestAnimationFrame(() => { stage.scrollTop = (rv.scrollFrac || 0) * wrap.offsetHeight; });
  }

  // tools (pen/hi/eraser are exclusive draw modes; ruler is an independent toggle)
  // overflow ("Mere") menu holds the occasional tools so the bar stays one calm row
  const moreBtn = ov.querySelector('.moretoggle');
  const menu = ov.querySelector('.rmenu');
  const closeMenu = () => { menu.hidden = true; moreBtn.classList.remove('open'); };
  moreBtn.onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; moreBtn.classList.toggle('open', !menu.hidden); };

  function setMode(m) {
    mode = (mode === m && m !== 'pan') ? 'pan' : m;
    ov.querySelectorAll('.tool').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
    moreBtn.classList.toggle('tool-active', mode === 'pen' || mode === 'eraser');  // show a tool is live in the menu
    const drawing = mode === 'pen' || mode === 'hi' || mode === 'eraser';
    canvas.style.pointerEvents = drawing ? 'auto' : 'none';
    canvas.style.touchAction = drawing ? 'none' : 'auto';
  }
  ov.querySelectorAll('.tool').forEach((b) => b.onclick = () => { setMode(b.dataset.m); closeMenu(); });
  const rt = ov.querySelector('.rulertoggle');
  rt.onclick = () => { ruler.hidden = !ruler.hidden; rt.classList.toggle('on', !ruler.hidden); placeRuler(); };
  ov.querySelector('.zin').onclick = () => { scale = Math.min(4, scale + 0.25); applyScale(); };   // menu stays open for repeated zoom
  ov.querySelector('.zout').onclick = () => { scale = Math.max(1, scale - 0.25); applyScale(); };
  ov.querySelector('.clear').onclick = () => { closeMenu(); if (confirm('Ryd dine tegninger på denne opskrift?')) ctx.clearRect(0, 0, canvas.width, canvas.height); };
  ov.querySelector('.videobtn').onclick = () => { closeMenu(); showVideos(); };
  stage.addEventListener('pointerdown', closeMenu);   // tapping the pattern closes the menu

  function showVideos() {
    const pid = 'up:' + upload.id;
    const vids = videosForPattern(pid, categoryIdsForPattern(pid));
    const sheet = E('div', 'reader-sheet');
    const rows = vids.length
      ? vids.map((v) => `<a class="rv-row" href="${(v.url || '').replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">▶ ${(v.title || '').replace(/[<>&]/g, '')}</a>`).join('')
      : `<p class="rv-empty">Ingen videoer tilknyttet denne opskrift endnu.<br>Du kan tilføje dem i Opskrifter ▸ Videoer.</p>`;
    sheet.innerHTML = `<div class="rv-panel"><h3>Videoer</h3>${rows}<button class="rv-close">Luk</button></div>`;
    sheet.addEventListener('click', (e) => { if (e.target === sheet || e.target.classList.contains('rv-close')) sheet.remove(); });
    ov.append(sheet);
  }

  // ---- pinch-zoom (two fingers) on the stage, with focal point ----
  const ptrs = new Map();
  let pinch = null;
  stage.addEventListener('pointerdown', (e) => { ptrs.set(e.pointerId, e); if (ptrs.size === 2) startPinch(); }, true);
  stage.addEventListener('pointermove', (e) => { if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, e); if (pinch && ptrs.size >= 2) movePinch(); }, true);
  const dropPtr = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; };
  stage.addEventListener('pointerup', dropPtr, true); stage.addEventListener('pointercancel', dropPtr, true);
  function pts() { return [...ptrs.values()]; }
  function dist(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
  function startPinch() {
    drawing = false; // cancel any stroke
    const [a, b] = pts(); const r = stage.getBoundingClientRect();
    const midX = (a.clientX + b.clientX) / 2, midY = (a.clientY + b.clientY) / 2;
    pinch = { d0: dist(a, b), s0: scale,
      fx: (stage.scrollLeft + midX - r.left) / wrap.offsetWidth,
      fy: (stage.scrollTop + midY - r.top) / wrap.offsetHeight };
  }
  function movePinch() {
    const [a, b] = pts(); const r = stage.getBoundingClientRect();
    const midX = (a.clientX + b.clientX) / 2, midY = (a.clientY + b.clientY) / 2;
    scale = Math.max(1, Math.min(4, pinch.s0 * dist(a, b) / pinch.d0));
    applyScale();
    stage.scrollLeft = pinch.fx * wrap.offsetWidth - (midX - r.left);
    stage.scrollTop = pinch.fy * wrap.offsetHeight - (midY - r.top);
  }

  // drawing (ignored while pinching / multi-touch)
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) }; };
  let drawing = false;
  canvas.addEventListener('pointerdown', (e) => {
    if (ptrs.size > 1 || (mode !== 'pen' && mode !== 'hi' && mode !== 'eraser')) return;
    drawing = true; try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    ctx.globalCompositeOperation = mode === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = mode === 'hi' ? 'rgba(255,214,64,0.45)' : '#2a2420';
    ctx.lineWidth = mode === 'hi' ? 26 : mode === 'eraser' ? 30 : 3;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
  });
  canvas.addEventListener('pointermove', (e) => { if (!drawing || ptrs.size > 1) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); });
  const endDraw = () => { if (drawing) { drawing = false; saveState(); } };
  canvas.addEventListener('pointerup', endDraw); canvas.addEventListener('pointercancel', endDraw);

  // persist annotation + count + reading position (debounced) so you resume where you left off
  let saveT;
  function viewState() { return { scrollFrac: stage.scrollTop / (wrap.offsetHeight || 1), scale, rulerFrac, rulerShown: !ruler.hidden }; }
  function persist() { upload.anno = canvas.toDataURL('image/png'); progress.obj.readerCount = count; progress.obj.readerView = viewState(); }
  async function commit() { try { persist(); await putUpload(upload); if (progress.obj !== upload) progress.save(); } catch (e) {} }
  function saveState() { clearTimeout(saveT); saveT = setTimeout(commit, 700); }
  stage.addEventListener('scroll', saveState);

  // draggable ruler (position stored as a fraction so it stays put when zooming)
  ruler.style.top = '40px';
  let rdrag = false, ry0 = 0, rt0 = 0;
  ruler.addEventListener('pointerdown', (e) => { rdrag = true; try { ruler.setPointerCapture(e.pointerId); } catch (err) {} ry0 = e.clientY; rt0 = parseFloat(ruler.style.top) || 0; e.preventDefault(); e.stopPropagation(); });
  ruler.addEventListener('pointermove', (e) => { if (!rdrag) return; const top = Math.max(0, Math.min(wrap.clientHeight - ruler.offsetHeight, rt0 + (e.clientY - ry0))); ruler.style.top = top + 'px'; rulerFrac = top / wrap.clientHeight; });
  ruler.addEventListener('pointerup', () => { rdrag = false; });

  // counter (with a gentle pop, matching the main app)
  const bump = (el) => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = 'countpop .14s ease-out'; };
  ov.querySelector('.plus').onclick = () => { count++; cntEl.textContent = count; bump(cntEl); saveState(); };
  ov.querySelector('.minus').onclick = () => { count = Math.max(0, count - 1); cntEl.textContent = count; bump(cntEl); saveState(); };

  async function close() {
    clearTimeout(saveT);
    removeEventListener('resize', placeRuler);
    await commit();
    objURLs.forEach((u) => URL.revokeObjectURL(u)); ov.remove();
  }
  ov.querySelector('.rclose').onclick = close;
  addEventListener('resize', placeRuler);
  setMode('pan');
}
