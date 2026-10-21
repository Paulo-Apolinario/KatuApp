import test from "node:test";
import assert from "node:assert/strict";
import {
  browserPosition,
  browserWatch,
  validPosition,
} from "../../src/services/locationBrowser";
function browser(geo: any, secure = true) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { isSecureContext: secure },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { geolocation: geo },
  });
}
const position = (lat = -3.7, lng = -40.3) => ({
  coords: { latitude: lat, longitude: lng, accuracy: 12 },
  timestamp: Date.now(),
});
test("Lê a posição real do navegador, preservando precisão e timestamp", async () => {
  browser({
    getCurrentPosition: (ok: any, _err: any, opts: any) => {
      assert.equal(opts.timeout, 15000);
      ok(position());
    },
  });
  const p = await browserPosition();
  assert.equal(p.coords.latitude, -3.7);
  assert.equal(p.coords.accuracy, 12);
});
test("Permissão negada não gera posição padrão", async () => {
  browser({ getCurrentPosition: (_ok: any, error: any) => error({ code: 1 }) });
  await assert.rejects(browserPosition(), /Permissão negada/);
});
test("HTTP inseguro falha antes de pedir localização", async () => {
  browser({}, false);
  await assert.rejects(browserPosition(), /HTTPS/);
});
test("Recusa posição inválida ou antiga, mas aceita coordenadas zero", () => {
  assert(validPosition(position(0, 0)));
  assert(!validPosition({ ...position(), timestamp: Date.now() - 120000 }));
  assert(!validPosition(position(NaN, 1)));
  assert(!validPosition(position(91, 1)));
});
test("Watch entrega atualizações e cancela callbacks após sair da tela", () => {
  let handler: any,
    cleared: any,
    seen: number[] = [];
  browser({
    watchPosition: (ok: any) => {
      handler = ok;
      return 42;
    },
    clearWatch: (id: any) => {
      cleared = id;
    },
  });
  const subscription = browserWatch(
    (p) => seen.push(p.coords.latitude),
    () => {},
  );
  handler(position(-3));
  handler(position(-4));
  subscription.remove();
  handler(position(-5));
  assert.deepEqual(seen, [-3, -4]);
  assert.equal(cleared, 42);
});
