import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BusinessMembersModule } from '../business-members/business-members.module';
import {
  AdminBusinessesController,
  BusinessesController,
  PublicBusinessesController,
} from './businesses.controller';
import { BusinessesService } from './businesses.service';

@Module({
  imports: [AuditModule, BusinessMembersModule],
  controllers: [
    BusinessesController,
    PublicBusinessesController,
    AdminBusinessesController,
  ],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
