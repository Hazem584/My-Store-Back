import { BadRequestException } from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';

export type PaymentInput = {
  paymentMethod?: PaymentMethod;
  paidAmount?: number;
  cashAmount?: number;
  cardAmount?: number;
};

export type PaymentResult = {
  paymentMethod: PaymentMethod;
  paidAmount?: Prisma.Decimal;
  cashAmount?: Prisma.Decimal;
  cardAmount?: Prisma.Decimal;
  changeAmount?: Prisma.Decimal;
};

export function validateAndBuildPayment(
  input: PaymentInput,
  totalAmount: Prisma.Decimal,
): PaymentResult {
  const method = input.paymentMethod;
  if (!method) {
    throw new BadRequestException('Payment method is required.');
  }

  const total = new Prisma.Decimal(totalAmount);

  if (method === PaymentMethod.CASH) {
    if (input.paidAmount === undefined) {
      throw new BadRequestException('paidAmount is required for CASH.');
    }
    const paid = toDecimal(input.paidAmount, 'paidAmount');
    if (paid.lt(total)) {
      throw new BadRequestException('paidAmount must be >= total for CASH.');
    }
    const change = paid.minus(total);
    return {
      paymentMethod: method,
      paidAmount: paid,
      cashAmount: paid,
      changeAmount: change,
    };
  }

  if (method === PaymentMethod.CARD) {
    let paid: Prisma.Decimal | undefined;
    if (input.paidAmount !== undefined) {
      paid = toDecimal(input.paidAmount, 'paidAmount');
      if (paid.lt(total)) {
        throw new BadRequestException('paidAmount must be >= total for CARD.');
      }
    } else {
      paid = total;
    }

    return {
      paymentMethod: method,
      paidAmount: paid,
      cardAmount: total,
      changeAmount: new Prisma.Decimal(0),
    };
  }

  if (method === PaymentMethod.MIXED) {
    if (input.cashAmount === undefined || input.cardAmount === undefined) {
      throw new BadRequestException(
        'cashAmount and cardAmount are required for MIXED.',
      );
    }

    const cash = toDecimal(input.cashAmount, 'cashAmount');
    const card = toDecimal(input.cardAmount, 'cardAmount');

    if (cash.isNegative() || card.isNegative()) {
      throw new BadRequestException('cashAmount and cardAmount must be >= 0.');
    }

    if (card.gt(total)) {
      throw new BadRequestException('cardAmount must be <= total for MIXED.');
    }

    const sum = cash.plus(card);
    if (sum.lt(total)) {
      throw new BadRequestException(
        'cashAmount + cardAmount must be >= total for MIXED.',
      );
    }

    const cashUsed = total.minus(card);
    const change = cash.minus(cashUsed);
    if (change.lt(0)) {
      throw new BadRequestException('Invalid cash/card split for MIXED.');
    }

    return {
      paymentMethod: method,
      paidAmount: sum,
      cashAmount: cash,
      cardAmount: card,
      changeAmount: change,
    };
  }

  throw new BadRequestException('Invalid payment method.');
}

function toDecimal(value: number, field: string) {
  if (!Number.isFinite(value)) {
    throw new BadRequestException(`${field} must be a finite number.`);
  }

  return new Prisma.Decimal(value);
}
