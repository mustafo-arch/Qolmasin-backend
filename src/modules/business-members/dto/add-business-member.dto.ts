import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessMemberRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { normalizeEmail } from '../../auth/dto/transformers';
import { BusinessPermission } from '../business-permission.enum';

export class AddBusinessMemberDto {
  @ApiProperty({ example: 'staff@example.com' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ enum: [BusinessMemberRole.MANAGER, BusinessMemberRole.STAFF] })
  @IsIn([BusinessMemberRole.MANAGER, BusinessMemberRole.STAFF])
  role!: 'MANAGER' | 'STAFF';

  @ApiPropertyOptional({ enum: BusinessPermission, isArray: true })
  @IsEnum(BusinessPermission, { each: true })
  @ArrayMaxSize(20)
  @IsOptional()
  permissions?: BusinessPermission[];
}
