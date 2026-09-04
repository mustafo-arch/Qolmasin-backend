import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequestContext } from '../../common/decorators/request-context.decorator';
import type { RequestContextData } from '../../common/decorators/request-context.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompleteOrderDto } from './dto/complete-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { OrdersService } from './orders.service';

@Controller({ path: 'orders', version: '1' })
@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class CustomerOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Atomically reserve one or more offers' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
    @RequestContext() context: RequestContextData,
  ) {
    return this.orders.create(user, dto, context);
  }

  @Get('mine')
  @ApiOperation({ summary: 'List the current customer orders' })
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOrdersDto,
  ) {
    return this.orders.listMine(user.sub, query);
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Get an owned order and pickup code' })
  getMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.orders.getMine(user.sub, orderId);
  }

  @Post(':orderId/cancel')
  @ApiOperation({ summary: 'Cancel an owned active reservation' })
  cancelMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @RequestContext() context: RequestContextData,
  ) {
    return this.orders.cancelMine(user, orderId, context);
  }
}

@Controller({ path: 'businesses/:businessId/orders', version: '1' })
@ApiTags('Business Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class BusinessOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List orders belonging to business branches' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: ListOrdersDto,
  ) {
    return this.orders.listBusiness(user.sub, businessId, query);
  }

  @Post(':orderId/ready')
  @ApiOperation({ summary: 'Mark a reserved order as ready for pickup' })
  ready(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @RequestContext() context: RequestContextData,
  ) {
    return this.orders.markReady(user, businessId, orderId, context);
  }

  @Post(':orderId/complete')
  @ApiOperation({ summary: 'Verify pickup code and complete an order' })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CompleteOrderDto,
    @RequestContext() context: RequestContextData,
  ) {
    return this.orders.complete(user, businessId, orderId, dto, context);
  }
}
