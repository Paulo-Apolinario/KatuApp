import {
  api,
  isApiNetworkError,
} from "./api";

import {
  getAllCollections,
  getCollectionById,
  getCollectionsByDriver as getCollectionsByDriverFromCache,
  getCollectionsByRoute as getCollectionsByRouteFromCache,
  upsertCollections,
} from "../database/repositories/collectionRepository";

import {
  enqueueSyncItem,
} from "../database/repositories/syncQueueRepository";

import {
  SYNC_ENTITY,
  SYNC_OPERATION,
} from "../database/schema";

import type {
  CancelCollectionPayload,
  Collection,
  CollectionMaterial,
  CompleteCollectionPayload,
  CompleteFieldCollectionPayload,
  CreateCollectionPayload,
  ReceiveCollectionPayload,
  StartCollectionPayload,
  StartSortingPayload,
  UpdateCollectionStatusPayload,
  WasteUnit,
} from "@/src/types/collection";

export type {
  CancelCollectionPayload,
  Collection,
  CollectionMaterial,
  CompleteCollectionPayload,
  CompleteFieldCollectionPayload,
  CreateCollectionPayload,
  ReceiveCollectionPayload,
  StartCollectionPayload,
  StartSortingPayload,
  UpdateCollectionStatusPayload,
  WasteUnit,
} from "@/src/types/collection";

/*
 * ============================================================
 * RESPOSTAS DA API
 * ============================================================
 */

type ListCollectionsApiResponse =
  | Collection[]
  | {
      collections?: Collection[];
      success?: boolean;
    };

type GetCollectionApiResponse =
  | Collection
  | {
      collection?: Collection;
      success?: boolean;
    };

type CollectionApiResponse = {
  collection?: Collection;
  success?: boolean;
};

/*
 * ============================================================
 * NORMALIZAÇÃO
 * ============================================================
 */

function normalizeOptionalText(
  value: unknown
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const normalized =
    String(value).trim();

  return normalized || null;
}

function normalizeNumber(
  value: unknown
): number {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const normalized =
    typeof value ===
    "string"
      ? value.replace(
          ",",
          "."
        )
      : value;

  const numeric =
    Number(normalized);

  return Number.isFinite(
    numeric
  )
    ? numeric
    : 0;
}

function normalizeWasteUnit(
  value: unknown
): WasteUnit {
  const normalized =
    String(value || "")
      .trim()
      .toUpperCase();

  const units: WasteUnit[] = [
    "KG",
    "TON",
    "LITER",
    "UNIT",
    "CUBIC_METER",
  ];

  return units.includes(
    normalized as WasteUnit
  )
    ? (normalized as WasteUnit)
    : "KG";
}

function normalizeMaterials(
  materials: unknown
): CollectionMaterial[] {
  if (
    !Array.isArray(
      materials
    )
  ) {
    return [];
  }

  return materials
    .map(
      (
        item
      ): CollectionMaterial | null => {
        if (
          typeof item ===
          "string"
        ) {
          const type =
            item.trim();

          if (!type) {
            return null;
          }

          return {
            type,
            name:
              type,
            quantity:
              0,
            quantityKg:
              0,
            unit:
              "KG",
          };
        }

        if (
          !item ||
          typeof item !==
            "object"
        ) {
          return null;
        }

        const material =
          item as Record<
            string,
            unknown
          >;

        const type =
          normalizeOptionalText(
            material.type
          ) ||
          normalizeOptionalText(
            material.name
          ) ||
          "";

        if (!type) {
          return null;
        }

        const unit =
          normalizeWasteUnit(
            material.unit
          );

        const quantity =
          material.quantity !==
            undefined
            ? normalizeNumber(
                material.quantity
              )
            : normalizeNumber(
                material.quantityKg
              );

        const quantityKg =
          material.quantityKg !==
            undefined
            ? normalizeNumber(
                material.quantityKg
              )
            : unit ===
                "KG"
              ? quantity
              : unit ===
                  "TON"
                ? quantity *
                  1000
                : 0;

        return {
          wasteTypeId:
            normalizeOptionalText(
              material.wasteTypeId
            ),

          type,

          name:
            normalizeOptionalText(
              material.name
            ) ||
            type,

          category:
            normalizeOptionalText(
              material.category
            ),

          subcategory:
            normalizeOptionalText(
              material.subcategory
            ),

          quantity,

          quantityKg,

          unit,

          notes:
            normalizeOptionalText(
              material.notes
            ),
        };
      }
    )
    .filter(
      (
        item
      ): item is CollectionMaterial =>
        item !== null
    );
}

function normalizeCollection(
  collection: Collection
): Collection {
  return {
    ...collection,

    totalWeightKg:
      normalizeNumber(
        collection.totalWeightKg
      ),

    materials:
      normalizeMaterials(
        collection.materials
      ),

    collectionMaterials:
      Array.isArray(
        collection.collectionMaterials
      )
        ? collection.collectionMaterials.map(
            (material) => ({
              ...material,

              quantity:
                material.quantity ===
                  undefined
                  ? undefined
                  : normalizeNumber(
                      material.quantity
                    ),

              wasteEntry:
                material.wasteEntry
                  ? {
                      ...material.wasteEntry,

                      collectedQuantity:
                        material
                          .wasteEntry
                          .collectedQuantity ===
                          undefined
                          ? undefined
                          : normalizeNumber(
                              material
                                .wasteEntry
                                .collectedQuantity
                            ),

                      destinedQuantity:
                        material
                          .wasteEntry
                          .destinedQuantity ===
                          undefined
                          ? undefined
                          : normalizeNumber(
                              material
                                .wasteEntry
                                .destinedQuantity
                            ),

                      remainingQuantity:
                        material
                          .wasteEntry
                          .remainingQuantity ===
                          undefined
                          ? undefined
                          : normalizeNumber(
                              material
                                .wasteEntry
                                .remainingQuantity
                            ),

                      destinations:
                        Array.isArray(
                          material
                            .wasteEntry
                            .destinations
                        )
                          ? material.wasteEntry.destinations.map(
                              (
                                destination
                              ) => ({
                                ...destination,

                                quantity:
                                  destination.quantity ===
                                    undefined
                                    ? undefined
                                    : normalizeNumber(
                                        destination.quantity
                                      ),
                              })
                            )
                          : [],
                    }
                  : null,
            })
          )
        : [],

    collectionWasteEntries:
      Array.isArray(
        collection.collectionWasteEntries
      )
        ? collection.collectionWasteEntries.map(
            (entry) => ({
              ...entry,

              collectedQuantity:
                entry.collectedQuantity ===
                  undefined
                  ? undefined
                  : normalizeNumber(
                      entry.collectedQuantity
                    ),

              destinedQuantity:
                entry.destinedQuantity ===
                  undefined
                  ? undefined
                  : normalizeNumber(
                      entry.destinedQuantity
                    ),

              remainingQuantity:
                entry.remainingQuantity ===
                  undefined
                  ? undefined
                  : normalizeNumber(
                      entry.remainingQuantity
                    ),

              destinations:
                Array.isArray(
                  entry.destinations
                )
                  ? entry.destinations.map(
                      (
                        destination
                      ) => ({
                        ...destination,

                        quantity:
                          destination.quantity ===
                            undefined
                            ? undefined
                            : normalizeNumber(
                                destination.quantity
                              ),
                      })
                    )
                  : [],
            })
          )
        : [],

    generator:
      collection.generator
        ? {
            ...collection.generator,

            latitude:
              collection.generator
                .latitude ===
                null ||
              collection.generator
                .latitude ===
                undefined
                ? null
                : normalizeNumber(
                    collection.generator
                      .latitude
                  ),

            longitude:
              collection.generator
                .longitude ===
                null ||
              collection.generator
                .longitude ===
                undefined
                ? null
                : normalizeNumber(
                    collection.generator
                      .longitude
                  ),
          }
        : null,

    schedule:
      collection.schedule
        ? {
            ...collection.schedule,

            requestedMaterials:
              Array.isArray(
                collection.schedule
                  .requestedMaterials
              )
                ? collection.schedule.requestedMaterials.map(
                    (material) => ({
                      ...material,

                      estimatedQuantity:
                        material.estimatedQuantity ===
                          null ||
                        material.estimatedQuantity ===
                          undefined
                          ? null
                          : normalizeNumber(
                              material.estimatedQuantity
                            ),

                      unit:
                        normalizeWasteUnit(
                          material.unit
                        ),
                    })
                  )
                : [],

            generator:
              collection.schedule
                .generator
                ? {
                    ...collection
                      .schedule
                      .generator,

                    latitude:
                      collection
                        .schedule
                        .generator
                        .latitude ===
                        null ||
                      collection
                        .schedule
                        .generator
                        .latitude ===
                        undefined
                        ? null
                        : normalizeNumber(
                            collection
                              .schedule
                              .generator
                              .latitude
                          ),

                    longitude:
                      collection
                        .schedule
                        .generator
                        .longitude ===
                        null ||
                      collection
                        .schedule
                        .generator
                        .longitude ===
                        undefined
                        ? null
                        : normalizeNumber(
                            collection
                              .schedule
                              .generator
                              .longitude
                          ),
                  }
                : null,
          }
        : null,
  };
}

/*
 * ============================================================
 * SERIALIZAÇÃO
 * ============================================================
 */

function serializeCompleteFieldMaterials(
  payload: CompleteFieldCollectionPayload
) {
  return payload.materials.map(
    (
      material,
      index
    ) => {
      const wasteTypeId =
        normalizeOptionalText(
          material.wasteTypeId
        );

      const proposedMaterial =
        material.proposedMaterial
          ? {
              name:
                String(
                  material
                    .proposedMaterial
                    .name ||
                    ""
                ).trim(),

              category:
                normalizeOptionalText(
                  material
                    .proposedMaterial
                    .category
                ) ||
                undefined,

              subcategory:
                normalizeOptionalText(
                  material
                    .proposedMaterial
                    .subcategory
                ) ||
                undefined,

              unit:
                normalizeWasteUnit(
                  material
                    .proposedMaterial
                    .unit
                ),
            }
          : undefined;

      if (
        !wasteTypeId &&
        !proposedMaterial?.name
      ) {
        throw new Error(
          `Material inválido na posição ${
            index + 1
          }.`
        );
      }

      if (
        wasteTypeId &&
        proposedMaterial
      ) {
        throw new Error(
          `Informe somente um material do catálogo ou um material proposto na posição ${
            index + 1
          }.`
        );
      }

      const quantity =
        normalizeNumber(
          material.quantity
        );

      if (
        quantity <= 0
      ) {
        throw new Error(
          `A quantidade do material na posição ${
            index + 1
          } deve ser maior que zero.`
        );
      }

      const unit =
        normalizeWasteUnit(
          material.unit ||
            proposedMaterial?.unit
        );

      return {
        wasteTypeId:
          wasteTypeId ||
          undefined,

        proposedMaterial,

        quantity,

        unit,

        notes:
          material.notes?.trim() ||
          undefined,
      };
    }
  );
}

/*
 * ============================================================
 * CACHE
 * ============================================================
 */

async function saveCollectionsToCache(
  collections: Collection[]
) {
  await upsertCollections(
    collections.map(
      (collection) => ({
        id:
          collection.id,

        status:
          collection.status,

        routeId:
          collection.routeId ??
          collection.route?.id ??
          null,

        driverId:
          collection.driverId ??
          collection.route
            ?.driverId ??
          null,

        collectorId:
          collection.collectorId ??
          collection.collector
            ?.id ??
          null,

        totalWeightKg:
          normalizeNumber(
            collection.totalWeightKg
          ),

        payload:
          collection,

        updatedAt:
          collection.updatedAt ??
          null,
      })
    )
  );
}

async function readCollectionsFromCache(): Promise<
  Collection[]
> {
  const rows =
    await getAllCollections();

  return rows
    .map(
      (row) =>
        row?.payload
    )
    .filter(
      (
        item
      ): item is Collection =>
        Boolean(item)
    )
    .map(
      normalizeCollection
    );
}

async function readCollectionByIdFromCache(
  id: string
): Promise<
  Collection | null
> {
  const row =
    await getCollectionById(
      id
    );

  if (!row?.payload) {
    return null;
  }

  return normalizeCollection(
    row.payload as Collection
  );
}

function createSyncQueueId(
  prefix: string,
  entityId: string
) {
  return `${prefix}_${entityId}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

async function saveCollectionStatusOffline(
  id: string,
  payload: UpdateCollectionStatusPayload
): Promise<
  Collection
> {
  const existing =
    await readCollectionByIdFromCache(
      id
    );

  if (!existing) {
    throw new Error(
      "Coleta não encontrada no cache local para atualização offline."
    );
  }

  const updatedCollection =
    normalizeCollection({
      ...existing,

      status:
        payload.status,

      collectedAt:
        payload.collectedAt !==
          undefined
          ? payload.collectedAt
          : existing.collectedAt ??
            null,

      totalWeightKg:
        payload.totalWeightKg !==
          undefined
          ? normalizeNumber(
              payload.totalWeightKg
            )
          : normalizeNumber(
              existing.totalWeightKg
            ),

      materials:
        payload.materials !==
          undefined
          ? normalizeMaterials(
              payload.materials
            )
          : normalizeMaterials(
              existing.materials
            ),

      notes:
        payload.notes !==
          undefined
          ? payload.notes?.trim() ||
            null
          : existing.notes ??
            null,

      cancellationReason:
        payload.cancellationReason !==
          undefined
          ? payload.cancellationReason
              .trim() ||
            null
          : existing.cancellationReason ??
            null,

      updatedAt:
        new Date().toISOString(),
    });

  await saveCollectionsToCache(
    [updatedCollection]
  );

  await enqueueSyncItem({
    id:
      createSyncQueueId(
        "collection_status",
        id
      ),

    operationType:
      SYNC_OPERATION.UPDATE_COLLECTION_STATUS,

    entityType:
      SYNC_ENTITY.COLLECTION,

    entityId:
      id,

    payload: {
      id,
      status:
        payload.status,
      collectedAt:
        payload.collectedAt ||
        undefined,
      totalWeightKg:
        payload.totalWeightKg,
      materials:
        payload.materials,
      notes:
        payload.notes?.trim() ||
        undefined,
      cancellationReason:
        payload.cancellationReason
          ?.trim() ||
        undefined,
    },
  });

  return updatedCollection;
}

/*
 * ============================================================
 * API — CONSULTAS
 * ============================================================
 */

async function list(): Promise<
  Collection[]
> {
  try {
    const response =
      await api.get<ListCollectionsApiResponse>(
        "/collections",
        true
      );

    const collections =
      Array.isArray(
        response
      )
        ? response
        : Array.isArray(
              response?.collections
            )
          ? response.collections
          : [];

    const normalized =
      collections.map(
        normalizeCollection
      );

    await saveCollectionsToCache(
      normalized
    );

    return normalized;
  } catch (error) {
    if (
      isApiNetworkError(
        error
      )
    ) {
      return readCollectionsFromCache();
    }

    throw error;
  }
}

async function listByDriver(
  driverId?: string | null
): Promise<
  Collection[]
> {
  if (!driverId) {
    return list();
  }

  try {
    const collections =
      await list();

    const filtered =
      collections.filter(
        (collection) =>
          collection.driverId ===
            driverId ||
          collection.route
            ?.driverId ===
            driverId
      );

    return filtered;
  } catch (error) {
    if (
      isApiNetworkError(
        error
      )
    ) {
      const rows =
        await getCollectionsByDriverFromCache(
          driverId
        );

      return rows
        .map(
          (row) =>
            row?.payload
        )
        .filter(
          (
            item
          ): item is Collection =>
            Boolean(item)
        )
        .map(
          normalizeCollection
        );
    }

    throw error;
  }
}

async function listByRoute(
  routeId?: string | null
): Promise<
  Collection[]
> {
  if (!routeId) {
    return list();
  }

  try {
    const collections =
      await list();

    return collections.filter(
      (collection) =>
        collection.routeId ===
        routeId
    );
  } catch (error) {
    if (
      isApiNetworkError(
        error
      )
    ) {
      const rows =
        await getCollectionsByRouteFromCache(
          routeId
        );

      return rows
        .map(
          (row) =>
            row?.payload
        )
        .filter(
          (
            item
          ): item is Collection =>
            Boolean(item)
        )
        .map(
          normalizeCollection
        );
    }

    throw error;
  }
}

async function listActiveByDriver(
  driverId?: string | null
): Promise<
  Collection[]
> {
  const collections =
    await listByDriver(
      driverId
    );

  return collections.filter(
    (collection) =>
      collection.status ===
        "PENDING" ||
      collection.status ===
        "IN_PROGRESS"
  );
}

async function getById(
  id: string
): Promise<
  Collection
> {
  const normalizedId =
    String(id || "").trim();

  if (!normalizedId) {
    throw new Error(
      "ID da coleta não informado."
    );
  }

  try {
    const response =
      await api.get<GetCollectionApiResponse>(
        `/collections/${normalizedId}`,
        true
      );

    const collection =
      response &&
      typeof response ===
        "object" &&
      "collection" in response
        ? response.collection
        : (response as Collection);

    if (!collection) {
      throw new Error(
        "Coleta não retornada pela API."
      );
    }

    const normalized =
      normalizeCollection(
        collection
      );

    await saveCollectionsToCache(
      [normalized]
    );

    return normalized;
  } catch (error) {
    if (
      isApiNetworkError(
        error
      )
    ) {
      const cached =
        await readCollectionByIdFromCache(
          normalizedId
        );

      if (cached) {
        return cached;
      }
    }

    throw error;
  }
}

/*
 * ============================================================
 * API — OPERAÇÕES
 * ============================================================
 */

async function create(
  payload: CreateCollectionPayload
): Promise<
  Collection
> {
  const response =
    await api.post<CollectionApiResponse>(
      "/collections",
      {
        scheduleId:
          payload.scheduleId,

        collectorId:
          payload.collectorId,

        driverId:
          payload.driverId ||
          undefined,

        vehicleId:
          payload.vehicleId ||
          undefined,

        routeId:
          payload.routeId ||
          undefined,

        notes:
          payload.notes?.trim() ||
          undefined,
      },
      true
    );

  if (!response?.collection) {
    throw new Error(
      "Coleta não retornada pela API."
    );
  }

  const normalized =
    normalizeCollection(
      response.collection
    );

  await saveCollectionsToCache(
    [normalized]
  );

  return normalized;
}

async function start(
  id: string,
  payload: StartCollectionPayload = {}
): Promise<
  Collection
> {
  return postCollectionAction(
    id,
    "start",
    {
      startedAt:
        payload.startedAt ||
        undefined,

      notes:
        payload.notes?.trim() ||
        undefined,
    }
  );
}

async function completeField(
  id: string,
  payload: CompleteFieldCollectionPayload
): Promise<
  Collection
> {
  const materials =
    serializeCompleteFieldMaterials(
      payload
    );

  return postCollectionAction(
    id,
    "complete-field",
    {
      collectedAt:
        payload.collectedAt ||
        undefined,

      materials,

      totalWeightKg:
        payload.totalWeightKg,

      notes:
        payload.notes?.trim() ||
        undefined,
    }
  );
}

async function receive(
  id: string,
  payload: ReceiveCollectionPayload = {}
): Promise<
  Collection
> {
  return postCollectionAction(
    id,
    "receive",
    {
      receivedAt:
        payload.receivedAt ||
        undefined,

      notes:
        payload.notes?.trim() ||
        undefined,
    }
  );
}

async function startSorting(
  id: string,
  payload: StartSortingPayload = {}
): Promise<
  Collection
> {
  return postCollectionAction(
    id,
    "start-sorting",
    {
      sortingStartedAt:
        payload.sortingStartedAt ||
        undefined,

      notes:
        payload.notes?.trim() ||
        undefined,
    }
  );
}

async function complete(
  id: string,
  payload: CompleteCollectionPayload = {}
): Promise<
  Collection
> {
  return postCollectionAction(
    id,
    "complete",
    {
      completedAt:
        payload.completedAt ||
        undefined,

      notes:
        payload.notes?.trim() ||
        undefined,
    }
  );
}

async function cancel(
  id: string,
  payload: CancelCollectionPayload
): Promise<
  Collection
> {
  const cancellationReason =
    payload.cancellationReason
      .trim();

  if (!cancellationReason) {
    throw new Error(
      "Informe o motivo do cancelamento."
    );
  }

  return postCollectionAction(
    id,
    "cancel",
    {
      cancelledAt:
        payload.cancelledAt ||
        undefined,

      cancellationReason,
    }
  );
}

async function postCollectionAction(
  id: string,
  action:
    | "start"
    | "complete-field"
    | "receive"
    | "start-sorting"
    | "complete"
    | "cancel",
  body: unknown
): Promise<
  Collection
> {
  const normalizedId =
    String(id || "").trim();

  if (!normalizedId) {
    throw new Error(
      "ID da coleta não informado."
    );
  }

  const response =
    await api.post<CollectionApiResponse>(
      `/collections/${normalizedId}/${action}`,
      body,
      true
    );

  if (!response?.collection) {
    throw new Error(
      "Coleta não retornada pela API."
    );
  }

  const normalized =
    normalizeCollection(
      response.collection
    );

  await saveCollectionsToCache(
    [normalized]
  );

  return normalized;
}

/*
 * ============================================================
 * COMPATIBILIDADE LEGADA
 * ============================================================
 */

async function updateStatus(
  id: string,
  payload: UpdateCollectionStatusPayload
): Promise<
  Collection
> {
  try {
    const response =
      await api.patch<CollectionApiResponse>(
        `/collections/${id}/status`,
        {
          status:
            payload.status,

          collectedAt:
            payload.collectedAt ||
            undefined,

          totalWeightKg:
            payload.totalWeightKg,

          materials:
            payload.materials,

          notes:
            payload.notes?.trim() ||
            undefined,

          cancellationReason:
            payload.cancellationReason
              ?.trim() ||
            undefined,
        },
        true
      );

    if (!response?.collection) {
      throw new Error(
        "Coleta não retornada pela API."
      );
    }

    const normalized =
      normalizeCollection(
        response.collection
      );

    await saveCollectionsToCache(
      [normalized]
    );

    return normalized;
  } catch (error) {
    if (
      isApiNetworkError(
        error
      )
    ) {
      return saveCollectionStatusOffline(
        id,
        payload
      );
    }

    throw error;
  }
}

export const collectionService = {
  list,
  listByDriver,
  listByRoute,
  listActiveByDriver,
  getById,
  create,
  start,
  completeField,
  receive,
  startSorting,
  complete,
  cancel,
  updateStatus,
};

export default collectionService;
