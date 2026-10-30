ALTER TABLE "WasteStockMovement" ADD COLUMN "transportDriverName" TEXT, ADD COLUMN "transportVehiclePlate" TEXT;

-- CreateTable
CREATE TABLE "ServiceOrder" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalDocument" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "collectionId" TEXT,
    "lotId" TEXT,
    "movementId" TEXT,
    "destinationId" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalDocumentLink" (
    "documentId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,

    CONSTRAINT "InternalDocumentLink_pkey" PRIMARY KEY ("documentId","serviceOrderId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrder_number_key" ON "ServiceOrder"("number");

-- CreateIndex
CREATE INDEX "ServiceOrder_cooperativeId_createdAt_id_idx" ON "ServiceOrder"("cooperativeId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrder_cooperativeId_sourceKey_key" ON "ServiceOrder"("cooperativeId", "sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "InternalDocument_number_key" ON "InternalDocument"("number");

-- CreateIndex
CREATE INDEX "InternalDocument_cooperativeId_createdAt_id_idx" ON "InternalDocument"("cooperativeId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "InternalDocument_cooperativeId_collectionId_idx" ON "InternalDocument"("cooperativeId", "collectionId");

-- CreateIndex
CREATE INDEX "InternalDocument_cooperativeId_lotId_idx" ON "InternalDocument"("cooperativeId", "lotId");

-- CreateIndex
CREATE UNIQUE INDEX "InternalDocument_cooperativeId_eventKey_key" ON "InternalDocument"("cooperativeId", "eventKey");

-- CreateIndex
CREATE INDEX "InternalDocumentLink_serviceOrderId_idx" ON "InternalDocumentLink"("serviceOrderId");

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalDocument" ADD CONSTRAINT "InternalDocument_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalDocumentLink" ADD CONSTRAINT "InternalDocumentLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "InternalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalDocumentLink" ADD CONSTRAINT "InternalDocumentLink_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ServiceOrderCollection" (
 "serviceOrderId" TEXT NOT NULL REFERENCES "ServiceOrder"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "collectionId" TEXT NOT NULL,
 CONSTRAINT "ServiceOrderCollection_pkey" PRIMARY KEY ("serviceOrderId","collectionId")
);
CREATE INDEX "ServiceOrderCollection_collectionId_idx" ON "ServiceOrderCollection"("collectionId");

CREATE SEQUENCE "ServiceOrderNumber";
CREATE SEQUENCE "InternalDocumentNumber";

-- Allowlisted operational snapshot; never serialize User or personal profile records.
CREATE FUNCTION katua_order_snapshot(coop text, source_type text, source_id text) RETURNS jsonb
LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object(
 'cooperative', (SELECT jsonb_build_object('name',name,'document',"registrationNumber",'address',coalesce(address,concat_ws(', ',street,number,neighborhood,city,state))) FROM "Cooperative" WHERE id=coop),
 'route', (SELECT jsonb_build_object('id',r.id,'name',r.name,'date',r."scheduledDate" AT TIME ZONE 'UTC','status',r.status,'driver',d.name,'vehicle',v.plate,'notes',r.description,'startedAt',r."startedAt" AT TIME ZONE 'UTC','closedAt',r."closedAt" AT TIME ZONE 'UTC','outcome',r."closureOutcome",'events',r."operationalEvents") FROM "Route" r LEFT JOIN "Driver" d ON d.id=r."driverId" LEFT JOIN "Vehicle" v ON v.id=r."vehicleId" WHERE source_type='ROUTE' AND r.id=source_id AND r."cooperativeId"=coop),
 'collections', coalesce((SELECT jsonb_agg(jsonb_build_object(
 'id',c.id,'scheduleId',c."scheduleId",'date',s."scheduledDate" AT TIME ZONE 'UTC','status',c.status,
 'origin',coalesce(g.name,b.name,c."routePoint"->>'name',u."displayName",'Coleta avulsa'),
 'address',coalesce(s."pickupAddress",g.address,nullif(concat_ws(', ',b.street,b.number,b.neighborhood,b.city,b.state),''),c."routePoint"->>'address'),
 'collector',cl.name,'driver',d.name,'vehicle',v.plate,'notes',c.notes,
 'startedAt',c."startedAt" AT TIME ZONE 'UTC','collectedAt',c."collectedAt" AT TIME ZONE 'UTC','receivedAt',c."receivedAt" AT TIME ZONE 'UTC','completedAt',c."completedAt" AT TIME ZONE 'UTC','cancelledAt',c."cancelledAt" AT TIME ZONE 'UTC','cancellationReason',c."cancellationReason",
 'participants',coalesce((SELECT jsonb_agg(p."nameSnapshot" ORDER BY p.id) FROM "CollectionParticipant" p WHERE p."collectionId"=c.id),'[]'::jsonb),
 'expectedMaterials',coalesce((SELECT jsonb_agg(jsonb_build_object('name',m."nameSnapshot",'quantity',m."estimatedQuantity",'unit',m.unit) ORDER BY m.id) FROM "ScheduleRequestedMaterial" m WHERE m."scheduleId"=c."scheduleId"),'[]'::jsonb),
 'materials',coalesce((SELECT jsonb_agg(jsonb_build_object('name',m."nameSnapshot",'quantity',m.quantity,'unit',m.unit,'reportedQuantity',m."reportedQuantity") ORDER BY m.id) FROM "CollectionMaterial" m WHERE m."collectionId"=c.id),'[]'::jsonb),
 'destinations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'type',d.type,'quantity',d.quantity,'unit',d.unit,'destinationName',d."destinationName",'status',d.status,'material',e."materialNameSnapshot",'stockLotId',d."stockLotId") ORDER BY d.id) FROM "CollectionWasteEntry" e JOIN "CollectionWasteDestination" d ON d."collectionWasteEntryId"=e.id WHERE e."collectionId"=c.id AND d."cooperativeId"=coop),'[]'::jsonb),
 'incidents',coalesce((SELECT jsonb_agg(jsonb_build_object('description',i.description,'status',i.status,'resolution',i.resolution) ORDER BY i.id) FROM "CollectionIncident" i WHERE i."collectionId"=c.id),'[]'::jsonb)
 ) ORDER BY c.id) FROM "Collection" c LEFT JOIN "Schedule" s ON s.id=c."scheduleId" LEFT JOIN "User" u ON u.id=s."requestedByUserId" LEFT JOIN "Generator" g ON g.id=c."generatorId" LEFT JOIN "Bin" b ON b.id=c."binId" LEFT JOIN "Collector" cl ON cl.id=c."collectorId" LEFT JOIN "Driver" d ON d.id=c."driverId" LEFT JOIN "Vehicle" v ON v.id=c."vehicleId"
 WHERE c."cooperativeId"=coop AND ((source_type='ROUTE' AND c."routeId"=source_id) OR (source_type='COLLECTION' AND c.id=source_id))),'[]'::jsonb));
$$;

CREATE FUNCTION katua_ensure_order(coop text, source_type text, source_id text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE oid text; key text:=source_type||':'||source_id;
BEGIN
 INSERT INTO "ServiceOrder" (id,"cooperativeId",number,"sourceKey","sourceType","sourceId")
 VALUES (md5(random()::text||clock_timestamp()::text),coop,'OS-'||to_char(now() AT TIME ZONE 'America/Fortaleza','YYYY')||'-'||lpad(nextval('"ServiceOrderNumber"')::text,8,'0'),key,source_type,source_id)
 ON CONFLICT ("cooperativeId","sourceKey") DO NOTHING;
 SELECT id INTO oid FROM "ServiceOrder" WHERE "cooperativeId"=coop AND "sourceKey"=key;
 RETURN oid;
END; $$;

CREATE FUNCTION katua_document(coop text, kind text, event_key text, payload jsonb, oid text DEFAULT NULL, cid text DEFAULT NULL, lid text DEFAULT NULL, mid text DEFAULT NULL, did text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE docid text;
BEGIN
 INSERT INTO "InternalDocument" (id,"cooperativeId",number,kind,"eventKey",snapshot,"collectionId","lotId","movementId","destinationId")
 VALUES (md5(random()::text||clock_timestamp()::text),coop,'INT-'||to_char(now() AT TIME ZONE 'America/Fortaleza','YYYY')||'-'||lpad(nextval('"InternalDocumentNumber"')::text,8,'0'),kind,event_key,payload||jsonb_build_object('internalOnly',true),cid,lid,mid,did)
 ON CONFLICT ("cooperativeId","eventKey") DO NOTHING;
 SELECT id INTO docid FROM "InternalDocument" WHERE "cooperativeId"=coop AND "eventKey"=event_key;
 IF oid IS NOT NULL THEN INSERT INTO "InternalDocumentLink" ("documentId","serviceOrderId") VALUES(docid,oid) ON CONFLICT DO NOTHING; END IF;
 RETURN docid;
END; $$;

CREATE FUNCTION katua_capture_order() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE coop text; sid text; typ text; oid text; snap jsonb; ready boolean; cid text; st text; key text; k text; actor text;
BEGIN
 IF TG_TABLE_NAME='Collection' THEN
  SELECT "cooperativeId",coalesce("routeId",id),CASE WHEN "routeId" IS NULL THEN 'COLLECTION' ELSE 'ROUTE' END,id,status::text INTO coop,sid,typ,cid,st FROM "Collection" WHERE id=NEW.id;
 ELSE
  SELECT "cooperativeId",id,'ROUTE',NULL,status::text INTO coop,sid,typ,cid,st FROM "Route" WHERE id=NEW.id;
 END IF;
 IF coop IS NULL THEN RETURN NULL; END IF;
 oid:=katua_ensure_order(coop,typ,sid); snap:=katua_order_snapshot(coop,typ,sid);
 INSERT INTO "ServiceOrderCollection" ("serviceOrderId","collectionId") SELECT oid,c.id FROM "Collection" c WHERE c."cooperativeId"=coop AND ((typ='ROUTE' AND c."routeId"=sid) OR (typ='COLLECTION' AND c.id=sid)) ON CONFLICT DO NOTHING;
 IF typ='ROUTE' THEN SELECT r."driverId" IS NOT NULL AND r."vehicleId" IS NOT NULL AND (cardinality(r."collectorIds")>0 OR EXISTS(SELECT 1 FROM "Collection" c WHERE c."routeId"=r.id AND c."collectorId" IS NOT NULL)) INTO ready FROM "Route" r WHERE r.id=sid;
 ELSE SELECT "driverId" IS NOT NULL AND "vehicleId" IS NOT NULL AND "collectorId" IS NOT NULL INTO ready FROM "Collection" WHERE id=sid; END IF;
 -- The planning document is issued only while the operation is pending. Subsequent changes create a new immutable version.
 IF ready AND st IN ('PENDING','SCHEDULED') AND jsonb_array_length(snap->'collections')>0 THEN
  PERFORM katua_document(coop,'SERVICE_ORDER','PLAN:'||oid||':'||md5(snap::text),snap,oid);
 END IF;
 IF TG_TABLE_NAME='Collection' THEN
  IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR NEW."quantityReviewVersion" IS DISTINCT FROM OLD."quantityReviewVersion" THEN
   k:=CASE st WHEN 'COLLECTED' THEN 'COLLECTION_RECEIPT' WHEN 'RECEIVED' THEN 'RECEIVING_RECEIPT' WHEN 'SORTING' THEN 'RECEIVING_RECEIPT' WHEN 'COMPLETED' THEN 'CLOSURE' WHEN 'CANCELLED' THEN 'CANCELLATION' WHEN 'IN_PROGRESS' THEN 'START_RECORD' ELSE NULL END;
   IF k IS NOT NULL THEN
    SELECT u."displayName" INTO actor FROM "Collection" c LEFT JOIN "User" u ON u.id=CASE st WHEN 'COLLECTED' THEN c."fieldCompletedByUserId" WHEN 'RECEIVED' THEN c."receivedByUserId" WHEN 'SORTING' THEN c."sortingStartedByUserId" WHEN 'COMPLETED' THEN c."completedByUserId" WHEN 'CANCELLED' THEN c."cancelledByUserId" ELSE c."startedByUserId" END WHERE c.id=cid;
    PERFORM katua_document(coop,k,k||':'||cid||':'||md5(snap::text),snap||jsonb_build_object('actor',actor,'subjectCollectionId',cid),oid,cid);
   END IF;
  END IF;
 ELSE
  IF st IN ('IN_PROGRESS','COMPLETED','CANCELLED') AND (TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR NEW."closureOutcome" IS DISTINCT FROM OLD."closureOutcome") THEN
   k:=CASE st WHEN 'IN_PROGRESS' THEN 'START_RECORD' WHEN 'COMPLETED' THEN 'CLOSURE' ELSE 'CANCELLATION' END;
   PERFORM katua_document(coop,k,k||':'||oid||':'||md5(snap::text),snap,oid);
  END IF;
 END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER katua_collection_documents AFTER INSERT OR UPDATE ON "Collection" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION katua_capture_order();
CREATE CONSTRAINT TRIGGER katua_route_documents AFTER INSERT OR UPDATE ON "Route" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION katua_capture_order();

CREATE FUNCTION katua_capture_destination() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c "Collection"%ROWTYPE; oid text; snap jsonb; typ text; sid text; dest "CollectionWasteDestination"%ROWTYPE; mat text;
BEGIN
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'updatedAt'-'version'-'lastOperationId'-'lastOperationHash'-'operationId'-'operationHash') IS NOT DISTINCT FROM (to_jsonb(OLD)-'updatedAt'-'version'-'lastOperationId'-'lastOperationHash'-'operationId'-'operationHash') THEN RETURN NULL; END IF;
 SELECT * INTO dest FROM "CollectionWasteDestination" WHERE id=NEW.id;
 IF dest.id IS NULL THEN RETURN NULL; END IF;
 SELECT co.* INTO c FROM "Collection" co JOIN "CollectionWasteEntry" e ON e."collectionId"=co.id WHERE e.id=dest."collectionWasteEntryId" AND co."cooperativeId"=dest."cooperativeId";
 IF c.id IS NULL THEN RETURN NULL; END IF;
 typ:=CASE WHEN c."routeId" IS NULL THEN 'COLLECTION' ELSE 'ROUTE' END; sid:=coalesce(c."routeId",c.id);
 oid:=katua_ensure_order(c."cooperativeId",typ,sid);
 SELECT "materialNameSnapshot" INTO mat FROM "CollectionWasteEntry" WHERE id=dest."collectionWasteEntryId";
 snap:=katua_order_snapshot(c."cooperativeId",typ,sid)||jsonb_build_object('subjectCollectionId',c.id,'destination',(to_jsonb(dest)-'operationHash'-'lastOperationHash'-'metadata')||jsonb_build_object('destinationDate',dest."destinationDate" AT TIME ZONE 'UTC'),'material',mat);
 PERFORM katua_document(c."cooperativeId",'DESTINATION_RECORD','DEST:'||dest.id||':'||md5(snap::text),snap,oid,c.id,dest."stockLotId",NULL,dest.id);
 IF dest.type IN ('DIRECT_DESTINATION','DISPOSAL') AND dest.status='ACTIVE' THEN
  PERFORM katua_document(c."cooperativeId",'TRANSPORT_RECORD','DIRECT-EXIT:'||dest.id||':'||md5(snap::text),snap,oid,c.id,dest."stockLotId",NULL,dest.id);
 END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER katua_destination_documents AFTER INSERT OR UPDATE ON "CollectionWasteDestination" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION katua_capture_destination();

CREATE FUNCTION katua_capture_stock_exit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lot "WasteStockLot"%ROWTYPE; c "Collection"%ROWTYPE; oid text; snap jsonb; typ text; sid text; docid text;
BEGIN
 IF NEW.kind NOT IN ('SALE','DONATION','DIRECT_DESTINATION','DISPOSAL') THEN RETURN NULL; END IF;
 SELECT * INTO lot FROM "WasteStockLot" WHERE id=NEW."lotId" AND "cooperativeId"=NEW."cooperativeId";
 SELECT * INTO c FROM "Collection" WHERE id=lot."originCollectionId" AND "cooperativeId"=NEW."cooperativeId";
 IF c.id IS NOT NULL THEN
  typ:=CASE WHEN c."routeId" IS NULL THEN 'COLLECTION' ELSE 'ROUTE' END; sid:=coalesce(c."routeId",c.id);
  oid:=katua_ensure_order(c."cooperativeId",typ,sid); snap:=katua_order_snapshot(c."cooperativeId",typ,sid);
 ELSE snap:=katua_order_snapshot(NEW."cooperativeId",'COLLECTION',''); END IF;
 snap:=snap||jsonb_build_object('subjectCollectionId',c.id,'lot',jsonb_build_object('id',lot.id,'code',coalesce(lot."lotCode",lot.code),'originCollectionId',lot."originCollectionId"),'material',(SELECT name FROM "WasteStockItem" WHERE id=lot."stockItemId"),'movement',(to_jsonb(NEW)-'operationHash')||jsonb_build_object('movementDate',NEW."movementDate" AT TIME ZONE 'UTC'));
 docid:=katua_document(NEW."cooperativeId",'TRANSPORT_RECORD','EXIT:'||NEW.id,snap,oid,c.id,lot.id,NEW.id);
 -- Also link earlier O.S. references if the collection was reassigned to another route.
 IF c.id IS NOT NULL THEN
  INSERT INTO "InternalDocumentLink" ("documentId","serviceOrderId") SELECT DISTINCT docid,l."serviceOrderId" FROM "ServiceOrderCollection" l JOIN "ServiceOrder" o ON o.id=l."serviceOrderId" WHERE l."collectionId"=c.id AND o."cooperativeId"=NEW."cooperativeId" ON CONFLICT DO NOTHING;
 END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER katua_stock_exit_documents AFTER INSERT ON "WasteStockMovement" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION katua_capture_stock_exit();

-- Existing operations receive a present-day reconstruction, never a retroactive authorization.
DO $$ DECLARE src record; oid text; BEGIN
 FOR src IN SELECT DISTINCT "cooperativeId" coop,CASE WHEN "routeId" IS NULL THEN 'COLLECTION' ELSE 'ROUTE' END typ,coalesce("routeId",id) sid FROM "Collection" LOOP
  oid:=katua_ensure_order(src.coop,src.typ,src.sid);
  INSERT INTO "ServiceOrderCollection" ("serviceOrderId","collectionId") SELECT oid,c.id FROM "Collection" c WHERE c."cooperativeId"=src.coop AND ((src.typ='ROUTE' AND c."routeId"=src.sid) OR (src.typ='COLLECTION' AND c.id=src.sid)) ON CONFLICT DO NOTHING;
  PERFORM katua_document(src.coop,'HISTORICAL_RECORD','HISTORY:'||oid,katua_order_snapshot(src.coop,src.typ,src.sid)||jsonb_build_object('historicalReconstruction',true),oid);
 END LOOP;
END $$;

-- Operational evidence is append-only, including accidental writes outside the API.
CREATE FUNCTION katua_keep_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Documentos internos emitidos são preservados. Registre uma nova versão.' USING ERRCODE='23514';
END; $$;
CREATE TRIGGER katua_immutable_document BEFORE UPDATE OR DELETE ON "InternalDocument" FOR EACH ROW EXECUTE FUNCTION katua_keep_document();
