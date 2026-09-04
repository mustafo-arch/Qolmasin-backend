import { ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessType, OfferStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListOffersDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ enum: OfferStatus })
  @IsEnum(OfferStatus)
  @IsOptional()
  status?: OfferStatus;

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

  @ApiPropertyOptional({ description: 'Only offers ending soon' })
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
    enum: ['expires', 'discount', 'price', 'newest', 'popular'],
    default: 'expires',
  })
  @IsEnum(['expires', 'discount', 'price', 'newest', 'popular'])
  @IsOptional()
  sort?: 'expires' | 'discount' | 'price' | 'newest' | 'popular';
}
