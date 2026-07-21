import { api, isApiNetworkError } from "./api";
import type {
  WasteCatalogItem,
  WasteUnit,
} from "@/src/types/collection";

type WasteCatalogApiResponse =
  | WasteCatalogItem[]
  | {
      success?: boolean;
      items?: WasteCatalogItem[];
      wasteStockItems?: WasteCatalogItem[];
      data?: WasteCatalogItem[];
    };

function normalizeWasteUnit(value: unknown): WasteUnit {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  const acceptedUnits: WasteUnit[] = [
    "KG",
    "TON",
    "LITER",
    "UNIT",
    "CUBIC_METER",
  ];

  return acceptedUnits.includes(normalized as WasteUnit)
    ? (normalized as WasteUnit)
    : "KG";
}

function normalizeOptionalText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();

  return normalized || null;
}

function normalizeBoolean(
  value: unknown,
  fallback: boolean
): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value
      .trim()
      .toLowerCase();

    if (["true", "1", "yes", "sim"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no", "não", "nao"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function normalizeCatalogItem(
  item: WasteCatalogItem
): WasteCatalogItem {
  const unit = normalizeWasteUnit(
    item.unit || item.defaultUnit
  );

  const status = String(
    item.status || "ACTIVE"
  )
    .trim()
    .toUpperCase();

  return {
    ...item,

    id: String(item.id || "").trim(),

    cooperativeId:
      normalizeOptionalText(item.cooperativeId) ||
      undefined,

    name: String(item.name || "").trim(),

    category:
      normalizeOptionalText(item.category),

    subcategory:
      normalizeOptionalText(item.subcategory),

    defaultUnit: normalizeWasteUnit(
      item.defaultUnit || unit
    ),

    unit,

    internalCode:
      normalizeOptionalText(item.internalCode),

    ncm:
      normalizeOptionalText(item.ncm),

    wasteClass:
      normalizeOptionalText(item.wasteClass),

    description:
      normalizeOptionalText(item.description),

    isActive: normalizeBoolean(
      item.isActive,
      true
    ),

    status,
  };
}

function extractItems(
  response: WasteCatalogApiResponse
): WasteCatalogItem[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.items)) {
    return response.items;
  }

  if (Array.isArray(response?.wasteStockItems)) {
    return response.wasteStockItems;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
}

function isActiveCatalogItem(
  item: WasteCatalogItem
): boolean {
  return (
    item.id.length > 0 &&
    item.name.length > 0 &&
    item.isActive !== false &&
    String(item.status || "ACTIVE")
      .trim()
      .toUpperCase() === "ACTIVE"
  );
}

function sortCatalogItems(
  items: WasteCatalogItem[]
): WasteCatalogItem[] {
  return [...items].sort((first, second) => {
    const categoryComparison = String(
      first.category || ""
    ).localeCompare(
      String(second.category || ""),
      "pt-BR",
      {
        sensitivity: "base",
      }
    );

    if (categoryComparison !== 0) {
      return categoryComparison;
    }

    return first.name.localeCompare(
      second.name,
      "pt-BR",
      {
        sensitivity: "base",
      }
    );
  });
}

async function list(): Promise<WasteCatalogItem[]> {
  const response =
    await api.get<WasteCatalogApiResponse>(
      "/waste-stock/items",
      true
    );

  const normalizedItems = extractItems(response)
    .map(normalizeCatalogItem)
    .filter(isActiveCatalogItem);

  return sortCatalogItems(normalizedItems);
}

async function getById(
  id: string
): Promise<WasteCatalogItem> {
  const normalizedId = String(id || "").trim();

  if (!normalizedId) {
    throw new Error(
      "ID do item do catálogo não informado."
    );
  }

  try {
    const response =
      await api.get<
        | WasteCatalogItem
        | {
            success?: boolean;
            item?: WasteCatalogItem;
            wasteStockItem?: WasteCatalogItem;
            data?: WasteCatalogItem;
          }
      >(
        `/waste-stock/items/${normalizedId}`,
        true
      );

    let rawItem: WasteCatalogItem | undefined;

    if (response && typeof response === "object") {
      if ("id" in response) {
        rawItem = response as WasteCatalogItem;
      } else {
        const wrappedResponse = response as {
          success?: boolean;
          item?: WasteCatalogItem;
          wasteStockItem?: WasteCatalogItem;
          data?: WasteCatalogItem;
        };

        rawItem =
          wrappedResponse.item ||
          wrappedResponse.wasteStockItem ||
          wrappedResponse.data;
      }
    }

    if (!rawItem) {
      throw new Error(
        "Item do catálogo não retornado pela API."
      );
    }

    const normalizedItem =
      normalizeCatalogItem(rawItem);

    if (!normalizedItem.id) {
      throw new Error(
        "Item do catálogo inválido."
      );
    }

    return normalizedItem;
  } catch (error) {
    if (isApiNetworkError(error)) {
      const items = await list();
      const found = items.find(
        (item) => item.id === normalizedId
      );

      if (found) {
        return found;
      }
    }

    throw error;
  }
}

async function search(
  term: string
): Promise<WasteCatalogItem[]> {
  const normalizedTerm = String(term || "")
    .trim()
    .toLocaleLowerCase("pt-BR");

  const items = await list();

  if (!normalizedTerm) {
    return items;
  }

  return items.filter((item) => {
    const searchableText = [
      item.name,
      item.category,
      item.subcategory,
      item.internalCode,
      item.ncm,
      item.description,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("pt-BR");

    return searchableText.includes(
      normalizedTerm
    );
  });
}

async function listByCategory(
  category: string
): Promise<WasteCatalogItem[]> {
  const normalizedCategory = String(
    category || ""
  )
    .trim()
    .toLocaleLowerCase("pt-BR");

  const items = await list();

  if (!normalizedCategory) {
    return items;
  }

  return items.filter(
    (item) =>
      String(item.category || "")
        .trim()
        .toLocaleLowerCase("pt-BR") ===
      normalizedCategory
  );
}

export const wasteCatalogService = {
  list,
  getById,
  search,
  listByCategory,
};

export default wasteCatalogService;
