import { Prisma } from '@prisma/client';

const RECEIPT_PREFIX = 'POS-';
const RECEIPT_PAD = 8;
const RECEIPT_COUNTER_ID = 1;

export async function getNextReceiptNumber(
  tx: Prisma.TransactionClient,
): Promise<number> {
  const counter = await tx.receiptCounter.upsert({
    where: { id: RECEIPT_COUNTER_ID },
    create: { id: RECEIPT_COUNTER_ID, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });

  return counter.lastNumber;
}

export function formatReceiptNo(value: number) {
  return `${RECEIPT_PREFIX}${value.toString().padStart(RECEIPT_PAD, '0')}`;
}
