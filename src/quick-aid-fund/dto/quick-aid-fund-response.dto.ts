import { ApiProperty } from '@nestjs/swagger';
import { BilingualTextDto } from '../../requests/dto/bilingual-text.dto';

class QuickAidFundSummaryDto {
  @ApiProperty({ example: '1500.00' })
  totalDonations!: string;

  @ApiProperty({ example: '400.00' })
  totalDisbursed!: string;

  @ApiProperty({ example: '1100.00' })
  currentBalance!: string;

  @ApiProperty({ example: 'USD' })
  currency!: string;
}

export class QuickAidFundSummaryResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Quick aid fund summary fetched successfully.' })
  message!: string;

  @ApiProperty({ type: QuickAidFundSummaryDto })
  data!: QuickAidFundSummaryDto;
}

class QuickAidBeneficiaryDto {
  @ApiProperty({ example: 'Ahmad' })
  firstName!: string;

  @ApiProperty({ example: 'Ali' })
  lastName!: string;
}

class QuickAidEmployeeDto extends QuickAidBeneficiaryDto {
  @ApiProperty({ example: 4 })
  id!: number;
}

class QuickAidDisbursementListItemDto {
  @ApiProperty({ example: 12 })
  beneficiaryId!: number;

  @ApiProperty({ type: QuickAidBeneficiaryDto })
  beneficiary!: QuickAidBeneficiaryDto;

  @ApiProperty({ type: QuickAidEmployeeDto })
  employee!: QuickAidEmployeeDto;

  @ApiProperty({ example: '250.00' })
  amount!: string;

  @ApiProperty({ type: BilingualTextDto })
  reason!: BilingualTextDto;
}

class QuickAidPaginationMetaDto {
  @ApiProperty({ example: 25 })
  totalCount!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;

  @ApiProperty({ example: true })
  hasNextPage!: boolean;

  @ApiProperty({ example: false })
  hasPreviousPage!: boolean;
}

export class QuickAidDisbursementListResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Quick aid fund disbursements fetched successfully.' })
  message!: string;

  @ApiProperty({ type: [QuickAidDisbursementListItemDto] })
  data!: QuickAidDisbursementListItemDto[];

  @ApiProperty({ type: QuickAidPaginationMetaDto })
  meta!: QuickAidPaginationMetaDto;
}

class CreatedQuickAidDisbursementDto extends QuickAidDisbursementListItemDto {
  @ApiProperty({ example: 30 })
  id!: number;

  @ApiProperty({ example: '850.00' })
  balanceAfter!: string;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ example: '2026-08-16T12:00:00.000Z' })
  createdAt!: Date;
}

export class CreateQuickAidDisbursementResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Quick aid disbursement created successfully.' })
  message!: string;

  @ApiProperty({ type: CreatedQuickAidDisbursementDto })
  data!: CreatedQuickAidDisbursementDto;
}
