import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { normalizeEmail } from './transformers';

export class LoginDto {
  @ApiProperty({ example: '+998901234567' })
  @Transform(normalizeEmail)
  @IsString()
  @MaxLength(254)
  identifier!: string;

  @ApiProperty({ minLength: 1, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: 'Chrome on Windows' })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  deviceName?: string;
}
