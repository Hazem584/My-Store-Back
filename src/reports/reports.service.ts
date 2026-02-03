import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailyReport(dateInput?: string) {
    const { start, end, label } = parseDateRange(dateInput);

    const [salesAgg, itemsAgg, topProductAgg] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { createdAt: { gte: start, lte: end } },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.saleItem.aggregate({
        where: { sale: { createdAt: { gte: start, lte: end } } },
        _sum: { quantity: true },
      }),
      this.prisma.saleItem.groupBy({
        by: ['productId'],
        where: { sale: { createdAt: { gte: start, lte: end } } },
        _sum: { quantity: true, lineTotal: true },
      }),
    ]);

    const productIds = topProductAgg.map((item) => item.productId);
    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true },
        })
      : [];
    const productMap = new Map(products.map((product) => [product.id, product.name]));

    const topProducts = topProductAgg
      .map((item) => ({
        productId: item.productId,
        name: productMap.get(item.productId) ?? 'Unknown',
        quantitySold: toNumber(item._sum.quantity),
        amount: toNumber(item._sum.lineTotal),
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      date: label,
      totalSalesAmount: toNumber(salesAgg._sum.totalAmount),
      totalOrders: salesAgg._count._all,
      totalItemsSold: toNumber(itemsAgg._sum.quantity),
      topProducts,
    };
  }

  async getMonthlyReport(monthInput?: string) {
    const { start, end, label } = parseMonthRange(monthInput);

    const [salesAgg, itemsAgg, sales] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { createdAt: { gte: start, lte: end } },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.saleItem.aggregate({
        where: { sale: { createdAt: { gte: start, lte: end } } },
        _sum: { quantity: true },
      }),
      this.prisma.sale.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { createdAt: true, totalAmount: true },
      }),
    ]);

    const dailyMap = new Map<string, { amount: number; orders: number }>();

    for (const sale of sales) {
      const dateKey = formatDate(sale.createdAt);
      const entry = dailyMap.get(dateKey) ?? { amount: 0, orders: 0 };
      entry.amount += toNumber(sale.totalAmount);
      entry.orders += 1;
      dailyMap.set(dateKey, entry);
    }

    const dailyBreakdown = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({
        date,
        amount: value.amount,
        orders: value.orders,
      }));

    return {
      month: label,
      totalSalesAmount: toNumber(salesAgg._sum.totalAmount),
      totalOrders: salesAgg._count._all,
      totalItemsSold: toNumber(itemsAgg._sum.quantity),
      dailyBreakdown,
    };
  }
}

function parseDateRange(dateInput?: string) {
  if (dateInput) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput.trim());
    if (!match) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (!isValidDateParts(year, month, day)) {
      throw new BadRequestException('Invalid date value.');
    }

    const start = new Date(year, month - 1, day, 0, 0, 0, 0);
    const end = new Date(year, month - 1, day, 23, 59, 59, 999);

    return { start, end, label: dateInput.trim() };
  }

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  return { start, end, label: formatDate(now) };
}

function parseMonthRange(monthInput?: string) {
  if (monthInput) {
    const match = /^(\d{4})-(\d{2})$/.exec(monthInput.trim());
    if (!match) {
      throw new BadRequestException('Invalid month format. Use YYYY-MM.');
    }

    const year = Number(match[1]);
    const month = Number(match[2]);

    if (!isValidMonth(year, month)) {
      throw new BadRequestException('Invalid month value.');
    }

    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    return { start, end, label: monthInput.trim() };
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  return { start, end, label: formatMonth(year, month) };
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatMonth(year: number, month: number) {
  return `${year}-${pad(month)}`;
}

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

function isValidDateParts(year: number, month: number, day: number) {
  if (!isValidMonth(year, month)) {
    return false;
  }

  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function isValidMonth(year: number, month: number) {
  return year >= 1970 && month >= 1 && month <= 12;
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === 'number' ? value : Number(value);
}
