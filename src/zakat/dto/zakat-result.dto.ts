import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ZakatType } from '../zakat-type.enum';

export class ZakatResultDto {
  @ApiProperty({
    enum: [ZakatType.MONEY, ZakatType.GOLD, ZakatType.SILVER],
    enumName: 'ZakatType',
  })
  type!: ZakatType;

  @ApiProperty()
  eligible!: boolean;

  @ApiPropertyOptional()
  amount?: string;

  @ApiProperty({ enum: ['USD', 'GRAMS'] })
  amountUnit!: 'USD' | 'GRAMS';

  @ApiProperty()
  nisabAmount!: string;

  @ApiProperty({ enum: ['USD', 'GRAMS'] })
  nisabUnit!: 'USD' | 'GRAMS';

  @ApiProperty()
  gramPrice!: string;

  @ApiProperty()
  assetValue!: string;

  @ApiProperty({ example: '0.025' })
  zakatRate!: string;

  @ApiProperty()
  zakatDue!: string;

  @ApiProperty({ example: 'USD' })
  currency!: 'USD';

  @ApiProperty()
  message!: string;
}
