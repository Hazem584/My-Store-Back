import { formatReceiptNo, getNextReceiptNumber } from './receipt-counter';

describe('receipt-counter', () => {
  it('formats receipt numbers', () => {
    expect(formatReceiptNo(1)).toBe('POS-00000001');
    expect(formatReceiptNo(1234)).toBe('POS-00001234');
  });

  it('increments receipt counter via tx', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 1, lastNumber: 42 });
    const tx = { receiptCounter: { upsert } } as any;

    const next = await getNextReceiptNumber(tx);

    expect(next).toBe(42);
    expect(upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      create: { id: 1, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
  });
});
