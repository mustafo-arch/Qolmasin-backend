import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BusinessMembersModule } from '../business-members/business-members.module';
import { ImageValidationService } from './image-validation.service';
import { StorageService } from './storage.service';
import { MediaController, UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [AuditModule, BusinessMembersModule],
  controllers: [UploadsController, MediaController],
  providers: [UploadsService, StorageService, ImageValidationService],
  exports: [StorageService],
})
export class UploadsModule {}
