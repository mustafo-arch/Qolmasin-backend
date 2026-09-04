import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const parseBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || typeof value === 'boolean') {
    return value;
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

export class ListNotificationsDto extends PaginationDto {
  @ApiPropertyOptional({ default: false })
  @Transform(parseBoolean)
  @IsBoolean()
  @IsOptional()
  unreadOnly?: boolean;
}
