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

export class CreateOfferDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  branchId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: '20000.00', type: String })
  @Transform(moneyToString)
  @IsDecimal({ decimal_digits: '0,2', force_decimal: false })
  originalPrice!: string;

  @ApiProperty({ example: '10000.00', type: String })
  @Transform(moneyToString)
  @IsDecimal({ decimal_digits: '0,2', force_decimal: false })
  discountPrice!: string;

  @ApiPropertyOptional({ enum: OfferType, default: OfferType.SURPLUS })
  @IsEnum(OfferType)
  @IsOptional()
  offerType?: OfferType;

  @ApiPropertyOptional({ example: '4000.00', type: String })
  @Transform(moneyToString)
  @IsDecimal({ decimal_digits: '0,2', force_decimal: false })
  @IsOptional()
  referencePrice?: string;

  @ApiProperty({ minimum: 1, maximum: 100000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  quantity!: number;

  @ApiProperty({ format: 'date-time' })
  @IsDateString({ strict: true })
  pickupStart!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString({ strict: true })
  pickupEnd!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsDateString({ strict: true })
  @IsOptional()
  expiresAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsDateString({ strict: true })
  @IsOptional()
  bestBeforeAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsDateString({ strict: true })
  @IsOptional()
  preparedAt?: string;
}
