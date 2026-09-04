-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'ACTIVE', 'LOW_STOCK', 'SOLD_OUT', 'EXPIRED', 'CANCELLED');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'RESERVED', 'CONFIRMED', 'READY', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED');

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "original_price" DECIMAL(14,2) NOT NULL,
    "discount_price" DECIMAL(14,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
    "sold_quantity" INTEGER NOT NULL DEFAULT 0,
    "pickup_start" TIMESTAMPTZ(3) NOT NULL,
    "pickup_end" TIMESTAMPTZ(3) NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "offers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "offers_price_check" CHECK ("original_price" >= 0 AND "discount_price" >= 0 AND "discount_price" <= "original_price"),
    CONSTRAINT "offers_inventory_check" CHECK ("quantity" > 0 AND "reserved_quantity" >= 0 AND "sold_quantity" >= 0 AND "reserved_quantity" + "sold_quantity" <= "quantity"),
    CONSTRAINT "offers_pickup_check" CHECK ("pickup_start" < "pickup_end" AND "expires_at" >= "pickup_end")
);

CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'RESERVED',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "pickup_code_hash" CHAR(64) NOT NULL,
    "pickup_attempts" INTEGER NOT NULL DEFAULT 0,
    "reserved_until" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "orders_money_check" CHECK ("subtotal" >= 0 AND "discount" >= 0 AND "total" >= 0 AND "discount" <= "subtotal" AND "total" = "subtotal" - "discount"),
    CONSTRAINT "orders_pickup_attempts_check" CHECK ("pickup_attempts" >= 0 AND "pickup_attempts" <= 10)
);

CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "product_name_snapshot" VARCHAR(180) NOT NULL,
    "unit_original_price" DECIMAL(14,2) NOT NULL,
    "unit_sale_price" DECIMAL(14,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total" DECIMAL(14,2) NOT NULL,
    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_items_money_check" CHECK ("unit_original_price" >= 0 AND "unit_sale_price" >= 0 AND "unit_sale_price" <= "unit_original_price" AND "line_total" = "unit_sale_price" * "quantity"),
    CONSTRAINT "order_items_quantity_check" CHECK ("quantity" > 0)
);

-- CreateIndex
CREATE INDEX "offers_branch_id_status_expires_at_idx" ON "offers"("branch_id", "status", "expires_at");
CREATE INDEX "offers_product_id_status_idx" ON "offers"("product_id", "status");
CREATE INDEX "offers_status_expires_at_idx" ON "offers"("status", "expires_at");
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");
CREATE INDEX "orders_branch_id_status_created_at_idx" ON "orders"("branch_id", "status", "created_at");
CREATE INDEX "orders_status_reserved_until_idx" ON "orders"("status", "reserved_until");
CREATE UNIQUE INDEX "order_items_order_id_offer_id_key" ON "order_items"("order_id", "offer_id");
CREATE INDEX "order_items_offer_id_idx" ON "order_items"("offer_id");

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offers" ADD CONSTRAINT "offers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
