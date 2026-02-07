import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleByCodeDto } from './dto/create-sale-by-code.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CreateSaleItemDto } from './dto/create-sale-item.dto';
import type { PaymentInput } from './payment.validator';
import { validateAndBuildPayment } from './payment.validator';
import { getNextReceiptNumber } from './receipt-counter';
import { buildReceipt, getStoreConfigFromEnv } from './receipt.builder';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSaleDto) {
    return this.createSale(userId, dto.items, dto);
  }

  async createByCode(userId: string, dto: CreateSaleByCodeDto) {
    const code = dto.code.trim();

    const product = await this.prisma.product.findUnique({
      where: { code },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const items: CreateSaleItemDto[] = [
      {
        productId: product.id,
        quantity: dto.quantity,
        unitPriceOverride: dto.unitPriceOverride,
      },
    ];

    return this.createSale(userId, items, dto);
  }

  async today() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const sales = await this.prisma.sale.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalAmount = new Prisma.Decimal(0);
    let itemsCount = 0;

    for (const sale of sales) {
      totalAmount = totalAmount.add(sale.totalAmount);
      for (const item of sale.items) {
        itemsCount += item.quantity;
      }
    }

    return {
      data: sales,
      summary: {
        totalAmount,
        itemsCount,
      },
    };
  }

  async findOne(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    return sale;
  }

  async getReceipt(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    const storeConfig = getStoreConfigFromEnv();
    const receipt = buildReceipt(sale, storeConfig);

    return receipt;
  }

  async remove(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id },
        include: {
          items: true,
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
      });

      if (!sale) {
        throw new NotFoundException('Sale not found');
      }

      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      return tx.sale.delete({
        where: { id: sale.id },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
      });
    });
  }

  private async createSale(
    userId: string,
    items: CreateSaleItemDto[],
    paymentInput: PaymentInput,
  ) {
    const storeConfig = getStoreConfigFromEnv();

    return this.prisma.$transaction(async (tx) => {
      const productIds = [...new Set(items.map((item) => item.productId))];

      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });

      if (products.length !== productIds.length) {
        const foundIds = new Set(products.map((product) => product.id));
        const missingId = productIds.find((id) => !foundIds.has(id));
        throw new NotFoundException(
          `Product not found: ${missingId ?? 'unknown'}`,
        );
      }

      const productMap = new Map(
        products.map((product) => [product.id, product]),
      );
      const requiredQty = new Map<string, number>();

      for (const item of items) {
        requiredQty.set(
          item.productId,
          (requiredQty.get(item.productId) ?? 0) + item.quantity,
        );
      }

      for (const [productId, qty] of requiredQty) {
        const updateResult = await tx.product.updateMany({
          where: {
            id: productId,
            stock: { gte: qty },
          },
          data: {
            stock: { decrement: qty },
          },
        });

        if (updateResult.count === 0) {
          const product = productMap.get(productId);
          throw new BadRequestException(
            `Insufficient stock for ${product?.name ?? 'product'}`,
          );
        }
      }

      let subtotalAmount = new Prisma.Decimal(0);
      const itemsData: Prisma.SaleItemCreateWithoutSaleInput[] = items.map(
        (item) => {
          const product = productMap.get(item.productId);
          if (!product) {
            throw new NotFoundException('Product not found');
          }

          const unitPrice = item.unitPriceOverride
            ? new Prisma.Decimal(item.unitPriceOverride)
            : product.price;
          const lineTotal = unitPrice.mul(item.quantity);

          subtotalAmount = subtotalAmount.add(lineTotal);

          return {
            product: { connect: { id: product.id } },
            quantity: item.quantity,
            unitPrice,
            lineTotal,
          };
        },
      );

      const discountAmount = new Prisma.Decimal(
        paymentInput.discountAmount ?? 0,
      );
      if (discountAmount.isNegative()) {
        throw new BadRequestException('discountAmount must be >= 0.');
      }
      if (discountAmount.gt(subtotalAmount)) {
        throw new BadRequestException('discountAmount must be <= subtotal.');
      }

      const taxAmount = new Prisma.Decimal(0);
      const totalAmount = subtotalAmount.minus(discountAmount).plus(taxAmount);

      const payment = validateAndBuildPayment(paymentInput, totalAmount);
      const receiptNoInt = await getNextReceiptNumber(tx);

      const sale = await tx.sale.create({
        data: {
          user: { connect: { id: userId } },
          totalAmount,
          receiptNoInt,
          paymentMethod: payment.paymentMethod,
          paidAmount: payment.paidAmount,
          cashAmount: payment.cashAmount,
          cardAmount: payment.cardAmount,
          changeAmount: payment.changeAmount,
          discountAmount,
          taxAmount,
          items: { create: itemsData },
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
      });

      const receipt = buildReceipt(sale, storeConfig);

      return { sale, receipt };
    });
  }
}
