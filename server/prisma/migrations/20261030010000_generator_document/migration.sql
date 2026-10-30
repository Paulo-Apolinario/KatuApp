-- Additive: existing records remain unclassified; never infer CPF/CNPJ from names.
ALTER TABLE "Generator" ADD COLUMN "documentNumber" TEXT;
CREATE UNIQUE INDEX "Generator_cooperativeId_documentNumber_key" ON "Generator"("cooperativeId", "documentNumber");
ALTER TABLE "Generator" ADD CONSTRAINT "Generator_documentNumber_format_check" CHECK (
  "documentNumber" IS NULL OR "documentNumber" ~ '^[0-9]{11}$' OR "documentNumber" ~ '^[A-Z0-9]{12}[0-9]{2}$'
);
