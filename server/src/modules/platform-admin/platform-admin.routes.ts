import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AuthService } from "../auth/auth.service";
import { registerCooperativeSchema } from "../auth/auth.schemas";
const create = registerCooperativeSchema.extend({ password: z.string().min(8).max(256), confirmPassword: z.string().min(8).max(256) }).strict().refine(v => v.password === v.confirmPassword, "As senhas não coincidem.");
export async function platformAdminRoutes(app: FastifyInstance) {
  const guard = { preHandler: [app.authenticate, async (r: any, p: any) => {
    p.header("Cache-Control", "private, no-store");
    const user = await prisma.user.findUnique({ where: { id: r.user.sub }, select: { role: true, isActive: true, accountStatus: true, credentialsReady: true } });
    if (!user?.isActive || !user.credentialsReady || user.role !== "ADMIN" || user.accountStatus !== "ACTIVE") return p.code(403).send({ error: "Cadastro de cooperativas restrito à administração do KATUÁ." });
  }] };
  app.get("/platform/cooperatives", guard, async (r, p) => {
    const parsed = z.object({ q: z.string().trim().max(120).default(""), page: z.coerce.number().int().min(1).max(100000).default(1) }).strict().safeParse(r.query);
    if (!parsed.success) return p.code(400).send({ error: "Filtros inválidos." });
    const { q, page } = parsed.data;
    const where = q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }, { registrationNumber: { contains: q } }] } : {};
    const [items, total] = await prisma.$transaction([prisma.cooperative.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }], skip: (page - 1) * 20, take: 20, select: { id: true, name: true, registrationNumber: true, email: true, phone: true, city: true, state: true, createdAt: true, simulationWorkspace: { select: { enabled: true } }, user: { select: { displayName: true, isActive: true, accountStatus: true, credentialsReady: true } } } }), prisma.cooperative.count({ where })]);
    return { items, pagination: { page, total, totalPages: Math.max(1, Math.ceil(total / 20)) } };
  });
  app.post("/platform/cooperatives", guard, async (r: any, p) => {
    const parsed = create.safeParse(r.body);
    if (!parsed.success) return p.code(400).send({ error: parsed.error.issues.map(v => v.message).join(" ") });
    try {
      const { confirmPassword: _confirm, ...data } = parsed.data;
      const result = await new AuthService().registerCooperative(data, r.user.sub);
      return p.code(201).send({ cooperative: result.cooperative, account: { id: result.user.id, email: result.user.email, role: result.user.role } });
    } catch (error: any) {
      if (error.code === "P2002" || /já está em uso|Já existe/.test(error.message || "")) return p.code(409).send({ error: "E-mail ou documento já cadastrado. Consulte a lista antes de repetir." });
      r.log.error({ code: error.code }, "Falha no cadastro administrativo de cooperativa");
      return p.code(500).send({ error: "Não foi possível cadastrar. Consulte a lista antes de tentar novamente." });
    }
  });
}
