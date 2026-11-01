import { Platform } from "react-native";
import { syncEngine } from "./syncEngine";
type SyncResult = {
    success: boolean;
    message: string;
    processed: number;
};
let activeSync: Promise<SyncResult> | null = null;
/** Chamadas simultâneas aguardam a mesma confirmação, sem abrir dois envios. */
export function runSyncNow(options?: {
    entityId?: string;
    manual?: boolean;
}): Promise<SyncResult> {
    if (activeSync)
        return activeSync;
    activeSync = (async () => {
        try {
            if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.locks)
                return await navigator.locks.request('katua-offline-sync', { ifAvailable: true }, async (lock) => lock ? syncEngine.syncPendingOperations(options) : { success: false, message: 'Outra aba está enviando os registros. Aguarde a confirmação.', processed: 0 });
            return await syncEngine.syncPendingOperations(options);
        }
        catch (error: any) {
            return {
                success: false,
                message: error?.message || "Erro ao executar sincronização.",
                processed: 0,
            };
        }
    })().finally(() => {
        activeSync = null;
    });
    return activeSync;
}
export function isSyncRunning() {
    return activeSync !== null;
}
export const syncManager = { runSyncNow, isSyncRunning };
export default syncManager;
