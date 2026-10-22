/** Serviço real com rede simulada. Não usa aparelho nem banco da VPS. */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');
const source = readFileSync(resolve(__dirname, '../../../src/services/collectionService.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const offline = new Error('Rede simulada indisponível');
let requests = 0, queued = 0, cached = 0;
const mod = { exports: {} };
new Function('require','module','exports',compiled)((name) => {
  if (name === './api') return { api: { post: async () => { requests++; throw offline; } }, isApiNetworkError: (e) => e === offline };
  if (name.includes('collectionRepository')) return { upsertCollections: async () => { cached++; }, getCollectionById: async () => null };
  if (name.includes('syncQueueRepository')) return { enqueueSyncItem: async () => { queued++; } };
  if (name.includes('database/schema')) return { SYNC_ENTITY: { COLLECTION: 'COLLECTION' }, SYNC_OPERATION: {} };
  throw Error('Import inesperado: '+name);
},mod,mod.exports);
(async () => {
  await assert.rejects(mod.exports.collectionService.start('coleta-qa', {}), /Rede simulada/);
  await assert.rejects(mod.exports.collectionService.completeField('coleta-qa', { materials: [{ wasteTypeId: 'papel-qa', quantity: 50, unit: 'KG' }] }), /Rede simulada/);
  assert.equal(requests,2); assert.equal(queued,0); assert.equal(cached,0);
  console.log(JSON.stringify({ finding: 'F_OFFLINE_FIELD', requestsRejected: requests, operationsQueued: queued, writesToCache: cached, method: 'Serviço TypeScript real com transporte simulado; sem teste de aparelho físico.' },null,2));
})().catch((e) => { console.error(e); process.exitCode=1; });
