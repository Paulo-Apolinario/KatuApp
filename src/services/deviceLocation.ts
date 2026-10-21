import * as Expo from "expo-location";
export {
  Accuracy,
  requestForegroundPermissionsAsync,
  watchPositionAsync,
  hasServicesEnabledAsync,
} from "expo-location";
export type { LocationObject, LocationSubscription } from "expo-location";
export async function getCurrentPositionAsync(
  options: Expo.LocationOptions = {},
) {
  if (!(await Expo.hasServicesEnabledAsync()))
    throw new Error(
      "A localização está desativada no aparelho. Ative o GPS e tente novamente.",
    );
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      Expo.getCurrentPositionAsync({
        accuracy: Expo.Accuracy.High,
        ...options,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "O GPS não respondeu a tempo. Vá para uma área aberta e tente novamente.",
              ),
            ),
          18000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
export async function reverseGeocodeAsync(
  position: Pick<Expo.LocationGeocodedLocation, "latitude" | "longitude">,
) {
  try {
    return await Expo.reverseGeocodeAsync(position);
  } catch {
    return [];
  }
}
