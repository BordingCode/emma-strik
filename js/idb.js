// IndexedDB: 'uploads' = Emma's pattern files (PDF/photo) + annotations; 'photos' = finished-project photos.
const DB = 'emma_strik', UPLOADS = 'uploads', PHOTOS = 'photos', VER = 2;
let _db;

function open() {
  return new Promise((res, rej) => {
    if (_db) return res(_db);
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(UPLOADS)) db.createObjectStore(UPLOADS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(PHOTOS)) db.createObjectStore(PHOTOS, { keyPath: 'id' });
    };
    r.onsuccess = () => { _db = r.result; res(_db); };
    r.onerror = () => rej(r.error);
  });
}
function op(storeName, mode, fn) {
  return open().then((db) => new Promise((res, rej) => {
    const s = db.transaction(storeName, mode).objectStore(storeName);
    const r = fn(s); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
}

export const putUpload = (rec) => op(UPLOADS, 'readwrite', (s) => s.put(rec));
export const allUploads = () => op(UPLOADS, 'readonly', (s) => s.getAll()).then((r) => r || []);
export const getUpload = (id) => op(UPLOADS, 'readonly', (s) => s.get(id));
export const delUpload = (id) => op(UPLOADS, 'readwrite', (s) => s.delete(id));

export const putPhoto = (rec) => op(PHOTOS, 'readwrite', (s) => s.put(rec));
export const allPhotos = () => op(PHOTOS, 'readonly', (s) => s.getAll()).then((r) => r || []);
export const getPhoto = (id) => op(PHOTOS, 'readonly', (s) => s.get(id));
export const delPhoto = (id) => op(PHOTOS, 'readwrite', (s) => s.delete(id));
