import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { IsDefined, IsIn, IsInt, Min, ValidateIf } from 'class-validator';
import {
  BilingualTextDto,
  ParseBilingualText,
} from '../../requests/dto/bilingual-text.dto';

export class ReviewSponsorshipDto {
  @ApiProperty({ enum: [Status.ACCEPTED, Status.REJECTED] })
  @Transform((params: TransformFnParams): unknown => {
    const value: unknown = params.value;
    return typeof value === 'string' ? value.toUpperCase() : value;
  })
  @IsIn([Status.ACCEPTED, Status.REJECTED])
  status!: Status;

  @ApiPropertyOptional({
    example: 3,
    description: 'Required only when status is ACCEPTED',
  })
  @ValidateIf((dto: ReviewSponsorshipDto) => dto.status === Status.ACCEPTED)
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orphanId?: number;

  @ApiPropertyOptional({
    type: BilingualTextDto,
    description: 'Required only when status is REJECTED',
    example: {
      ar: 'لا يوجد يتيم مناسب حالياً',
      en: 'No suitable orphan is currently available',
    },
  })
  @ValidateIf((dto: ReviewSponsorshipDto) => dto.status === Status.REJECTED)
  @IsDefined()
  @ParseBilingualText()
  rejectionReason?: BilingualTextDto;
}
