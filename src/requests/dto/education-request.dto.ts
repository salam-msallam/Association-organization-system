import { IsEnum, IsString } from 'class-validator';
import { AcademicAchievement } from '@prisma/client';
import { BaseRequestAidDto } from './base-request.dto';
import { ApiProperty } from '@nestjs/swagger';
import { BilingualTextDto, ParseBilingualText } from './bilingual-text.dto';


export class EducationRequestDto extends BaseRequestAidDto {
  @ApiProperty({ enum: AcademicAchievement, example: AcademicAchievement.BACHELOR })
  @IsEnum(AcademicAchievement)
  academicAchievement: AcademicAchievement;

  @ApiProperty({
    type: BilingualTextDto,
    example: { ar: 'جامعة دمشق', en: 'Damascus University' },
  })
  @ParseBilingualText()
  institutionName: BilingualTextDto;

  @ApiProperty({ example: '2026' })
  @IsString()
  year: string;
}
