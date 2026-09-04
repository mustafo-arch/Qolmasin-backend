import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { BranchStatus } from '@prisma/client';
import { IsIn, IsOptional } from 'class-validator';
import { CreateBranchDto } from './create-branch.dto';

export class UpdateBranchDto extends PartialType(CreateBranchDto) {
  @ApiPropertyOptional({
    enum: [
      BranchStatus.ACTIVE,
      BranchStatus.TEMPORARILY_CLOSED,
      BranchStatus.ARCHIVED,
    ],
  })
  @IsIn([
    BranchStatus.ACTIVE,
    BranchStatus.TEMPORARILY_CLOSED,
    BranchStatus.ARCHIVED,
  ])
  @IsOptional()
  status?: 'ACTIVE' | 'TEMPORARILY_CLOSED' | 'ARCHIVED';
}
