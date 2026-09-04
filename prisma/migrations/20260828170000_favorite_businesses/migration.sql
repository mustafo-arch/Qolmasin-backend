-- CreateTable
CREATE TABLE "favorite_businesses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "favorite_businesses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "favorite_businesses_user_id_business_id_key" ON "favorite_businesses"("user_id", "business_id");
CREATE INDEX "favorite_businesses_user_id_created_at_idx" ON "favorite_businesses"("user_id", "created_at");
CREATE INDEX "favorite_businesses_business_id_created_at_idx" ON "favorite_businesses"("business_id", "created_at");

-- AddForeignKey
ALTER TABLE "favorite_businesses" ADD CONSTRAINT "favorite_businesses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "favorite_businesses" ADD CONSTRAINT "favorite_businesses_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
