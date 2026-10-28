export const catalogNameKey = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
export const intermediateTypes = ["TRIAGE", "RESERVATION"] as const;
export function pagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPreviousPage: page > 1,
  };
}
