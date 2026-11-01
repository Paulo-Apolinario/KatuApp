import { Platform } from 'react-native';
import { durableGet, durablePut, durableKeys, durableRemove } from './durableStorage';
export const canCacheRead = (path: string) => Platform.OS === 'web' && /^\/(cooperative-field\/(collectors|drivers|generators|pevs)([/?]|$)|reports\/|generators([/?]|$)|collectors([/?]|$)|bins([/?]|$)|drivers([/?]|$)|vehicles([/?]|$)|residential\/(overview|requests|pevs)([/?]|$)|impact([/?]|$)|pev-requests([/?]|$))/.test(path);
export async function saveRead(owner: string, path: string, data: unknown) { await durablePut('read:' + owner + ':' + path, { data, savedAt: new Date().toISOString() }); }
export const cachedRead = (owner: string, path: string) => durableGet<{
    data: any;
    savedAt: string;
}>('read:' + owner + ':' + path);
export async function invalidateReads(owner: string) { for (const key of await durableKeys('read:' + owner + ':'))
    await durableRemove(key); }
let cacheFault = '';
export const resetCacheFault = () => { cacheFault = ''; };
export const readCacheFault = () => cacheFault;
export const markCacheFault = (message: string) => { cacheFault = message; };
export async function cachedDirectory(owner: string, path: string) { const url = new URL(path, 'https://local.invalid'), match = url.pathname.match(/^\/cooperative-field\/(collectors|drivers|generators|pevs)$/); if (!match)
    return; const keys = await durableKeys('read:' + owner + ':/cooperative-field/' + match[1]); const snapshots = (await Promise.all(keys.map(k => durableGet<{
    data: any;
    savedAt: string;
}>(k)))).filter((v): v is {
    data: any;
    savedAt: string;
} => !!v).sort((a, b) => a.savedAt.localeCompare(b.savedAt)); if (!snapshots.length)
    return; const records = new Map<string, any>(); for (const s of snapshots)
    for (const item of s.data.items || [s.data.item].filter(Boolean))
        records.set(item.id, item); const normalize = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR'); const term = normalize(url.searchParams.get('q') || ''); const all = [...records.values()].filter(v => normalize([v.name, v.companyName, v.binId, v.address, v.street, v.neighborhood].filter(Boolean).join(' ')).includes(term)).sort((a, b) => (a.name || a.binId || '').localeCompare(b.name || b.binId || '', 'pt-BR')); const totalPages = Math.max(1, Math.ceil(all.length / 20)), page = Math.min(totalPages, Math.max(1, Number(url.searchParams.get('page')) || 1)); return { items: all.slice((page - 1) * 20, page * 20), pagination: { page, total: all.length, totalPages }, offline: true }; }
const localReads = new Map<string, {
    savedAt: string;
    at: number;
}>();
export const markLocalRead = (owner: string, path: string, savedAt: string) => localReads.set(owner + ':' + path, { savedAt, at: Date.now() });
export const clearLocalRead = (owner: string, path: string) => localReads.delete(owner + ':' + path);
export function localReadNotice(owner: string) { return [...localReads.entries()].filter(([k]) => k.startsWith(owner + ':')).map(([, v]) => v).sort((a, b) => b.at - a.at)[0]?.savedAt || ''; }
