// Backup / restore — export ALL Emma's on-device data (incl. uploaded files) to a JSON file,
// and import it back. Her safety net against losing local data.
import { store } from './store.js';
import { allUploads, putUpload } from './idb.js';

const KEYS = ['projects', 'activeProject', 'favorites', 'owned', 'collections', 'stash', 'tools'];

const blobToDataURL = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
function dataURLToBlob(d) {
  const [meta, b64] = d.split(','); const mime = (meta.match(/:(.*?);/) || [])[1] || 'application/octet-stream';
  const bin = atob(b64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function exportData() {
  const ls = {}; KEYS.forEach((k) => { const v = store.get(k, null); if (v != null) ls[k] = v; });
  const ups = await allUploads();
  const uploads = [];
  for (const u of ups) uploads.push({ ...u, blob: await blobToDataURL(u.blob) });
  const payload = { _app: 'emmas-strik', _v: 1, ts: Date.now(), ls, uploads };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'emmas-strik-backup.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function importData(file) {
  const d = JSON.parse(await file.text());
  if (d._app !== 'emmas-strik') throw new Error('Det ser ikke ud til at være en Emmas Strik-sikkerhedskopi.');
  Object.keys(d.ls || {}).forEach((k) => { if (d.ls[k] != null) store.set(k, d.ls[k]); });
  for (const u of (d.uploads || [])) { try { await putUpload({ ...u, blob: dataURLToBlob(u.blob) }); } catch (e) {} }
}
