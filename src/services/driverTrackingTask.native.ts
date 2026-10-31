import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { sendDriverPosition, sharingSession } from './driverTrackingCore';
export const DRIVER_LOCATION_TASK = 'katua-driver-location-v1';
TaskManager.defineTask<{
  locations: Location.LocationObject[];
}>(DRIVER_LOCATION_TASK, async ({
  data,
  error
}) => {
  if (error) return;
  try {
    if (!(await sharingSession())) {
      if (await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK)) await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
      return;
    }
    const point = data?.locations?.at(-1);
    if (point) await sendDriverPosition(point);
    if (!(await sharingSession()) && (await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK))) await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  } catch {/* The next GPS fix retries; old points are never queued as live. */}
});
