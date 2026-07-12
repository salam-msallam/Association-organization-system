import {
  IsInt,
  IsOptional,
  IsNumber,
  Min,
  IsString,
} from 'class-validator';
import { BaseRequestAidDto } from './base-request.dto';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BilingualTextDto, ParseBilingualText } from './bilingual-text.dto';

export class HousingRequestDto extends BaseRequestAidDto {
  @ApiPropertyOptional({
    type: BilingualTextDto,
    description: 'مطلوب فقط إذا كان subCategoryId يخص "إصلاحات منزلية"',
    example: { ar: 'استئجار شقة صغيرة', en: 'Renting a small apartment' },
  })
  @IsOptional()
  @ParseBilingualText()
  currentHousingSituation?: BilingualTextDto;

  @ApiPropertyOptional({
    description: 'مطلوب فقط إذا كان subCategoryId يخص "مساعدة في إيجار البيت"',
    example: 250,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentRent?: number;

  @ApiPropertyOptional({
    type: BilingualTextDto,
    description: 'مطلوب فقط إذا كان subCategoryId يخص "تأمين منزل"',
    example: { ar: 'دمشق', en: 'Damascus' },
  })
  @IsOptional()
  @ParseBilingualText()
  currentPlaceOfResidence?: BilingualTextDto;

  @ApiPropertyOptional({
    type: BilingualTextDto,
    description: 'مطلوب فقط إذا كان subCategoryId يخص "تأمين منزل"',
    example: {
      ar: 'غير قادر على دفع الإيجار هذا الشهر',
      en: 'Unable to pay rent this month',
    },
  })
  @IsOptional()
  @ParseBilingualText()
  reasonForLock?: BilingualTextDto;

  @ApiPropertyOptional({
    type: BilingualTextDto,
    description: 'مطلوب فقط إذا كان subCategoryId يخص "تأمين منزل"',
    example: {
      ar: 'غرفتان ويحتاج إلى إصلاحات أساسية',
      en: 'Two rooms, needs basic repairs',
    },
  })
  @IsOptional()
  @ParseBilingualText()
  housingSpecifications?: BilingualTextDto;
}