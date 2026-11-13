import {recoveredCreateDraft} from './cooperativeCreateDraft';
import * as Crypto from 'expo-crypto';
import { api } from '../services/api';
import { sessionService } from '../services/sessionService';
import { enqueueSyncItem, getPendingSyncItems } from '../database/repositories/syncQueueRepository';
import { durableGet, durablePut } from './durableStorage';
import { saveRead, markCacheFault } from './readCache';
export type CreateKind = 'GENERATOR_CREATE' | 'PEV_CREATE';
export async function queueCooperativeCreate(operationId: string, kind: CreateKind, data: unknown, expectedOwner: string) { const old = (await getPendingSyncItems()).find(q => q?.id === 'mobile:' + operationId); if (old)
    return; await enqueueSyncItem({ id: 'mobile:' + operationId, operationType: 'COOPERATIVE_CREATE', entityType: 'COOPERATIVE_RECORD', entityId: operationId, payload: { operationId, kind, data }, expectedOwner }); void import('./syncManager').then(m => m.syncManager.runSyncNow({ entityId: operationId })); }
export const newCreateOperation = () => Crypto.randomUUID();
export async function syncCooperativeCreate(payload: any) { const user = await sessionService.getUser() as any; if (!user || user.id !== payload.__ownerId)
    throw Error('A conta mudou. A pendência permanece na conta original.'); const response = await api.post<{
    kind: CreateKind;
    entity: any;
    replayed: boolean;
}>('/mobile-offline/operations', { operationId: payload.operationId, kind: payload.kind, data: payload.data }, true, payload.__ownerId); if (!response.entity?.id)
    throw Error('O cadastro ainda não foi confirmado pelo servidor.'); const kind = response.kind === 'PEV_CREATE' ? 'pevs' : 'generators'; await durablePut('result:' + user.id + ':' + payload.operationId, { kind, entityId: response.entity.id, savedAt: new Date().toISOString() }); try {
    await saveRead(user.id, `/cooperative-field/${kind}/${response.entity.id}?filter=all&page=1`, { item: response.entity, collections: [], requests: [], summary: { pending: 0, active: 0, incidents: 0 }, pagination: { page: 1, total: 0, totalPages: 1 } });
}
catch (e: any) {
    markCacheFault(e.message);
} }
export const createResult = (owner: string, id: string) => durableGet<{
    kind: string;
    entityId: string;
    savedAt: string;
}>('result:' + owner + ':' + id);
export async function recoverCooperativeCreate(id: string) {
    const { removeOwnedSyncItem } = await import('../database/repositories/syncQueueRepository');
    const work = async () => { const q = (await getPendingSyncItems()).find(q => q?.entityId === id && q.operationType === 'COOPERATIVE_CREATE'); if (!q || q.status !== 'ERROR' || !q.errorMessage?.startsWith('[REVISÃO]'))
        throw Error('Aguarde a confirmação ou a revisão do envio antes de corrigir.'); const status = await api.get<{
        state: string;
    }>(`/mobile-offline/operations/${encodeURIComponent(id)}`, true); if (status.state !== 'NOT_RECORDED')
        throw Error('Esta operação já foi confirmada no servidor. Tente sincronizar os mesmos dados e confira o cadastro antes de alterar.'); const user = await sessionService.getUser() as any; if (user?.id !== q.payload.__ownerId)
        throw Error('A conta mudou.'); const payload = q.payload.data, operationId = newCreateOperation(), pev = q.payload.kind === 'PEV_CREATE'; const value=recoveredCreateDraft(payload,pev); await durablePut('draft:' + user.id + ':create:' + operationId, { ownerId: user.id, name: 'create:' + operationId, title: pev ? 'Corrigir PEV' : 'Corrigir gerador', value, savedAt: new Date().toISOString() }); await removeOwnedSyncItem(q.id); return { operationId, pev }; };
    if (typeof navigator !== 'undefined' && navigator.locks)
        return navigator.locks.request('katua-offline-sync', { ifAvailable: true }, async (lock) => { if (!lock)
            throw Error('Aguarde a outra aba terminar a sincronização.'); return work(); });
    return work();
}
