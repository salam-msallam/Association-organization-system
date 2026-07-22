import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { BilingualTextDto, ParseBilingualText } from './bilingual-text.dto';

export class ReviewHelpRequestDto {
  @ApiProperty({ enum: [Status.ACCEPTED, Status.REJECTED] })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsIn([Status.ACCEPTED, Status.REJECTED])
  status!: Status;

  @ApiProperty({
    type: BilingualTextDto,
    description: 'Required only when status is ACCEPTED',
  })
  @ValidateIf((dto: ReviewHelpRequestDto) => dto.status === Status.ACCEPTED)
  @IsDefined()
  @ParseBilingualText()
  title?: BilingualTextDto;

  @ApiProperty({
    type: BilingualTextDto,
    description: 'Required only when status is ACCEPTED',
  })
  @ValidateIf((dto: ReviewHelpRequestDto) => dto.status === Status.ACCEPTED)
  @IsDefined()
  @ParseBilingualText()
  description?: BilingualTextDto;

  @ApiProperty({
    example: true,
    description: 'Required only when status is ACCEPTED',
  })
  @ValidateIf((dto: ReviewHelpRequestDto) => dto.status === Status.ACCEPTED)
  @IsDefined()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return value === true || value === 'true';
  })
  @IsBoolean()
  isUrgent?: boolean;

  @ApiHideProperty()
  @ValidateIf((dto: ReviewHelpRequestDto) => dto.status === Status.ACCEPTED)
  @IsOptional()
  @IsString()
  donorImageUrl?: string;

  @ApiPropertyOptional({
    type: BilingualTextDto,
    description: 'Required only when status is REJECTED',
  })
  @ValidateIf((dto: ReviewHelpRequestDto) => dto.status === Status.REJECTED)
  @IsDefined()
  @ParseBilingualText()
  rejectionReason?: BilingualTextDto;
}
