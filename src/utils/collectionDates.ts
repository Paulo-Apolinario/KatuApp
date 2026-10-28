/** A coleta pode ter sido registrada antes e realizada depois de outra. */
export function sortCollectionHistory<T extends { collectedAt?: string | null; createdAt?: string | null }>(items: T[]): T[] {
  const time = (item: T) => new Date(item.collectedAt || item.createdAt || 0).getTime() || 0;
  return [...items].sort((a, b) => time(b) - time(a));
}
