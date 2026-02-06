-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'MIXED');

-- CreateTable
CREATE TABLE "ReceiptCounter" (
    "id" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL,

    CONSTRAINT "ReceiptCounter_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "receiptNoInt" INTEGER;
ALTER TABLE "Sale" ADD COLUMN "paymentMethod" "PaymentMethod";
ALTER TABLE "Sale" ADD COLUMN "paidAmount" DECIMAL(12,2);
ALTER TABLE "Sale" ADD COLUMN "cashAmount" DECIMAL(12,2);
ALTER TABLE "Sale" ADD COLUMN "cardAmount" DECIMAL(12,2);
ALTER TABLE "Sale" ADD COLUMN "changeAmount" DECIMAL(12,2);

-- CreateIndex
CREATE UNIQUE INDEX "Sale_receiptNoInt_key" ON "Sale"("receiptNoInt");
