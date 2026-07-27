import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsDefined, IsIn, ValidateIf } from 'class-validator';
import {
  BilingualTextDto,
  ParseBilingualText,
} from '../../requests/dto/bilingual-text.dto';

export class ReviewBeneficiaryDto {
  @ApiProperty({ enum: [Status.ACCEPTED, Status.REJECTED] })
  @Transform((params: TransformFnParams): unknown => {
    const value: unknown = params.value;
    return typeof value === 'string' ? value.toUpperCase() : value;
  })
  @IsIn([Status.ACCEPTED, Status.REJECTED])
  status!: Status;

  @ApiPropertyOptional({
    type: BilingualTextDto,
    description: 'Required only when status is REJECTED',
    example: {
      ar: 'الوثائق غير مكتملة',
      en: 'The documents are incomplete',
    },
  })
  @ValidateIf((dto: ReviewBeneficiaryDto) => dto.status === Status.REJECTED)
  @IsDefined()
  @ParseBilingualText()
  rejectionReason?: BilingualTextDto;
}
