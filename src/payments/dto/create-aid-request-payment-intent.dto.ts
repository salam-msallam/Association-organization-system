import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsPositive } from 'class-validator';

export class CreateAidRequestPaymentIntentDto {
  @ApiProperty({
    example: 25,
    minimum: 0.01,
    description: 'Donation amount in the configured currency major unit.',
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'payments.PAYMENT_AMOUNT_MUST_BE_NUMBER' },
  )
  @IsPositive({ message: 'payments.PAYMENT_AMOUNT_MUST_BE_POSITIVE' })
  amount!: number;
}
