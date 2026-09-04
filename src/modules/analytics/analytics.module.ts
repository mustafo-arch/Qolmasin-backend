import { Module } from '@nestjs/common';
import { BusinessMembersModule } from '../business-members/business-members.module';
import {
  BusinessAnalyticsController,
  CustomerAnalyticsController,
} from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [BusinessMembersModule],
  controllers: [CustomerAnalyticsController, BusinessAnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
