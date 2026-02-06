import { PaymentMethod } from '@prisma/client';

export class ReceiptItemDto {
  productId: string;
  name: string;
  code?: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export class ReceiptStoreDto {
  name: string;
  address?: string;
  phone?: string;
  taxNumber?: string;
}

export class ReceiptCashierDto {
  id: string;
  fullName: string;
}

export class ReceiptTotalsDto {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export class ReceiptPaymentDto {
  method: PaymentMethod;
  paidAmount?: number;
  changeAmount?: number;
  cardAmount?: number;
  cashAmount?: number;
}

export class ReceiptItemsSummaryDto {
  totalQty: number;
  distinctItems: number;
}

export class ReceiptDto {
  receiptId: string;
  receiptNo: string;
  createdAt: string;
  displayDate?: string;
  displayTime?: string;
  currency: string;
  store: ReceiptStoreDto;
  cashier: ReceiptCashierDto;
  items: ReceiptItemDto[];
  itemsSummary: ReceiptItemsSummaryDto;
  totals: ReceiptTotalsDto;
  payment?: ReceiptPaymentDto;
  footerLines: string[];
}
