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
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller({ path: 'businesses/:businessId/branches', version: '1' })
@ApiTags('Branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a business branch' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateBranchDto,
  ) {
    return this.branches.create(user.sub, businessId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List branches visible to a business member' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: PaginationDto,
  ) {
    return this.branches.listManaged(user.sub, businessId, query);
  }

  @Patch(':branchId')
  @ApiOperation({ summary: 'Update a business branch' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branches.update(user.sub, businessId, branchId, dto);
  }
}

@Controller({ path: 'branches', version: '1' })
@ApiTags('Branches')
export class PublicBranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get(':branchId')
  @ApiOperation({ summary: 'Get a public active branch' })
  get(@Param('branchId', ParseUUIDPipe) branchId: string) {
    return this.branches.getPublic(branchId);
  }
}
