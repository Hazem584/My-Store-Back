import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto): Promise<Product> {
    const data = this.mapCreateData(dto);

    try {
      return await this.prisma.product.create({ data });
    } catch (error) {
      throw this.handleUniqueError(error);
    }
  }

  async findAll(query: QueryProductsDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    if (query.search) {
      const search = query.search.trim();
      if (search.length > 0) {
        where.name = { contains: search, mode: 'insensitive' };
      }
    }

    if (query.lowStock === true) {
      where.stock = { lte: 5 };
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async findByCode(code: string): Promise<Product> {
    const normalized = code?.trim();

    if (!normalized) {
      throw new NotFoundException('Product not found');
    }

    const product = await this.prisma.product.findUnique({
      where: { code: normalized },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    await this.ensureExists(id);

    const data = this.mapUpdateData(dto);

    try {
      return await this.prisma.product.update({
        where: { id },
        data,
      });
    } catch (error) {
      throw this.handleUniqueError(error);
    }
  }

  async remove(id: string): Promise<Product> {
    await this.ensureExists(id);

    try {
      return await this.prisma.product.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Product has sales and cannot be deleted',
        );
      }

      throw error;
    }
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Product not found');
    }
  }

  private mapCreateData(dto: CreateProductDto): Prisma.ProductCreateInput {
    return {
      name: dto.name.trim(),
      price: dto.price,
      stock: dto.stock,
      code: dto.code?.trim() || null,
    };
  }

  private mapUpdateData(dto: UpdateProductDto): Prisma.ProductUpdateInput {
    const data: Prisma.ProductUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (dto.price !== undefined) {
      data.price = dto.price;
    }

    if (dto.stock !== undefined) {
      data.stock = dto.stock;
    }

    if (dto.code !== undefined) {
      data.code = dto.code?.trim() || null;
    }

    return data;
  }

  private handleUniqueError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Product code already exists');
    }

    throw error;
  }
}
