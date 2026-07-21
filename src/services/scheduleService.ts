import { api, isApiNetworkError } from "./api";

import {
  getAllSchedules,
  getScheduleById,
  upsertSchedules,
} from "../database/repositories/scheduleRepository";

import type {
  CreateSchedulePayload,
  RequestedScheduleMaterialInput,
  Schedule,
  ScheduleRequestedMaterialRecord,
  UpdateScheduleStatusPayload,
} from "@/src/types/schedule";

import type {
  Collection,
  CollectionMaterial,
  WasteUnit,
} from "@/src/types/collection";

export type {
  CreateSchedulePayload,
  RequestedScheduleMaterialInput,
  Schedule,
  ScheduleRequestedMaterialRecord,
  UpdateScheduleStatusPayload,
} from "@/src/types/schedule";

export type {
  Collection,
  CollectionMaterial,
  WasteUnit,
} from "@/src/types/collection";

/*
 * ============================================================
 * RESPOSTAS DA API
 * ============================================================
 */

type ListSchedulesApiResponse =
  | Schedule[]
  | {
      schedules?: Schedule[];
      success?: boolean;
    };

type GetScheduleApiResponse =
  | Schedule
  | {
      schedule?: Schedule;
      success?: boolean;
    };

type CreateScheduleApiResponse = {
  schedule?: Schedule;
  success?: boolean;
};

type UpdateScheduleStatusApiResponse = {
  schedule?: Schedule;
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
    typeof value === "string"
      ? value.replace(",", ".")
      : value;

  const numericValue =
    Number(normalized);

  return Number.isFinite(
    numericValue
  )
    ? numericValue
    : 0;
}

function normalizeWasteUnit(
  value: unknown
): WasteUnit {
  const normalized = String(
    value || ""
  )
    .trim()
    .toUpperCase();

  const acceptedUnits: WasteUnit[] = [
    "KG",
    "TON",
    "LITER",
    "UNIT",
    "CUBIC_METER",
  ];

  return acceptedUnits.includes(
    normalized as WasteUnit
  )
    ? (normalized as WasteUnit)
    : "KG";
}

function normalizeRequestedMaterial(
  material: unknown
): ScheduleRequestedMaterialRecord | null {
  if (
    !material ||
    typeof material !== "object"
  ) {
    return null;
  }

  const item = material as Record<
    string,
    unknown
  >;

  const nameSnapshot =
    normalizeOptionalText(
      item.nameSnapshot
    ) ||
    normalizeOptionalText(
      (
        item.wasteType as
          | Record<string, unknown>
          | undefined
      )?.name
    ) ||
    normalizeOptionalText(
      (
        item.catalogSuggestion as
          | Record<string, unknown>
          | undefined
      )?.name
    ) ||
    "";

  if (!nameSnapshot) {
    return null;
  }

  return {
    id:
      String(item.id || "").trim(),

    scheduleId:
      normalizeOptionalText(
        item.scheduleId
      ) ||
      undefined,

    wasteTypeId:
      normalizeOptionalText(
        item.wasteTypeId
      ),

    catalogSuggestionId:
      normalizeOptionalText(
        item.catalogSuggestionId
      ),

    nameSnapshot,

    categorySnapshot:
      normalizeOptionalText(
        item.categorySnapshot
      ),

    subcategorySnapshot:
      normalizeOptionalText(
        item.subcategorySnapshot
      ),

    estimatedQuantity:
      item.estimatedQuantity ===
        null ||
      item.estimatedQuantity ===
        undefined
        ? null
        : normalizeNumber(
            item.estimatedQuantity
          ),

    unit:
      normalizeWasteUnit(
        item.unit
      ),

    wasteType:
      item.wasteType &&
      typeof item.wasteType ===
        "object"
        ? (item.wasteType as ScheduleRequestedMaterialRecord["wasteType"])
        : null,

    catalogSuggestion:
      item.catalogSuggestion &&
      typeof item.catalogSuggestion ===
        "object"
        ? (item.catalogSuggestion as ScheduleRequestedMaterialRecord["catalogSuggestion"])
        : null,

    createdAt:
      normalizeOptionalText(
        item.createdAt
      ) ||
      undefined,

    updatedAt:
      normalizeOptionalText(
        item.updatedAt
      ) ||
      undefined,
  };
}

function normalizeCollectionMaterial(
  item: unknown
): CollectionMaterial | null {
  if (
    !item ||
    typeof item !== "object"
  ) {
    return null;
  }

  const material = item as Record<
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
      : unit === "KG"
        ? quantity
        : unit === "TON"
          ? quantity * 1000
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
      Array.isArray(
        collection.materials
      )
        ? collection.materials
            .map(
              normalizeCollectionMaterial
            )
            .filter(
              (
                item
              ): item is CollectionMaterial =>
                item !== null
            )
        : [],

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
            })
          )
        : [],
  };
}

function normalizeSchedule(
  schedule: Schedule
): Schedule {
  return {
    ...schedule,

    generator:
      schedule.generator
        ? {
            ...schedule.generator,

            latitude:
              schedule.generator
                .latitude ===
                null ||
              schedule.generator
                .latitude ===
                undefined
                ? null
                : normalizeNumber(
                    schedule.generator
                      .latitude
                  ),

            longitude:
              schedule.generator
                .longitude ===
                null ||
              schedule.generator
                .longitude ===
                undefined
                ? null
                : normalizeNumber(
                    schedule.generator
                      .longitude
                  ),
          }
        : null,

    cooperative:
      schedule.cooperative
        ? {
            ...schedule.cooperative,

            latitude:
              schedule.cooperative
                .latitude ===
                null ||
              schedule.cooperative
                .latitude ===
                undefined
                ? null
                : normalizeNumber(
                    schedule.cooperative
                      .latitude
                  ),

            longitude:
              schedule.cooperative
                .longitude ===
                null ||
              schedule.cooperative
                .longitude ===
                undefined
                ? null
                : normalizeNumber(
                    schedule.cooperative
                      .longitude
                  ),
          }
        : null,

    requestedMaterials:
      Array.isArray(
        schedule.requestedMaterials
      )
        ? schedule.requestedMaterials
            .map(
              normalizeRequestedMaterial
            )
            .filter(
              (
                item
              ): item is ScheduleRequestedMaterialRecord =>
                item !== null
            )
        : [],

    collections:
      Array.isArray(
        schedule.collections
      )
        ? schedule.collections.map(
            normalizeCollection
          )
        : [],
  };
}

/*
 * ============================================================
 * SERIALIZAÇÃO
 * ============================================================
 */

function serializeRequestedMaterials(
  materials: RequestedScheduleMaterialInput[]
): RequestedScheduleMaterialInput[] {
  return materials.map(
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
          `Informe apenas um material do catálogo ou um material proposto na posição ${
            index + 1
          }.`
        );
      }

      const estimatedQuantity =
        material.estimatedQuantity ===
          undefined
          ? undefined
          : normalizeNumber(
              material.estimatedQuantity
            );

      if (
        estimatedQuantity !==
          undefined &&
        estimatedQuantity <= 0
      ) {
        throw new Error(
          `A quantidade estimada do material na posição ${
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

        estimatedQuantity,

        unit,
      };
    }
  );
}

/*
 * ============================================================
 * CACHE
 * ============================================================
 */

async function saveSchedulesToCache(
  schedules: Schedule[]
) {
  await upsertSchedules(
    schedules.map(
      (schedule) => ({
        id:
          schedule.id,

        status:
          schedule.status,

        generatorId:
          schedule.generatorId ??
          schedule.generator?.id ??
          null,

        payload:
          schedule,

        updatedAt:
          schedule.updatedAt ??
          null,
      })
    )
  );
}

async function readSchedulesFromCache(): Promise<
  Schedule[]
> {
  const rows =
    await getAllSchedules();

  return rows
    .map(
      (row) =>
        row?.payload
    )
    .filter(
      (
        item
      ): item is Schedule =>
        Boolean(item)
    )
    .map(
      normalizeSchedule
    );
}

async function readScheduleByIdFromCache(
  id: string
): Promise<
  Schedule | null
> {
  const row =
    await getScheduleById(
      id
    );

  if (!row?.payload) {
    return null;
  }

  return normalizeSchedule(
    row.payload as Schedule
  );
}

/*
 * ============================================================
 * API
 * ============================================================
 */

async function list(): Promise<
  Schedule[]
> {
  try {
    const response =
      await api.get<ListSchedulesApiResponse>(
        "/schedules",
        true
      );

    const schedules =
      Array.isArray(
        response
      )
        ? response
        : Array.isArray(
              response?.schedules
            )
          ? response.schedules
          : [];

    const normalized =
      schedules.map(
        normalizeSchedule
      );

    await saveSchedulesToCache(
      normalized
    );

    return normalized;
  } catch (error) {
    if (
      isApiNetworkError(
        error
      )
    ) {
      return readSchedulesFromCache();
    }

    throw error;
  }
}

async function getById(
  id: string
): Promise<
  Schedule
> {
  const normalizedId =
    String(id || "").trim();

  if (!normalizedId) {
    throw new Error(
      "ID do agendamento não informado."
    );
  }

  try {
    const response =
      await api.get<GetScheduleApiResponse>(
        `/schedules/${normalizedId}`,
        true
      );

    const schedule =
      response &&
      typeof response ===
        "object" &&
      "schedule" in response
        ? response.schedule
        : (response as Schedule);

    if (!schedule) {
      throw new Error(
        "Agendamento não retornado pela API."
      );
    }

    const normalized =
      normalizeSchedule(
        schedule
      );

    await saveSchedulesToCache(
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
        await readScheduleByIdFromCache(
          normalizedId
        );

      if (cached) {
        return cached;
      }
    }

    throw error;
  }
}

async function create(
  payload: CreateSchedulePayload
): Promise<
  Schedule
> {
  const requestedMaterials =
    serializeRequestedMaterials(
      payload.requestedMaterials
    );

  if (
    requestedMaterials.length ===
    0
  ) {
    throw new Error(
      "Informe ao menos um material solicitado."
    );
  }

  const response =
    await api.post<CreateScheduleApiResponse>(
      "/schedules",
      {
        cooperativeId:
          payload.cooperativeId ||
          undefined,

        generatorId:
          payload.generatorId ||
          undefined,

        preferredDate:
          payload.preferredDate ||
          undefined,

        scheduledDate:
          payload.scheduledDate ||
          undefined,

        requestedMaterials,

        notes:
          payload.notes?.trim() ||
          undefined,
      },
      true
    );

  if (!response?.schedule) {
    throw new Error(
      "Agendamento não retornado pela API."
    );
  }

  const normalized =
    normalizeSchedule(
      response.schedule
    );

  await saveSchedulesToCache(
    [normalized]
  );

  return normalized;
}

async function updateStatus(
  id: string,
  payload: UpdateScheduleStatusPayload
): Promise<
  Schedule
> {
  const normalizedId =
    String(id || "").trim();

  if (!normalizedId) {
    throw new Error(
      "ID do agendamento não informado."
    );
  }

  const response =
    await api.patch<UpdateScheduleStatusApiResponse>(
      `/schedules/${normalizedId}/status`,
      {
        status:
          payload.status,
      },
      true
    );

  if (!response?.schedule) {
    throw new Error(
      "Agendamento não retornado pela API."
    );
  }

  const normalized =
    normalizeSchedule(
      response.schedule
    );

  await saveSchedulesToCache(
    [normalized]
  );

  return normalized;
}

export const scheduleService = {
  list,
  getById,
  create,
  updateStatus,
};

export default scheduleService;
