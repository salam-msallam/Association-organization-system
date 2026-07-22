import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { BilingualTextResponseDto } from './admin-help-request-detail-response.dto';

export class ReviewHelpRequestDataDto {
  @ApiProperty({ example: 13 })
  id!: number;

  @ApiProperty({ enum: [Status.ACCEPTED, Status.REJECTED] })
  status!: Status;

  @ApiProperty({ type: BilingualTextResponseDto, nullable: true })
  title!: BilingualTextResponseDto | null;

  @ApiProperty({ type: BilingualTextResponseDto, nullable: true })
  description!: BilingualTextResponseDto | null;

  @ApiProperty({ example: true })
  isUrgent!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'uploads/request-media/donor-facing.png',
  })
  donorImageUrl!: string | null;

  @ApiProperty({ type: BilingualTextResponseDto, nullable: true })
  rejectionReason!: BilingualTextResponseDto | null;

  @ApiProperty({ type: String, format: 'date-time' })
  reviewedAt!: Date;
}

export class ReviewHelpRequestResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({
    example: 'Assistance request status updated successfully.',
  })
  message!: string;

  @ApiProperty({ type: ReviewHelpRequestDataDto })
  data!: ReviewHelpRequestDataDto;
}

