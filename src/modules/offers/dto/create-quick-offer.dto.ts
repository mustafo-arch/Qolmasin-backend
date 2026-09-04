import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OfferType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsDecimal,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

const moneyToString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : value;

export class CreateQuickOfferDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  branchId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: '10000.00', type: String })
  @Transform(moneyToString)
  @IsDecimal({ decimal_digits: '0,2', force_decimal: false })
  discountPrice!: string;

  @ApiProperty({ minimum: 1, maximum: 100000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  quantity!: number;

  @ApiPropertyOptional({ minimum: 5, maximum: 1440, default: 120 })
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(1440)
  @IsOptional()
  durationMinutes = 120;

  @ApiPropertyOptional({ enum: OfferType, default: OfferType.LAST_MINUTE })
  @IsEnum(OfferType)
  @IsOptional()
  offerType = OfferType.LAST_MINUTE;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsDateString({ strict: true })
  @IsOptional()
  bestBeforeAt?: string;
}
