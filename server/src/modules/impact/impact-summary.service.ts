/** Shared access error. The API now uses one material-specific calculation engine. */
export class ImpactAccessError extends Error {
  constructor(
    message: string,
    public statusCode = 403,
  ) {
    super(message);
  }
}
export async function impactOverview(userId: string, generatorId?: string) {
  const { analyzeImpact, analysisQuery } =
    await import("./impact-analysis.service.js");
  return analyzeImpact(userId, analysisQuery.parse({ generatorId }));
}
