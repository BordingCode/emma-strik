// Backup / restore — export ALL on-device data (incl. uploaded files) to a JSON file, import back.
import { store } from './store.js';
import { allUploads, putUpload } from './idb.js';

const KEYS = ['projects', 'activeProject', 'favorites', 'owned', 'collections', 'stash', 'tools', 'lastBackupAt'];

const blobToDataURL = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error || new Error('Kunne ikke læse fil')); r.readAsDataURL(blob); });
function dataURLToBlob(d) {
  const [meta, b64] = d.split(','); const mime = (meta.match(/:(.*?);/) || [])[1] || 'application/octet-stream';
  const bin = atob(b64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
const stamp = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

export async function exportData() {
  const ls = {}; KEYS.forEach((k) => { const v = store.get(k, null); if (v != null) ls[k] = v; });
  const ups = await allUploads();
  const uploads = [];
  for (const u of ups) uploads.push({ ...u, blob: await blobToDataURL(u.blob) });
  const payload = { _app: 'emmas-strik', _v: 1, ts: Date.now(), ls, uploads };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `emmas-strik-backup-${stamp()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  store.set('lastBackupAt', Date.now());
}

// Returns { restored, failed }. Caller should confirm with the user first (this overwrites).
export async function importData(file) {
  const d = JSON.parse(await file.text());
  if (d._app !== 'emmas-strik') throw new Error('Det ser ikke ud til at være en Emmas Strik-sikkerhedskopi.');
  Object.keys(d.ls || {}).forEach((k) => { if (d.ls[k] != null) store.set(k, d.ls[k]); });
  let restored = 0, failed = 0;
  for (const u of (Array.isArray(d.uploads) ? d.uploads : [])) {
    try { await putUpload({ ...u, blob: dataURLToBlob(u.blob) }); restored++; } catch (e) { failed++; }
  }
  return { restored, failed };
}
