import test from 'node:test';
import assert from 'node:assert/strict';
import { identifyCurrentCity, freshPosition } from '../../src/services/currentCity';
const position = () => ({ timestamp: Date.now(), coords: { latitude: -3.73, longitude: -38.52 } });
const signal = () => new AbortController().signal;
const payload = () => ({ ...position().coords, lookupSource: 'coordinates', city: 'Fortaleza', principalSubdivision: 'Ceará' });
const response = (value: unknown) => (async () => ({ ok: true, json: async () => value })) as unknown as typeof fetch;
test('Consulta usa coordenadas atuais, português e não envia cookies', async () => {
  const request = (async (url: string, options: RequestInit) => {
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('latitude'), '-3.73');
    assert.equal(parsed.searchParams.get('longitude'), '-38.52');
    assert.equal(parsed.searchParams.get('localityLanguage'), 'pt');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.referrerPolicy, 'no-referrer');
    return { ok: true, json: async () => payload() };
  }) as unknown as typeof fetch;
  assert.deepEqual(await identifyCurrentCity(position(), signal(), request), { name: 'Fortaleza', region: 'Ceará' });
});
test('Não consulta serviço com posição antiga, futura ou inválida', async () => {
  let requests = 0;
  const request = (async () => { requests++; }) as unknown as typeof fetch;
  for (const p of [{...position(), timestamp: Date.now()-60000}, {...position(), timestamp: Date.now()+60000}, {...position(), coords: {latitude: NaN, longitude: 0}}]) {
    await assert.rejects(identifyCurrentCity(p, signal(), request), /Atualize/);
  }
  assert.equal(requests, 0);
  assert(freshPosition({...position(), coords: {latitude: 0, longitude: 0}}));
});
test('Recusa resposta por IP e resposta de outro lugar', async () => {
  await assert.rejects(identifyCurrentCity(position(), signal(), response({...payload(), lookupSource: 'ipGeolocation'})), /confirmar a cidade/);
  await assert.rejects(identifyCurrentCity(position(), signal(), response({...payload(), latitude: -4})), /confirmar a cidade/);
});
test('Aceita variante documentada reverseGeocoding e localidade quando cidade ausente', async () => {
  assert.equal((await identifyCurrentCity(position(), signal(), response({...payload(), lookupSource: 'reverseGeocoding', city: '', locality: 'Jijoca de Jericoacoara'}))).name, 'Jijoca de Jericoacoara');
});
test('Indisponibilidade e falta de cidade têm erro próprio, sem posição fictícia', async () => {
  await assert.rejects(identifyCurrentCity(position(), signal(), (async () => ({ok:false})) as unknown as typeof fetch), /posição do aparelho continua/);
  await assert.rejects(identifyCurrentCity(position(), signal(), response({...payload(), city:''})), /Cidade não identificada/);
});
