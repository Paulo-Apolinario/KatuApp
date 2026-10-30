import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
const key = "katu.session.token";
export async function readToken() {
  const token = await SecureStore.getItemAsync(key);
  if (token) return token;
  const legacy = await AsyncStorage.getItem("@katu:token");
  if (legacy) {
    await writeToken(legacy);
    return legacy;
  }
  return null;
}
export async function writeToken(token: string) {
  await SecureStore.setItemAsync(key, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await AsyncStorage.removeItem("@katu:token");
}
export async function removeToken() {
  await SecureStore.deleteItemAsync(key);
  await AsyncStorage.removeItem("@katu:token");
}
