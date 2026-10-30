export const residentialStatus = (status: string) => ({ REQUESTED: "Aguardando análise", SCHEDULED: "Atendimento programado", IN_PROGRESS: "Coleta em andamento", COMPLETED: "Concluída", CANCELLED: "Cancelada" }[status] || "Em acompanhamento");
export function residentialDate(value?: string | null) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "Não informada";
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}
export function maskDate(value: string) { const d = value.replace(/\D/g, "").slice(0, 8); return d.slice(0, 2) + (d.length > 2 ? "/" + d.slice(2, 4) : "") + (d.length > 4 ? "/" + d.slice(4) : ""); }
export function maskTime(value: string) { const d = value.replace(/\D/g, "").slice(0, 4); return d.slice(0, 2) + (d.length > 2 ? ":" + d.slice(2) : ""); }
export const decimalValue = (value: string) => { const v = value.trim(); if (!v) return 0; if (!/^\d+(?:[.,]\d{0,3})?$/.test(v)) return null; const n = Number(v.replace(",", ".")); return Number.isFinite(n) && n >= 0 ? n : null; };
export const numberBR = (value: number, digits = 1) => value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 3) });
export function separationTip(material: string) {
  const name = material.toLocaleLowerCase("pt-BR");
  if (/vidro/.test(name)) return "Proteja as bordas cortantes e sinalize embalagens com vidro quebrado.";
  if (/papel|papelão/.test(name)) return "Mantenha papel e papelão secos e separe materiais engordurados.";
  if (/plástico|metal|alumínio/.test(name)) return "Esvazie as embalagens e retire o excesso de resíduos antes de separar.";
  return "Separe os materiais secos e consulte a cooperativa sobre itens especiais ou contaminados.";
}

export function residentialProgress(request: { status: string; collections?: { status: string }[] }) {
  if (["CANCELLED", "COMPLETED"].includes(request.status)) return residentialStatus(request.status);
  const status = request.collections?.[0]?.status;
  return ({ COLLECTED: "Coletada · aguarda recebimento", RECEIVED: "Recebida pela cooperativa", SORTING: "Material em triagem", COMPLETED: "Concluída" } as Record<string, string>)[status || ""] || residentialStatus(request.status);
}
