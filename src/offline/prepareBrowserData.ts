import { resetCacheFault, readCacheFault } from "./readCache";
import { scheduleService } from '../services/scheduleService';
import { api } from '../services/api';
import { collectionService } from '../services/collectionService';
import { routeService } from '../services/routeService';
import { fieldService, type FieldKind } from '../services/cooperativeFieldService';
async function prepare(role: string) { if (role === 'COOPERATIVE') {
    for (const kind of ['collectors', 'drivers', 'generators', 'pevs'] as FieldKind[]) {
        const list = await fieldService.list(kind);
        for (let i = 0; i < list.items.length; i += 3)
            await Promise.all(list.items.slice(i, i + 3).map(item => fieldService.detail(kind, item.id)));
    }
    return 'Primeira página dos cadastros e seus atendimentos baixados. Abra outras páginas online para guardá-las também.';
} if (['DRIVER', 'COLLECTOR'].includes(role)) {
    await Promise.all([collectionService.list(), routeService.list()]);
    if (role === 'COLLECTOR') {
        const { extraOrderService } = await import('../services/extraOrderService');
        await extraOrderService.context();
    }
    return 'Trabalhos disponíveis baixados. Abra o roteiro e os pontos que vai atender antes de sair.';
} if (role === 'PF') {
    await api.get('/residential/overview', true);
    return 'Resumo e solicitações baixados. Abra os detalhes que deseja consultar offline.';
} if (['GENERATOR_SMALL', 'GENERATOR_LARGE'].includes(role)) {
    await Promise.all([collectionService.list(), scheduleService.list()]);
    return 'Cadastro baixado. Abra as solicitações e os históricos online antes de sair.';
} return 'Abra as telas que precisa consultar para guardar os dados neste aparelho.'; }
export async function prepareBrowserData(role: string) { resetCacheFault(); const result = await prepare(role); if (readCacheFault())
    throw Error(readCacheFault()); return result; }
