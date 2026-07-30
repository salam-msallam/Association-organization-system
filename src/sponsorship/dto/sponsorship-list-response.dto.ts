import { ApiProperty } from '@nestjs/swagger';
import { Gender, Status } from '@prisma/client';

class SponsorshipOrphanSummaryDto {
  @ApiProperty({ example: 5 })
  id!: number;

  @ApiProperty({ example: 'Ahmad' })
  firstName!: string;

  @ApiProperty({ example: 'Ali' })
  lastName!: string;

  @ApiProperty({ example: '2015-04-12T00:00:00.000Z' })
  birthOfDate!: Date;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  gender!: Gender;

  @ApiProperty({ example: 'الصف الخامس', nullable: true })
  class!: unknown;

  @ApiProperty({ example: 'الرسم', nullable: true })
  talent!: unknown;
}

class SponsorshipListItemDto {
  @ApiProperty({ example: 42 })
  id!: number;

  @ApiProperty({ example: 7 })
  donorId!: number;

  @ApiProperty({ example: '10.00' })
  monthlyAmount!: string;

  @ApiProperty({ enum: Status, example: Status.PENDING })
  status!: Status;

  @ApiProperty({ example: null, nullable: true })
  rejectionReason!: unknown;

  @ApiProperty({ example: null, nullable: true })
  startDate!: Date | null;

  @ApiProperty({ example: null, nullable: true })
  endDate!: Date | null;

  @ApiProperty({ example: '2026-07-29T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ type: SponsorshipOrphanSummaryDto, nullable: true })
  orphan!: SponsorshipOrphanSummaryDto | null;
}

export class SponsorshipListResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'تم جلب كفالاتك بنجاح.' })
  message!: string;

  @ApiProperty({ type: [SponsorshipListItemDto] })
  data!: SponsorshipListItemDto[];
}
