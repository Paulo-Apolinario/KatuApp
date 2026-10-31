CREATE TABLE "DriverLiveLocation" (
 "driverId" TEXT PRIMARY KEY REFERENCES "Driver"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 "cooperativeId" TEXT NOT NULL,
 "sessionId" TEXT NOT NULL UNIQUE,
 "routeId" TEXT,
 "collectionId" TEXT,
 "active" BOOLEAN NOT NULL DEFAULT true,
 "latitude" DOUBLE PRECISION,
 "longitude" DOUBLE PRECISION,
 "accuracy" DOUBLE PRECISION,
 "capturedAt" TIMESTAMP(3),
 "receivedAt" TIMESTAMP(3),
 "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "endedAt" TIMESTAMP(3),
 "mode" TEXT NOT NULL,
 CONSTRAINT "DriverLiveLocation_context_check" CHECK (("routeId" IS NULL) <> ("collectionId" IS NULL)),
 CONSTRAINT "DriverLiveLocation_coords_check" CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)),
 CONSTRAINT "DriverLiveLocation_accuracy_check" CHECK (accuracy IS NULL OR accuracy >= 0)
);
CREATE INDEX "DriverLiveLocation_cooperativeId_active_idx" ON "DriverLiveLocation"("cooperativeId","active");
