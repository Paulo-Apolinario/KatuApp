/** Localização do aparelho. Não envia coordenadas à API nem consulta geocodificador externo. */
export function locationMessage(error: any) {
  return error?.code === 1
    ? "Permissão negada. Libere a localização nas permissões deste site ou aplicativo."
    : error?.code === 3
      ? "O aparelho não respondeu a tempo. Vá para uma área aberta e tente novamente."
      : error?.message ||
        "Não foi possível obter a posição do aparelho. Confira o GPS e tente novamente.";
}
export function browserGeolocation() {
  if (typeof window === "undefined" || !window.isSecureContext)
    throw new Error(
      "A localização exige HTTPS. Abra o aplicativo pelo endereço seguro.",
    );
  if (!navigator.geolocation)
    throw new Error("Este navegador não oferece localização do aparelho.");
  return navigator.geolocation;
}
export function browserPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        reject(
          Object.assign(
            new Error("O aparelho não respondeu a tempo. Tente novamente."),
            { code: 3 },
          ),
        );
      }
    }, 18000);
    try {
      browserGeolocation().getCurrentPosition(
        (p) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          if (!validPosition(p))
            reject(new Error("O aparelho retornou coordenadas inválidas."));
          else resolve(p);
        },
        (e) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          reject(
            Object.assign(new Error(locationMessage(e)), { code: e.code }),
          );
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
      );
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}
export function validPosition(p: any) {
  return (
    p?.coords?.latitude != null &&
    p?.coords?.longitude != null &&
    Number.isFinite(p.coords.latitude) &&
    Number.isFinite(p.coords.longitude) &&
    Math.abs(p.coords.latitude) <= 90 &&
    Math.abs(p.coords.longitude) <= 180 &&
    Number.isFinite(p.timestamp) &&
    Date.now() - p.timestamp <= 60000
  );
}
export function browserWatch(
  onPosition: (p: GeolocationPosition) => void,
  onError: (e: any) => void,
) {
  const geo = browserGeolocation();
  let active = true;
  const id = geo.watchPosition(
    (p) => {
      if (active && validPosition(p)) onPosition(p);
    },
    (e) => {
      if (active)
        onError(Object.assign(new Error(locationMessage(e)), { code: e.code }));
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
  );
  return {
    remove: () => {
      active = false;
      geo.clearWatch(id);
    },
  };
}
