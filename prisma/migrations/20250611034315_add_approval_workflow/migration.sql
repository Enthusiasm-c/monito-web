/*
  Warnings:

  - You are about to drop the column `filename` on the `uploads` table. All the data in the column will be lost.
  - Added the required column `rawName` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "products" ADD COLUMN     "rawName" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "uploads" DROP COLUMN "filename",
ADD COLUMN     "approvalStatus" TEXT DEFAULT 'pending_review',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "autoApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "completenessRatio" DOUBLE PRECISION,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "processingCostUsd" DOUBLE PRECISION,
ADD COLUMN     "processingDetails" TEXT,
ADD COLUMN     "processingTimeMs" INTEGER,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewNotes" TEXT,
ADD COLUMN     "sheetsProcessed" JSONB,
ADD COLUMN     "tokensUsed" INTEGER,
ADD COLUMN     "totalRowsDetected" INTEGER,
ADD COLUMN     "totalRowsProcessed" INTEGER,
ADD COLUMN     "url" TEXT,
ALTER COLUMN "originalName" DROP NOT NULL,
ALTER COLUMN "fileSize" DROP NOT NULL,
ALTER COLUMN "mimeType" DROP NOT NULL;
