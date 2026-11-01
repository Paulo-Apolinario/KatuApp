const writes = new Set<symbol>();
export function beginLocalWrite() { const id = Symbol(); writes.add(id); return () => writes.delete(id); }
export const hasLocalWrites = () => writes.size > 0;
