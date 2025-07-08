-- Ensure composite unique index on products table
-- This prevents duplicate products with same standardizedName and standardizedUnit
CREATE UNIQUE INDEX IF NOT EXISTS "products_standardizedName_standardizedUnit_key" 
ON "products"("standardizedName", "standardizedUnit");