import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

export type ConnectivityStatus = {
  isConnected: boolean;
  isInternetReachable: boolean;
  isOffline: boolean;
};

function mapStateToConnectivity(state: NetInfoState): ConnectivityStatus {
  // NetInfo pode retornar null enquanto verifica a rede. Isso não confirma ausência de internet.
  const isConnected = state.isConnected !== false;
  const isInternetReachable = state.isInternetReachable !== false;
  const isOffline = !isConnected || !isInternetReachable;

  return {
    isConnected,
    isInternetReachable,
    isOffline,
  };
}

export async function getCurrentConnectivity(): Promise<ConnectivityStatus> {
  const state = await NetInfo.fetch();
  return mapStateToConnectivity(state);
}

export function subscribeToConnectivity(
  callback: (status: ConnectivityStatus) => void
) {
  return NetInfo.addEventListener((state) => {
    callback(mapStateToConnectivity(state));
  });
}