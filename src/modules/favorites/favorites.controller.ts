import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FavoritesService } from './favorites.service';

@Controller({ path: 'favorites', version: '1' })
@ApiTags('Favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get('businesses')
  @ApiOperation({ summary: "List the current user's favorite businesses" })
  listBusinesses(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationDto,
  ) {
    return this.favorites.listBusinesses(user.sub, query);
  }
}

@Controller({ path: 'businesses', version: '1' })
@ApiTags('Favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class FavoriteBusinessesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Post(':businessId/favorite')
  @ApiOperation({ summary: 'Favorite a verified business' })
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ) {
    return this.favorites.addBusiness(user.sub, businessId);
  }

  @Delete(':businessId/favorite')
  @ApiOperation({ summary: 'Remove a business from favorites' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ) {
    return this.favorites.removeBusiness(user.sub, businessId);
  }
}
