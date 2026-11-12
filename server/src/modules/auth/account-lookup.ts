import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { validDocument } from "../generators/generator-document";
export type IdentifierType = "EMAIL" | "PHONE" | "CPF";
export const authInclude = {
  personProfile: true,
  generator: true,
  collector: true,
  cooperative: true,
  driver: true,
} as const;
export function phoneDigits(value: string | null | undefined) {
  let digits = (value || "").replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55"))
    digits = digits.slice(2);
  return /^[1-9]{2}\d{8,9}$/.test(digits) ? digits : null;
}
export async function lookupAccount(identifier: string, type?: IdentifierType) {
  const value = identifier.trim();
  const kind = type || (value.includes("@") ? "EMAIL" : "PHONE");
  let condition: Prisma.Sql;
  if (kind === "EMAIL")
    condition = Prisma.sql`lower(u.email)=${value.toLowerCase()}`;
  else if (kind === "CPF") {
    const digits = value.replace(/\D/g, "");
    if (digits.length !== 11 || !validDocument(digits)) return null;
    condition = Prisma.sql`((coalesce(g."documentNumber",'') !~ '[A-Za-z]' AND regexp_replace(coalesce(g."documentNumber",''),'[^0-9]','','g')=${digits}) OR regexp_replace(coalesce(c.cpf,''),'[^0-9]','','g')=${digits} OR regexp_replace(coalesce(p.cpf,''),'[^0-9]','','g')=${digits})`;
  } else {
    const digits = phoneDigits(value);
    if (!digits) return null;
    const raw = Prisma.sql`regexp_replace(coalesce(nullif(g.phone,''),nullif(c.phone,''),nullif(d.phone,''),nullif(o.phone,''),u.phone,''),'[^0-9]','','g')`;
    condition = Prisma.sql`(CASE WHEN length(${raw}) IN (12,13) AND left(${raw},2)='55' THEN substr(${raw},3) ELSE ${raw} END)=${digits}`;
  }
  const ids = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT DISTINCT u.id FROM "User" u LEFT JOIN "Generator" g ON g."userId"=u.id LEFT JOIN "Collector" c ON c."userId"=u.id LEFT JOIN "Driver" d ON d."userId"=u.id LEFT JOIN "Cooperative" o ON o."userId"=u.id LEFT JOIN "PersonProfile" p ON p."userId"=u.id WHERE ${condition} LIMIT 2`,
  );
  if (ids.length !== 1) return null; // Never guess between shared telephone/CPF identities.
  return prisma.user.findUnique({
    where: { id: ids[0].id },
    include: authInclude,
  });
}
