import { ApiProperty } from '@nestjs/swagger';

export class PaymentIntentResponseDto {
  @ApiProperty({ example: 101 })
  transactionId!: number;

  @ApiProperty({ example: 'pi_123_secret_abc' })
  clientSecret!: string;

  @ApiProperty({ example: '25.00' })
  amount!: string;

  @ApiProperty({ example: 'usd' })
  currency!: string;
}
