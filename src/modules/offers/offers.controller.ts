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
import { UserRole } from '@prisma/client';
import { RequestContext } from '../../common/decorators/request-context.decorator';
import type { RequestContextData } from '../../common/decorators/request-context.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateOfferDto } from './dto/create-offer.dto';
import { CreateDiscountScheduleDto } from './dto/create-discount-schedule.dto';
import { CreateQuickOfferDto } from './dto/create-quick-offer.dto';
import { ListOffersDto } from './dto/list-offers.dto';
import { NearbyOffersDto } from './dto/nearby-offers.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { OffersService } from './offers.service';

@Controller({ path: 'businesses/:businessId/offers', version: '1' })
@ApiTags('Business Offers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class BusinessOffersController {
  constructor(private readonly offers: OffersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a draft offer' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateOfferDto,
    @RequestContext() context: RequestContextData,
  ) {
    return this.offers.create(user, businessId, dto, context);
  }

  @Post('quick')
  @ApiOperation({ summary: 'Create a one-tap last-minute offer' })
  createQuick(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateQuickOfferDto,
    @RequestContext() context: RequestContextData,
  ) {
    return this.offers.createQuick(user, businessId, dto, context);
  }

  @Get()
  @ApiOperation({ summary: 'List offers for a business member' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: ListOffersDto,
  ) {
    return this.offers.listManaged(user.sub, businessId, query);
  }

  @Patch(':offerId')
  @ApiOperation({ summary: 'Update a draft offer' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: UpdateOfferDto,
    @RequestContext() context: RequestContextData,
  ) {
    return this.offers.update(user, businessId, offerId, dto, context);
  }

  @Post(':offerId/publish')
  @ApiOperation({ summary: 'Publish a validated draft offer' })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @RequestContext() context: RequestContextData,
  ) {
    return this.offers.publish(user, businessId, offerId, context);
  }

  @Post(':offerId/discount-schedules')
  @ApiOperation({ summary: 'Schedule a future discount price' })
  addDiscountSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: CreateDiscountScheduleDto,
    @RequestContext() context: RequestContextData,
  ) {
    return this.offers.addDiscountSchedule(
      user,
      businessId,
      offerId,
      dto,
      context,
    );
  }

  @Post(':offerId/cancel')
  @ApiOperation({ summary: 'Cancel a business offer' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @RequestContext() context: RequestContextData,
  ) {
    return this.offers.cancel(user, businessId, offerId, context);
  }
}

@Controller({ path: 'offers', version: '1' })
@ApiTags('Offers')
export class PublicOffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  @ApiOperation({ summary: 'List currently available public offers' })
  list(@Query() query: ListOffersDto) {
    return this.offers.listPublic(query);
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Find available offers within a radius' })
  nearby(@Query() query: NearbyOffersDto) {
    return this.offers.nearby(query);
  }

  @Get('ending-soon')
  @ApiOperation({ summary: 'List offers ending soon' })
  endingSoon(@Query() query: ListOffersDto) {
    return this.offers.listPublic({
      ...query,
      endingSoon: true,
      sort: 'expires',
    });
  }

  @Get('biggest-discounts')
  @ApiOperation({ summary: 'List offers with the biggest discounts' })
  biggestDiscounts(@Query() query: ListOffersDto) {
    return this.offers.listPublic({ ...query, sort: 'discount' });
  }

  @Get('new')
  @ApiOperation({ summary: 'List newly published offers' })
  newest(@Query() query: ListOffersDto) {
    return this.offers.listPublic({ ...query, sort: 'newest' });
  }

  @Get('popular')
  @ApiOperation({ summary: 'List popular offers by sold quantity' })
  popular(@Query() query: ListOffersDto) {
    return this.offers.listPublic({ ...query, sort: 'popular' });
  }

  @Get('recommended')
  @ApiOperation({ summary: 'List rule-based recommended offers' })
  recommended(@Query() query: ListOffersDto) {
    return this.offers.listPublic({ ...query, sort: 'popular' });
  }

  @Get(':offerId/price-history')
  @ApiOperation({ summary: 'Get transparent offer price history' })
  priceHistory(@Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.offers.getPublicPriceHistory(offerId);
  }

  @Get(':offerId')
  @ApiOperation({ summary: 'Get a public offer' })
  get(@Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.offers.getPublic(offerId);
  }
}

@Controller({ path: 'admin/offers', version: '1' })
@ApiTags('Admin Offers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminOffersController {
  constructor(private readonly offers: OffersService) {}

  @Post(':offerId/hide')
  @ApiOperation({ summary: 'Hide an offer from the public marketplace' })
  hide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @RequestContext() context: RequestContextData,
  ) {
    return this.offers.moderateVisibility(user, offerId, true, context);
  }

  @Post(':offerId/unhide')
  @ApiOperation({ summary: 'Restore a moderated offer to the marketplace' })
  unhide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @RequestContext() context: RequestContextData,
  ) {
    return this.offers.moderateVisibility(user, offerId, false, context);
  }
}
