import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDecimal,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { QuantityUnit } from '@prisma/client';

function trimValue({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateProductDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 'Tandir non' })
  @Transform(trimValue)
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @Transform(trimValue)
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '4000.00', type: String })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number'
      ? String(value).trim()
      : value,
  )
  @IsDecimal({ decimal_digits: '0,2', force_decimal: false })
  @IsOptional()
  regularPrice?: string;

  @ApiPropertyOptional({ enum: QuantityUnit, default: QuantityUnit.PIECE })
  @IsEnum(QuantityUnit)
  @IsOptional()
  quantityUnit?: QuantityUnit;
}
