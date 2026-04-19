import  { syncEngine } from "./syncEngine";

type SyncResult = {
  success: boolean;
  message: string;
  processed: number;
};

let syncing = false;

export async function runSyncNow(): Promise<SyncResult> {
  if (syncing) {
    return {
      success: false,
      message: "Sincronização já está em andamento.",
      processed: 0,
    };
  }

  syncing = true;

  try {
    const result = await syncEngine.syncPendingOperations();

    return {
      success: result.success,
      message: result.message,
      processed: result.processed,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Erro ao executar sincronização.",
      processed: 0,
    };
  } finally {
    syncing = false;
  }
}

export function isSyncRunning() {
  return syncing;
}

export const syncManager = {
  runSyncNow,
  isSyncRunning,
};

export default syncManager;