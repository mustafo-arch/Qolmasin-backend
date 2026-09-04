import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BusinessAccessService } from './business-access.service';
import { BusinessMembersController } from './business-members.controller';
import { BusinessMembersService } from './business-members.service';

@Module({
  imports: [AuditModule],
  controllers: [BusinessMembersController],
  providers: [BusinessAccessService, BusinessMembersService],
  exports: [BusinessAccessService],
})
export class BusinessMembersModule {}
