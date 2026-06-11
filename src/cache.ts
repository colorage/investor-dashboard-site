import type { ReturnSnapshot } from "./returns";

const DB_NAME = "invester-dashboard";
const STORE_NAME = "quotes";
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface CachedQuote {
  symbol: string;
  snapshot: ReturnSnapshot;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "symbol" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    Promise.resolve(fn(store))
      .then((result) => {
        tx.oncomplete = () => resolve(result as T);
        tx.onerror = () => reject(tx.error);
      })
      .catch(reject);
  });
}

export async function getCachedQuote(symbol: string): Promise<CachedQuote | null> {
  return withStore("readonly", (store) => {
    return new Promise<CachedQuote | null>((resolve, reject) => {
      const req = store.get(symbol);
      req.onsuccess = () => {
        const row = req.result as CachedQuote | undefined;
        if (!row || Date.now() - row.updatedAt > CACHE_TTL_MS) {
          resolve(null);
          return;
        }
        resolve(row);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function getAllCachedQuotes(): Promise<Map<string, CachedQuote>> {
  return withStore("readonly", (store) => {
    return new Promise<Map<string, CachedQuote>>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const map = new Map<string, CachedQuote>();
        const now = Date.now();
        for (const row of req.result as CachedQuote[]) {
          if (row.symbol === "meta") continue;
          if (now - row.updatedAt <= CACHE_TTL_MS) {
            map.set(row.symbol, row);
          }
        }
        resolve(map);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function setCachedQuote(
  symbol: string,
  snapshot: ReturnSnapshot,
): Promise<void> {
  await withStore("readwrite", (store) => {
    store.put({ symbol, snapshot, updatedAt: Date.now() } satisfies CachedQuote);
    return store.transaction as unknown as IDBRequest;
  });
}

export async function clearCache(): Promise<void> {
  await withStore("readwrite", (store) => {
    store.clear();
    return store.transaction as unknown as IDBRequest;
  });
}

export async function getCacheAge(): Promise<Date | null> {
  const all = await getAllCachedQuotes();
  if (all.size === 0) return null;
  let newest = 0;
  for (const q of all.values()) {
    newest = Math.max(newest, q.updatedAt);
  }
  return newest ? new Date(newest) : null;
}
