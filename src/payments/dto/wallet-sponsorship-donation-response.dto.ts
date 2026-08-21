import { ApiProperty } from '@nestjs/swagger';

class WalletSponsorshipDonationDataDto {
  @ApiProperty({ example: 115 })
  walletTransactionId!: number;

  @ApiProperty({ example: 5 })
  sponsorshipId!: number;

  @ApiProperty({ example: '10.00' })
  paidAmount!: string;

  @ApiProperty({ example: '90.00' })
  balanceAfter!: string;

  @ApiProperty({ example: '2026-08' })
  coveredMonth!: string;

  @ApiProperty({ example: '2026-09', nullable: true })
  nextDueMonth!: string | null;

  @ApiProperty({ example: true })
  hasAnotherDuePayment!: boolean;

  @ApiProperty({ example: '2026-07-25T10:00:00.000Z' })
  paidAt!: Date;
}

export class WalletSponsorshipDonationResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({
    example: 'The sponsorship payment was confirmed successfully.',
  })
  message!: string;

  @ApiProperty({ type: WalletSponsorshipDonationDataDto })
  data!: WalletSponsorshipDonationDataDto;
}
