/** Consulta opcional: somente posição atual do próprio aparelho e após consentimento na tela. */
export type CurrentPosition = {
  timestamp: number;
  coords: { latitude: number; longitude: number };
};
export type CurrentCity = { name: string; region: string };

export function positionCell(position: CurrentPosition) {
  return `${position.coords.latitude.toFixed(3)},${position.coords.longitude.toFixed(3)}`;
}

export function freshPosition(position: CurrentPosition, now = Date.now()) {
  const { latitude, longitude } = position.coords;
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 &&
    Number.isFinite(position.timestamp) && now - position.timestamp >= -5000 &&
    now - position.timestamp <= 15000;
}

export async function identifyCurrentCity(
  position: CurrentPosition,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<CurrentCity> {
  if (!freshPosition(position)) throw new Error("Atualize a posição do aparelho antes de identificar a cidade.");
  // Nunca omitir coordenadas: o serviço também oferece localização por IP, que não usamos.
  const params = new URLSearchParams({
    latitude: String(position.coords.latitude),
    longitude: String(position.coords.longitude),
    localityLanguage: "pt",
  });
  const response = await request(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`, {
    signal, credentials: "omit", referrerPolicy: "no-referrer", headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Serviço de identificação da cidade indisponível. A posição do aparelho continua disponível.");
  const data = await response.json();
  // Recusar explicitamente respostas de IP ou de outra coordenada.
  if (!["coordinates", "reverseGeocoding"].includes(data.lookupSource) ||
    !Number.isFinite(data.latitude) || !Number.isFinite(data.longitude) ||
    Math.abs(data.latitude - position.coords.latitude) > 0.0001 ||
    Math.abs(data.longitude - position.coords.longitude) > 0.0001) {
    throw new Error("Não foi possível confirmar a cidade pelas coordenadas do aparelho.");
  }
  const name = typeof data.city === "string" ? data.city.trim() : "";
  const locality = typeof data.locality === "string" ? data.locality.trim() : "";
  if (!name && !locality) throw new Error("Cidade não identificada para esta posição. As coordenadas continuam disponíveis.");
  return { name: name || locality, region: typeof data.principalSubdivision === "string" ? data.principalSubdivision.trim() : "" };
}
