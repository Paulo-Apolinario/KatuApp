import { Redirect } from "expo-router";
export default function LegacyScreen() {
  return <Redirect href={'/(cooperativa)/field-map?kind=generators' as any} />;
}
