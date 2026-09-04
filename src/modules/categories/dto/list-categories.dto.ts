import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListCategoriesDto extends PaginationDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filter by parent category',
  })
  @IsUUID()
  @IsOptional()
  parentId?: string;
}
