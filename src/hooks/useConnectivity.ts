import { useEffect, useState } from "react";
import {
  getCurrentConnectivity,
  subscribeToConnectivity,
  type ConnectivityStatus,
} from "../offline/connectivity";

const INITIAL_STATE: ConnectivityStatus = {
  isConnected: true,
  isInternetReachable: true,
  isOffline: false,
};

export function useConnectivity() {
  const [status, setStatus] = useState<ConnectivityStatus>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const currentStatus = await getCurrentConnectivity();

        if (isMounted) {
          setStatus(currentStatus);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    const unsubscribe = subscribeToConnectivity((nextStatus) => {
      if (isMounted) {
        setStatus(nextStatus);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return {
    ...status,
    loading,
  };
}