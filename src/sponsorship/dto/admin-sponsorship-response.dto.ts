import { ApiProperty } from '@nestjs/swagger';
import { CancellationSource, Gender, Status } from '@prisma/client';

class AdminSponsorshipDonorDto {
  @ApiProperty({ example: 3, description: 'Donor record ID' })
  id!: number;

  @ApiProperty({ example: 'Sara' })
  firstName!: string;

  @ApiProperty({ example: 'Ali' })
  lastName!: string;

  @ApiProperty({ example: 'sara@example.com' })
  email!: string;

  @ApiProperty({ example: '934206455' })
  number!: string;
}

class AdminSponsorshipOrphanDto {
  @ApiProperty({ example: 3 })
  id!: number;

  @ApiProperty({ example: 'Ahmad' })
  firstName!: string;

  @ApiProperty({ example: 'Ali' })
  lastName!: string;

  @ApiProperty({
    example: 5,
    minimum: 1,
    maximum: 5,
    description: 'Orphan priority where 5 is the highest priority',
  })
  priority!: number;
}

class AdminSponsorshipOrphanDetailsDto extends AdminSponsorshipOrphanDto {
  @ApiProperty({ example: 'Mohammad' })
  fatherName!: string;

  @ApiProperty({ example: 'Fatima' })
  motherName!: string;

  @ApiProperty({ example: '2015-04-12T00:00:00.000Z' })
  birthOfDate!: Date;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  gender!: Gender;

  @ApiProperty({ example: 'الصف الرابع' })
  class!: unknown;

  @ApiProperty({ example: 'لا توجد أمراض' })
  Diseases!: unknown;

  @ApiProperty({ example: 'uploads/orphans/family-statement.pdf' })
  FamilyStatement!: string;

  @ApiProperty({ example: 3 })
  brotherAndSisterNumber!: number;

  @ApiProperty({ example: 'Mahmoud Hassan' })
  guardianName!: string;

  @ApiProperty({ example: '+963933123456' })
  guaranteedPhone!: string;

  @ApiProperty({ example: 130 })
  bodySize!: number;

  @ApiProperty({ example: 34 })
  shoesSize!: number;

  @ApiProperty({ example: 'دمشق' })
  currentAddress!: unknown;

  @ApiProperty({ example: 'حمص' })
  previousAddress!: unknown;

  @ApiProperty({ example: 'الرسم' })
  talent!: unknown;

  @ApiProperty({ example: true })
  isSupported!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class AdminSponsorshipItemDto {
  @ApiProperty({ example: 5 })
  id!: number;

  @ApiProperty({ example: '10.00' })
  monthlyAmount!: string;

  @ApiProperty({ enum: Status, example: Status.PENDING })
  status!: Status;

  @ApiProperty({ nullable: true })
  rejectionReason!: unknown;

  @ApiProperty({ nullable: true })
  startDate!: Date | null;

  @ApiProperty({ nullable: true })
  endDate!: Date | null;

  @ApiProperty({ enum: CancellationSource, nullable: true })
  cancellationSource!: CancellationSource | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: AdminSponsorshipDonorDto })
  donor!: AdminSponsorshipDonorDto;

  @ApiProperty({ type: AdminSponsorshipOrphanDto, nullable: true })
  orphan!: AdminSponsorshipOrphanDto | null;
}

export class AdminSponsorshipListMetaDto {
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

export class AdminSponsorshipListResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Sponsorship requests fetched successfully.' })
  message!: string;

  @ApiProperty({ type: [AdminSponsorshipItemDto] })
  data!: AdminSponsorshipItemDto[];

  @ApiProperty({ type: AdminSponsorshipListMetaDto })
  meta!: AdminSponsorshipListMetaDto;
}

class AdminSponsorshipDetailItemDto extends AdminSponsorshipItemDto {
  @ApiProperty({ type: AdminSponsorshipOrphanDetailsDto, nullable: true })
  declare orphan: AdminSponsorshipOrphanDetailsDto | null;
}

export class AdminSponsorshipDetailResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'The sponsorship request was fetched successfully.' })
  message!: string;

  @ApiProperty({ type: AdminSponsorshipDetailItemDto })
  data!: AdminSponsorshipDetailItemDto;
}

export class ReviewSponsorshipResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Sponsorship request reviewed successfully.' })
  message!: string;

  @ApiProperty({ type: AdminSponsorshipItemDto })
  data!: AdminSponsorshipItemDto;
}
