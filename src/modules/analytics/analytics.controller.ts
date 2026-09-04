import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@Controller({ path: 'analytics', version: '1' })
@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class CustomerAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('me/impact')
  @ApiOperation({ summary: 'Get customer savings and rescued food impact' })
  impact(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.customerImpact(user.sub);
  }
}

@Controller({ path: 'businesses/:businessId/analytics', version: '1' })
@ApiTags('Business Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class BusinessAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get sales, savings, stock and offer analytics' })
  overview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ) {
    return this.analytics.businessOverview(user.sub, businessId);
  }
}
