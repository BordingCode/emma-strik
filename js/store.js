// Tiny localStorage wrapper. Everything auto-saves so you never lose your place.
const P = 'es_';
let warnedFull = false;
const subs = []; // change listeners (used by cloud sync to know when to push)
export const store = {
  get(key, def) { try { const v = localStorage.getItem(P + key); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
  set(key, val) {
    try {
      localStorage.setItem(P + key, JSON.stringify(val));
      subs.forEach((f) => { try { f(key, val); } catch (_) {} });
      return true;
    }
    catch (e) {
      if (!warnedFull) { warnedFull = true; try { alert('Din enheds lager er fyldt — ændringen kunne ikke gemmes. Lav en sikkerhedskopi (under Garn) og frigør lidt plads.'); } catch (_) {} }
      return false;
    }
  },
  subscribe(fn) { subs.push(fn); },
};
export const uid = () => 'i' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
