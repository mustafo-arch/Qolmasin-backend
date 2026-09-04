import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'One-time email verification token' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{64}$/)
  token!: string;
}
