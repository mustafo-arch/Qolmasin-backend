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
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { ListModerationBusinessesDto } from './dto/list-moderation-businesses.dto';
import { ReviewBusinessDto } from './dto/review-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

@Controller({ path: 'businesses', version: '1' })
@ApiTags('Businesses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a business and owner membership' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBusinessDto,
    @RequestContext() context: RequestContextData,
  ) {
    return this.businesses.create(user, dto, context);
  }

  @Get('mine')
  @ApiOperation({ summary: 'List businesses available to the current user' })
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationDto,
  ) {
    return this.businesses.listMine(user.sub, query);
  }

  @Patch(':businessId')
  @ApiOperation({ summary: 'Update an owned business' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: UpdateBusinessDto,
    @RequestContext() context: RequestContextData,
  ) {
    return this.businesses.update(user, businessId, dto, context);
  }

  @Post(':businessId/submit-verification')
  @ApiOperation({ summary: 'Submit a business for moderator verification' })
  submitVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @RequestContext() context: RequestContextData,
  ) {
    return this.businesses.submitForVerification(user, businessId, context);
  }
}

@Controller({ path: 'admin/businesses', version: '1' })
@ApiTags('Admin Businesses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminBusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Get()
  @ApiOperation({ summary: 'List businesses in the moderation queue' })
  list(@Query() query: ListModerationBusinessesDto) {
    return this.businesses.listForModeration(query);
  }

  @Post(':businessId/review')
  @ApiOperation({ summary: 'Review, suspend, or reinstate a business' })
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: ReviewBusinessDto,
    @RequestContext() context: RequestContextData,
  ) {
    return this.businesses.review(user, businessId, dto, context);
  }
}

@Controller({ path: 'businesses', version: '1' })
@ApiTags('Businesses')
export class PublicBusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Get('public/:slug')
  @ApiOperation({ summary: 'Get a verified public business by slug' })
  getPublic(@Param('slug') slug: string) {
    return this.businesses.getPublicBySlug(slug);
  }
}
