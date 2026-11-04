-- CreateEnum
CREATE TYPE "AgentDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'DEAD', 'SKIPPED');

-- AlterEnum
ALTER TYPE "AgentOrigin" ADD VALUE 'EVENT';

-- AlterTable
ALTER TABLE "AgentConfig" ADD COLUMN     "eventIntervalMinutes" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "nextEventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "AgentRun" ADD COLUMN "eventDeliveryIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "AgentEvent" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentEventDelivery" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "agent" "AgentKey" NOT NULL,
    "status" "AgentDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "runId" TEXT,
    "errorCode" TEXT,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentEventDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentEvent_cooperativeId_occurredAt_id_idx" ON "AgentEvent"("cooperativeId", "occurredAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentEvent_cooperativeId_eventKey_key" ON "AgentEvent"("cooperativeId", "eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "AgentEvent_cooperativeId_id_key" ON "AgentEvent"("cooperativeId", "id");

-- CreateIndex
CREATE INDEX "AgentEventDelivery_status_availableAt_createdAt_id_idx" ON "AgentEventDelivery"("status", "availableAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "AgentEventDelivery_cooperativeId_agent_status_availableAt_idx" ON "AgentEventDelivery"("cooperativeId", "agent", "status", "availableAt");

-- CreateIndex
CREATE INDEX "AgentEventDelivery_cooperativeId_runId_status_idx" ON "AgentEventDelivery"("cooperativeId", "runId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentEventDelivery_eventId_agent_key" ON "AgentEventDelivery"("eventId", "agent");

-- AddForeignKey
ALTER TABLE "AgentEvent" ADD CONSTRAINT "AgentEvent_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentEventDelivery" ADD CONSTRAINT "AgentEventDelivery_cooperativeId_eventId_fkey" FOREIGN KEY ("cooperativeId", "eventId") REFERENCES "AgentEvent"("cooperativeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentEventDelivery" ADD CONSTRAINT "AgentEventDelivery_cooperativeId_agent_fkey" FOREIGN KEY ("cooperativeId", "agent") REFERENCES "AgentConfig"("cooperativeId", "agent") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentEventDelivery" ADD CONSTRAINT "AgentEventDelivery_cooperativeId_runId_fkey" FOREIGN KEY ("cooperativeId", "runId") REFERENCES "AgentRun"("cooperativeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Capture at the storage boundary: domain commit and outbox commit are indivisible,
-- including existing route generation, bulk updates and replay-safe offline services.
CREATE FUNCTION katua_capture_agent_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  current_row jsonb := to_jsonb(NEW);
  previous_row jsonb;
  payload jsonb;
  previous_payload jsonb;
  tenant text := current_row->>'cooperativeId';
  targets text[];
  interested "AgentKey"[];
  event_key text;
  event_id text;
  digest text;
BEGIN
  IF tenant IS NULL THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'SystemAlert' AND current_setting('katua.agent_analysis', true) = 'true' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME IN ('Route','Vehicle','Driver','Collector') THEN targets := ARRAY['ROUTES','MANAGER'];
  ELSIF TG_TABLE_NAME = 'Collection' THEN targets := ARRAY['COLLECTIONS','ROUTES','MANAGER'];
  ELSIF TG_TABLE_NAME = 'SystemAlert' THEN targets := ARRAY['MANAGER'];
  ELSE targets := ARRAY['COLLECTIONS','MANAGER']; END IF;
  -- No queue growth for tenants without opted-in automatic agents.
  SELECT array_agg(c.agent) INTO interested FROM "AgentConfig" c
    JOIN "Cooperative" co ON co.id=c."cooperativeId" JOIN "User" u ON u.id=co."userId"
    WHERE c."cooperativeId"=tenant AND c.enabled AND c."automationsEnabled"
      AND c.agent::text=ANY(targets) AND u."isActive" AND u."accountStatus"='ACTIVE' AND u.role='COOPERATIVE';
  IF interested IS NULL THEN RETURN NEW; END IF;
  SELECT jsonb_object_agg(k,current_row->k) INTO payload FROM unnest(string_to_array(TG_ARGV[0],',')) k;
  IF TG_OP='UPDATE' THEN
    previous_row := to_jsonb(OLD);
    SELECT jsonb_object_agg(k,previous_row->k) INTO previous_payload FROM unnest(string_to_array(TG_ARGV[0],',')) k;
    IF payload IS NOT DISTINCT FROM previous_payload THEN RETURN NEW; END IF;
  END IF;
  digest := md5(payload::text);
  event_key := 'db:' || txid_current()::text || ':' || TG_TABLE_NAME || ':' || (current_row->>'id') || ':' || digest;
  event_id := 'ae_' || md5(event_key);
  INSERT INTO "AgentEvent" (id,"cooperativeId","eventKey",source,"entityId",kind,"sourceHash")
    VALUES(event_id,tenant,event_key,TG_TABLE_NAME,current_row->>'id',TG_TABLE_NAME || '.' || TG_OP,digest)
    ON CONFLICT ("cooperativeId","eventKey") DO NOTHING;
  INSERT INTO "AgentEventDelivery" (id,"cooperativeId","eventId",agent,"availableAt","expiresAt","updatedAt")
    SELECT 'aed_' || md5(event_id || ':' || a::text),tenant,event_id,a,now()+interval '60 seconds',now()+interval '7 days',now()
    FROM unnest(interested) a ON CONFLICT ("eventId",agent) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER katua_agent_schedule AFTER INSERT OR UPDATE ON "Schedule" FOR EACH ROW EXECUTE FUNCTION katua_capture_agent_event('cooperativeId,status,scheduledDate,preferredDate,generatorId,pickupAddress,pickupLatitude,pickupLongitude');
CREATE TRIGGER katua_agent_collection AFTER INSERT OR UPDATE ON "Collection" FOR EACH ROW EXECUTE FUNCTION katua_capture_agent_event('cooperativeId,status,routeId,scheduleId,collectorId,driverId,vehicleId,quantityReviewVersion,attendanceOutcome');
CREATE TRIGGER katua_agent_route AFTER INSERT OR UPDATE ON "Route" FOR EACH ROW EXECUTE FUNCTION katua_capture_agent_event('cooperativeId,status,scheduledDate,driverId,vehicleId,collectorIds,teamId,stops,collectionOrder,coverageMode,coverageArea,startPoint,endPoint,description');
CREATE TRIGGER katua_agent_alert AFTER INSERT OR UPDATE ON "SystemAlert" FOR EACH ROW EXECUTE FUNCTION katua_capture_agent_event('cooperativeId,status,priority,cycle,snoozedUntil,title,message,link');
CREATE TRIGGER katua_agent_vehicle AFTER INSERT OR UPDATE ON "Vehicle" FOR EACH ROW EXECUTE FUNCTION katua_capture_agent_event('cooperativeId,status,driverId,capacityKg');
CREATE TRIGGER katua_agent_driver AFTER INSERT OR UPDATE ON "Driver" FOR EACH ROW EXECUTE FUNCTION katua_capture_agent_event('cooperativeId,status');
CREATE TRIGGER katua_agent_collector AFTER INSERT OR UPDATE ON "Collector" FOR EACH ROW EXECUTE FUNCTION katua_capture_agent_event('cooperativeId,status');
CREATE TRIGGER katua_agent_extra AFTER INSERT OR UPDATE ON "ExtraCollectionOrder" FOR EACH ROW EXECUTE FUNCTION katua_capture_agent_event('cooperativeId,status,collectionId,revision');
CREATE TRIGGER katua_agent_pev AFTER INSERT OR UPDATE ON "PevRequest" FOR EACH ROW EXECUTE FUNCTION katua_capture_agent_event('cooperativeId,status,collectionId,version');
