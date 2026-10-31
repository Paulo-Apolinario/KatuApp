import { Redirect } from "expo-router";
export default function LegacyScreen() {
  return <Redirect href={'/(cooperativa)/catadores' as any} />;
}
