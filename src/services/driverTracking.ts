import * as Location from './deviceLocation';
import { AppState } from 'react-native';
import { beginSharing, endSharing, ownedSharingSession, sendDriverPosition, onSharingStopped, recordSharingError } from './driverTrackingCore';
let watcher: Location.LocationSubscription | null = null;
onSharingStopped(() => {
  watcher?.remove();
  watcher = null;
});
export async function restoreSharing() {
  const session = await ownedSharingSession();
  if (!session || watcher) return;
  watcher = await Location.watchPositionAsync({
    accuracy: Location.Accuracy.High,
    distanceInterval: 0,
    timeInterval: 5000
  }, point => {
    if (AppState.currentState === 'active' || AppState.currentState === null) void sendDriverPosition(point).catch(e => recordSharingError(e.message));
  });
}
export async function startSharing(context: {
  routeId?: string;
  collectionId?: string;
}) {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw Error('Permita a localização do aparelho para compartilhar durante o serviço.');
  await stopSharing();
  const session = await beginSharing(context, 'FOREGROUND');
  try {
    await restoreSharing();
    await sendDriverPosition(await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High
    }));
    return session;
  } catch (e) {
    await stopSharing().catch(() => {});
    throw e;
  }
}
export async function stopSharing() {
  watcher?.remove();
  watcher = null;
  await endSharing();
}
