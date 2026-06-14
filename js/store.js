// Tiny localStorage wrapper. Everything auto-saves so you never lose your place.
const P = 'es_';
export const store = {
  get(key, def) { try { const v = localStorage.getItem(P + key); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
  set(key, val) { try { localStorage.setItem(P + key, JSON.stringify(val)); } catch (e) {} },
};
export const uid = () => 'i' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
