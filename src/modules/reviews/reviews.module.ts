import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import {
  PublicReviewsController,
  ReportsController,
  AdminTrustController,
} from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [AuditModule],
  controllers: [
    PublicReviewsController,
    ReportsController,
    AdminTrustController,
  ],
  providers: [ReviewsService],
})
export class ReviewsModule {}
