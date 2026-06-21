// Ambient fireflies for atmospheric dark themes (Aften). A lightweight canvas of
// slowly drifting, glowing, twinkling warm dots — inspired by Grimoire's scene layers.
// Sits behind the app content, respects prefers-reduced-motion, and pauses when the
// tab is hidden. Does nothing on themes that don't ask for it (canvas stays hidden).

// Per-theme look: rgb = dot colour, count = how many, glow = blur multiplier.
const RECIPES = {
  aften:      { rgb: '255,196,120', count: 26, glow: 1.0 },  // warm honey fireflies
  solnedgang: { rgb: '255,210,150', count: 22, glow: 1.0 },  // soft dusk embers (optional)
};

let canvas, ctx, raf, running = false, parts = [], w = 0, h = 0, dpr = 1, t = 0, last = 0, cfg = null;
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const R = (a, b) => a + Math.random() * (b - a);

function ensure() {
  if (canvas) return;
  const app = document.getElementById('app');
  if (!app) return;
  canvas = document.createElement('canvas');
  canvas.className = 'fireflies';
  canvas.setAttribute('aria-hidden', 'true');
  app.prepend(canvas);
  ctx = canvas.getContext('2d');
  addEventListener('resize', () => { clearTimeout(ensure._t); ensure._t = setTimeout(resize, 150); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (cfg) start(); });
}

function resize() {
  const app = document.getElementById('app');
  if (!canvas || !app) return;
  w = app.clientWidth; h = app.clientHeight;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  seed();
}

function seed() {
  parts = [];
  if (!cfg) return;
  for (let i = 0; i < cfg.count; i++) {
    parts.push({
      x: R(0, w), y: R(0, h), r: R(1.1, 2.9), a: R(.35, .95),
      vy: -R(3, 9) * .06, vx: R(-.12, .12),     // drift gently upward
      tw: R(0, 6.28), tws: R(.5, 1.7), sway: R(.4, 1.1),
    });
  }
}

function frame(now) {
  if (!running) return;
  const dt = Math.min(.05, (now - last) / 1000 || 0); last = now; t += dt;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(' + cfg.rgb + ',1)';
  ctx.shadowColor = 'rgba(' + cfg.rgb + ',1)';
  for (const p of parts) {
    p.y += p.vy; p.x += p.vx + Math.sin(t * p.sway + p.tw) * .25;
    const pad = p.r + 6;
    if (p.y < -pad) { p.y = h + pad; p.x = R(0, w); }
    if (p.x < -pad) p.x = w + pad; else if (p.x > w + pad) p.x = -pad;
    const tw = .45 + .55 * Math.sin(t * p.tws + p.tw);   // soft twinkle
    ctx.globalAlpha = Math.max(0, p.a * tw);
    ctx.shadowBlur = p.r * 4 * cfg.glow;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  raf = requestAnimationFrame(frame);
}

function start() {
  if (running || !cfg) return;
  running = true; last = performance.now();
  if (reduce()) { frame(performance.now()); running = false; return; }  // one calm static frame
  raf = requestAnimationFrame(frame);
}
function stop() { running = false; cancelAnimationFrame(raf); }

// Switch the effect to match a theme id (call from applyTheme). Unknown ids → off.
export function setFireflies(themeId) {
  cfg = RECIPES[themeId] || null;
  if (!cfg) { if (canvas) { stop(); ctx.clearRect(0, 0, w, h); canvas.style.display = 'none'; } return; }
  ensure();
  if (!canvas) return;
  canvas.style.display = 'block';
  resize();
  start();
}
