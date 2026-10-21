import * as Expo from "expo-location";
import {
  browserPosition,
  browserWatch,
  browserGeolocation,
} from "./locationBrowser";
export { Accuracy } from "expo-location";
export type { LocationObject, LocationSubscription } from "expo-location";
let last: Expo.LocationObject | null = null;
const convert = (p: GeolocationPosition): Expo.LocationObject => ({
  timestamp: p.timestamp,
  coords: {
    latitude: p.coords.latitude,
    longitude: p.coords.longitude,
    accuracy: p.coords.accuracy,
    altitude: p.coords.altitude,
    altitudeAccuracy: p.coords.altitudeAccuracy,
    heading: p.coords.heading,
    speed: p.coords.speed,
  },
});
export async function requestForegroundPermissionsAsync(): Promise<Expo.LocationPermissionResponse> {
  try {
    last = convert(await browserPosition());
    return {
      status: Expo.PermissionStatus.GRANTED,
      granted: true,
      canAskAgain: true,
      expires: "never",
    };
  } catch (e: any) {
    if (e.code !== 1) throw e;
    last = null;
    return {
      status: Expo.PermissionStatus.DENIED,
      granted: false,
      canAskAgain: false,
      expires: "never",
    };
  }
}
export async function getCurrentPositionAsync(_options?: Expo.LocationOptions) {
  if (last && Date.now() - last.timestamp < 5000) return last;
  last = convert(await browserPosition());
  return last;
}
export async function hasServicesEnabledAsync() {
  browserGeolocation();
  return true;
}
export async function reverseGeocodeAsync(
  _position: Pick<Expo.LocationGeocodedLocation, "latitude" | "longitude">,
): Promise<Expo.LocationGeocodedAddress[]> {
  return [];
}
export async function watchPositionAsync(
  _options: Expo.LocationOptions,
  callback: Expo.LocationCallback,
  errorHandler?: (reason: string) => void,
): Promise<Expo.LocationSubscription> {
  return browserWatch(
    (p) => {
      last = convert(p);
      callback(last);
    },
    (e) => errorHandler?.(e.message),
  );
}
