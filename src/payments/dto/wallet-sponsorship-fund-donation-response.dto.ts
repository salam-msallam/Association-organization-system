import { ApiProperty } from '@nestjs/swagger';

class WalletSponsorshipFundDonationDataDto {
  @ApiProperty({ example: 101 })
  walletTransactionId!: number;

  @ApiProperty({ example: '50.00' })
  donatedAmount!: string;

  @ApiProperty({ example: '150.00' })
  balanceAfter!: string;

  @ApiProperty({ example: 'USD' })
  currency!: string;
}

export class WalletSponsorshipFundDonationResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({
    example: 'The sponsorship continuity fund donation was confirmed successfully.',
  })
  message!: string;

  @ApiProperty({ type: WalletSponsorshipFundDonationDataDto })
  data!: WalletSponsorshipFundDonationDataDto;
}
