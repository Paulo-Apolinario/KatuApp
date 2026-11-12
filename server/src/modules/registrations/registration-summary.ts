import { validDocument } from "../generators/generator-document";

type Registration = {
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  street?: string | null;
  city?: string | null;
  documentNumber?: string | null;
  cpf?: string | null;
  userId?: string | null;
  user?: { credentialsReady: boolean } | null;
};
// Completeness helps follow-up; it never blocks an operational registration.
export function withRegistration<T extends Registration>(
  kind: "GENERATOR" | "COLLECTOR",
  record: T,
) {
  const missing: string[] = [];
  const document = kind === "GENERATOR" ? record.documentNumber : record.cpf;
  if (!document || !validDocument(document))
    missing.push(kind === "GENERATOR" ? "documentNumber" : "cpf");
  if (!record.email?.trim()) missing.push("email");
  if (!record.phone?.trim()) missing.push("phone");
  if (
    !record.address?.trim() &&
    !(record.street?.trim() && record.city?.trim())
  )
    missing.push("address");
  return {
    ...record,
    registrationStatus: missing.length ? "TO_COMPLETE" : "COMPLETE",
    missingRegistrationFields: missing,
    hasOnlineAccess: Boolean(record.userId && record.user?.credentialsReady !== false),
    accessActivationPending: Boolean(record.userId && record.user?.credentialsReady === false),
  };
}
