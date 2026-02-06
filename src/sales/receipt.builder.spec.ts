import { PaymentMethod, Prisma, Role } from '@prisma/client';
import { buildReceipt, SaleWithItemsAndUser, StoreConfig } from './receipt.builder';

describe('buildReceipt', () => {
  const sale: SaleWithItemsAndUser = {
    id: 'sale-1',
    userId: 'user-1',
    totalAmount: new Prisma.Decimal('19.98'),
    receiptNoInt: 1234,
    paymentMethod: PaymentMethod.CASH,
    paidAmount: new Prisma.Decimal('20.00'),
    cashAmount: new Prisma.Decimal('20.00'),
    cardAmount: null,
    changeAmount: new Prisma.Decimal('0.02'),
    createdAt: new Date('2026-02-06T10:20:30.000Z'),
    items: [
      {
        id: 'item-1',
        saleId: 'sale-1',
        productId: 'prod-1',
        quantity: 2,
        unitPrice: new Prisma.Decimal('4.99'),
        lineTotal: new Prisma.Decimal('9.98'),
        product: {
          id: 'prod-1',
          name: 'Soda',
          code: 'S001',
        },
      },
      {
        id: 'item-2',
        saleId: 'sale-1',
        productId: 'prod-2',
        quantity: 1,
        unitPrice: new Prisma.Decimal('10.00'),
        lineTotal: new Prisma.Decimal('10.00'),
        product: {
          id: 'prod-2',
          name: 'Sandwich',
          code: null,
        },
      },
    ],
    user: {
      id: 'user-1',
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      role: Role.CASHIER,
    },
  };

  const storeConfig: StoreConfig = {
    name: 'Test Store',
    address: '123 Main St',
    phone: '555-0100',
    taxNumber: 'TAX-123',
    currency: 'EGP',
    footerLines: ['Thanks for shopping!'],
  };

  it('maps totals and item lines correctly', () => {
    const receipt = buildReceipt(sale, storeConfig);

    expect(receipt.receiptId).toBe('sale-1');
    expect(receipt.receiptNo).toBe('POS-00001234');
    expect(receipt.currency).toBe('EGP');
    expect(receipt.totals.subtotal).toBeCloseTo(19.98, 2);
    expect(receipt.totals.discount).toBe(0);
    expect(receipt.totals.tax).toBe(0);
    expect(receipt.totals.total).toBeCloseTo(19.98, 2);
    expect(receipt.items).toHaveLength(2);
    expect(receipt.itemsSummary).toEqual({
      totalQty: 3,
      distinctItems: 2,
    });
    expect(receipt.items[0]).toEqual({
      productId: 'prod-1',
      name: 'Soda',
      code: 'S001',
      qty: 2,
      unitPrice: 4.99,
      lineTotal: 9.98,
    });
    expect(receipt.items[1]).toEqual({
      productId: 'prod-2',
      name: 'Sandwich',
      qty: 1,
      unitPrice: 10,
      lineTotal: 10,
    });
    expect(receipt.payment).toEqual({
      method: PaymentMethod.CASH,
      paidAmount: 20,
      changeAmount: 0.02,
      cashAmount: 20,
    });
  });

  it('includes cashier and store info', () => {
    const receipt = buildReceipt(sale, storeConfig);

    expect(receipt.cashier).toEqual({
      id: 'user-1',
      fullName: 'Jane Doe',
    });
    expect(receipt.store).toEqual({
      name: 'Test Store',
      address: '123 Main St',
      phone: '555-0100',
      taxNumber: 'TAX-123',
    });
    expect(receipt.footerLines).toEqual(['Thanks for shopping!']);
  });
});
