import {
  Body,
  Controller,
  Delete,
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
import { AlertsService } from './alerts.service';
import { CreateDealAlertDto } from './dto/create-deal-alert.dto';
import { UpdateDealAlertDto } from './dto/update-deal-alert.dto';

@Controller({ path: 'alerts', version: '1' })
@ApiTags('Deal Alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a personal deal alert' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDealAlertDto,
  ) {
    return this.alerts.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List the current user deal alerts' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationDto) {
    return this.alerts.list(user.sub, query);
  }

  @Patch(':alertId')
  @ApiOperation({ summary: 'Update or enable a deal alert' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('alertId', ParseUUIDPipe) alertId: string,
    @Body() dto: UpdateDealAlertDto,
  ) {
    return this.alerts.update(user.sub, alertId, dto);
  }

  @Delete(':alertId')
  @ApiOperation({ summary: 'Delete a deal alert' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('alertId', ParseUUIDPipe) alertId: string,
  ) {
    return this.alerts.remove(user.sub, alertId);
  }
}
