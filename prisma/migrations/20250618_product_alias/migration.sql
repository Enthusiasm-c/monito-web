-- CreateTable
CREATE TABLE "product_alias" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "language" TEXT DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_alias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_alias_alias_key" ON "product_alias"("alias");

-- CreateIndex
CREATE INDEX "product_alias_productId_idx" ON "product_alias"("productId");

-- CreateIndex
CREATE INDEX "product_alias_alias_idx" ON "product_alias"("alias");

-- AddForeignKey
ALTER TABLE "product_alias" ADD CONSTRAINT "product_alias_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;