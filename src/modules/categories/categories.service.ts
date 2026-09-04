import { HttpStatus, Injectable } from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';
import { RequestContextData } from '../../common/decorators/request-context.decorator';
import { paginate } from '../../common/dto/pagination.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { normalizeSlug } from '../../common/utils/slug.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditAction, AuditEntityType } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ListCategoriesDto } from './dto/list-categories.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listPublic(query: ListCategoriesDto) {
    const where: Prisma.CategoryWhereInput = {
      status: 'ACTIVE',
      ...(query.parentId ? { parentId: query.parentId } : {}),
    };
    const [categories, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.category.count({ where }),
    ]);
    return paginate(
      categories.map((category) => this.toResponse(category)),
      total,
      query,
    );
  }

  async create(
    actor: AuthenticatedUser,
    dto: CreateCategoryDto,
    context: RequestContextData = {},
  ) {
    await this.assertValidParent(dto.parentId);
    const slug = dto.slug ?? normalizeSlug(dto.name);
    if (!slug) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'CATEGORY_SLUG_REQUIRED',
        'A Latin slug is required for this category name',
      );
    }
    try {
      const category = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.category.create({
          data: {
            name: dto.name,
            slug,
            description: dto.description,
            parentId: dto.parentId,
            sortOrder: dto.sortOrder,
          },
        });
        await this.audit.record(transaction, {
          actorUserId: actor.sub,
          actorRole: actor.role,
          action: AuditAction.CATEGORY_CREATED,
          entityType: AuditEntityType.CATEGORY,
          entityId: created.id,
          requestId: context.requestId,
          ip: context.ip,
          metadata: { parentId: created.parentId ?? null },
        });
        return created;
      });
      return this.toResponse(category);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'CATEGORY_SLUG_EXISTS',
          'Category slug already exists',
        );
      }
      throw error;
    }
  }

  async update(
    actor: AuthenticatedUser,
    categoryId: string,
    dto: UpdateCategoryDto,
    context: RequestContextData = {},
  ) {
    const existing = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!existing) throw this.notFound();
    await this.assertValidParent(dto.parentId, categoryId);
    try {
      const category = await this.prisma.$transaction(async (transaction) => {
        const updated = await transaction.category.update({
          where: { id: categoryId },
          data: {
            name: dto.name,
            slug: dto.slug,
            description: dto.description,
            parentId: dto.parentId,
            sortOrder: dto.sortOrder,
            status: dto.status,
          },
        });
        await this.audit.record(transaction, {
          actorUserId: actor.sub,
          actorRole: actor.role,
          action: AuditAction.CATEGORY_UPDATED,
          entityType: AuditEntityType.CATEGORY,
          entityId: categoryId,
          requestId: context.requestId,
          ip: context.ip,
          metadata: {
            changedFields: Object.entries(dto)
              .filter(([, value]) => value !== undefined)
              .map(([key]) => key),
          },
        });
        return updated;
      });
      return this.toResponse(category);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'CATEGORY_SLUG_EXISTS',
          'Category slug already exists',
        );
      }
      throw error;
    }
  }

  private async assertValidParent(parentId?: string, categoryId?: string) {
    if (!parentId) return;
    if (parentId === categoryId) throw this.invalidParent();

    let currentId: string | null = parentId;
    for (let depth = 0; depth < 5; depth += 1) {
      const parent: { parentId: string | null } | null =
        await this.prisma.category.findUnique({
          where: { id: currentId },
          select: { parentId: true },
        });
      if (!parent) throw this.invalidParent();
      if (!parent.parentId) return;
      if (parent.parentId === categoryId) throw this.invalidParent();
      currentId = parent.parentId;
    }
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      'CATEGORY_MAX_DEPTH_EXCEEDED',
      'Category nesting cannot exceed five levels',
    );
  }

  private toResponse(category: Category) {
    return {
      id: category.id,
      parentId: category.parentId,
      name: category.name,
      slug: category.slug,
      description: category.description,
      status: category.status,
      sortOrder: category.sortOrder,
    };
  }

  private notFound() {
    return new AppException(
      HttpStatus.NOT_FOUND,
      'CATEGORY_NOT_FOUND',
      'Category not found',
    );
  }

  private invalidParent() {
    return new AppException(
      HttpStatus.BAD_REQUEST,
      'CATEGORY_INVALID_PARENT',
      'Category parent is invalid',
    );
  }
}
