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
import { RequestContext } from '../../common/decorators/request-context.decorator';
import type { RequestContextData } from '../../common/decorators/request-context.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessMembersService } from './business-members.service';
import { AddBusinessMemberDto } from './dto/add-business-member.dto';
import { UpdateBusinessMemberDto } from './dto/update-business-member.dto';

@Controller({ path: 'businesses/:businessId/members', version: '1' })
@ApiTags('Business Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class BusinessMembersController {
  constructor(private readonly members: BusinessMembersService) {}

  @Post()
  @ApiOperation({ summary: 'Add an existing verified user to a business' })
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: AddBusinessMemberDto,
    @RequestContext() context: RequestContextData,
  ) {
    return this.members.add(user, businessId, dto, context);
  }

  @Get()
  @ApiOperation({ summary: 'List business members' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: PaginationDto,
  ) {
    return this.members.list(user.sub, businessId, query);
  }

  @Patch(':memberId')
  @ApiOperation({ summary: 'Update a non-owner membership' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateBusinessMemberDto,
    @RequestContext() context: RequestContextData,
  ) {
    return this.members.update(user, businessId, memberId, dto, context);
  }
}
