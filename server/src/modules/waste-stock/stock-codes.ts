import { randomUUID } from "node:crypto";
/** Generated on the server; existing identifiers supplied by older clients remain valid. */
export function generateStockCode(prefix: "MAT" | "LOT") {
  return `${prefix}-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${randomUUID().replace(/-/g,"").slice(0,16).toUpperCase()}`;
}
