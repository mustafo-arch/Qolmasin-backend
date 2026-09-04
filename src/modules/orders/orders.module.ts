import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BusinessMembersModule } from '../business-members/business-members.module';
import {
  BusinessOrdersController,
  CustomerOrdersController,
} from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuditModule, BusinessMembersModule],
  controllers: [CustomerOrdersController, BusinessOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
