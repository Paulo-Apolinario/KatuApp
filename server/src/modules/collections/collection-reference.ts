import type { Prisma } from "@prisma/client";

/** The UI displays the last eight ID characters with an optional leading #. */
export function referenceSearch(value: string) {
  return value.trim().replace(/^#+\s*/, "");
}
export function collectionReferenceWhere(value: string): Prisma.CollectionWhereInput[] {
  const reference = referenceSearch(value);
  if (!reference) return [];
  const contains = { contains: reference, mode: "insensitive" as const };
  return [{ id: contains }, { scheduleId: contains }, { extraOrder: { is: { id: contains } } }];
}
