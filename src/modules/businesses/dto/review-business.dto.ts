import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const reviewStatuses = [
  BusinessStatus.VERIFIED,
  BusinessStatus.REJECTED,
  BusinessStatus.SUSPENDED,
] as const;

export class ReviewBusinessDto {
  @ApiProperty({ enum: reviewStatuses })
  @IsIn(reviewStatuses)
  status!: (typeof reviewStatuses)[number];

  @ApiPropertyOptional({
    maxLength: 1000,
    description: 'Required when rejecting or suspending a business',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf(
    (dto: ReviewBusinessDto) =>
      dto.status === BusinessStatus.REJECTED ||
      dto.status === BusinessStatus.SUSPENDED ||
      dto.reason !== undefined,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason?: string;
}
