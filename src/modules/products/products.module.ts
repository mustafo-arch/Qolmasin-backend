import { Module } from '@nestjs/common';
import { BusinessMembersModule } from '../business-members/business-members.module';
import {
  ProductsController,
  PublicProductsController,
} from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [BusinessMembersModule],
  controllers: [ProductsController, PublicProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
