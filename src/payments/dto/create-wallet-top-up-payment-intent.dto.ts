import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class CreateWalletTopUpPaymentIntentDto {
  @ApiProperty({
    example: '50.00',
    minimum: 0.01,
    description: 'Wallet top-up amount in USD, with up to two decimal places.',
  })
  @IsString({ message: 'payments.PAYMENT_AMOUNT_MUST_BE_STRING' })
  @Matches(/^(?!0+(?:\.0{1,2})?$)\d+(?:\.\d{1,2})?$/, {
    message: 'payments.PAYMENT_AMOUNT_MUST_BE_POSITIVE_DECIMAL',
  })
  amount!: string;
}
