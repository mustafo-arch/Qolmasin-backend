import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CategoryStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateCategoryDto } from './create-category.dto';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @ApiPropertyOptional({ enum: CategoryStatus })
  @IsEnum(CategoryStatus)
  @IsOptional()
  status?: CategoryStatus;
}
