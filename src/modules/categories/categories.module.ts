import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import {
  AdminCategoriesController,
  PublicCategoriesController,
} from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  imports: [AuditModule],
  controllers: [PublicCategoriesController, AdminCategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
