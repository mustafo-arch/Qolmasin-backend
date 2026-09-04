import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { ListPublicProductsDto } from './dto/list-public-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller({ path: 'businesses/:businessId/products', version: '1' })
@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a draft business product' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.products.create(user.sub, businessId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List products visible to a business member' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: PaginationDto,
  ) {
    return this.products.listManaged(user.sub, businessId, query);
  }

  @Patch(':productId')
  @ApiOperation({ summary: 'Update a business product' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(user.sub, businessId, productId, dto);
  }
}

@Controller({ path: 'products', version: '1' })
@ApiTags('Products')
export class PublicProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List active products from verified businesses' })
  list(@Query() query: ListPublicProductsDto) {
    return this.products.listPublic(query);
  }

  @Get(':productId')
  @ApiOperation({ summary: 'Get an active public product' })
  get(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.products.getPublic(productId);
  }
}
