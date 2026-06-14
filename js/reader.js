// In-pattern reader for Emma's own uploads (IMAGE or PDF). Renders the pattern, then overlays a
// draggable row-ruler, an embedded row counter, and highlighter/pencil/eraser annotation.
// Annotation + counter saved per pattern (IDB). PDFs render via vendored pdf.js.
import { putUpload } from './idb.js';

const E = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const RENDER_W = 1000;   // px width pages/images are rendered at (annotation resolution)

export async function openReader(upload) {
  const ov = E('div', 'reader');
  let mode = 'pan', scale = 1, count = upload.readerCount || 0;
  ov.innerHTML = `
    <div class="reader-top">
      <button class="rbtn close">‹ Luk</button>
      <span class="rtitle">${(upload.name || 'Opskrift').replace(/[<>&]/g, '')}</span>
      <div class="rtools">
        <button class="rbtn tool" data-m="ruler" title="Lineal">📏</button>
        <button class="rbtn tool" data-m="hi" title="Overstreg">🖊️</button>
        <button class="rbtn tool" data-m="pen" title="Blyant">✏️</button>
        <button class="rbtn tool" data-m="eraser" title="Viskelæder">🧽</button>
        <button class="rbtn zout" title="Zoom ud">−</button>
        <button class="rbtn zin" title="Zoom ind">＋</button>
        <button class="rbtn clear" title="Ryd tegning">Ryd</button>
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

  function applyScale() { wrap.style.width = (stage.clientWidth * scale) + 'px'; }

  async function buildContent() {
    const isImg = (upload.mime || '').startsWith('image/');
    if (isImg) {
      const url = URL.createObjectURL(upload.blob); objURLs.push(url);
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
      const w = Math.min(img.naturalWidth, 1400), h = Math.round(img.naturalHeight * w / img.naturalWidth);
      pages.innerHTML = ''; img.className = 'rpage'; pages.append(img);
      return { w, h };
    }
    // PDF
    const pdfjsLib = await import('../vendor/pdf.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.mjs', import.meta.url).href;
    const buf = await upload.blob.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
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
  catch (err) {
    // fall back to opening the file externally if rendering fails
    pages.innerHTML = '';
    const url = URL.createObjectURL(upload.blob); window.open(url, '_blank');
    ov.remove(); return;
  }

  canvas.width = content.w; canvas.height = content.h;
  if (upload.anno) { const a = new Image(); a.onload = () => ctx.drawImage(a, 0, 0, canvas.width, canvas.height); a.src = upload.anno; }
  applyScale();

  // tools
  function setMode(m) {
    mode = (mode === m && m !== 'pan') ? 'pan' : m;
    ov.querySelectorAll('.tool').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
    const drawing = mode === 'pen' || mode === 'hi' || mode === 'eraser';
    canvas.style.pointerEvents = drawing ? 'auto' : 'none';
    canvas.style.touchAction = drawing ? 'none' : 'auto';
    if (mode === 'ruler') { ruler.hidden = false; ruler.dataset.shown = '1'; }
  }
  ov.querySelectorAll('.tool').forEach((b) => b.onclick = () => setMode(b.dataset.m));
  ov.querySelector('.zin').onclick = () => { scale = Math.min(4, scale + 0.25); applyScale(); };
  ov.querySelector('.zout').onclick = () => { scale = Math.max(1, scale - 0.25); applyScale(); };
  ov.querySelector('.clear').onclick = () => { if (confirm('Ryd dine tegninger på denne opskrift?')) ctx.clearRect(0, 0, canvas.width, canvas.height); };

  // drawing
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) }; };
  let drawing = false;
  canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'pen' && mode !== 'hi' && mode !== 'eraser') return;
    drawing = true; try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    ctx.globalCompositeOperation = mode === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = mode === 'hi' ? 'rgba(255,214,64,0.45)' : '#2a2420';
    ctx.lineWidth = mode === 'hi' ? 26 : mode === 'eraser' ? 30 : 3;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
  });
  canvas.addEventListener('pointermove', (e) => { if (!drawing) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); });
  const endDraw = () => { drawing = false; };
  canvas.addEventListener('pointerup', endDraw); canvas.addEventListener('pointercancel', endDraw);

  // draggable ruler
  ruler.style.top = '40px';
  let rdrag = false, ry0 = 0, rt0 = 0;
  ruler.addEventListener('pointerdown', (e) => { rdrag = true; try { ruler.setPointerCapture(e.pointerId); } catch (err) {} ry0 = e.clientY; rt0 = parseFloat(ruler.style.top) || 0; e.preventDefault(); });
  ruler.addEventListener('pointermove', (e) => { if (!rdrag) return; ruler.style.top = Math.max(0, rt0 + (e.clientY - ry0)) + 'px'; });
  ruler.addEventListener('pointerup', () => { rdrag = false; });

  // counter
  ov.querySelector('.plus').onclick = () => { count++; cntEl.textContent = count; };
  ov.querySelector('.minus').onclick = () => { count = Math.max(0, count - 1); cntEl.textContent = count; };

  async function close() {
    try { upload.anno = canvas.toDataURL('image/png'); upload.readerCount = count; await putUpload(upload); } catch (e) {}
    objURLs.forEach((u) => URL.revokeObjectURL(u)); ov.remove();
  }
  ov.querySelector('.close').onclick = close;
  setMode('pan');
}
