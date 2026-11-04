import type { AgentProposal, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
type Reader = Pick<
  Prisma.TransactionClient,
  "route" | "schedule" | "systemAlert" | "collector"
>;
export async function proposalFreshness(
  proposal: Pick<AgentProposal, "kind" | "evidence" | "cooperativeId">,
  db: Reader = prisma,
) {
  const e = proposal.evidence as any,
    id = proposal.cooperativeId;
  let reason: string | null = null;
  if (
    proposal.kind === "REVIEW_ROUTE" ||
    proposal.kind === "REVIEW_ROUTE_SEQUENCE"
  ) {
    const row = await db.route.findFirst({
      where: { id: e.routeId, cooperativeId: id },
      select: {
        updatedAt: true,
        status: true,
        collectorIds: true,
        driver: { select: { updatedAt: true } },
        vehicle: { select: { updatedAt: true } },
      },
    });
    if (!row || !["SCHEDULED", "IN_PROGRESS"].includes(row.status))
      reason = "A rota foi encerrada ou não está mais disponível.";
    else if (row.updatedAt.toISOString() !== e.revisionAt)
      reason = "A rota mudou depois desta análise.";
    else if (!e.resources)
      reason =
        "Esta recomendação antiga não tem versões dos recursos. Execute uma nova análise.";
    else {
      const collectors = await db.collector.findMany({
        where: { cooperativeId: id, id: { in: row.collectorIds } },
        orderBy: { id: "asc" },
        select: { id: true, updatedAt: true },
      });
      const resources = {
        driver: row.driver?.updatedAt.toISOString() || null,
        vehicle: row.vehicle?.updatedAt.toISOString() || null,
        collectors: collectors.map((c) => ({
          id: c.id,
          version: c.updatedAt.toISOString(),
        })),
      };
      if (
        resources.driver !== e.resources.driver ||
        resources.vehicle !== e.resources.vehicle ||
        JSON.stringify(resources.collectors.map((c) => [c.id, c.version])) !==
          JSON.stringify(
            (e.resources.collectors || []).map((c: any) => [c.id, c.version]),
          )
      )
        reason = "Os recursos da rota mudaram depois desta análise.";
    }
  } else if (proposal.kind === "GROUP_COLLECTIONS") {
    if (!Array.isArray(e.records) || !e.records.length)
      reason = "As referências desta proposta não puderam ser conferidas.";
    else {
      const rows = await db.schedule.findMany({
        where: {
          cooperativeId: id,
          id: { in: e.records.slice(0, 100).map((r: any) => r.id) },
        },
        select: {
          id: true,
          updatedAt: true,
          status: true,
          preferredDate: true,
          scheduledDate: true,
          generator: { select: { city: true, neighborhood: true } },
          _count: { select: { collections: true } },
        },
      });
      if (rows.length !== e.records.length)
        reason = "Uma solicitação não está mais disponível.";
      for (const row of rows) {
        const date = row.scheduledDate || row.preferredDate;
        const area =
          date && row.generator?.city && row.generator.neighborhood
            ? [
                new Date(+date - 3 * 3600000).toISOString().slice(0, 10),
                row.generator.city.trim().toLocaleLowerCase("pt-BR"),
                row.generator.neighborhood.trim().toLocaleLowerCase("pt-BR"),
              ].join("|")
            : null;
        if (
          row.updatedAt.toISOString() !==
            e.records.find((r: any) => r.id === row.id)?.updatedAt ||
          !["REQUESTED", "SCHEDULED"].includes(row.status) ||
          row._count.collections ||
          area !== e.area
        )
          reason =
            "Uma solicitação foi alterada, atendida, delegada ou deixou de fazer parte do agrupamento.";
      }
    }
  } else if (proposal.kind === "REVIEW_OCCURRENCES") {
    const refs = Array.isArray(e.alerts) ? e.alerts.slice(0, 100) : [];
    const rows = await db.systemAlert.findMany({
      where: { cooperativeId: id, id: { in: refs.map((r: any) => r.id) } },
      select: { id: true, cycle: true, status: true, snoozedUntil: true },
    });
    if (
      !refs.length ||
      rows.length !== refs.length ||
      rows.some(
        (r) =>
          r.status !== "OPEN" ||
          r.cycle !== refs.find((x: any) => x.id === r.id)?.cycle ||
          (r.snoozedUntil && r.snoozedUntil > new Date()),
      )
    )
      reason = "Uma ocorrência deste grupo foi alterada, resolvida ou adiada.";
  } else if (proposal.kind === "REVIEW_OCCURRENCE") {
    const row = await db.systemAlert.findFirst({
      where: { id: e.alertId, cooperativeId: id },
      select: { cycle: true, status: true, snoozedUntil: true },
    });
    if (
      !row ||
      row.status !== "OPEN" ||
      row.cycle !== e.cycle ||
      (row.snoozedUntil && row.snoozedUntil > new Date())
    )
      reason =
        "A ocorrência foi alterada, resolvida ou adiada depois desta análise.";
  } else reason = "Tipo de proposta sem verificação de atualidade disponível.";
  return {
    current: reason === null,
    reason,
    checkedAt: new Date().toISOString(),
  };
}
