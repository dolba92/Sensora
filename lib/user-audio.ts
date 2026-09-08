export type UserSound = { id: string; name: string; blob: Blob };
const DB = 'auto-user-audio';
function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore('sounds', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function getUserSounds(): Promise<UserSound[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const r = db.transaction('sounds').objectStore('sounds').getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function saveUserSound(sound: UserSound) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const r = db
      .transaction('sounds', 'readwrite')
      .objectStore('sounds')
      .put(sound);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}
export async function deleteUserSound(id: string) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const r = db
      .transaction('sounds', 'readwrite')
      .objectStore('sounds')
      .delete(id);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}
