import { ApiProperty } from '@nestjs/swagger';
import { CancellationSource, Status } from '@prisma/client';

class CancelledSponsorshipDataDto {
  @ApiProperty({ example: 4 })
  id!: number;

  @ApiProperty({ example: 19 })
  donorId!: number;

  @ApiProperty({ example: null, nullable: true })
  orphanId!: number | null;

  @ApiProperty({ enum: Status, example: Status.CANCELLED })
  status!: Status;

  @ApiProperty({ example: null, nullable: true })
  startDate!: Date | null;

  @ApiProperty({ example: null, nullable: true })
  endDate!: Date | null;

  @ApiProperty({ example: '2026-07-31T12:00:00.000Z' })
  cancelledAt!: Date;

  @ApiProperty({
    enum: CancellationSource,
    example: CancellationSource.DONOR,
  })
  cancellationSource!: CancellationSource;

  @ApiProperty({ example: false })
  orphanReleased!: boolean;
}

export class CancelSponsorshipResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'تم إلغاء الكفالة بنجاح.' })
  message!: string;

  @ApiProperty({ type: CancelledSponsorshipDataDto })
  data!: CancelledSponsorshipDataDto;
}
