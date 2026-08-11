import { ApiProperty } from '@nestjs/swagger';
import { Gender, OrphanEmergencyCoverageReason, OrphanEmergencyCoverageStatus } from '@prisma/client';

class AdminSponsorshipFundOrphanDto {
  @ApiProperty({ example: 3 })
  id!: number;

  @ApiProperty({ example: 'Ahmad' })
  firstName!: string;

  @ApiProperty({ example: 'Ali' })
  lastName!: string;

  @ApiProperty({ example: 'Mohammad' })
  fatherName!: string;

  @ApiProperty({ example: 'Fatima' })
  motherName!: string;

  @ApiProperty({ example: '2015-04-12T00:00:00.000Z' })
  birthOfDate!: Date;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  gender!: Gender;
}

class AdminSponsorshipFundListMetaDto {
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

class AdminSponsorshipFundSummaryDto {
  @ApiProperty({ example: '1250.00' })
  currentBalance!: string;

  @ApiProperty({ example: '3000.00' })
  totalDonations!: string;

  @ApiProperty({ example: '1750.00' })
  totalDistributed!: string;

  @ApiProperty({ example: 4 })
  activeCoverages!: number;

  @ApiProperty({ example: 12 })
  totalSupportedOrphans!: number;
}

export class AdminSponsorshipFundSummaryResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Sponsorship fund summary fetched successfully.' })
  message!: string;

  @ApiProperty({ type: AdminSponsorshipFundSummaryDto })
  data!: AdminSponsorshipFundSummaryDto;
}

class AdminSponsorshipFundCoverageDto {
  @ApiProperty({ example: 7 })
  id!: number;

  @ApiProperty({ example: 3 })
  orphanId!: number;

  @ApiProperty({ example: 12 })
  sponsorshipId!: number;

  @ApiProperty({ example: '10.00' })
  originalAmount!: string;

  @ApiProperty({ example: '5.00' })
  monthlySupport!: string;

  @ApiProperty({ example: 1 })
  supportedMonths!: number;

  @ApiProperty({
    enum: OrphanEmergencyCoverageStatus,
    example: OrphanEmergencyCoverageStatus.ACTIVE,
  })
  status!: OrphanEmergencyCoverageStatus;

  @ApiProperty({
    enum: OrphanEmergencyCoverageReason,
    example: OrphanEmergencyCoverageReason.PAYMENT_INTERRUPTED,
  })
  reason!: OrphanEmergencyCoverageReason;

  @ApiProperty({ example: '2026-07-20T00:00:00.000Z' })
  startDate!: Date;

  @ApiProperty({ example: null, nullable: true })
  endDate!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: AdminSponsorshipFundOrphanDto })
  orphan!: AdminSponsorshipFundOrphanDto;
}

export class AdminSponsorshipFundCoveragesResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Sponsorship fund coverages fetched successfully.' })
  message!: string;

  @ApiProperty({ type: [AdminSponsorshipFundCoverageDto] })
  data!: AdminSponsorshipFundCoverageDto[];

  @ApiProperty({ type: AdminSponsorshipFundListMetaDto })
  meta!: AdminSponsorshipFundListMetaDto;
}

class AdminSponsorshipFundSupportDto {
  @ApiProperty({ example: 18 })
  id!: number;

  @ApiProperty({ example: 7 })
  coverageId!: number;

  @ApiProperty({ example: '5.00' })
  amount!: string;

  @ApiProperty({ example: '1245.00' })
  balanceAfter!: string;

  @ApiProperty({ example: '2026-07-20T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ type: AdminSponsorshipFundOrphanDto })
  orphan!: AdminSponsorshipFundOrphanDto;
}

export class AdminSponsorshipFundSupportsResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Sponsorship fund supports fetched successfully.' })
  message!: string;

  @ApiProperty({ type: [AdminSponsorshipFundSupportDto] })
  data!: AdminSponsorshipFundSupportDto[];

  @ApiProperty({ type: AdminSponsorshipFundListMetaDto })
  meta!: AdminSponsorshipFundListMetaDto;
}
