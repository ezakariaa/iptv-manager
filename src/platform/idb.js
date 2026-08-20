/**
 * Petit magasin clé/valeur sur IndexedDB.
 * Sert à persister l'export binaire de la base sql.js entre deux lancements :
 * localStorage plafonne à ~5 Mo et ne stocke que du texte, ce qui exclut une
 * base de plusieurs milliers de chaînes.
 */

const DB_NAME    = 'iptv-manager';
const STORE_NAME = 'kv';

let openPromise = null;

function open() {
  if (openPromise) return openPromise;
  openPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
  return openPromise;
}

function tx(mode, run) {
  return open().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store       = transaction.objectStore(STORE_NAME);
    const request     = run(store);
    transaction.onerror    = () => reject(transaction.error);
    transaction.oncomplete = () => resolve(request?.result);
  }));
}

export const idbGet = (key)        => tx('readonly',  (s) => s.get(key));
export const idbSet = (key, value) => tx('readwrite', (s) => s.put(value, key));
export const idbDel = (key)        => tx('readwrite', (s) => s.delete(key));
