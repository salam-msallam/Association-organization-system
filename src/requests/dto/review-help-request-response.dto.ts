import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { BilingualTextResponseDto } from './admin-help-request-detail-response.dto';

export class ReviewHelpRequestDataDto {
  @ApiProperty({ example: 13 })
  id!: number;

  @ApiProperty({ enum: [Status.ACCEPTED, Status.REJECTED] })
  status!: Status;

  @ApiProperty({ type: BilingualTextResponseDto })
  title!: BilingualTextResponseDto;

  @ApiProperty({ type: BilingualTextResponseDto })
  description!: BilingualTextResponseDto;

  @ApiProperty({ example: true })
  isUrgent!: boolean;

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

