import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsDecimal } from 'class-validator';

export class CreateDiscountScheduleDto {
  @ApiProperty({ format: 'date-time' })
  @IsDateString({ strict: true })
  startsAt!: string;

  @ApiProperty({ example: '8000.00', type: String })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number'
      ? String(value).trim()
      : value,
  )
  @IsDecimal({ decimal_digits: '0,2', force_decimal: false })
  price!: string;
}
