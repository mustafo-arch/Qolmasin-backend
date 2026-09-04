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
import { UserRole } from '@prisma/client';
import { RequestContext } from '../../common/decorators/request-context.decorator';
import type { RequestContextData } from '../../common/decorators/request-context.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateReportDto } from './dto/create-report.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { ListReviewsDto } from './dto/list-reviews.dto';
import { ReviewsService } from './reviews.service';
import { ListAnomaliesDto } from './dto/list-anomalies.dto';
import { ListReportsDto } from './dto/list-reports.dto';
import { ReviewReportDto } from './dto/review-report.dto';

@Controller({ path: 'businesses/:businessId/reviews', version: '1' })
@ApiTags('Reviews')
export class PublicReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List published business reviews' })
  list(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: ListReviewsDto,
  ) {
    return this.reviews.list(businessId, query);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Review a business after a completed order' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateReviewDto,
    @RequestContext() context: RequestContextData,
  ) {
    return this.reviews.createReview(user, businessId, dto, context);
  }
}

@Controller({ path: 'reports', version: '1' })
@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post()
  @ApiOperation({ summary: 'Report inaccurate or unsafe marketplace content' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReportDto,
    @RequestContext() context: RequestContextData,
  ) {
    return this.reviews.createReport(user, dto, context);
  }
}

@Controller({ path: 'admin', version: '1' })
@ApiTags('Admin Trust & Safety')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminTrustController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('reports')
  @ApiOperation({ summary: 'List user reports for moderation' })
  reports(@Query() query: ListReportsDto) {
    return this.reviews.listReports(query);
  }

  @Post('reports/:reportId/resolve')
  @ApiOperation({ summary: 'Resolve or dismiss a user report' })
  resolveReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body() dto: ReviewReportDto,
    @RequestContext() context: RequestContextData,
  ) {
    return this.reviews.resolveReport(user, reportId, dto.status, context);
  }

  @Get('price-anomalies')
  @ApiOperation({ summary: 'List suspicious price changes' })
  anomalies(@Query() query: ListAnomaliesDto) {
    return this.reviews.listAnomalies(query);
  }

  @Post('price-anomalies/:anomalyId/resolve')
  @ApiOperation({ summary: 'Mark a price anomaly as resolved' })
  resolveAnomaly(
    @CurrentUser() user: AuthenticatedUser,
    @Param('anomalyId', ParseUUIDPipe) anomalyId: string,
    @RequestContext() context: RequestContextData,
  ) {
    return this.reviews.resolveAnomaly(user, anomalyId, context);
  }
}
