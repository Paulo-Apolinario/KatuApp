import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { wasteCooperativeScope } from '../waste-workspace/waste-workspace.routes';
import { GeneratorService } from '../generators/generator.service';
import { createGeneratorSchema } from '../generators/generator.schemas';
import { binsService } from '../bins/bins.service';
import { createBinSchema } from '../bins/bins.schemas';
const input = z.object({ operationId: z.string().uuid(), kind: z.enum(['GENERATOR_CREATE', 'PEV_CREATE']), data: z.record(z.unknown()) }).strict();
const canonical = (v: any): string => JSON.stringify(v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => [k, JSON.parse(canonical(v[k]))])) : v) ?? 'null';
export async function mobileOfflineRoutes(app: FastifyInstance) {
    app.addHook('preHandler', app.authenticate);
    app.get('/mobile-offline/operations/:id', async (r: any, p) => { try {
        const cooperativeId = await wasteCooperativeScope(r.user.sub), id = z.string().uuid().parse(r.params.id);
        const result = await prisma.$transaction(async (tx) => { await tx.$queryRaw `SELECT id FROM "Cooperative" WHERE id=${cooperativeId} FOR UPDATE`; return tx.mobileOfflineOperation.findFirst({ where: { id, actorUserId: r.user.sub, cooperativeId }, select: { id: true, kind: true, entityId: true } }); });
        p.header('Cache-Control', 'private, no-store');
        return { state: result ? 'CONFIRMED' : 'NOT_RECORDED', operation: result };
    }
    catch (e: any) {
        return p.code(e instanceof z.ZodError ? 400 : e.statusCode || 500).send({ error: e.statusCode ? e.message : 'Não foi possível conferir o cadastro no servidor.' });
    } });
    app.post('/mobile-offline/operations', async (r: any, p) => { try {
        const cooperativeId = await wasteCooperativeScope(r.user.sub), v = input.parse(r.body);
        const data = v.kind === 'GENERATOR_CREATE' ? createGeneratorSchema.strict().parse(v.data) : createBinSchema.parse(v.data);
        if ((v.kind === "PEV_CREATE" || data.latitude != null || data.longitude != null) && (data.latitude == null || data.longitude == null || !Number.isFinite(data.latitude) || !Number.isFinite(data.longitude) || Math.abs(data.latitude) > 90 || Math.abs(data.longitude) > 180))
            return p.code(400).send({ error: 'Confirme a localização antes de enviar o cadastro.' });
        const requestHash = createHash('sha256').update(canonical({ kind: v.kind, data })).digest('hex');
        const result = await prisma.$transaction(async (tx) => { await tx.$queryRaw `SELECT id FROM "Cooperative" WHERE id=${cooperativeId} FOR UPDATE`; const old = await tx.mobileOfflineOperation.findUnique({ where: { id: v.operationId } }); if (old) {
            if (old.actorUserId !== r.user.sub || old.cooperativeId !== cooperativeId || old.kind !== v.kind || old.requestHash !== requestHash)
                throw Object.assign(Error('Identificador já usado com outros dados. Revise o cadastro pendente.'), { statusCode: 409 });
            const entity = v.kind === 'GENERATOR_CREATE' ? await tx.generator.findFirst({ where: { id: old.entityId, cooperativeId } }) : await tx.bin.findFirst({ where: { id: old.entityId, cooperativeId } });
            if (!entity)
                throw Object.assign(Error('O cadastro confirmado não está mais disponível. Consulte a cooperativa.'), { statusCode: 409 });
            return { entity, replayed: true };
        } const entity = v.kind === 'GENERATOR_CREATE' ? await new GeneratorService().create(r.user.sub, data as any, tx) : await binsService.create(r.user.sub, data as any, tx); await tx.mobileOfflineOperation.create({ data: { id: v.operationId, actorUserId: r.user.sub, cooperativeId, kind: v.kind, requestHash, entityId: entity.id } }); return { entity, replayed: false }; });
        p.header('Cache-Control', 'private, no-store');
        return p.code(result.replayed ? 200 : 201).send({ kind: v.kind, ...result });
    }
    catch (e: any) {
        return p.code(e instanceof z.ZodError ? 400 : e.code === 'P2002' ? 409 : e.statusCode || (/^Já existe|^Para grande|^Cooperativa do/.test(e.message || '') ? 400 : 500)).send({ error: e instanceof z.ZodError ? e.issues.map(i => i.message).join(' ') : e.code === 'P2002' ? 'Já existe um cadastro com esse documento, código ou e-mail. Revise a pendência.' : e.statusCode || /^Já existe|^Para grande|^Cooperativa do/.test(e.message || '') ? e.message : 'Não foi possível confirmar o cadastro. A pendência foi preservada.' });
    } });
}
