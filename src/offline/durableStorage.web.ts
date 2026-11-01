import { beginLocalWrite } from "./saveGuard";
/** App records live in IndexedDB, never in the service worker's public asset cache. */
let database: Promise<IDBDatabase> | null = null;
export const hasDurableStorage = () => typeof indexedDB !== 'undefined';
function db() { if (!database)
    database = new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('katua-offline-v1', 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('records'))
        request.result.createObjectStore('records'); }; request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); database = null; }; resolve(request.result); }; request.onerror = () => { database = null; reject(Error('Não foi possível abrir o armazenamento do aparelho. Os dados não foram descartados.')); }; request.onblocked = () => reject(Error('Feche outras abas do KATUÁ e tente novamente para abrir o armazenamento.')); }); return database; }
async function atomicImpl<T, R>(key: string, fn: (value: T | undefined) => {
    value?: T;
    result: R;
    remove?: boolean;
    unchanged?: boolean;
}): Promise<R> {
    if (!hasDurableStorage()) {
        if (typeof localStorage === 'undefined')
            throw Error('Armazenamento local indisponível.');
        const old = localStorage.getItem('@katua:kv:' + key);
        const out = fn(old ? JSON.parse(old) : undefined);
        if (out.remove)
            localStorage.removeItem('@katua:kv:' + key);
        else if (!out.unchanged)
            localStorage.setItem('@katua:kv:' + key, JSON.stringify(out.value));
        return out.result;
    }
    const database = await db();
    return new Promise((resolve, reject) => { const tx = database.transaction('records', 'readwrite'), store = tx.objectStore('records'), request = store.get(key); let result: R; tx.oncomplete = () => resolve(result); tx.onerror = () => reject(Error(tx.error?.name === 'QuotaExceededError' ? 'Armazenamento do aparelho cheio. O registro não foi salvo; libere espaço e tente novamente.' : 'Não foi possível salvar no aparelho. Mantenha esta tela aberta e tente novamente.')); tx.onabort = () => reject(Error('O salvamento no aparelho foi interrompido. Tente novamente.')); request.onsuccess = () => { try {
        const out = fn(request.result);
        result = out.result;
        if (out.remove)
            store.delete(key);
        else if (!out.unchanged)
            store.put(out.value, key);
    }
    catch (e) {
        tx.abort();
        reject(e);
    } }; });
}
export async function durableGet<T>(key: string): Promise<T | undefined> { if (!hasDurableStorage()) {
    const value = typeof localStorage !== 'undefined' ? localStorage.getItem('@katua:kv:' + key) : null;
    return value ? JSON.parse(value) : undefined;
} const database = await db(); return new Promise((resolve, reject) => { const tx = database.transaction('records', 'readonly'), request = tx.objectStore('records').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(Error('Não foi possível ler os dados do aparelho.')); }); }
export const durablePut = async <T,>(key: string, value: T) => durableAtomic<T, void>(key, () => ({ value, result: undefined }));
export const durableRemove = async (key: string) => durableAtomic<unknown, void>(key, () => ({ remove: true, result: undefined }));
export async function durableKeys(prefix: string) { if (!hasDurableStorage())
    return Object.keys(localStorage).filter(k => k.startsWith('@katua:kv:' + prefix)).map(k => k.slice(10)); const database = await db(); return new Promise<string[]>((resolve, reject) => { const tx = database.transaction('records', 'readonly'), r = tx.objectStore('records').getAllKeys(); r.onsuccess = () => resolve(r.result.map(String).filter(k => k.startsWith(prefix))); r.onerror = () => reject(Error('Não foi possível consultar dados locais.')); }); }
export async function durableAtomic<T, R>(key: string, fn: (value: T | undefined) => {
    value?: T;
    result: R;
    remove?: boolean;
    unchanged?: boolean;
}): Promise<R> { const done = beginLocalWrite(); try {
    return await atomicImpl(key, fn);
}
finally {
    done();
} }
