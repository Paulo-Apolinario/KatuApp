import Base from "./ExtraOrderAddressBase";
import { useAuth } from "../../contexts/AuthContext";
export { emptyAddressDraft } from "./ExtraOrderAddressBase";
export type { AddressDraft } from "./ExtraOrderAddressBase";
export default function AddressWeb(props: Parameters<typeof Base>[0]) {
  const { user } = useAuth();
  return <Base {...props} compact={user?.role === "COLLECTOR"} />;
}
