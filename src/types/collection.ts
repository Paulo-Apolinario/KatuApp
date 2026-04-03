export type CollectionStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface CollectionMaterial {
  type: string;
  quantityKg: number;
}

export interface Collection {
  id: string;
  cooperativeId: string;
  generatorId?: string | null;
  collectorId?: string | null;
  scheduleId?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  routeId?: string | null;

  collectedAt?: string | null;
  totalWeightKg: number;
  materials: CollectionMaterial[];
  notes?: string | null;
  status: CollectionStatus;
  createdAt?: string;
  updatedAt?: string;

  generator?: {
    id: string;
    name?: string | null;
    businessName?: string | null;
    companyName?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;

  collector?: {
    id: string;
    name?: string | null;
    displayName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;

  driver?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    cnh?: string | null;
    cnhCategory?: string | null;
    status?: string | null;
  } | null;

  vehicle?: {
    id: string;
    plate?: string | null;
    model?: string | null;
    brand?: string | null;
    year?: number | null;
    capacityKg?: number | null;
    status?: string | null;
  } | null;

  route?: {
  id: string;
  name?: string | null;
  description?: string | null;
  scheduledDate?: string | null;
  stops?: string[];
  status?: string | null;
  driverId?: string | null;
} | null;

  schedule?: {
    id: string;
    scheduledDate?: string | null;
    preferredDate?: string | null;
    status?: string | null;
    notes?: string | null;
    requestedBy?: {
      id: string;
      displayName?: string | null;
      email?: string | null;
      role?: string | null;
    } | null;
    generator?: {
      id: string;
      name?: string | null;
      businessName?: string | null;
      companyName?: string | null;
      address?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    } | null;
  } | null;
}