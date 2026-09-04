import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, Product, ProductStatus } from '@prisma/client';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BusinessAccessService } from '../business-members/business-access.service';
import { BusinessPermission } from '../business-members/business-permission.enum';
import { CreateProductDto } from './dto/create-product.dto';
import { ListPublicProductsDto } from './dto/list-public-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BusinessAccessService,
  ) {}

  async create(userId: string, businessId: string, dto: CreateProductDto) {
    await this.access.requireManager(
      userId,
      businessId,
      BusinessPermission.PRODUCT_WRITE,
    );
    await this.requireActiveCategory(dto.categoryId);
    const product = await this.prisma.product.create({
      data: {
        businessId,
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        ...(dto.regularPrice !== undefined
          ? { regularPrice: new Prisma.Decimal(dto.regularPrice) }
          : {}),
        ...(dto.quantityUnit !== undefined
          ? { quantityUnit: dto.quantityUnit }
          : {}),
      },
    });
    return this.toResponse(product);
  }

  async listManaged(
    userId: string,
    businessId: string,
    pagination: PaginationDto,
  ) {
    await this.access.requireMembership(userId, businessId);
    const where: Prisma.ProductWhereInput = { businessId, deletedAt: null };
    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return paginate(
      products.map((product) => this.toResponse(product)),
      total,
      pagination,
    );
  }

  async listPublic(query: ListPublicProductsDto) {
    const where: Prisma.ProductWhereInput = {
      status: 'ACTIVE',
      deletedAt: null,
      businessId: query.businessId,
      categoryId: query.categoryId,
      business: { status: 'VERIFIED', deletedAt: null },
      category: { status: 'ACTIVE' },
    };
    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: { orderBy: { sortOrder: 'asc' }, take: 5 },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    const data = products.map((product) => ({
      ...this.toResponse(product),
      category: product.category,
      images: product.images.map((image) => ({
        id: image.id,
        url: image.url,
        mimeType: image.mimeType,
        size: image.size,
        sortOrder: image.sortOrder,
      })),
    }));
    return paginate(data, total, query);
  }

  async getPublic(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        status: 'ACTIVE',
        deletedAt: null,
        business: { status: 'VERIFIED', deletedAt: null },
        category: { status: 'ACTIVE' },
      },
      include: {
        business: { select: { id: true, name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!product) throw this.notFound();
    return {
      ...this.toResponse(product),
      business: product.business,
      category: product.category,
      images: product.images.map((image) => ({
        id: image.id,
        url: image.url,
        mimeType: image.mimeType,
        size: image.size,
        sortOrder: image.sortOrder,
      })),
    };
  }

  async update(
    userId: string,
    businessId: string,
    productId: string,
    dto: UpdateProductDto,
  ) {
    const member = await this.access.requireManager(
      userId,
      businessId,
      BusinessPermission.PRODUCT_WRITE,
    );
    const existing = await this.prisma.product.findFirst({
      where: { id: productId, businessId, deletedAt: null },
    });
    if (!existing) throw this.notFound();

    this.assertStatusTransition(existing.status, dto.status);
    const categoryId = dto.categoryId ?? existing.categoryId;
    if (dto.categoryId || dto.status === 'ACTIVE') {
      await this.requireActiveCategory(categoryId);
    }
    if (dto.status === 'ACTIVE' && member.business.status !== 'VERIFIED') {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'PRODUCT_BUSINESS_NOT_VERIFIED',
        'Only a verified business can activate products',
      );
    }

    const product = await this.prisma.product.update({
      where: { id: existing.id },
      data: {
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        status: dto.status,
        ...(dto.regularPrice !== undefined
          ? { regularPrice: new Prisma.Decimal(dto.regularPrice) }
          : {}),
        ...(dto.quantityUnit !== undefined
          ? { quantityUnit: dto.quantityUnit }
          : {}),
      },
    });
    return this.toResponse(product);
  }

  private assertStatusTransition(current: ProductStatus, next?: ProductStatus) {
    if (!next || next === current) return;
    if (current === ProductStatus.ARCHIVED) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'PRODUCT_ARCHIVED',
        'Archived products cannot be reactivated',
      );
    }
  }

  private async requireActiveCategory(categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!category) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'PRODUCT_CATEGORY_INVALID',
        'An active category is required',
      );
    }
  }

  private toResponse(product: Product) {
    return {
      id: product.id,
      businessId: product.businessId,
      categoryId: product.categoryId,
      name: product.name,
      description: product.description,
      regularPrice: product.regularPrice?.toFixed(2) ?? null,
      quantityUnit: product.quantityUnit,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private notFound() {
    return new AppException(
      HttpStatus.NOT_FOUND,
      'PRODUCT_NOT_FOUND',
      'Product not found',
    );
  }
}
