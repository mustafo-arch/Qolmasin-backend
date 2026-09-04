import { ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListModerationBusinessesDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: BusinessStatus,
    default: BusinessStatus.PENDING_REVIEW,
  })
  @IsEnum(BusinessStatus)
  @IsOptional()
  status: BusinessStatus = BusinessStatus.PENDING_REVIEW;
}
