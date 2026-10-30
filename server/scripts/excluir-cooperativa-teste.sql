-- Manutenção manual e destrutiva: somente dados de teste expressamente autorizados.
-- Uso: psql -v ON_ERROR_STOP=1 -v cnpj=... -v email=... -f este-arquivo.sql
-- Não é migração e nunca é executado durante inicialização/deploy.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE TEMP TABLE _cleanup_target ON COMMIT DROP AS
SELECT c.id, c."userId", c.name, c."registrationNumber", u.email
FROM public."Cooperative" c JOIN public."User" u ON u.id = c."userId"
WHERE c."registrationNumber" = :'cnpj' AND u.email = :'email' AND u.role = 'COOPERATIVE'
FOR UPDATE OF c, u;

DO $guard$
DECLARE t record; n bigint; target_id text; owner_id text;
BEGIN
  IF (SELECT count(*) FROM _cleanup_target) <> 1 THEN
    RAISE EXCEPTION 'CNPJ e email de acesso não identificam uma única cooperativa. Nada foi excluído.';
  END IF;
  SELECT id, "userId" INTO target_id, owner_id FROM _cleanup_target;
  -- Bloquear vínculos entre cooperativas, inclusive os que seriam alterados por SET NULL/CASCADE.
  FOR t IN
    SELECT ns.nspname AS schema_name, child.relname AS child_table, ca.attname AS child_key,
           parent.relname AS parent_table, pa.attname AS parent_key,
           EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = parent.oid AND a.attname = 'cooperativeId' AND NOT a.attisdropped) AS parent_scoped
    FROM pg_constraint fk
    JOIN pg_class child ON child.oid = fk.conrelid
    JOIN pg_namespace ns ON ns.oid = child.relnamespace
    JOIN pg_class parent ON parent.oid = fk.confrelid
    JOIN pg_namespace pn ON pn.oid = parent.relnamespace
    JOIN pg_attribute ca ON ca.attrelid = child.oid AND ca.attnum = fk.conkey[1]
    JOIN pg_attribute pa ON pa.attrelid = parent.oid AND pa.attnum = fk.confkey[1]
    WHERE fk.contype = 'f' AND cardinality(fk.conkey) = 1 AND cardinality(fk.confkey) = 1
      AND ns.nspname = 'public' AND pn.nspname = 'public'
      AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = child.oid AND a.attname = 'cooperativeId' AND NOT a.attisdropped)
  LOOP
    IF t.parent_scoped THEN
      EXECUTE format('SELECT count(*) FROM %I.%I c JOIN public.%I p ON c.%I = p.%I WHERE p."cooperativeId" = $1 AND c."cooperativeId" IS DISTINCT FROM $1', t.schema_name, t.child_table, t.parent_table, t.child_key, t.parent_key) INTO n USING target_id;
    ELSIF t.parent_table = 'User' AND t.parent_key = 'id' THEN
      EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I = $1 AND "cooperativeId" IS DISTINCT FROM $2', t.schema_name, t.child_table, t.child_key) INTO n USING owner_id, target_id;
    ELSE CONTINUE;
    END IF;
    IF n > 0 THEN RAISE EXCEPTION 'Vínculo externo em %. Revisão manual necessária; nada foi excluído.', t.child_table; END IF;
  END LOOP;
END;
$guard$;

SELECT name AS cooperativa_excluida, "registrationNumber" AS cnpj, email AS acesso FROM _cleanup_target;
-- Primeiro, históricos protegidos e dependências sem cascata.
DELETE FROM public."CollectionWasteDestinationEvent" WHERE "destinationId" IN
 (SELECT id FROM public."CollectionWasteDestination" WHERE "cooperativeId" IN (SELECT id FROM _cleanup_target));
DELETE FROM public."ExtraCollectionOrderEvent" WHERE "orderId" IN
 (SELECT id FROM public."ExtraCollectionOrder" WHERE "cooperativeId" IN (SELECT id FROM _cleanup_target));
DELETE FROM public."ExtraCollectionOrder" WHERE "cooperativeId" IN (SELECT id FROM _cleanup_target);
DELETE FROM public."OwnerDocument" WHERE "cooperativeId" IN (SELECT id FROM _cleanup_target);
DELETE FROM public."CollectionIncident" WHERE "cooperativeId" IN (SELECT id FROM _cleanup_target);
DELETE FROM public."PevRequestUpdate" WHERE "requestId" IN
 (SELECT id FROM public."PevRequest" WHERE "cooperativeId" IN (SELECT id FROM _cleanup_target));
DELETE FROM public."PevRequest" WHERE "cooperativeId" IN (SELECT id FROM _cleanup_target);
DELETE FROM public."BinEvent" WHERE "cooperativeId" IN (SELECT id FROM _cleanup_target);
DELETE FROM public."EnvironmentalEvent" WHERE "documentId" IN
 (SELECT d.id FROM public."EnvironmentalDocument" d JOIN public."EnvironmentalUnit" u ON u.id = d."unitId" WHERE u."cooperativeId" IN (SELECT id FROM _cleanup_target));
DELETE FROM public."EnvironmentalAttachment" WHERE "documentId" IN
 (SELECT d.id FROM public."EnvironmentalDocument" d JOIN public."EnvironmentalUnit" u ON u.id = d."unitId" WHERE u."cooperativeId" IN (SELECT id FROM _cleanup_target));
DELETE FROM public."EnvironmentalDocument" WHERE "unitId" IN
 (SELECT id FROM public."EnvironmentalUnit" WHERE "cooperativeId" IN (SELECT id FROM _cleanup_target));
DELETE FROM public."EnvironmentalUnit" WHERE "cooperativeId" IN (SELECT id FROM _cleanup_target);
DELETE FROM public."EnvironmentalMunicipalAccess" WHERE "userId" IN (SELECT "userId" FROM _cleanup_target);
-- Coletas levam materiais, conferências, entradas, destinações e rateios relacionados por FK.
DELETE FROM public."Collection" WHERE "cooperativeId" IN (SELECT id FROM _cleanup_target);
-- Catadores têm vínculo opcional: remover seu perfil desta cooperativa evita deixá-los órfãos.
-- Contas de acesso dos colaboradores/PFs não são excluídas por este procedimento.
DELETE FROM public."Collector" WHERE "cooperativeId" IN (SELECT id FROM _cleanup_target);
-- A cascata restante remove cooperativa, geradores, veículos, rotas, planos, estoque e configurações.
DELETE FROM public."User" WHERE id IN (SELECT "userId" FROM _cleanup_target) RETURNING id, email;

DO $verify$
DECLARE t record; n bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM public."User" WHERE id IN (SELECT "userId" FROM _cleanup_target))
     OR EXISTS (SELECT 1 FROM public."Cooperative" WHERE id IN (SELECT id FROM _cleanup_target)) THEN
    RAISE EXCEPTION 'Cadastro ainda presente. Transação cancelada.';
  END IF;
  FOR t IN SELECT table_schema, table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'cooperativeId'
  LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE "cooperativeId" IN (SELECT id FROM _cleanup_target)', t.table_schema, t.table_name) INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'Restaram registros em %. Transação cancelada.', t.table_name; END IF;
  END LOOP;
END;
$verify$;
COMMIT;
\echo EXCLUSAO_CONCLUIDA
