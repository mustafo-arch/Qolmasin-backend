import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const trimValue = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ListAuditLogsDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'BUSINESS_STATUS_CHANGED' })
  @Transform(trimValue)
  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Z][A-Z0-9_]*$/)
  @IsOptional()
  action?: string;

  @ApiPropertyOptional({ example: 'BUSINESS' })
  @Transform(trimValue)
  @IsString()
  @MaxLength(80)
  @Matches(/^[A-Z][A-Z0-9_]*$/)
  @IsOptional()
  entityType?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  entityId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  actorUserId?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsDateString({ strict: true })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsDateString({ strict: true })
  @IsOptional()
  to?: string;
}
