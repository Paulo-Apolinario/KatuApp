import { useCallback, useEffect, useState } from "react";
import { getPendingSyncItems } from "../database/repositories/syncQueueRepository";
import { syncManager } from "../offline/syncManager";
export function useSyncStatus() {
  const [pending, setPending] = useState(0),
    [errors, setErrors] = useState(0),
    [message, setMessage] = useState("");
  const refresh = useCallback(async () => {
    const rows = await getPendingSyncItems();
    setPending(rows.length);
    setErrors(rows.filter((row) => row?.status === "ERROR").length);
  }, []);
  useEffect(() => {
    let active = true;
    const update = () => {
      if (active) void refresh().catch(() => {});
    };
    update();
    const timer = setInterval(update, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [refresh]);
  const sync = async () => {
    const result = await syncManager.runSyncNow();
    setMessage(result.message);
    await refresh();
    return result;
  };
  return { pending, errors, message, sync, refresh };
}
