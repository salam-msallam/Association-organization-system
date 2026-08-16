import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, IsInt, IsString, Matches, Min } from 'class-validator';
import {
  BilingualTextDto,
  ParseBilingualText,
} from '../../requests/dto/bilingual-text.dto';

export class CreateQuickAidDisbursementDto {
  @ApiProperty({ example: 12, description: 'Internal Beneficiary record ID' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  beneficiaryId!: number;

  @ApiProperty({
    example: '250.00',
    description: 'Positive amount with exactly two decimal places',
  })
  @IsString({ message: 'quick-aid-fund.AMOUNT_MUST_BE_STRING' })
  @Matches(/^(?!0+\.00$)\d{1,8}\.\d{2}$/, {
    message: 'quick-aid-fund.AMOUNT_INVALID',
  })
  amount!: string;

  @ApiProperty({
    type: BilingualTextDto,
    example: {
      ar: 'مساعدة عاجلة لتغطية تكاليف العلاج',
      en: 'Urgent aid to cover treatment costs',
    },
  })
  @IsDefined()
  @ParseBilingualText()
  reason!: BilingualTextDto;
}
