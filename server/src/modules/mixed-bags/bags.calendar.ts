import { z } from "zod";
import type { Prisma } from "@prisma/client";
export const civilDay = (d = new Date()) =>
  new Date(d.getTime() - 10800000).toISOString().slice(0, 10);
export const dayValue = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      Number.isFinite(Date.parse(v + "T12:00:00Z")) &&
      new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v,
    "Data inválida.",
  );
export const dayRange = (day: string) => ({
  gte: new Date(day + "T00:00:00-03:00"),
  lt: new Date(Date.parse(day + "T00:00:00-03:00") + 86400000),
});
export async function lockDay(
  tx: Prisma.TransactionClient,
  cooperativeId: string,
  day: string,
) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`bag-day:${cooperativeId}:${day}`}))::text AS locked`;
}
export async function assertDayOpen(
  tx: Prisma.TransactionClient,
  cooperativeId: string,
  day: string,
) {
  await lockDay(tx, cooperativeId, day);
  const row = await tx.triageDay.findUnique({
    where: { cooperativeId_day: { cooperativeId, day } },
  });
  if (row?.status === "CLOSED")
    throw Object.assign(
      Error(
        `Produção de ${day.split("-").reverse().join("/")} fechada. O gestor precisa reabrir o dia com justificativa antes de registrar ou estornar pesagens.`,
      ),
      { statusCode: 409 },
    );
}
