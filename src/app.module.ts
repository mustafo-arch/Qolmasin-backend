import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envValidation } from './config/env.validation';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { BranchesModule } from './modules/branches/branches.module';
import { AuditModule } from './modules/audit/audit.module';
import { BusinessMembersModule } from './modules/business-members/business-members.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ProductsModule } from './modules/products/products.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { OffersModule } from './modules/offers/offers.module';
import { OrdersModule } from './modules/orders/orders.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AlertsModule } from './modules/alerts/alerts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: envValidation }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'global',
          ttl: config.get<number>('GLOBAL_RATE_LIMIT_TTL_MS', 60_000),
          limit: config.get<number>('GLOBAL_RATE_LIMIT', 100),
        },
      ],
    }),
    PrismaModule,
    AuthModule,
    AuditModule,
    BusinessesModule,
    BusinessMembersModule,
    FavoritesModule,
    BranchesModule,
    CategoriesModule,
    ProductsModule,
    UploadsModule,
    OffersModule,
    OrdersModule,
    NotificationsModule,
    ReviewsModule,
    AnalyticsModule,
    AlertsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
