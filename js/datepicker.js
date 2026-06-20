// A small Danish, Monday-first calendar picker — replaces the native date input
// (whose first weekday follows the phone's language and can't be forced to Monday).
const DAYS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
const MONTHS = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
export function fmtDate(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : (s || ''); }

// HTML for a tappable date field. Read the chosen value back from el.dataset.val.
export function dateBtnHtml(id, value, ph = 'Vælg dato') {
  const v = value || '';
  return `<button type="button" class="datebtn${v ? '' : ' empty'}" id="${id}" data-val="${v}" data-ph="${ph}">${v ? fmtDate(v) : ph}</button>`;
}

// Wire every .datebtn inside root so tapping it opens the Monday-first calendar.
export function wireDateButtons(root) {
  root.querySelectorAll('.datebtn').forEach((btn) => {
    btn.addEventListener('click', () => openCalendar(btn.dataset.val, (val) => {
      btn.dataset.val = val || '';
      btn.textContent = val ? fmtDate(val) : (btn.dataset.ph || 'Vælg dato');
      btn.classList.toggle('empty', !val);
    }));
  });
}

function openCalendar(current, onPick) {
  const sel = /^(\d{4})-(\d{2})-(\d{2})$/.exec(current || '');
  const now = new Date();
  let y = sel ? +sel[1] : now.getFullYear();
  let m = sel ? +sel[2] - 1 : now.getMonth();

  const ov = document.createElement('div');
  ov.className = 'dp-ov';
  const cal = document.createElement('div');
  cal.className = 'dp-cal';
  ov.append(cal);
  const close = () => ov.remove();
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });

  function draw() {
    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7; // shift so Monday = 0
    const days = new Date(y, m + 1, 0).getDate();
    const t = new Date(); const tIso = iso(t.getFullYear(), t.getMonth(), t.getDate());
    let cells = '';
    for (let i = 0; i < offset; i++) cells += '<span class="dp-cell empty"></span>';
    for (let d = 1; d <= days; d++) {
      const cellIso = iso(y, m, d);
      const cls = ['dp-cell', 'day'];
      if (cellIso === current) cls.push('sel');
      if (cellIso === tIso) cls.push('today');
      cells += `<button type="button" class="${cls.join(' ')}" data-d="${d}">${d}</button>`;
    }
    cal.innerHTML = `
      <div class="dp-head">
        <button type="button" class="dp-nav" data-nav="-1" aria-label="Forrige måned">‹</button>
        <div class="dp-title">${MONTHS[m][0].toUpperCase() + MONTHS[m].slice(1)} ${y}</div>
        <button type="button" class="dp-nav" data-nav="1" aria-label="Næste måned">›</button>
      </div>
      <div class="dp-grid dp-dow">${DAYS.map((d) => `<span class="dp-cell dow">${d}</span>`).join('')}</div>
      <div class="dp-grid dp-days">${cells}</div>
      <div class="dp-foot">
        <button type="button" class="dp-foot-btn" data-act="clear">Ryd</button>
        <button type="button" class="dp-foot-btn" data-act="today">I dag</button>
      </div>`;
    cal.querySelectorAll('.dp-nav').forEach((b) => b.onclick = () => { m += +b.dataset.nav; if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; } draw(); });
    cal.querySelectorAll('.day').forEach((b) => b.onclick = () => { onPick(iso(y, m, +b.dataset.d)); close(); });
    cal.querySelector('[data-act="clear"]').onclick = () => { onPick(''); close(); };
    cal.querySelector('[data-act="today"]').onclick = () => { const t2 = new Date(); onPick(iso(t2.getFullYear(), t2.getMonth(), t2.getDate())); close(); };
  }
  draw();
  document.body.append(ov);
}
