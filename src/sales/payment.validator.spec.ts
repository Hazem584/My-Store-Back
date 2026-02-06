import { BadRequestException } from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';
import { validateAndBuildPayment } from './payment.validator';

describe('validateAndBuildPayment', () => {
  const total = new Prisma.Decimal('100.00');

  it('throws for CASH paidAmount < total', () => {
    expect(() =>
      validateAndBuildPayment(
        { paymentMethod: PaymentMethod.CASH, paidAmount: 50 },
        total,
      ),
    ).toThrow(BadRequestException);
  });

  it('returns change for CASH paidAmount >= total', () => {
    const result = validateAndBuildPayment(
      { paymentMethod: PaymentMethod.CASH, paidAmount: 120 },
      total,
    );

    expect(result.paymentMethod).toBe(PaymentMethod.CASH);
    expect(result.paidAmount?.toString()).toBe('120');
    expect(result.changeAmount?.toString()).toBe('20');
  });

  it('validates CARD payment', () => {
    const result = validateAndBuildPayment(
      { paymentMethod: PaymentMethod.CARD },
      total,
    );

    expect(result.paymentMethod).toBe(PaymentMethod.CARD);
    expect(result.cardAmount?.toString()).toBe('100');
    expect(result.changeAmount?.toString()).toBe('0');
  });

  it('validates MIXED payment and computes change', () => {
    const result = validateAndBuildPayment(
      { paymentMethod: PaymentMethod.MIXED, cashAmount: 60, cardAmount: 50 },
      total,
    );

    expect(result.paymentMethod).toBe(PaymentMethod.MIXED);
    expect(result.cashAmount?.toString()).toBe('60');
    expect(result.cardAmount?.toString()).toBe('50');
    expect(result.changeAmount?.toString()).toBe('10');
  });
});
