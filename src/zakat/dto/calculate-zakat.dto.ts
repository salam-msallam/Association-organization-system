import { ApiProperty } from '@nestjs/swagger';
import { IsDecimal } from 'class-validator';

export class CalculateZakatDto {
  @ApiProperty({
    description:
      'Money amount in USD for MONEY; owned weight in grams for GOLD or SILVER',
    example: '10000.00',
  })
  @IsDecimal({ decimal_digits: '0,2', force_decimal: false })
  amount!: string;

  @ApiProperty({
    description:
      'Current USD price per gram: 24-karat gold for MONEY/GOLD, pure silver for SILVER',
    example: '100.00',
  })
  @IsDecimal({ decimal_digits: '0,6', force_decimal: false })
  gramPrice!: string;
}
