import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class DonateWalletToAidRequestDto {
  @ApiProperty({
    example: '25.00',
    minimum: 0.01,
    description: 'Wallet donation amount in USD with exactly two decimal places.',
  })
  @IsString({ message: 'payments.PAYMENT_AMOUNT_MUST_BE_STRING' })
  @Matches(/^(?!0+\.00$)\d+\.\d{2}$/, {
    message: 'payments.PAYMENT_AMOUNT_MUST_BE_POSITIVE_TWO_DECIMAL_PLACES',
  })
  amount!: string;
}
