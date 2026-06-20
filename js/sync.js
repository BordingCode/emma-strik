// Cloud sync — link Emma's own devices so they share one profile.
// Reuses the existing Cloudflare relay (/backup/:code, newest-wins). The link code
// is the only secret, so it's long & random. No backend cost (free tier).
import { store } from './store.js';
import { buildBundle, applyBundle } from './backup.js';

const WORKER = 'https://grimoire-sync.mathiasjob.workers.dev';
const CODE_KEY = 'syncCode';      // es_syncCode — the shared link code (empty = not linked)
const VER_KEY = 'syncVersion';    // last cloud version we've seen/written
const UPDATED_KEY = 'syncUpdatedAt';
const MAX_BYTES = 20 * 1024 * 1024; // cloud store caps at 25 MB; stay under with margin

export const getCode = () => store.get(CODE_KEY, '');
export const isLinked = () => !!getCode();
export const lastUpdated = () => store.get(UPDATED_KEY, null);

let busy = false, muted = false, pushTimer = null;
const listeners = [];
let status = { state: 'idle' };
export const onStatus = (fn) => { listeners.push(fn); fn(status); };
export const getStatus = () => status;
function setStatus(state, extra) { status = { state, ...(extra || {}) }; listeners.forEach((f) => { try { f(status); } catch (e) {} }); }

function rndCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusable 0/O/1/I
  const pick = (n) => Array.from({ length: n }, () => A[Math.floor(Math.random() * A.length)]).join('');
  return 'ES-' + pick(4) + '-' + pick(4);
}
export function normalizeCode(raw) { return String(raw || '').trim().toUpperCase().replace(/\s+/g, ''); }

async function remoteGet(code) {
  const r = await fetch(`${WORKER}/backup/${encodeURIComponent(code)}`);
  if (!r.ok) throw new Error('Serveren svarede ' + r.status);
  return r.json(); // { empty:true } | { version, updatedAt, payload }
}
async function remotePut(code) {
  const payload = await buildBundle();
  const body = JSON.stringify({ payload });
  if (body.length > MAX_BYTES) throw new Error('Profilen er for stor til at synkronisere (for mange/store opskrifter eller billeder).');
  const r = await fetch(`${WORKER}/backup/${encodeURIComponent(code)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  if (!r.ok) throw new Error('Serveren svarede ' + r.status);
  const d = await r.json();
  store.set(VER_KEY, d.version); store.set(UPDATED_KEY, d.updatedAt);
  return d;
}
// apply a cloud bundle without it triggering an immediate re-push
async function applyMuted(payload) { muted = true; try { return await applyBundle(payload); } finally { muted = false; } }

// Create a brand-new link from THIS device's data. Returns the code.
export async function linkNew() {
  const code = rndCode();
  setStatus('syncing');
  try { const d = await remotePut(code); store.set(CODE_KEY, code); setStatus('ok', { updatedAt: d.updatedAt }); return code; }
  catch (e) { setStatus('error', { message: e.message }); throw e; }
}

// Join an existing code: pull the profile down and adopt it (replaces local).
export async function linkJoin(rawCode) {
  const code = normalizeCode(rawCode);
  if (!/^[A-Z0-9-]{4,40}$/.test(code)) throw new Error('Koden ser ikke rigtig ud.');
  setStatus('syncing');
  try {
    const remote = await remoteGet(code);
    if (remote.empty) throw new Error('Der er ingen profil gemt med den kode endnu.');
    await applyMuted(remote.payload);
    store.set(CODE_KEY, code); store.set(VER_KEY, remote.version); store.set(UPDATED_KEY, remote.updatedAt);
    setStatus('ok', { updatedAt: remote.updatedAt });
    return remote;
  } catch (e) { setStatus('error', { message: e.message }); throw e; }
}

export function unlink() { store.set(CODE_KEY, ''); store.set(VER_KEY, 0); store.set(UPDATED_KEY, null); setStatus('idle'); }

// Push local → cloud now (used by auto-debounce and the manual button).
export async function pushNow() {
  const code = getCode(); if (!code || busy) return;
  busy = true; setStatus('syncing');
  try { const d = await remotePut(code); setStatus('ok', { updatedAt: d.updatedAt }); }
  catch (e) { setStatus('error', { message: e.message }); }
  finally { busy = false; }
}

// Pull cloud → local if the cloud is newer than what we've seen. Returns true if local data changed.
export async function pullIfNewer() {
  const code = getCode(); if (!code || busy) return false;
  busy = true; setStatus('syncing');
  try {
    const remote = await remoteGet(code);
    if (remote.empty) { setStatus('ok'); return false; }
    if (remote.version > store.get(VER_KEY, 0)) {
      await applyMuted(remote.payload);
      store.set(VER_KEY, remote.version); store.set(UPDATED_KEY, remote.updatedAt);
      setStatus('ok', { updatedAt: remote.updatedAt, pulled: true });
      return true;
    }
    setStatus('ok', { updatedAt: remote.updatedAt });
    return false;
  } catch (e) { setStatus('error', { message: e.message }); return false; }
  finally { busy = false; }
}

// Auto-push whenever real data changes (debounced). Ignore bookkeeping/transient keys.
const IGNORE = new Set(['syncCode', 'syncVersion', 'syncUpdatedAt', 'activeProject', 'lastBackupAt', 'backupSnooze', 'theme']);
store.subscribe((key) => {
  if (muted || !isLinked() || IGNORE.has(key)) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushNow(), 3000);
});
