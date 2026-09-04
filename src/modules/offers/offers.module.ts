import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BusinessMembersModule } from '../business-members/business-members.module';
import {
  BusinessOffersController,
  AdminOffersController,
  PublicOffersController,
} from './offers.controller';
import { OffersService } from './offers.service';

@Module({
  imports: [AuditModule, BusinessMembersModule],
  controllers: [
    BusinessOffersController,
    PublicOffersController,
    AdminOffersController,
  ],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
