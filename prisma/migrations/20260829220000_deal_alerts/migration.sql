ALTER TYPE "BusinessType" ADD VALUE IF NOT EXISTS 'OTHER';

CREATE TABLE "deal_alerts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category_id" UUID,
    "product_query" VARCHAR(180),
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "radius" DECIMAL(6,2) NOT NULL DEFAULT 3,
    "min_discount" DECIMAL(5,2),
    "max_price" DECIMAL(14,2),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "deal_alerts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "deal_alerts_latitude_check" CHECK ("latitude" >= -90 AND "latitude" <= 90),
    CONSTRAINT "deal_alerts_longitude_check" CHECK ("longitude" >= -180 AND "longitude" <= 180),
    CONSTRAINT "deal_alerts_radius_check" CHECK ("radius" >= 0.1 AND "radius" <= 100),
    CONSTRAINT "deal_alerts_min_discount_check" CHECK ("min_discount" IS NULL OR ("min_discount" >= 0 AND "min_discount" <= 100)),
    CONSTRAINT "deal_alerts_max_price_check" CHECK ("max_price" IS NULL OR "max_price" >= 0),
    CONSTRAINT "deal_alerts_filter_check" CHECK ("category_id" IS NOT NULL OR "product_query" IS NOT NULL)
);

CREATE INDEX "deal_alerts_user_id_enabled_created_at_idx" ON "deal_alerts"("user_id", "enabled", "created_at");
CREATE INDEX "deal_alerts_category_id_enabled_idx" ON "deal_alerts"("category_id", "enabled");

ALTER TABLE "deal_alerts" ADD CONSTRAINT "deal_alerts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deal_alerts" ADD CONSTRAINT "deal_alerts_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
