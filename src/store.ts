/* Saves each template's photos and handwriting to IndexedDB so a reload or an offline return keeps the work.
   Photos picked from the device are stored as Blobs; sample photos as their data URI. */

export interface SavedPhoto { src: string | null; blob: Blob | null; nw: number; nh: number; z: number; x: number; y: number }
export interface Saved { photos: Record<string, SavedPhoto>; texts: Record<string, string> }

export const Store = (() => {
  const DB = 'scrappy', TABLE = 'projects';
  let dbp: Promise<IDBDatabase> | null = null;
  const open = () => dbp ||= new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(TABLE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => {
    const db = await open();
    return new Promise<T | undefined>((res, rej) => {
      const t = db.transaction(TABLE, mode), out = fn(t.objectStore(TABLE));
      t.oncomplete = () => res(out && out.result);
      t.onerror = t.onabort = () => rej(t.error);
    });
  };
  const timers: Record<string, ReturnType<typeof setTimeout>> = {};
  return {
    get: (id: string): Promise<Saved | undefined> => tx<Saved>('readonly', (s) => s.get(id)).catch(() => undefined),
    put: (id: string, v: Saved) => tx('readwrite', (s) => s.put(v, id)).catch(() => {}),
    clear: (id: string) => tx('readwrite', (s) => s.delete(id)).catch(() => {}),
    /* debounced save of one template's current state */
    save(id: string, getSnapshot: () => Saved) {
      clearTimeout(timers[id]);
      timers[id] = setTimeout(() => Store.put(id, getSnapshot()), 350);
    }
  };
})();
