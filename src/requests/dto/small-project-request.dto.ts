import { IsString, IsInt, Min } from 'class-validator';
import { BaseRequestAidDto } from './base-request.dto';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { BilingualTextDto, ParseBilingualText } from './bilingual-text.dto';

export class SmallProjectRequestDto extends BaseRequestAidDto {
  @ApiProperty({
    type: BilingualTextDto,
    example: { ar: 'مخبز منزلي', en: 'Home bakery' },
  })
  @ParseBilingualText()
  projectName: BilingualTextDto;

  @ApiProperty({
    type: BilingualTextDto,
    example: { ar: 'إنتاج غذائي', en: 'Food production' },
  })
  @ParseBilingualText()
  projectCategory: BilingualTextDto;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numberOfPeopleSupported: number;
}
