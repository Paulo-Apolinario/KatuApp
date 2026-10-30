import { syncEngine } from "./syncEngine";
type SyncResult = { success: boolean; message: string; processed: number };
let activeSync: Promise<SyncResult> | null = null;
/** Chamadas simultâneas aguardam a mesma confirmação, sem abrir dois envios. */
export function runSyncNow(options?: { entityId?: string; manual?: boolean }): Promise<SyncResult> {
  if (activeSync) return activeSync;
  activeSync = (async () => {
    try {
      return await syncEngine.syncPendingOperations(options);
    } catch (error: any) {
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
