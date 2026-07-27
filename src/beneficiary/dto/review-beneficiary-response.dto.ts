import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@prisma/client';

export class BeneficiaryRejectionReasonResponseDto {
  @ApiProperty({ example: 'الوثائق غير مكتملة' })
  ar!: string;

  @ApiProperty({ example: 'The documents are incomplete' })
  en!: string;
}

export class ReviewBeneficiaryDataDto {
  @ApiProperty({ example: 12, description: 'Beneficiary user account ID' })
  id!: number;

  @ApiProperty({ enum: [Status.ACCEPTED, Status.REJECTED] })
  status!: Status;

  @ApiProperty({
    type: BeneficiaryRejectionReasonResponseDto,
    nullable: true,
  })
  rejectionReason!: BeneficiaryRejectionReasonResponseDto | null;
}

export class ReviewBeneficiaryResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({
    example: 'Beneficiary account status updated successfully.',
  })
  message!: string;

  @ApiProperty({ type: ReviewBeneficiaryDataDto })
  data!: ReviewBeneficiaryDataDto;
}
