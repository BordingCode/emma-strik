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

  // ---- pen/highlighter look (colour + thickness + transparency), remembered across patterns ----
  const PALETTES = {
    pen: ['#2a2420', '#d23b3b', '#2f6fd2', '#2e9e57', '#d24b9c', '#ffffff'],   // mørk, rød, blå, grøn, pink, hvid
    hi:  ['#ffd640', '#ff9d4d', '#7ed957', '#5bc8ff', '#ff7eb6', '#c79bff'],   // gul, orange, grøn, blå, pink, lilla
  };
  const WIDTHS = { pen: [2, 4, 7], hi: [16, 26, 40] };
  function defaultTools() { return { pen: { color: '#2a2420', width: 4, alpha: 1 }, hi: { color: '#ffd640', width: 26, alpha: 0.3 } }; }
  function loadTools() { try { const s = JSON.parse(localStorage.getItem('emma-reader-tools')); if (s && s.pen && s.hi) return { pen: { ...defaultTools().pen, ...s.pen }, hi: { ...defaultTools().hi, ...s.hi } }; } catch (e) {} return defaultTools(); }
  const tools = loadTools();
  const saveTools = () => { try { localStorage.setItem('emma-reader-tools', JSON.stringify(tools)); } catch (e) {} };

  const settings = E('div', 'rtool-settings'); settings.hidden = true;
  ov.querySelector('.reader-top').append(settings);
  const closeSettings = () => { settings.hidden = true; };
  function openSettings(key) {
    const t = tools[key];
    const sw = PALETTES[key].map((c) => `<button class="ts-sw${c === t.color ? ' on' : ''}" data-c="${c}" style="background:${c}" aria-label="Farve"></button>`).join('');
    const sz = WIDTHS[key].map((w, i) => `<button class="ts-sz${w === t.width ? ' on' : ''}" data-w="${w}" aria-label="Tykkelse"><span style="width:${5 + i * 6}px;height:${5 + i * 6}px"></span></button>`).join('');
    settings.innerHTML =
      `<div class="ts-row ts-colors">${sw}</div>` +
      `<div class="ts-row"><div class="ts-sizes">${sz}</div></div>` +
      `<label class="ts-row ts-alpha"><span>Synlighed</span><input type="range" min="15" max="100" step="5" value="${Math.round(t.alpha * 100)}"><b>${Math.round(t.alpha * 100)}%</b></label>`;
    settings.hidden = false;
    settings.querySelectorAll('.ts-sw').forEach((b) => b.onclick = () => { t.color = b.dataset.c; settings.querySelectorAll('.ts-sw').forEach((x) => x.classList.toggle('on', x === b)); saveTools(); });
    settings.querySelectorAll('.ts-sz').forEach((b) => b.onclick = () => { t.width = +b.dataset.w; settings.querySelectorAll('.ts-sz').forEach((x) => x.classList.toggle('on', x === b)); saveTools(); });
    const rng = settings.querySelector('input'), lab = settings.querySelector('.ts-alpha b');
    rng.oninput = () => { t.alpha = +rng.value / 100; lab.textContent = rng.value + '%'; };
    rng.onchange = saveTools;
  }

  function setMode(m) {
    mode = (mode === m && m !== 'pan') ? 'pan' : m;
    ov.querySelectorAll('.tool').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
    moreBtn.classList.toggle('tool-active', mode === 'pen' || mode === 'eraser');  // show a tool is live in the menu
    const drawing = mode === 'pen' || mode === 'hi' || mode === 'eraser';
    canvas.style.pointerEvents = drawing ? 'auto' : 'none';
    canvas.style.touchAction = drawing ? 'none' : 'auto';
    if (mode === 'pen' || mode === 'hi') openSettings(mode); else closeSettings();  // colour/size panel for the two drawing tools
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
  // Pen & highlighter both draw onto their own FULL-opacity layer, blended onto the page once
  // at the tool's chosen alpha. (Stroking the same path on every pointermove would otherwise
  // stack a semi-transparent colour into a near-solid blob, making transparency meaningless.)
  // The eraser writes straight to the page with destination-out.
  let layer = null, lctx = null, baseSnap = null, drawAlpha = 1;
  canvas.addEventListener('pointerdown', (e) => {
    if (ptrs.size > 1 || (mode !== 'pen' && mode !== 'hi' && mode !== 'eraser')) return;
    drawing = true; try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    const p = pos(e);
    if (mode === 'eraser') {
      layer = lctx = baseSnap = null;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 30; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      return;
    }
    const t = tools[mode]; drawAlpha = t.alpha;
    // snapshot current page so we can re-blend the live stroke each move without compounding
    baseSnap = document.createElement('canvas'); baseSnap.width = canvas.width; baseSnap.height = canvas.height;
    baseSnap.getContext('2d').drawImage(canvas, 0, 0);
    layer = document.createElement('canvas'); layer.width = canvas.width; layer.height = canvas.height;
    lctx = layer.getContext('2d');
    lctx.strokeStyle = t.color; lctx.lineWidth = t.width; lctx.lineCap = 'round'; lctx.lineJoin = 'round';
    lctx.beginPath(); lctx.moveTo(p.x, p.y);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing || ptrs.size > 1) return;
    const p = pos(e);
    if (mode === 'eraser') { ctx.lineTo(p.x, p.y); ctx.stroke(); return; }
    if (!lctx) return;
    lctx.lineTo(p.x, p.y); lctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseSnap, 0, 0);
    ctx.globalAlpha = drawAlpha; ctx.drawImage(layer, 0, 0); ctx.globalAlpha = 1;
  });
  const endDraw = () => { if (drawing) { drawing = false; layer = lctx = baseSnap = null; saveState(); } };
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
