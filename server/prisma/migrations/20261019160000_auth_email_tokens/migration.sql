-- Adição independente; não modifica usuários nem senhas existentes.
CREATE TABLE "AuthEmailToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "temporaryPasswordHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthEmailToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuthEmailToken_tokenHash_key" ON "AuthEmailToken"("tokenHash");
CREATE INDEX "AuthEmailToken_userId_purpose_createdAt_idx" ON "AuthEmailToken"("userId", "purpose", "createdAt");
ALTER TABLE "AuthEmailToken" ADD CONSTRAINT "AuthEmailToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "AuthEmailToken_expiresAt_idx" ON "AuthEmailToken"("expiresAt");
