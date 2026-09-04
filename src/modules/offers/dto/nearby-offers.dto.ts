import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class NearbyOffersDto extends PaginationDto {
  @ApiProperty({ minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiPropertyOptional({ default: 10, minimum: 0.1, maximum: 100 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0.1)
  @Max(100)
  @IsOptional()
  radius = 10;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  @IsOptional()
  minDiscount = 0;

  @ApiPropertyOptional({ enum: BusinessType })
  @IsEnum(BusinessType)
  @IsOptional()
  businessType?: BusinessType;

  @ApiPropertyOptional({ example: '25000.00', type: String })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999999.99)
  @IsOptional()
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'Return offers ending in the next 24 hours',
  })
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  @IsOptional()
  endingSoon?: boolean;

  @ApiPropertyOptional({ description: 'Compatibility alias for endingSoon' })
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  @IsOptional()
  expiresSoon?: boolean;

  @ApiPropertyOptional({ maxLength: 180 })
  @IsString()
  @MaxLength(180)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    enum: [
      'distance',
      'discount',
      'price',
      'expires',
      'nearest',
      'cheapest',
      'biggest_discount',
      'ending_soon',
      'popular',
      'newest',
    ],
    default: 'distance',
  })
  @Transform(({ value }: { value: unknown }) => {
    const normalized = String(value).toLowerCase();
    return (
      {
        nearest: 'distance',
        cheapest: 'price',
        biggest_discount: 'discount',
        ending_soon: 'expires',
      }[normalized] ?? normalized
    );
  })
  @IsIn(['distance', 'discount', 'price', 'expires', 'popular', 'newest'])
  @IsOptional()
  sort: 'distance' | 'discount' | 'price' | 'expires' | 'popular' | 'newest' =
    'distance';
}
