import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

export type ConnectivityStatus = {
  isConnected: boolean;
  isInternetReachable: boolean;
  isOffline: boolean;
};

function mapStateToConnectivity(state: NetInfoState): ConnectivityStatus {
  const isConnected = Boolean(state.isConnected);
  const isInternetReachable = Boolean(state.isInternetReachable);
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