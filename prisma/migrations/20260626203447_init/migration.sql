-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "EntryKind" AS ENUM ('HUSK_PURCHASE', 'OPERATIONAL', 'SALE', 'CAPITAL', 'CAPITAL_RETURN');

-- CreateEnum
CREATE TYPE "OutBucket" AS ENUM ('HUSK_PURCHASE', 'PETTY_CASH', 'LABOUR', 'TRANSPORT', 'BROKER', 'MISC');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('REQUIRED', 'EXTRA');

-- CreateEnum
CREATE TYPE "PaymentSource" AS ENUM ('ALFALAH', 'MEEZAN', 'CASH', 'OTHER');

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "direction" "Direction" NOT NULL,
    "kind" "EntryKind" NOT NULL,
    "bucket" "OutBucket",
    "priority" "Priority",
    "amount" BIGINT,
    "billed" BIGINT,
    "received" BIGINT,
    "weight" BIGINT,
    "counterparty" TEXT,
    "partner" TEXT,
    "paymentSource" "PaymentSource",
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateSetting" (
    "id" TEXT NOT NULL,
    "paisaPerKg" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "RateSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Entry_date_idx" ON "Entry"("date");

-- CreateIndex
CREATE INDEX "Entry_direction_kind_idx" ON "Entry"("direction", "kind");

-- CreateIndex
CREATE INDEX "Entry_deletedAt_idx" ON "Entry"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_email_key" ON "AppUser"("email");

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
