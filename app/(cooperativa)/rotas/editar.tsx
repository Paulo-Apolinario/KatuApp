import { useLocalSearchParams } from "expo-router";
import RouteEditor from "@/src/components/routes/RouteEditor";
export default function EditRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RouteEditor routeId={id} />;
}
