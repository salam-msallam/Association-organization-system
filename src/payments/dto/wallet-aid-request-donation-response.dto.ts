import { ApiProperty } from '@nestjs/swagger';

export class WalletAidRequestDonationResponseDto {
  @ApiProperty({ example: 101 })
  walletTransactionId!: number;

  @ApiProperty({ example: '25.00' })
  donatedAmount!: string;

  @ApiProperty({ example: '75.00' })
  balanceAfter!: string;

  @ApiProperty({ example: 13 })
  requestId!: number;

  @ApiProperty({ example: '65.00' })
  currentPayment!: string;

  @ApiProperty({ example: '35.00' })
  remainingAmount!: string;

  @ApiProperty({ example: '65.00' })
  compliancePercentage!: string;
}
