import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { beginSharing, endSharing, ownedSharingSession, sendDriverPosition, onSharingStopped, recordSharingError } from './driverTrackingCore';
import { DRIVER_LOCATION_TASK } from './driverTrackingTask';
import { readToken, writeToken } from './tokenStorage';
let watcher: Location.LocationSubscription | null = null;
onSharingStopped(() => {
  watcher?.remove();
  watcher = null;
});
export async function restoreSharing() {
  const session = await ownedSharingSession();
  if (!session) return;
  if (session.mode === 'BACKGROUND') {
    if (!(await TaskManager.isAvailableAsync()) || !(await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK))) await endSharing();
    return;
  }
  if (watcher) return;
  watcher = await Location.watchPositionAsync({
    accuracy: Location.Accuracy.High,
    distanceInterval: 0,
    timeInterval: 5000
  }, p => void sendDriverPosition(p).catch(e => recordSharingError(e.message)), reason => recordSharingError(reason));
}
export async function startSharing(context: {
  routeId?: string;
  collectionId?: string;
}) {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) throw Error('Permita o acesso ao GPS para compartilhar durante o serviço.');
  const canBackground = await TaskManager.isAvailableAsync().catch(()=>false);
  let background = false;
  if (canBackground) {
    try {const grant = await Location.requestBackgroundPermissionsAsync(); background = grant.granted;} catch {background=false;}
  }
  await stopSharing();
  const token = await readToken();
  if (token) await writeToken(token, background);
  const session = await beginSharing(context, background ? 'BACKGROUND' : 'FOREGROUND');
  try {
    if (background) await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 0,
      timeInterval: 10000,
      deferredUpdatesInterval: 10000,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Katuá · localização em serviço',
        notificationBody: 'Sua cooperativa acompanha sua localização. Encerre pelo App ao finalizar o serviço.',
        killServiceOnDestroy: true
      }
    });else await restoreSharing();
    void Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High
    }).then(sendDriverPosition).catch(() => {});
    return session;
  } catch (e) {
    await stopSharing().catch(() => {});
    throw e;
  }
}
export async function stopSharing() {
  watcher?.remove();
  watcher = null;
  try {
    if ((await TaskManager.isAvailableAsync()) && (await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK))) await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  } finally {
    await endSharing();
  }
}
