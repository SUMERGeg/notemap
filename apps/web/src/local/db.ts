// A single state record makes domain changes and photo cascades one IDB commit.
export type LocalState = {
  profile: { id: string; email: string; nickname?: string; avatar_color?: string };
  places: any[]; notes: any[]; itemTypes: any[]; reviews: any[];
  collections: any[]; imports: any[]; snapshots: any[]; receipts: Record<string, any>;
};
export type LocalPhoto = { id: string; note_id: string; blob: Blob; created_at: string; mime_type: string; size_bytes: number };
export const DATABASE_NAME = 'notemap-local';

export function createState(): LocalState {
  return { profile: { id: crypto.randomUUID(), email: 'На этом устройстве' }, places: [], notes: [], itemTypes: [], reviews: [], collections: [], imports: [], snapshots: [], receipts: {} };
}

let opening: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) return Promise.reject(new Error('Браузер не поддерживает локальное хранилище IndexedDB.'));
  if (!opening) opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('state');
      request.result.createObjectStore('photos', { keyPath: 'id' });
    };
    request.onerror = () => reject(storageError(request.error));
    request.onblocked = () => reject(new Error('Закрой другие вкладки Notemap и повтори попытку.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); opening = undefined; };
      resolve(db);
    };
  }).catch(error => { opening = undefined; throw error; });
  return opening;
}

function storageError(error: unknown): Error {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') return new Error('Недостаточно места в хранилище браузера. Сохрани резервную копию и освободи место.');
  if (error instanceof DOMException) return new Error('Браузер не смог сохранить данные. Проверь доступ к хранилищу и повтори попытку.');
  return error instanceof Error ? error : new Error('Не удалось открыть локальное хранилище.');
}

export type DatabaseContents = { state: LocalState; photos: LocalPhoto[] };
async function transaction<T>(write: boolean, work: (contents: DatabaseContents) => T): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    try { tx = db.transaction(['state', 'photos'], write ? 'readwrite' : 'readonly'); }
    catch (error) { reject(storageError(error)); return; }
    let result: T; let failure: unknown; let state: LocalState | undefined; let photos: LocalPhoto[] = []; let ready = 0;
    const stateStore = tx.objectStore('state'); const photoStore = tx.objectStore('photos');
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(storageError(failure ?? tx.error));
    tx.onerror = () => { failure ??= tx.error; };
    function finishRead() {
      if (++ready !== 2) return;
      try {
        const contents = { state: state ?? createState(), photos };
        result = work(contents);
        if (result instanceof Promise) throw new Error('Изменение локальных данных должно быть синхронным.');
        if (write) {
          // Always enforce the cascade, including mutations from backup/import code.
          cascadeNotes(contents.state);
          stateStore.put(contents.state, 'current');
          const noteIds = new Set(contents.state.notes.map(row => row.id));
          for (const row of photos) if (!noteIds.has(row.note_id) || !contents.photos.some(photo => photo.id === row.id)) photoStore.delete(row.id);
          const existingPhotos = new Map(photos.map(row => [row.id, row]));
          for (const row of contents.photos) {
            if (!noteIds.has(row.note_id)) continue;
            if (existingPhotos.get(row.id) !== row) photoStore.put(row);
          }
        }
      } catch (error) { failure = error; tx.abort(); }
    }
    const stateRequest = stateStore.get('current');
    stateRequest.onsuccess = () => { state = stateRequest.result; finishRead(); };
    const photosRequest = photoStore.getAll();
    photosRequest.onsuccess = () => { photos = photosRequest.result; finishRead(); };
  });
}

export function cascadeNotes(state: LocalState): void {
  const noteIds = new Set(state.notes.map(row => row.id));
  state.reviews = state.reviews.filter(row => noteIds.has(row.note_id));
  for (const collection of state.collections) collection.note_ids = collection.note_ids.filter((id: string) => noteIds.has(id));
}

// Read through a write transaction to persist the generated profile on first use.
export function readState(): Promise<LocalState> { return transaction(true, contents => structuredClone(contents.state)); }
export function mutateState<T>(work: (state: LocalState) => T): Promise<T> { return transaction(true, contents => work(contents.state)); }
export function mutateDatabase<T>(work: (contents: DatabaseContents) => T): Promise<T> { return transaction(true, work); }
export function getPhoto(id: string): Promise<LocalPhoto | undefined> { return transaction(false, contents => contents.photos.find(row => row.id === id)); }
export function listPhotos(noteId?: string): Promise<LocalPhoto[]> { return transaction(false, contents => contents.photos.filter(row => !noteId || row.note_id === noteId)); }
export function putPhoto(row: LocalPhoto): Promise<void> {
  return transaction(true, contents => {
    if (!contents.state.notes.some(note => note.id === row.note_id)) throw new Error('Заметка не найдена.');
    if (!row.id || !(row.blob instanceof Blob) || row.blob.size <= 0 || row.blob.size > 10 * 1024 * 1024 || row.blob.size !== row.size_bytes || row.blob.type !== row.mime_type || !['image/jpeg', 'image/png', 'image/webp'].includes(row.mime_type)) throw new Error('Некорректные данные фотографии.');
    const existing = contents.photos.find(photo => photo.id === row.id);
    if (existing && existing.note_id !== row.note_id) throw new Error('Фотография принадлежит другой заметке.');
    if (!existing && contents.photos.filter(photo => photo.note_id === row.note_id).length >= 10) throw new Error('Можно сохранить не больше 10 фото к одной заметке.');
    contents.photos = [...contents.photos.filter(photo => photo.id !== row.id), row];
  });
}
export function deletePhoto(id: string): Promise<void> { return transaction(true, contents => { contents.photos = contents.photos.filter(row => row.id !== id); }); }
export function exportDatabase(): Promise<DatabaseContents> { return transaction(true, contents => structuredClone(contents)); }
export function replaceDatabase(state: LocalState, photos: LocalPhoto[]): Promise<void> {
  return transaction(true, contents => {
    const noteIds = new Set(state.notes.map(row => row.id));
    const photoIds = new Set<string>(); const counts = new Map<string, number>();
    for (const row of photos) {
      const count = (counts.get(row.note_id) ?? 0) + 1; counts.set(row.note_id, count);
      if (!noteIds.has(row.note_id) || photoIds.has(row.id) || count > 10 || !(row.blob instanceof Blob) || row.blob.size <= 0 || row.blob.size > 10 * 1024 * 1024 || row.blob.size !== row.size_bytes || row.blob.type !== row.mime_type || !['image/jpeg', 'image/png', 'image/webp'].includes(row.mime_type)) throw new Error('Резервная копия содержит некорректные фотографии.');
      photoIds.add(row.id);
    }
    contents.state = structuredClone(state); contents.photos = structuredClone(photos);
  });
}
