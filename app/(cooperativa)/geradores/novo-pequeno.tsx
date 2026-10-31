import { Redirect } from "expo-router";
export default function LegacyScreen() {
  return <Redirect href={'/(cooperativa)/geradores/novo' as any} />;
}
