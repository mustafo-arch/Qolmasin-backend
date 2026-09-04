import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trimValue = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateDealAlertDto {
  @ApiProperty({
    minimum: -90,
    maximum: 90,
    description: 'Alert centre latitude',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({
    minimum: -180,
    maximum: 180,
    description: 'Alert centre longitude',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'non', maxLength: 180 })
  @Transform(trimValue)
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  @IsOptional()
  productQuery?: string;

  @ApiPropertyOptional({
    description: 'Search radius in kilometres',
    default: 3,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  @Max(100)
  @IsOptional()
  radius = 3;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  @IsOptional()
  minDiscount?: number;

  @ApiPropertyOptional({ example: '3000.00', type: String })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999999.99)
  @IsOptional()
  maxPrice?: number;
}
