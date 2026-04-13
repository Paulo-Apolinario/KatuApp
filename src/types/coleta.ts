export type CollectionMaterial = {
  type: string;
  quantityKg: number;
};

export type CollectionStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type Collection = {
  id: string;
  cooperativeId?: string;
  generatorId?: string | null;
  collectorId?: string | null;
  scheduleId?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  routeId?: string | null;

  createdAt?: string;
  updatedAt?: string;
  collectedAt?: string | null;

  totalWeightKg?: number;
  notes?: string | null;
  status: CollectionStatus;

  materials?: CollectionMaterial[];

  generator?: {
    id: string;
    name?: string;
    businessName?: string;
  } | null;

  collector?: {
    id: string;
    name?: string;
  } | null;

  driver?: {
    id: string;
    name?: string;
  } | null;

  vehicle?: {
    id: string;
    plate?: string;
    model?: string;
  } | null;

  route?: {
    id: string;
    name?: string;
  } | null;
};