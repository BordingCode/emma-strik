// IndexedDB store for Emma's own uploaded patterns (PDF/photo blobs live on her device).
const DB = 'emma_strik', STORE = 'uploads', VER = 1;
let _db;

function open() {
  return new Promise((res, rej) => {
    if (_db) return res(_db);
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }); };
    r.onsuccess = () => { _db = r.result; res(_db); };
    r.onerror = () => rej(r.error);
  });
}
function op(mode, fn) {
  return open().then((db) => new Promise((res, rej) => {
    const s = db.transaction(STORE, mode).objectStore(STORE);
    const r = fn(s); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
}
export const putUpload = (rec) => op('readwrite', (s) => s.put(rec));
export const allUploads = () => op('readonly', (s) => s.getAll()).then((r) => r || []);
export const getUpload = (id) => op('readonly', (s) => s.get(id));
export const delUpload = (id) => op('readwrite', (s) => s.delete(id));
