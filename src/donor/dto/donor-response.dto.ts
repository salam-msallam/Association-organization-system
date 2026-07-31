import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';

export class AdminDonorListItemDto {
  @ApiProperty({ example: 3 })
  donorId!: number;

  @ApiProperty({ example: 7 })
  userId!: number;

  @ApiProperty({ example: 'Ahmad' })
  firstName!: string;

  @ApiProperty({ example: 'Saleh' })
  lastName!: string;

  @ApiProperty({ example: 'ahmad@example.com' })
  email!: string;

  @ApiProperty({ example: '959522414' })
  number!: string;

  @ApiProperty({ example: '+963' })
  countryCode!: string;

  @ApiProperty({ example: 'syria' })
  countryName!: string;

  @ApiProperty({ example: true })
  isSponsor!: boolean;

  @ApiProperty({ example: '2026-07-20T09:30:00.000Z' })
  createdAt!: Date;
}

export class AdminDonorListMetaDto {
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

export class AdminDonorListResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Donors fetched successfully.' })
  message!: string;

  @ApiProperty({ type: [AdminDonorListItemDto] })
  data!: AdminDonorListItemDto[];

  @ApiProperty({ type: AdminDonorListMetaDto })
  meta!: AdminDonorListMetaDto;
}

export class DonorHistoryAidRequestDto {
  @ApiProperty({ example: 13 })
  id!: number;

  @ApiProperty({
    example: { ar: 'عملية جراحية عاجلة', en: 'Urgent surgery' },
    nullable: true,
  })
  title!: unknown;
}

export class DonorHistoryOrphanDto {
  @ApiProperty({ example: 5 })
  id!: number;

  @ApiProperty({ example: 'Omar' })
  firstName!: string;

  @ApiProperty({ example: 'Hassan' })
  lastName!: string;
}

export class DonorHistoryItemDto {
  @ApiProperty({ example: '50.00' })
  amount!: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.AID_REQUEST_DONATION })
  type!: TransactionType;

  @ApiProperty({ example: '2026-03-15T11:20:00.000Z' })
  createdAt!: Date;

  @ApiPropertyOptional({ type: DonorHistoryAidRequestDto })
  aidRequest?: DonorHistoryAidRequestDto;

  @ApiPropertyOptional({ type: DonorHistoryOrphanDto })
  orphan?: DonorHistoryOrphanDto;
}

export class AdminDonorHistoryResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Donor history fetched successfully.' })
  message!: string;

  @ApiProperty({ type: [DonorHistoryItemDto] })
  data!: DonorHistoryItemDto[];
}
