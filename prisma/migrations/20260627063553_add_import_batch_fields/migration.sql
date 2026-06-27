/*
  Warnings:

  - You are about to drop the column `committedAt` on the `ImportBatch` table. All the data in the column will be lost.
  - You are about to drop the column `sheetName` on the `ImportBatch` table. All the data in the column will be lost.
  - Added the required column `fileHash` to the `ImportBatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sheetNames` to the `ImportBatch` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ImportBatch" DROP COLUMN "committedAt",
DROP COLUMN "sheetName",
ADD COLUMN     "fileHash" TEXT NOT NULL,
ADD COLUMN     "sheetNames" TEXT NOT NULL,
ADD COLUMN     "skipped" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "ImportBatch_fileHash_idx" ON "ImportBatch"("fileHash");
