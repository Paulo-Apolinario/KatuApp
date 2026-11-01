import AsyncStorage from '@react-native-async-storage/async-storage';
let writer: Promise<unknown> = Promise.resolve();
export const hasDurableStorage = () => true;
export async function durableGet<T>(key: string): Promise<T | undefined> { const value = await AsyncStorage.getItem('@katua:kv:' + key); return value ? JSON.parse(value) : undefined; }
export function durableAtomic<T, R>(key: string, fn: (value: T | undefined) => {
    value?: T;
    result: R;
    remove?: boolean;
    unchanged?: boolean;
}): Promise<R> { const result = writer.then(async () => { const out = fn(await durableGet<T>(key)); if (out.remove)
    await AsyncStorage.removeItem('@katua:kv:' + key);
else if (!out.unchanged)
    await AsyncStorage.setItem('@katua:kv:' + key, JSON.stringify(out.value)); return out.result; }); writer = result.catch(() => { }); return result; }
export const durablePut = async <T,>(key: string, value: T) => durableAtomic<T, void>(key, () => ({ value, result: undefined }));
export const durableRemove = async (key: string) => durableAtomic<unknown, void>(key, () => ({ remove: true, result: undefined }));
export async function durableKeys(prefix: string) { return (await AsyncStorage.getAllKeys()).filter(k => k.startsWith('@katua:kv:' + prefix)).map(k => k.slice(10)); }
