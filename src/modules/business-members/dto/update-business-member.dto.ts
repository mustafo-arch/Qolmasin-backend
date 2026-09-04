import { ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessMemberRole, BusinessMemberStatus } from '@prisma/client';
import { ArrayMaxSize, IsEnum, IsIn, IsOptional } from 'class-validator';
import { BusinessPermission } from '../business-permission.enum';

export class UpdateBusinessMemberDto {
  @ApiPropertyOptional({
    enum: [BusinessMemberRole.MANAGER, BusinessMemberRole.STAFF],
  })
  @IsIn([BusinessMemberRole.MANAGER, BusinessMemberRole.STAFF])
  @IsOptional()
  role?: 'MANAGER' | 'STAFF';

  @ApiPropertyOptional({
    enum: [BusinessMemberStatus.ACTIVE, BusinessMemberStatus.SUSPENDED],
  })
  @IsIn([BusinessMemberStatus.ACTIVE, BusinessMemberStatus.SUSPENDED])
  @IsOptional()
  status?: 'ACTIVE' | 'SUSPENDED';

  @ApiPropertyOptional({ enum: BusinessPermission, isArray: true })
  @IsEnum(BusinessPermission, { each: true })
  @ArrayMaxSize(20)
  @IsOptional()
  permissions?: BusinessPermission[];
}
