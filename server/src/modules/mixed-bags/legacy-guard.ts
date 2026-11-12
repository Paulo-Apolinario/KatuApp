import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../lib/prisma";
/** Bag receipts have their own conservation ledger; legacy screens remain readable. */
export async function rejectBagLegacyEdit(r: FastifyRequest, p: FastifyReply) {
  if (r.method === "GET" || !["COOPERATIVE", "COLLECTOR"].includes(r.user.role))
    return;
  const id = (r.params as { id?: string })?.id;
  if (!id) return;
  const path = r.routeOptions.url || "";
  if (!path.includes("/collections/") && !path.includes("/material-intakes/"))
    return;
  const bag = await prisma.mixedBag.findFirst({
    where: {
      collectionId: id,
      cooperative: {
        OR: [
          { userId: r.user.sub },
          {
            collectors: {
              some: { userId: r.user.sub, status: { not: "INACTIVE" } },
            },
          },
        ],
      },
    },
    select: { id: true },
  });
  if (bag)
    return p
      .code(409)
      .send({
        error:
          "Este recebimento é controlado por bags. Use Triagem e lotes para preservar o peso e o histórico.",
        mixedBagId: bag.id,
      });
}
