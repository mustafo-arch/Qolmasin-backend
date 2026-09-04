CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'HIDDEN');
CREATE TYPE "ReportReason" AS ENUM (
  'FAKE_DISCOUNT',
  'WRONG_PRICE',
  'WRONG_LOCATION',
  'WRONG_HOURS',
  'EXPIRED_OFFER',
  'UNSAFE_PRODUCT',
  'OTHER'
);
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');

CREATE TABLE "business_reviews" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" VARCHAR(1000),
  "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "business_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "business_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "business_reviews_user_id_business_id_key"
  ON "business_reviews"("user_id", "business_id");
CREATE INDEX "business_reviews_business_id_status_created_at_idx"
  ON "business_reviews"("business_id", "status", "created_at");

CREATE TABLE "business_reports" (
  "id" UUID NOT NULL,
  "reporter_id" UUID NOT NULL,
  "business_id" UUID,
  "offer_id" UUID,
  "reason" "ReportReason" NOT NULL,
  "details" VARCHAR(1000),
  "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(3),
  CONSTRAINT "business_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "business_reports_target_check" CHECK ("business_id" IS NOT NULL OR "offer_id" IS NOT NULL)
);

CREATE INDEX "business_reports_status_created_at_idx"
  ON "business_reports"("status", "created_at");
CREATE INDEX "business_reports_business_id_created_at_idx"
  ON "business_reports"("business_id", "created_at");
CREATE INDEX "business_reports_offer_id_created_at_idx"
  ON "business_reports"("offer_id", "created_at");

ALTER TABLE "business_reviews"
  ADD CONSTRAINT "business_reviews_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "business_reviews_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_reports"
  ADD CONSTRAINT "business_reports_reporter_id_fkey"
    FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "business_reports_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "business_reports_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
