-- Add the first price-trust and food-safety fields without changing existing rows.
ALTER TYPE "OfferStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
ALTER TYPE "OfferStatus" ADD VALUE IF NOT EXISTS 'PAUSED';
ALTER TYPE "OfferStatus" ADD VALUE IF NOT EXISTS 'HIDDEN';

CREATE TYPE "OfferType" AS ENUM (
  'SURPLUS',
  'EXPIRING_SOON',
  'OVERSTOCK',
  'DAILY_SPECIAL',
  'LAST_MINUTE',
  'CLEARANCE'
);

CREATE TYPE "PriceAnomalyStatus" AS ENUM (
  'NORMAL',
  'SUSPICIOUS',
  'REVIEW_REQUIRED',
  'RESOLVED'
);

ALTER TABLE "offers"
  ADD COLUMN "reference_price" DECIMAL(14,2),
  ADD COLUMN "offer_type" "OfferType" NOT NULL DEFAULT 'SURPLUS',
  ADD COLUMN "auto_discount_enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "best_before_at" TIMESTAMPTZ(3),
  ADD COLUMN "prepared_at" TIMESTAMPTZ(3);

CREATE TYPE "QuantityUnit" AS ENUM (
  'PIECE', 'GRAM', 'KILOGRAM', 'LITER', 'PACK', 'PORTION', 'BOX'
);

ALTER TABLE "products"
  ADD COLUMN "regular_price" DECIMAL(14,2),
  ADD COLUMN "quantity_unit" "QuantityUnit" NOT NULL DEFAULT 'PIECE';

ALTER TABLE "products"
  ADD CONSTRAINT "products_regular_price_check"
  CHECK ("regular_price" IS NULL OR "regular_price" >= 0);

ALTER TABLE "offers"
  ADD CONSTRAINT "offers_reference_price_check"
  CHECK ("reference_price" IS NULL OR "reference_price" >= 0);

CREATE TABLE "price_history" (
  "id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "branch_id" UUID,
  "price" DECIMAL(14,2) NOT NULL,
  "source" VARCHAR(80) NOT NULL,
  "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "price_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "price_history_price_check" CHECK ("price" >= 0)
);

CREATE TABLE "price_anomalies" (
  "id" UUID NOT NULL,
  "offer_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "previous_price" DECIMAL(14,2) NOT NULL,
  "current_price" DECIMAL(14,2) NOT NULL,
  "increase_percent" DECIMAL(7,2) NOT NULL,
  "status" "PriceAnomalyStatus" NOT NULL DEFAULT 'REVIEW_REQUIRED',
  "reason" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(3),
  CONSTRAINT "price_anomalies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "price_anomalies_price_check" CHECK ("previous_price" >= 0 AND "current_price" >= 0 AND "increase_percent" >= 0)
);

CREATE INDEX "price_history_product_id_branch_id_recorded_at_idx"
  ON "price_history"("product_id", "branch_id", "recorded_at");
CREATE INDEX "price_history_recorded_at_idx" ON "price_history"("recorded_at");
CREATE INDEX "price_anomalies_status_created_at_idx"
  ON "price_anomalies"("status", "created_at");
CREATE INDEX "price_anomalies_product_id_branch_id_created_at_idx"
  ON "price_anomalies"("product_id", "branch_id", "created_at");

ALTER TABLE "price_history"
  ADD CONSTRAINT "price_history_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "price_history_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "price_anomalies"
  ADD CONSTRAINT "price_anomalies_offer_id_fkey"
  FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "price_anomalies_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "price_anomalies_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "discount_schedules" (
  "id" UUID NOT NULL,
  "offer_id" UUID NOT NULL,
  "starts_at" TIMESTAMPTZ(3) NOT NULL,
  "price" DECIMAL(14,2) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "discount_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "discount_schedules_price_check" CHECK ("price" >= 0)
);

CREATE UNIQUE INDEX "discount_schedules_offer_id_starts_at_key"
  ON "discount_schedules"("offer_id", "starts_at");
CREATE INDEX "discount_schedules_offer_id_starts_at_idx"
  ON "discount_schedules"("offer_id", "starts_at");
ALTER TABLE "discount_schedules"
  ADD CONSTRAINT "discount_schedules_offer_id_fkey"
  FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
