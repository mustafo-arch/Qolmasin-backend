import { Module } from '@nestjs/common';
import { BusinessMembersModule } from '../business-members/business-members.module';
import {
  BranchesController,
  PublicBranchesController,
} from './branches.controller';
import { BranchesService } from './branches.service';

@Module({
  imports: [BusinessMembersModule],
  controllers: [BranchesController, PublicBranchesController],
  providers: [BranchesService],
})
export class BranchesModule {}
