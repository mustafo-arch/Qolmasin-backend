import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';

export class CompleteOrderDto {
  @ApiProperty({ example: 'QOL-583102' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^QOL-\d{6}$/)
  pickupCode!: string;
}
