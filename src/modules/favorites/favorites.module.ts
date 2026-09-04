import { Module } from '@nestjs/common';
import {
  FavoriteBusinessesController,
  FavoritesController,
} from './favorites.controller';
import { FavoritesService } from './favorites.service';

@Module({
  controllers: [FavoritesController, FavoriteBusinessesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
