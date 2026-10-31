import AsyncStorage from "@react-native-async-storage/async-storage";
const key = "@katu:token";
export const readToken = () => AsyncStorage.getItem(key);
export const writeToken = (token: string, _background = false) => AsyncStorage.setItem(key, token);
export const removeToken = () => AsyncStorage.removeItem(key);
