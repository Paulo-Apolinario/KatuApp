-- Operational registrations can exist before an email/login is available.
-- Existing identities, unique email indexes and User login requirements remain.
ALTER TABLE "Generator" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "Collector" ALTER COLUMN "email" DROP NOT NULL;
