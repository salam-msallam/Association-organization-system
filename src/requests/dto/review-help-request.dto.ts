import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Status } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDefined, IsIn, ValidateIf } from 'class-validator';
import { BilingualTextDto, ParseBilingualText } from './bilingual-text.dto';

export class ReviewHelpRequestDto {
  @ApiProperty({ enum: [Status.ACCEPTED, Status.REJECTED] })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsIn([Status.ACCEPTED, Status.REJECTED])
  status!: Status;

  @ApiProperty({ type: BilingualTextDto })
  @IsDefined()
  @ParseBilingualText()
  title!: BilingualTextDto;

  @ApiProperty({ type: BilingualTextDto })
  @IsDefined()
  @ParseBilingualText()
  description!: BilingualTextDto;

  @ApiProperty({ example: true })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isUrgent!: boolean;

  @ApiPropertyOptional({
    type: BilingualTextDto,
    description: 'Required only when status is REJECTED',
  })
  @ValidateIf((dto: ReviewHelpRequestDto) => dto.status === Status.REJECTED)
  @IsDefined()
  @ParseBilingualText()
  rejectionReason?: BilingualTextDto;
}
