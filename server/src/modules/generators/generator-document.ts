// CNPJ DV: Receita Federal, manual-dv-cnpj.pdf (ASCII - 48, módulo 11).
// This validates format/check digits, not registration status or ownership.
export function normalizeDocument(value: string) {
  return value.trim().toUpperCase().replace(/[.\-/\s]/g, "");
}

export function documentType(value?: string | null): "CPF" | "CNPJ" | null {
  const number = value ? normalizeDocument(value) : "";
  if (/^\d{11}$/.test(number)) return "CPF";
  if (/^[A-Z0-9]{12}\d{2}$/.test(number)) return "CNPJ";
  return null;
}

export function validDocument(value: string): boolean {
  const number = normalizeDocument(value), type = documentType(number);
  if (!type || /^(.)\1+$/.test(number)) return false;
  const digit = (text: string, weights: number[]) => {
    const sum = [...text].reduce((total, char, i) => total + (char.charCodeAt(0) - 48) * weights[i], 0);
    const remainder = sum % 11;
    return String(remainder < 2 ? 0 : 11 - remainder);
  };
  const weights = type === "CPF" ? [10, 9, 8, 7, 6, 5, 4, 3, 2] : [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const base = number.slice(0, -2);
  const first = digit(base, weights);
  const second = digit(base + first, type === "CPF" ? [11, ...weights] : [6, ...weights]);
  return number.endsWith(first + second);
}

export function generatorCategory(type: string, document?: string | null) {
  if (type === "LARGE") return "LARGE";
  if (!document || !validDocument(document)) return "PENDING_DOCUMENT";
  return documentType(document) === "CPF" ? "REGISTERED_RESIDENTIAL" : "SMALL_BUSINESS";
}

export function withGeneratorDocument<T extends { type: string; documentNumber?: string | null }>(generator: T) {
  return { ...generator, documentType: documentType(generator.documentNumber), registrationCategory: generatorCategory(generator.type, generator.documentNumber) };
}
