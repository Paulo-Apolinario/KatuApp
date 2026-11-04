import { prisma } from "../../lib/prisma";
import { LIMITS, type Finding } from "./agents.types";
/** Extra orders and PEV reports keep their own identities; never merge their counts into schedules. */
export async function otherRequestSources(
  cooperativeId: string,
  before: Date,
  overdueOnly: boolean,
) {
  const extraWhere = {
    cooperativeId,
    status: { in: ["PENDING_REVIEW", "NEEDS_INFO"] },
    ...(overdueOnly ? { createdAt: { lt: before } } : {}),
  };
  const pevWhere = {
    cooperativeId,
    status: "OPEN",
    collectionId: null,
    bin: { cooperativeId },
    ...(overdueOnly ? { createdAt: { lt: before } } : {}),
  };
  const [extraTotal, pevTotal, extras, pevs] = await Promise.all([
    prisma.extraCollectionOrder.count({ where: extraWhere }),
    prisma.pevRequest.count({ where: pevWhere }),
    prisma.extraCollectionOrder.findMany({
      where: {
        ...extraWhere,
        ...(overdueOnly ? { createdAt: { lt: before } } : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: LIMITS.records + 1,
      select: { id: true, status: true, createdAt: true },
    }),
    prisma.pevRequest.findMany({
      where: {
        ...pevWhere,
        ...(overdueOnly ? { createdAt: { lt: before } } : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: LIMITS.records + 1,
      select: { id: true, binId: true, binName: true, createdAt: true },
    }),
  ]);
  const items: Finding[] = [
    ...extras.slice(0, LIMITS.records).map((x) => ({
      kind: "EXTRA_ORDER",
      priorityScore:
        +x.createdAt < +before ? 6 : x.status === "NEEDS_INFO" ? 3 : 0,
      priority:
        +x.createdAt < +before
          ? ("HIGH" as const)
          : x.status === "NEEDS_INFO"
            ? ("MEDIUM" as const)
            : undefined,
      id: x.id,
      title: "Ordem de coleta extra",
      status: x.status,
      date: x.createdAt.toISOString(),
      href: `/extra-collection-orders?ordem=${encodeURIComponent(x.id)}`,
      reasons: [
        x.status === "NEEDS_INFO"
          ? "Aguardando complemento das informações."
          : "Aguardando análise da cooperativa.",
        ...(+x.createdAt < +before
          ? ["Solicitação antiga; conferir prioridade."]
          : []),
      ],
    })),
    ...pevs.slice(0, LIMITS.records).map((x) => ({
      kind: "PEV_REQUEST",
      priorityScore: +x.createdAt < +before ? 6 : 0,
      priority: +x.createdAt < +before ? ("HIGH" as const) : undefined,
      id: x.id,
      title: x.binName,
      status: "OPEN",
      date: x.createdAt.toISOString(),
      href: `/bin-list/${encodeURIComponent(x.binId)}`,
      reasons: [
        "PEV com solicitação de retirada ainda sem coleta vinculada.",
        ...(+x.createdAt < +before
          ? ["Relato antigo; conferir as condições atuais do PEV."]
          : []),
      ],
    })),
  ];
  return {
    items,
    extraTotal,
    pevTotal,
    truncated: extras.length > LIMITS.records || pevs.length > LIMITS.records,
  };
}
