import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '@prisma/client';

class DonorOrphanSummaryDto {
  @ApiProperty({ example: 3 })
  id!: number;

  @ApiProperty({ example: 'Ahmad' })
  firstName!: string;

  @ApiProperty({ example: 'Hassan' })
  lastName!: string;

  @ApiProperty({ example: '2015-04-12T00:00:00.000Z' })
  birthOfDate!: Date;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  gender!: Gender;

  @ApiProperty({ example: 'الصف الرابع', nullable: true })
  class!: unknown;

  @ApiProperty({ example: 'الرسم', nullable: true })
  talent!: unknown;

  @ApiProperty({ example: 'لا توجد أمراض', nullable: true })
  diseases!: unknown;
}

class OrphanSummaryDataDto {
  @ApiProperty({ example: 7 })
  sponsorshipId!: number;

  @ApiProperty({ type: DonorOrphanSummaryDto })
  orphan!: DonorOrphanSummaryDto;
}

export class OrphanSummaryResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'تم جلب معلومات اليتيم المختصرة بنجاح.' })
  message!: string;

  @ApiProperty({ type: OrphanSummaryDataDto })
  data!: OrphanSummaryDataDto;
}
