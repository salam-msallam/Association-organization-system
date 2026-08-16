import { ApiProperty } from '@nestjs/swagger';

class WalletQuickAidFundDonationDataDto {
  @ApiProperty({ example: 101 })
  walletTransactionId!: number;

  @ApiProperty({ example: '50.00' })
  donatedAmount!: string;

  @ApiProperty({ example: '150.00' })
  balanceAfter!: string;

  @ApiProperty({ example: 'USD' })
  currency!: string;
}

export class WalletQuickAidFundDonationResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({
    example: 'The quick aid fund donation was confirmed successfully.',
  })
  message!: string;

  @ApiProperty({ type: WalletQuickAidFundDonationDataDto })
  data!: WalletQuickAidFundDonationDataDto;
}
