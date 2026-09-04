import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

function trimValue({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function upperValue({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export class CreateBranchDto {
  @ApiProperty({ example: 'Chilonzor filiali' })
  @Transform(trimValue)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 'Bunyodkor ko‘chasi 1' })
  @Transform(trimValue)
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  address!: string;

  @ApiProperty({ example: 'UZ' })
  @Transform(upperValue)
  @Matches(/^[A-Z]{2}$/)
  countryCode!: string;

  @ApiPropertyOptional({ example: 'Toshkent' })
  @Transform(trimValue)
  @IsString()
  @MaxLength(120)
  @IsOptional()
  region?: string;

  @ApiProperty({ example: 'Toshkent' })
  @Transform(trimValue)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city!: string;

  @ApiPropertyOptional({ example: 'Chilonzor' })
  @Transform(trimValue)
  @IsString()
  @MaxLength(120)
  @IsOptional()
  district?: string;

  @ApiProperty({ example: 41.2856 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: 69.2034 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiPropertyOptional({ example: '+998901234567' })
  @Matches(/^\+[1-9]\d{7,14}$/)
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'Asia/Tashkent' })
  @IsString()
  @MaxLength(64)
  timezone!: string;

  @ApiProperty({ example: 'UZS' })
  @Transform(upperValue)
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @ApiPropertyOptional({ example: '08:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  @IsOptional()
  openingTime?: string;

  @ApiPropertyOptional({ example: '22:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  @IsOptional()
  closingTime?: string;
}
