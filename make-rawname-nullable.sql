-- Make rawName nullable for existing products
ALTER TABLE "products" ALTER COLUMN "rawName" DROP NOT NULL;