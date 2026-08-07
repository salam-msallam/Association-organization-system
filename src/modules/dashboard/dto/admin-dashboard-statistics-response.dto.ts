import { ApiProperty } from '@nestjs/swagger';

export class AnnualDonationDistributionItemDto {
  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: 30000, description: 'Donation amount in USD' })
  amount: number;
}

export class MonthlyDonationDistributionItemDto {
  @ApiProperty({ example: 1, minimum: 1, maximum: 12 })
  month: number;

  @ApiProperty({ example: 200, description: 'Donation amount in USD' })
  amount: number;
}

export class AidRequestCategoryDistributionItemDto {
  @ApiProperty({ example: 1 })
  category_id: number;

  @ApiProperty({ example: 'Medical aid' })
  category: unknown;

  @ApiProperty({ example: 20 })
  count: number;
}

export class SponsorshipStatisticsResponseDto {
  @ApiProperty({ example: 10 })
  accepted: number;

  @ApiProperty({ example: 4 })
  pending: number;

  @ApiProperty({ example: 2 })
  rejected: number;
}

export class OrphanStatisticsResponseDto {
  @ApiProperty({ example: 25 })
  sponsored: number;

  @ApiProperty({ example: 12 })
  not_sponsored: number;
}
