// Backup / restore — export ALL on-device data (incl. uploaded files) to a JSON file, import back.
import { store } from './store.js';
import { allUploads, putUpload, allPhotos, putPhoto } from './idb.js';

const KEYS = ['projects', 'activeProject', 'todos', 'showTodo', 'favorites', 'owned', 'collections', 'stash', 'tools', 'videos', 'ownerName', 'lastBackupAt'];

const blobToDataURL = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error || new Error('Kunne ikke læse fil')); r.readAsDataURL(blob); });
function dataURLToBlob(d) {
  const [meta, b64] = d.split(','); const mime = (meta.match(/:(.*?);/) || [])[1] || 'application/octet-stream';
  const bin = atob(b64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
const stamp = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

// Build the full on-device bundle (localStorage + uploaded files + photos as data URLs).
// Shared by file export AND cloud sync.
export async function buildBundle() {
  const ls = {}; KEYS.forEach((k) => { const v = store.get(k, null); if (v != null) ls[k] = v; });
  const ups = await allUploads();
  const uploads = [];
  for (const u of ups) uploads.push({ ...u, blob: await blobToDataURL(u.blob) });
  const phs = await allPhotos();
  const photos = [];
  for (const ph of phs) photos.push({ ...ph, blob: await blobToDataURL(ph.blob) });
  return { _app: 'emmas-strik', _v: 2, ts: Date.now(), ls, uploads, photos };
}

// Apply a parsed bundle (overwrites localStorage keys, adds uploads/photos). Returns { restored, failed }.
export async function applyBundle(d) {
  if (!d || d._app !== 'emmas-strik') throw new Error('Det ser ikke ud til at være en Emmas Strik-profil.');
  Object.keys(d.ls || {}).forEach((k) => { if (d.ls[k] != null) store.set(k, d.ls[k]); });
  let restored = 0, failed = 0;
  for (const u of (Array.isArray(d.uploads) ? d.uploads : [])) {
    try { await putUpload({ ...u, blob: dataURLToBlob(u.blob) }); restored++; } catch (e) { failed++; }
  }
  for (const ph of (Array.isArray(d.photos) ? d.photos : [])) {
    try { await putPhoto({ ...ph, blob: dataURLToBlob(ph.blob) }); restored++; } catch (e) { failed++; }
  }
  return { restored, failed };
}

export async function exportData() {
  const payload = await buildBundle();
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `emmas-strik-backup-${stamp()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  store.set('lastBackupAt', Date.now());
}

// Returns { restored, failed }. Caller should confirm with the user first (this overwrites).
export async function importData(file) {
  return applyBundle(JSON.parse(await file.text()));
}
