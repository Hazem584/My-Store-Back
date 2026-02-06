import { Prisma } from '@prisma/client';
import { ReceiptDto, ReceiptItemDto } from './dto/receipt.dto';
import { formatReceiptNo } from './receipt-counter';

export type StoreConfig = {
  name: string;
  address?: string;
  phone?: string;
  taxNumber?: string;
  currency: string;
  footerLines?: string[];
};

export type SaleWithItemsAndUser = Prisma.SaleGetPayload<{
  include: {
    items: {
      include: {
        product: {
          select: {
            id: true;
            name: true;
            code: true;
          };
        };
      };
    };
    user: {
      select: {
        id: true;
        fullName: true;
        email: true;
        role: true;
      };
    };
  };
}>;

const DEFAULT_STORE_NAME = 'My Store';
const DEFAULT_STORE_ADDRESS = '';
const DEFAULT_STORE_PHONE = '';
const DEFAULT_STORE_TAX_NO = '';
const DEFAULT_STORE_CURRENCY = 'EGP';

export function getStoreConfigFromEnv(): StoreConfig {
  const name = cleanOptional(process.env.STORE_NAME) ?? DEFAULT_STORE_NAME;
  const address =
    cleanOptional(process.env.STORE_ADDRESS) ?? DEFAULT_STORE_ADDRESS;
  const phone = cleanOptional(process.env.STORE_PHONE) ?? DEFAULT_STORE_PHONE;
  const taxNumber =
    cleanOptional(process.env.STORE_TAX_NO) ?? DEFAULT_STORE_TAX_NO;
  const currency =
    cleanOptional(process.env.STORE_CURRENCY) ?? DEFAULT_STORE_CURRENCY;
  const footerLines = parseFooterLines(process.env.STORE_FOOTER_LINES);

  return {
    name,
    address,
    phone,
    taxNumber,
    currency,
    footerLines,
  };
}

export function buildReceipt(
  sale: SaleWithItemsAndUser,
  storeConfig: StoreConfig,
): ReceiptDto {
  const items: ReceiptItemDto[] = sale.items.map((item) => {
    const receiptItem: ReceiptItemDto = {
      productId: item.product.id,
      name: item.product.name,
      qty: item.quantity,
      unitPrice: round2(toNumber(item.unitPrice)),
      lineTotal: round2(toNumber(item.lineTotal)),
    };

    if (item.product.code) {
      receiptItem.code = item.product.code;
    }

    return receiptItem;
  });

  const subtotal = round2(items.reduce((acc, item) => acc + item.lineTotal, 0));
  const discount = round2(toNumber(sale.discountAmount));
  const tax = round2(toNumber(sale.taxAmount));
  const total = round2(toNumber(sale.totalAmount));
  const totalQty = sale.items.reduce((acc, item) => acc + item.quantity, 0);
  const distinctItems = sale.items.length;
  const receiptNo = sale.receiptNoInt
    ? formatReceiptNo(sale.receiptNoInt)
    : sale.id;
  const payment = sale.paymentMethod
    ? {
        method: sale.paymentMethod,
        ...(sale.paidAmount !== null && sale.paidAmount !== undefined
          ? { paidAmount: round2(toNumber(sale.paidAmount)) }
          : {}),
        ...(sale.changeAmount !== null && sale.changeAmount !== undefined
          ? { changeAmount: round2(toNumber(sale.changeAmount)) }
          : {}),
        ...(sale.cardAmount !== null && sale.cardAmount !== undefined
          ? { cardAmount: round2(toNumber(sale.cardAmount)) }
          : {}),
        ...(sale.cashAmount !== null && sale.cashAmount !== undefined
          ? { cashAmount: round2(toNumber(sale.cashAmount)) }
          : {}),
      }
    : undefined;

  return {
    receiptId: sale.id,
    receiptNo,
    createdAt: sale.createdAt.toISOString(),
    displayDate: formatDate(sale.createdAt),
    displayTime: formatTime(sale.createdAt),
    currency: storeConfig.currency,
    store: {
      name: storeConfig.name,
      ...(storeConfig.address !== undefined
        ? { address: storeConfig.address }
        : {}),
      ...(storeConfig.phone !== undefined ? { phone: storeConfig.phone } : {}),
      ...(storeConfig.taxNumber !== undefined
        ? { taxNumber: storeConfig.taxNumber }
        : {}),
    },
    cashier: {
      id: sale.user.id,
      fullName: sale.user.fullName,
    },
    items,
    itemsSummary: {
      totalQty,
      distinctItems,
    },
    totals: {
      subtotal,
      discount,
      tax,
      total,
    },
    payment,
    footerLines: storeConfig.footerLines ?? [],
  };
}

function cleanOptional(value?: string) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === 'number' ? value : Number(value);
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

function formatTime(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

function parseFooterLines(input?: string) {
  if (!input) {
    return [];
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((line) => String(line).trim()).filter(Boolean);
      }
    } catch {
      // fall through to comma parsing
    }
  }

  return trimmed
    .split(',')
    .map((line) => line.trim())
    .filter(Boolean);
}
