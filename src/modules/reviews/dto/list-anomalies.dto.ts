import { ApiPropertyOptional } from '@nestjs/swagger';
import { PriceAnomalyStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListAnomaliesDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PriceAnomalyStatus })
  @IsEnum(PriceAnomalyStatus)
  @IsOptional()
  status?: PriceAnomalyStatus;
}
